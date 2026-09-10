'use strict';
const sides = {};
const $ = id => document.getElementById(id);
for (const [key, name, number] of [['front', 'Anverso', 'A'], ['back', 'Reverso', 'B']]) {
  const section = document.createElement('section');
  section.className = 'side'; section.dataset.state = 'empty';
  section.innerHTML = `<div class="side-head"><h2><span>${number}</span>${name}</h2><span class="badge">Sin fotografía</span></div><div class="drop"><div class="empty"><span class="upload-icon" aria-hidden="true">＋</span><div>La carta, por ${key === 'front' ? 'delante' : 'detrás'}</div><p>Arrastra aquí tu fotografía</p></div><canvas hidden aria-label="Fotografía del ${name.toLowerCase()} y contorno, si se detecta"></canvas><label class="choose">Elegir ${name.toLowerCase()}<input aria-label="Elegir fotografía del ${name.toLowerCase()}" type="file" accept="image/jpeg,image/png,image/webp"></label><p class="format">JPG, PNG o WebP · Hasta 20 MB</p></div><div class="actions"><span class="filename">Una foto de una sola carta</span><button type="button" hidden>Quitar</button></div><div class="side-result" role="status"><strong>Pendiente de fotografía</strong><p>Se comprobarán el contorno y la calidad visible.</p></div>`;
  $('workspace').append(section);
  const s = sides[key] = {key, section, seq:0, state:'empty', result:null, worker:null, timer:null};
  s.canvas = section.querySelector('canvas'); s.input = section.querySelector('input'); s.drop = section.querySelector('.drop');
  s.input.addEventListener('change', () => { const f=s.input.files[0]; s.input.value=''; if(f) load(s,f); });
  section.querySelector('button').addEventListener('click', () => reset(s));
  for (const ev of ['dragenter','dragover']) s.drop.addEventListener(ev, e => {e.preventDefault();s.drop.classList.add('drag');});
  s.drop.addEventListener('dragleave', () => s.drop.classList.remove('drag'));
  s.drop.addEventListener('drop', e => {e.preventDefault();s.drop.classList.remove('drag');if(e.dataTransfer.files.length!==1){invalidate(s,'Elige una sola imagen por cara.');return;}load(s,e.dataTransfer.files[0]);});
}
function stop(s){s.seq++;s.worker?.terminate();s.worker=null;clearTimeout(s.timer);}
function reset(s){stop(s);s.result=null;s.hash=null;s.state='empty';s.canvas.hidden=true;s.canvas.width=1;s.canvas.height=1;s.drop.classList.remove('has-image');s.section.querySelector('button').hidden=true;s.section.querySelector('.filename').textContent='Una foto de una sola carta';show(s,'empty','Pendiente de fotografía','Se comprobarán el contorno y la calidad visible.','Sin fotografía');}
function invalidate(s,message){reset(s);show(s,'error','No se ha analizado la imagen',message,'Revisar archivo');}
function show(s,state,title,message,badge){s.state=state;s.section.dataset.state=state;s.section.querySelector('.side-result strong').textContent=title;s.section.querySelector('.side-result p').textContent=message;s.section.querySelector('.badge').textContent=badge;summary();}
function summary(){const all=Object.values(sides);const count=all.filter(s=>s.state==='compatible').length;$('progress').textContent=`${count} / 2`;let title='Empieza por las dos fotografías',text='Añade una foto del anverso y otra del reverso de la misma carta.';if(all.some(s=>s.state==='loading')){title='Comprobando la fotografía…';text='Buscando bordes y revisando la calidad visible.';}else if(all.some(s=>['warning','error'].includes(s.state))){title='Hay una fotografía que necesita revisión';text='Consulta el aviso de cada cara y vuelve a fotografiarla. El resultado no está confirmado.';}else if(count===2){title='Dos contornos compatibles';text='Las comprobaciones básicas no han detectado problemas. Esto no confirma la identidad de la carta ni que ambas caras correspondan a la misma.';}else if(count===1){title='Un contorno compatible. Falta la otra cara.';text='Añade la fotografía pendiente para completar la revisión.';}if(all[0]?.hash && all[0].hash===all[1]?.hash){title='Has añadido la misma fotografía dos veces';text='Fotografía la otra cara de la carta. La revisión de ambas caras está incompleta.';$('progress').textContent=Math.min(count,1)+' / 2';}$('summary-title').textContent=title;$('summary-text').textContent=text;}
async function load(s,file){
  reset(s);const seq=s.seq;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){invalidate(s,'Formato no compatible. Usa una fotografía JPG, PNG o WebP.');return;}
  if(file.size>20*1024*1024){invalidate(s,'La imagen supera 20 MB. Exporta una copia más pequeña.');return;}
  show(s,'loading','Abriendo fotografía…','La imagen se procesa en este dispositivo.','Comprobando');
  let bitmap;
  try{
    bitmap=await createImageBitmap(file);
    if(seq!==s.seq)return;
    if(bitmap.width*bitmap.height>40000000)throw Error('La imagen supera 40 megapíxeles. Reduce su tamaño y vuelve a intentarlo.');
    const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
    s.canvas.width=Math.round(bitmap.width*scale);s.canvas.height=Math.round(bitmap.height*scale);
    const ctx=s.canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#ffffff';ctx.fillRect(0,0,s.canvas.width,s.canvas.height);ctx.drawImage(bitmap,0,0,s.canvas.width,s.canvas.height);
    s.canvas.hidden=false;s.drop.classList.add('has-image');s.section.querySelector('button').hidden=false;s.section.querySelector('.filename').textContent=`${file.name} · ${bitmap.width} × ${bitmap.height} px`;
    const pixels=ctx.getImageData(0,0,s.canvas.width,s.canvas.height);
    if(globalThis.crypto?.subtle){const hash=await crypto.subtle.digest('SHA-256',pixels.data);if(seq!==s.seq)return;s.hash=Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');}
    show(s,'loading','Buscando los cuatro bordes…','La primera comprobación puede tardar mientras se carga el detector.','Comprobando');
    s.worker=new Worker('detector.js');
    const fail=message=>{if(seq!==s.seq)return;stop(s);show(s,'error','Análisis no disponible',message,'Sin resultado');};
    s.timer=setTimeout(()=>fail('El detector ha tardado demasiado. Comprueba tu conexión y vuelve a elegir la foto.'),60000);
    s.worker.onerror=()=>fail('No se pudo iniciar el detector. Comprueba tu conexión y vuelve a elegir la foto.');
    s.worker.onmessage=({data})=>{if(seq!==s.seq)return;if(data.error){fail(data.error);return;}clearTimeout(s.timer);s.worker.terminate();s.worker=null;s.result=data;
      if(data.points){ctx.strokeStyle=data.state==='compatible'?'#dafa76':'#efc47f';ctx.lineWidth=Math.max(3,s.canvas.width/250);ctx.beginPath();data.points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();for(const p of data.points){ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(p.x,p.y,Math.max(4,s.canvas.width/180),0,Math.PI*2);ctx.fill();}}
      show(s,data.state,data.title,data.message,data.state==='compatible'?'Contorno compatible':'Repetir fotografía');
    };
    s.worker.postMessage({pixels,scale},[pixels.data.buffer]);
  }catch(error){if(seq===s.seq)invalidate(s,error.message.startsWith('La imagen supera')?error.message:'No se pudo abrir la fotografía. Prueba con otro archivo JPG, PNG o WebP.');}
  finally{bitmap?.close();}
}
let probe;
function checkEngine(){probe?.terminate();$('retry').hidden=true;$('engine').textContent='Preparando detector…';probe=new Worker('detector.js');const timer=setTimeout(()=>finish(false),45000);function finish(ok){clearTimeout(timer);probe.terminate();$('engine').textContent=ok?'Detector disponible':'Detector no disponible';$('retry').hidden=ok;}probe.onmessage=e=>finish(!e.data.error);probe.onerror=()=>finish(false);probe.postMessage({probe:true});}
$('retry').addEventListener('click',checkEngine);checkEngine();
if(document.modelContext?.registerTool){const lifecycle=new AbortController();try{Promise.resolve(document.modelContext.registerTool({name:'read_card_checks',description:'Read the current front and back photo checks. A compatible contour does not confirm card identity.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(input){if(!input||Object.keys(input).length)throw Error('Expected an empty object');return Object.fromEntries(Object.entries(sides).map(([key,s])=>[key,{state:s.state,result:s.result}]));}},{signal:lifecycle.signal})).catch(()=>{});}catch{}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
