(function(root){
  'use strict';
  const MAX_AGE=1500;
  function guide(w,h){const height=Math.min(h*.76,w*.76/.716),width=height*.716;return {x:(w-width)/2,y:(h-height)/2,width,height};}
  function assess(result,w,h){
    if(!result?.points||result.points.length!==4)return {ok:false,message:'Coloca una sola carta dentro de la guía.'};
    if(result.state!=='compatible'||!result.outlineVerified)return {ok:false,message:result.title==='Calidad insuficiente para continuar'?result.message:'Aún no se distingue bien el borde exterior. Prueba un fondo liso que contraste.'};
    const p=result.points,x=p.reduce((v,p)=>v+p.x,0)/4,y=p.reduce((v,p)=>v+p.y,0)/4;
    if(p.some(p=>p.x<w*.04||p.x>w*.96||p.y<h*.04||p.y>h*.96))return {ok:false,message:'Deja espacio alrededor de toda la carta.'};
    if(Math.abs(x/w-.5)>.07||Math.abs(y/h-.5)>.07)return {ok:false,message:'Mueve la carta hacia el centro de la guía.'};
    const lengths=p.map((a,i)=>Math.hypot(a.x-p[(i+1)%4].x,a.y-p[(i+1)%4].y));
    const shortest=lengths.indexOf(Math.min(...lengths)),a=p[shortest],b=p[(shortest+1)%4];
    if(Math.abs(b.y-a.y)/Math.max(1,lengths[shortest])>.24)return {ok:false,message:'Gira la carta para colocarla vertical, como la guía.'};
    const target=guide(w,h),cardH=Math.max(...lengths);
    if(cardH<target.height*.76)return {ok:false,message:'Acerca un poco la cámara a la carta.'};
    if(cardH>target.height*1.17)return {ok:false,message:'Aleja un poco la cámara para dejar margen.'};
    return {ok:true,message:'Mantén la cámara quieta…',signature:{x:x/w,y:y/h,size:cardH/h,angle:Math.atan2(b.y-a.y,b.x-a.x)}};
  }
  function same(a,b){if(!a||!b)return false;const turn=Math.abs(Math.sin(a.angle-b.angle));return Math.hypot(a.x-b.x,a.y-b.y)<.018&&Math.abs(a.size-b.size)<.025&&turn<.045;}
  function advance(previous,result,w,h,timestamp,now){
    if(now-timestamp>MAX_AGE||timestamp>now)return {count:0,ready:false,message:'Analizando… Mantén la carta quieta.'};
    const check=assess(result,w,h);if(!check.ok)return {count:0,ready:false,message:check.message};
    const continuous=previous?.signature&&timestamp-previous.timestamp<MAX_AGE&&same(previous.signature,check.signature)&&same(previous.anchor,check.signature);
    const count=continuous?previous.count+1:1,start=continuous?previous.start:timestamp;
    const ready=count>=3&&timestamp-start>=650;
    return {...check,count,start,timestamp,anchor:continuous?previous.anchor:check.signature,ready,message:ready?'Centrada y estable. Puedes capturar.':check.message};
  }
  const api={MAX_AGE,guide,assess,advance};if(typeof module==='object'&&module.exports)module.exports=api;else root.CardCameraCore=api;
})(globalThis);
