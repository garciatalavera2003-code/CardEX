(function(){
  'use strict';
  const dialog=document.getElementById('camera-dialog'),video=document.getElementById('camera-video'),overlay=document.getElementById('camera-overlay');
  const status=document.getElementById('camera-status'),capture=document.getElementById('camera-capture'),retry=document.getElementById('camera-retry');
  let current=null,sequence=0;
  function message(text){if(status.textContent!==text)status.textContent=text;}
  function resources(session){clearTimeout(session.next);clearTimeout(session.timeout);clearInterval(session.freshness);session.worker?.terminate();session.stream?.getTracks().forEach(track=>track.stop());session.native.width=1;session.native.height=1;session.accepted=null;}
  function release(){sequence++;if(current){resources(current);current=null;}capture.disabled=true;video.pause();video.srcObject=null;overlay.getContext('2d').clearRect(0,0,overlay.width,overlay.height);}
  function close(){release();if(dialog.open)dialog.close();}
  function paint(result,ready=false){const ctx=overlay.getContext('2d'),w=overlay.width,h=overlay.height;ctx.clearRect(0,0,w,h);const g=CardCameraCore.guide(w,h);ctx.strokeStyle=ready?'#dafa76':'#c4cbd1';ctx.lineWidth=Math.max(2,w/200);ctx.setLineDash([w/45,w/70]);ctx.strokeRect(g.x,g.y,g.width,g.height);ctx.setLineDash([]);
    // This rectangle is a positioning guide, not a detected physical boundary.
    if(result?.outline?.length){ctx.strokeStyle=ready?'#dafa76':'#efc47f';ctx.beginPath();result.outline.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.stroke();}
    dialog.dataset.ready=ready?'true':'false';
  }
  function fail(session,text){if(current!==session)return;resources(session);session.stopped=true;capture.disabled=true;session.gate=null;paint(null);message(text);retry.hidden=false;video.pause();video.srcObject=null;}
  function sample(session){if(current!==session||session.stopped)return;
    if(video.readyState<2||!video.videoWidth){session.next=setTimeout(()=>sample(session),200);return;}
    try{
      const nativeScale=Math.min(1,2048/Math.max(video.videoWidth,video.videoHeight));
      session.native.width=Math.round(video.videoWidth*nativeScale);session.native.height=Math.round(video.videoHeight*nativeScale);
      session.native.getContext('2d').drawImage(video,0,0,session.native.width,session.native.height);
      const scale=Math.min(1,640/Math.max(session.native.width,session.native.height));
      session.sample.width=Math.round(session.native.width*scale);session.sample.height=Math.round(session.native.height*scale);
      if(overlay.width!==session.sample.width||overlay.height!==session.sample.height){overlay.width=session.sample.width;overlay.height=session.sample.height;session.gate=null;paint(null);}
      const ctx=session.sample.getContext('2d',{willReadFrequently:true});ctx.drawImage(session.native,0,0,session.sample.width,session.sample.height);
      const pixels=ctx.getImageData(0,0,session.sample.width,session.sample.height);session.frameTime=performance.now();session.busy=true;
      session.timeout=setTimeout(()=>fail(session,'El análisis tarda demasiado. Puedes cerrar la cámara y usar una fotografía.'),12000);
      session.worker.postMessage({pixels,scale,live:true},[pixels.data.buffer]);
    }catch{fail(session,'No se pudo leer la cámara. Ciérrala y vuelve a intentarlo.');}
  }
  async function open(key){
    release();const token=sequence;const session=current={key,token,native:document.createElement('canvas'),sample:document.createElement('canvas'),gate:null,accepted:null};
    document.getElementById('camera-title').textContent=`Capturar ${key==='front'?'anverso':'reverso'}`;
    retry.hidden=true;capture.disabled=true;message('Permite el acceso a la cámara para empezar.');if(!dialog.open)dialog.showModal();
    if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){fail(session,'La cámara necesita abrir esta web por HTTPS en un navegador compatible. También puedes elegir una foto.');return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'environment'},width:{ideal:1920},height:{ideal:1440}}});
      if(current!==session||token!==sequence){stream.getTracks().forEach(t=>t.stop());return;}
      session.stream=stream;for(const track of stream.getVideoTracks())track.addEventListener('ended',()=>fail(session,'La cámara se ha desconectado. Vuelve a abrirla.'),{once:true});
      video.srcObject=stream;await video.play();if(current!==session)return;
      message('Cargando el detector. Coloca la carta vertical dentro de la guía.');
      session.worker=new Worker('detector.js?v=0.4.0');session.timeout=setTimeout(()=>fail(session,'No se ha podido cargar el detector. Comprueba tu conexión.'),45000);
      session.worker.onerror=()=>fail(session,'El detector no está disponible. Puedes reintentarlo o elegir una foto.');
      session.worker.onmessage=({data})=>{
        if(current!==session||session.stopped)return;clearTimeout(session.timeout);
        if(data.error){fail(session,data.error);return;}
        if(data.ready){sample(session);return;}
        session.busy=false;const now=performance.now();
        session.gate=CardCameraCore.advance(session.gate,data,session.sample.width,session.sample.height,session.frameTime,now);
        session.lastResult=data;paint(data,session.gate.ready);message(session.gate.message);capture.disabled=!session.gate.ready;
        if(session.gate.ready){
          // Save the exact analysed frame, rather than an unverified later frame.
          session.accepted??=document.createElement('canvas');session.accepted.width=session.native.width;session.accepted.height=session.native.height;session.accepted.getContext('2d').drawImage(session.native,0,0);session.acceptedTime=session.frameTime;
        }else session.accepted=null;
        session.next=setTimeout(()=>sample(session),Math.max(80,350-(now-session.frameTime)));
      };
      session.freshness=setInterval(()=>{if(session.accepted&&performance.now()-session.acceptedTime>CardCameraCore.MAX_AGE){capture.disabled=true;session.accepted=null;session.gate=null;paint(session.lastResult);message('Actualizando el encuadre…');}},100);
      session.worker.postMessage({probe:true});
    }catch(error){if(current!==session)return;const text={NotAllowedError:'No has dado permiso para usar la cámara. Puedes permitirlo en el navegador o elegir una foto.',NotFoundError:'No se ha encontrado una cámara. Puedes elegir una fotografía.',NotReadableError:'La cámara está ocupada o no está disponible. Cierra otras aplicaciones e inténtalo de nuevo.'}[error.name]||'No se pudo abrir la cámara. Puedes reintentarlo o elegir una foto.';fail(session,text);}
  }
  capture.addEventListener('click',()=>{const session=current;if(!session?.accepted||capture.disabled||performance.now()-session.acceptedTime>CardCameraCore.MAX_AGE)return;
    const frame=session.accepted;capture.disabled=true;clearTimeout(session.next);clearInterval(session.freshness);session.worker?.terminate();session.stream?.getTracks().forEach(track=>track.stop());message('Guardando el fotograma comprobado…');
    frame.toBlob(blob=>{if(current!==session)return;if(!blob){fail(session,'No se pudo guardar la captura. Vuelve a intentarlo.');return;}const key=session.key;close();load(sides[key],new File([blob],`${key==='front'?'anverso':'reverso'}-camara.jpg`,{type:'image/jpeg'}));},'image/jpeg',.96);
  });
  document.addEventListener('click',e=>{const button=e.target.closest('[data-camera]');if(button)open(button.dataset.camera);});
  document.getElementById('camera-close').addEventListener('click',close);
  retry.addEventListener('click',()=>{if(current)open(current.key);});
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('close',release);
  window.addEventListener('pagehide',close);document.addEventListener('visibilitychange',()=>{if(document.hidden)close();});
})();
