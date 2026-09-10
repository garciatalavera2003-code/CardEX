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
function edgeSupport(points,edges){
  const short=Math.min(...points.map((p,i)=>dist(p,points[(i+1)%4])));
  const radius=Math.max(2,Math.min(8,Math.round(short*.018)));
  return points.map((a,i)=>{const b=points[(i+1)%4];let hits=0;
    for(let j=3;j<61;j++){const x=Math.round(a.x+(b.x-a.x)*j/64),y=Math.round(a.y+(b.y-a.y)*j/64);let found=false;
      for(let dy=-radius;dy<=radius&&!found;dy++)for(let dx=-radius;dx<=radius;dx++){const xx=x+dx,yy=y+dy;if(xx>=0&&yy>=0&&xx<edges.cols&&yy<edges.rows&&edges.data[yy*edges.cols+xx]){found=true;break;}}
      if(found)hits++;
    }return hits/58;
  });
}
function addCandidate(candidates,candidate,pass){
  // Independent settings count once; two sides of the same edge are not two votes.
  const previous=candidates.find(c=>{
    if(dist({x:c.cx,y:c.cy},{x:candidate.cx,y:candidate.cy})>candidate.short*.07||Math.abs(c.area-candidate.area)/candidate.area>.15)return false;
    return candidate.points.every(p=>Math.min(...c.points.map(q=>dist(p,q)))<candidate.short*.10);
  });
  if(previous){previous.passes.add(pass);if(candidate.support>previous.support){Object.assign(previous,candidate,{passes:previous.passes});}}
  else candidates.push({...candidate,passes:new Set([pass])});
}
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
    cv.cvtColor(src,gray,cv.COLOR_RGBA2GRAY);cv.GaussianBlur(gray,blur,new cv.Size(3,3),0);
    const kernel=own(cv.Mat.ones(3,3,cv.CV_8U));const candidates=[];
    const evidence=own(new cv.Mat());cv.Canny(blur,evidence,25,75);
    for(const [low,high] of [[20,60],[35,100],[65,180]]){
      cv.Canny(blur,edges,low,high);cv.morphologyEx(edges,closed,cv.MORPH_CLOSE,kernel);
      const contours=new cv.MatVector(),hierarchy=new cv.Mat();
      try{cv.findContours(closed,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
        for(let i=0;i<contours.size();i++){
          const contour=contours.get(i),approx=new cv.Mat();
          try{const area=Math.abs(cv.contourArea(contour));
            if(cv.arcLength(contour,true)>Math.min(w,h)){
              const box=cv.minAreaRect(contour),points=cv.RotatedRect.points(box),boxArea=box.size.width*box.size.height;
              const candidate=geometry(points,w,h,boxArea);
              if(candidate){const support=edgeSupport(points,evidence);if(Math.min(...support)>=.85)addCandidate(candidates,{...candidate,support:support.reduce((a,b)=>a+b,0)/4},`edge-${low}`);}
            }
            if(area<w*h*.1)continue;
            cv.approxPolyDP(contour,approx,.018*cv.arcLength(contour,true),true);
            if(approx.rows!==4||!cv.isContourConvex(approx))continue;
            const points=Array.from({length:4},(_,j)=>({x:approx.data32S[j*2],y:approx.data32S[j*2+1]}));
            const candidate=geometry(points,w,h,area);if(!candidate)continue;
            // Reject approximations that replace a rounded or irregular object with a rectangle.
            if(Math.abs(cv.contourArea(approx)-area)/area>.055)continue;
            const support=edgeSupport(points,evidence);if(Math.min(...support)<.65)continue;
            addCandidate(candidates,{...candidate,support:support.reduce((a,b)=>a+b,0)/4},`edge-${low}`);
          }finally{contour.delete();approx.delete();}
        }
      }finally{contours.delete();hierarchy.delete();}
    }
    // A patterned background can join Canny edges into a single component.
    // Independently segment light and dark regions at several exposure levels.
    // Hulls only propose candidates: measured edge support is required on EVERY side.
    const mask=own(new cv.Mat());
    const closeSize=Math.max(3,Math.round(Math.min(w,h)*.009)|1);
    const maskKernel=own(cv.Mat.ones(closeSize,closeSize,cv.CV_8U));
    for(const threshold of [55,80,105,130,140,145,150,155,180,205])for(const inverse of [false,true]){
      cv.threshold(gray,mask,threshold,255,inverse?cv.THRESH_BINARY_INV:cv.THRESH_BINARY);
      cv.morphologyEx(mask,mask,cv.MORPH_CLOSE,maskKernel);
      const contours=new cv.MatVector(),hierarchy=new cv.Mat();
      try{cv.findContours(mask,contours,hierarchy,cv.RETR_LIST,cv.CHAIN_APPROX_SIMPLE);
        for(let i=0;i<contours.size();i++){
          const contour=contours.get(i),hull=new cv.Mat(),approx=new cv.Mat();
          try{
            const rawArea=Math.abs(cv.contourArea(contour));
            if(cv.arcLength(contour,true)<Math.min(w,h))continue;
            cv.convexHull(contour,hull);const area=Math.abs(cv.contourArea(hull));
            if(area<w*h*.10)continue;
            // Rounded corners are not the physical corners of a four-point polygon.
            // Propose a surrounding rotated rectangle, then verify all four sides
            // against image edges. Never accept a bounding box based on shape alone.
            const box=cv.minAreaRect(hull),boxArea=box.size.width*box.size.height;
            if(area/boxArea>.76){
              const boxPoints=cv.RotatedRect.points(box);
              const boxCandidate=geometry(boxPoints,w,h,boxArea);
              if(boxCandidate){const support=edgeSupport(boxPoints,evidence);
                if(Math.min(...support)>=.85)addCandidate(candidates,{...boxCandidate,support:support.reduce((a,b)=>a+b,0)/4},`mask-${threshold}`);
              }
            }
            if(rawArea/area<.75)continue;
            cv.approxPolyDP(hull,approx,.025*cv.arcLength(hull,true),true);
            if(approx.rows!==4||!cv.isContourConvex(approx)||Math.abs(cv.contourArea(approx)-area)/area>.13)continue;
            const points=Array.from({length:4},(_,j)=>({x:approx.data32S[j*2],y:approx.data32S[j*2+1]}));
            const candidate=geometry(points,w,h,area);if(!candidate)continue;
            const support=edgeSupport(points,evidence);if(Math.min(...support)<.65)continue;
            addCandidate(candidates,{...candidate,support:support.reduce((a,b)=>a+b,0)/4},`mask-${threshold}`);
          }finally{contour.delete();hull.delete();approx.delete();}
        }
      }finally{contours.delete();hierarchy.delete();}
    }
    // A frame or inner illustration should not hide its enclosing outer contour.
    const stable=candidates.filter(c=>c.passes.size>=2);
    const pool=stable.length?stable:candidates;
    const distinct=pool.filter(c=>!pool.some(outer=>outer!==c&&outer.area>c.area*1.15&&c.points.every(p=>{
      const crosses=outer.points.map((a,i)=>{const b=outer.points[(i+1)%4];return (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);});
      return crosses.every(v=>v>=0)||crosses.every(v=>v<=0);
    })));
    if(!candidates.length)return warning('No se detecta un contorno compatible','No se puede confirmar una carta. Muestra los cuatro bordes, usa un fondo que contraste y toma la foto de frente.');
    if(distinct.length!==1)return warning('Hay varios contornos posibles','No se puede elegir una carta con seguridad. Fotografía una sola carta sobre un fondo liso.');
    const c=distinct[0];
    if(c.clipped)return warning('La carta está demasiado cerca del borde','Deja espacio alrededor de los cuatro lados para descartar un recorte.');
    // A pale card may separate from its background only in a narrow exposure band.
    // Independent edge evidence can support that proposal without requiring two
    // arbitrary threshold crossings. This is coverage, NOT a confidence probability.
    if(c.passes.size<2&&c.support<.97)return warning('Contorno provisional','Hay una forma posible, pero sus cuatro bordes no quedan suficientemente respaldados. El contorno marcado necesita revisión.',c.points);
    if(c.short/scale<200||c.short<120)return warning('Contorno localizado; detalle limitado','Los bordes se han localizado, pero esta copia tiene pocos píxeles para comprobar la nitidez del interior. Esto no significa que el contorno sea incorrecto.',c.points);
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
