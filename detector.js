'use strict';
// No classification or confidence probability is inferred from these geometric checks.
// Thresholds are conservative heuristics, not calibrated against a real-card dataset.
let engine;
function getEngine(){return engine??=(async()=>{
  importScripts('opencv.js');
  const cv=self.cv;
  if(!cv?.Mat)await new Promise((resolve,reject)=>{const start=Date.now();const timer=setInterval(()=>{if(cv?.Mat){clearInterval(timer);resolve();}else if(Date.now()-start>40000){clearInterval(timer);reject(Error('timeout'));}},50);});
  // This OpenCV build exposes a self-resolving thenable; never await or return it.
})();}
self.onmessage=async({data})=>{try{await getEngine();self.postMessage(data.probe?{ready:true}:detect(self.cv,data.pixels,data.scale));}catch{self.postMessage({error:'No se pudo completar la comprobación. Revisa la conexión o prueba otra fotografía. No se ha confirmado ningún resultado.'});}};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function geometry(points,w,h,area){
  const lengths=points.map((p,i)=>dist(p,points[(i+1)%4]));
  const a=(lengths[0]+lengths[2])/2,b=(lengths[1]+lengths[3])/2;
  const ratio=Math.min(a,b)/Math.max(a,b);
  if(ratio<.65||ratio>.79||area/(w*h)<.10||area/(w*h)>.88)return null;
  if(Math.min(lengths[0],lengths[2])/Math.max(lengths[0],lengths[2])<.82||Math.min(lengths[1],lengths[3])/Math.max(lengths[1],lengths[3])<.82)return null;
  for(let i=0;i<4;i++){const p=points[i],prev=points[(i+3)%4],next=points[(i+1)%4];const cos=((prev.x-p.x)*(next.x-p.x)+(prev.y-p.y)*(next.y-p.y))/(dist(prev,p)*dist(next,p));if(Math.abs(cos)>.25)return null;}
  const clipped=points.some(p=>p.x<w*.018||p.y<h*.018||p.x>w*.982||p.y>h*.982);
  return {points,area,short:Math.min(a,b),clipped,cx:points.reduce((s,p)=>s+p.x,0)/4,cy:points.reduce((s,p)=>s+p.y,0)/4};
}
function detect(cv,pixels,scale){
  const allocations=[];const own=m=>(allocations.push(m),m);const w=pixels.width,h=pixels.height;
  const warning=(title,message,points)=>({state:'warning',title,message,...(points?{points}:{})});
  try{
    const src=own(cv.matFromImageData(pixels)),gray=own(new cv.Mat()),blur=own(new cv.Mat()),edges=own(new cv.Mat()),closed=own(new cv.Mat());
    cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);cv.GaussianBlur(gray,blur,new cv.Size(5,5),0);
    const kernel=own(cv.Mat.ones(3,3,cv.CV_8U));const candidates=[];
    for(const [low,high] of [[35,100],[65,180]]){
      cv.Canny(blur,edges,low,high);cv.morphologyEx(edges,closed,cv.MORPH_CLOSE,kernel);
      const contours=new cv.MatVector(),hierarchy=new cv.Mat();
      try{cv.findContours(closed,contours,hierarchy,cv.RETR_EXTERNAL,cv.CHAIN_APPROX_SIMPLE);
        for(let i=0;i<contours.size();i++){
          const contour=contours.get(i),approx=new cv.Mat();
          try{const area=Math.abs(cv.contourArea(contour));if(area<w*h*.1)continue;
            cv.approxPolyDP(contour,approx,.018*cv.arcLength(contour,true),true);
            if(approx.rows!==4||!cv.isContourConvex(approx))continue;
            const points=Array.from({length:4},(_,j)=>({x:approx.data32S[j*2],y:approx.data32S[j*2+1]}));
            const candidate=geometry(points,w,h,area);if(!candidate)continue;
            // Reject approximations that replace a rounded or irregular object with a rectangle.
            if(Math.abs(cv.contourArea(approx)-area)/area>.055)continue;
            const previous=candidates.find(c=>dist({x:c.cx,y:c.cy},{x:candidate.cx,y:candidate.cy})<Math.min(w,h)*.025&&Math.abs(c.area-area)/area<.12);
            if(previous)previous.passes++;else candidates.push({...candidate,passes:1});
          }finally{contour.delete();approx.delete();}
        }
      }finally{contours.delete();hierarchy.delete();}
    }
    if(!candidates.length)return warning('No se detecta un contorno compatible','No se puede confirmar una carta. Muestra los cuatro bordes, usa un fondo que contraste y toma la foto de frente.');
    if(candidates.length>1)return warning('Hay varios contornos posibles','No se puede elegir una carta con seguridad. Fotografía una sola carta sobre un fondo liso.');
    const c=candidates[0];
    if(c.clipped)return warning('La carta está demasiado cerca del borde','Deja espacio alrededor de los cuatro lados para descartar un recorte.');
    if(c.passes<2)return warning('El contorno no es suficientemente estable','Mejora el contraste con el fondo y evita sombras o reflejos. No se ha confirmado el contorno.');
    if(c.short/scale<450||c.short<220)return warning('Resolución insuficiente','Acerca la cámara y utiliza la foto original: el lado corto del objeto debe ocupar al menos 450 píxeles.',c.points);
    // Rectify the candidate to a common scale; measure quality inside it, not on the background.
    let points=c.points.slice();if(dist(points[0],points[1])>dist(points[1],points[2]))points.push(points.shift());
    const from=own(cv.matFromArray(4,1,cv.CV_32FC2,points.flatMap(p=>[p.x,p.y]))),to=own(cv.matFromArray(4,1,cv.CV_32FC2,[0,0,319,0,319,447,0,447]));
    const transform=own(cv.getPerspectiveTransform(from,to)),rectified=own(new cv.Mat());cv.warpPerspective(gray,rectified,transform,new cv.Size(320,448));
    const region=own(rectified.roi(new cv.Rect(16,16,288,416))),roi=own(region.clone()),lap=own(new cv.Mat()),mean=own(new cv.Mat()),std=own(new cv.Mat());
    cv.Laplacian(roi,lap,cv.CV_64F);cv.meanStdDev(lap,mean,std);const sharpness=std.data64F[0]**2;
    let sum=0,dark=0,bright=0;for(const value of roi.data){sum+=value;if(value<24)dark++;if(value>247)bright++;}const avg=sum/roi.data.length;dark/=roi.data.length;bright/=roi.data.length;
    const reasons=[];if(avg<45||dark>.5)reasons.push('La zona de la carta está demasiado oscura. Usa más luz uniforme.');if(avg>225||bright>.30)reasons.push('Hay zonas muy claras o posibles reflejos. Cambia la iluminación.');if(sharpness<85)reasons.push('Falta nitidez o detalle suficiente. Limpia la lente, enfoca la carta y mantén la cámara quieta.');
    if(reasons.length)return warning('Calidad insuficiente para continuar',reasons.join(' '),c.points);
    return {state:'compatible',title:'Contorno compatible con una carta',message:'Cuatro bordes delimitados; sin alertas en las comprobaciones básicas de calidad. La identidad del objeto sigue sin confirmar.',points:c.points};
  }finally{for(const mat of allocations.reverse())mat.delete();}
}
