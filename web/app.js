'use strict';

const $ = id => document.getElementById(id);
const layouts = {
  six: {count:6, columns:2, rows:3, width:1200, height:1570},
  strip: {count:4, columns:1, rows:4, width:680, height:2190},
  four: {count:4, columns:2, rows:2, width:1200, height:1130}
};
const colors = {cream:'#fffaf0', rose:'#efd2d2', sage:'#d9dfcd', blue:'#d6dfea', ink:'#353331'};
const filters = {
  original:'none', warm:'sepia(.2) saturate(1.12) contrast(.96) brightness(1.04)',
  vintage:'sepia(.43) saturate(.72) contrast(.88) brightness(1.06)', mono:'grayscale(1) contrast(1.08)'
};
const poses = ['Your favourite smile.', 'A little shy, a little cute.', 'Get close. A little closer.', 'Your best serious face.', 'One for the silly side.', 'One last moment. Just be you.'];
const state = {layout:'six', color:'cream', filter:'original', photos:Array(6).fill(null), stream:null,
  mode:null, mirrored:true, running:false, runId:0, retake:null, capturedAt:null, demoFrame:0};
let toastTimeout;
let demoAnimation;
let cameraRequest = 0;

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {$('toast').hidden = true;}, 4200);
}
function total() { return layouts[state.layout].count; }
function count() { return state.photos.slice(0,total()).filter(Boolean).length; }
function complete() { return count() === total(); }
function choose(group, button) {
  document.querySelectorAll(group).forEach(el => {
    const active = el === button;
    el.classList.toggle('active',active);
    el.setAttribute('aria-pressed',String(active));
  });
}
function setLiveStyles() {
  $('camera').style.filter = filters[state.filter];
  $('demoCanvas').style.filter = filters[state.filter];
  $('camera').classList.toggle('mirrored',state.mirrored);
}
function lockSettings(locked) {
  document.querySelectorAll('.layout-button, #timer, #uploadButton, #mirrorButton, #useCamera').forEach(el => {el.disabled=locked;});
}
function refresh() {
  const n = total();
  const filled = count();
  $('shotCountLabel').textContent = `${n} little moments`;
  $('filmTray').style.setProperty('--shots',String(n));
  $('filmTray').replaceChildren();
  for(let i=0;i<n;i++) {
    const button=document.createElement('button');
    button.className='film-frame'+(state.photos[i]?' captured':'')+(state.retake===i?' current':'');
    button.disabled=state.running || !state.photos[i];
    if(state.photos[i]) {
      const img=document.createElement('img');
      img.src=state.photos[i].src;
      img.alt=`Photo ${i+1}`;
      img.style.filter=filters[state.filter];
      const label=document.createElement('span');
      label.className='retake-label';label.textContent='Retake';
      button.append(img,label);
      button.setAttribute('aria-label',`Retake photo ${i+1}`);
      button.addEventListener('click',()=>selectRetake(i));
    } else {
      const number=document.createElement('span');
      number.textContent=String(i+1).padStart(2,'0');button.append(number);
      button.setAttribute('aria-label',`Photo ${i+1}, not taken`);
    }
    $('filmTray').append(button);
  }
  const done=complete();
  ['downloadButton','letterButton','printButton'].forEach(id=>{$(id).disabled=!done || state.running;});
  $('startCapture').disabled=!state.mode || state.running || (done && state.retake===null);
  $('startCapture').hidden=state.running;
  $('cancelCapture').hidden=!state.running;
  if(!state.running) {
    if(state.retake!==null) {
      $('sessionTitle').textContent=`Let's try photo ${state.retake+1} again.`;
      $('sessionDescription').textContent='Your other moments are safe.';
      $('captureLabel').textContent=`Retake photo ${state.retake+1}`;
    } else if(done) {
      $('sessionTitle').textContent='A little memory, made.';
      $('sessionDescription').textContent='Tap a photo to retake it, or save your keepsake.';
      $('captureLabel').textContent='All moments captured';
    } else {
      $('sessionTitle').textContent=filled?`${filled} down, ${n-filled} little moments to go.`:'Your seat is ready.';
      $('sessionDescription').textContent=state.mode?`One click. ${n-filled} photos. All the good feelings.`:'Allow your camera, or use your own photos.';
      $('captureLabel').textContent=filled?'Continue photo session':'Start photo session';
    }
    $('finishOverlay').hidden=!done || state.retake!==null;
  }
  $('previewHint').textContent=done?'Made by you. Ready to keep.':filled?`${filled} of ${n} moments, tucked in.`:'A few poses from now, this will be all you.';
  renderSheet();
}

async function enableCamera() {
  if(state.running) return;
  const request=++cameraRequest;
  $('enableCamera').disabled=true;
  $('enableCamera').textContent='Opening your camera…';
  $('cameraError').hidden=true;
  $('viewfinder').classList.remove('error');
  try {
    if(!navigator.mediaDevices?.getUserMedia) throw new Error('unavailable');
    const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:960}},audio:false});
    if(request!==cameraRequest) {stream.getTracks().forEach(t=>t.stop());return;}
    stopCamera();
    cancelAnimationFrame(demoAnimation);
    state.stream=stream;
    const video=$('camera');
    video.srcObject=stream;
    await video.play();
    state.mode='camera';
    $('demoCanvas').hidden=true;
    video.hidden=false;
    $('startScreen').hidden=true;
    $('cameraStatus').textContent='Camera is on';
    $('cameraStatus').classList.add('live');
    $('viewfinderMode').textContent='LIVE VIEW';
    $('viewfinderMode').hidden=false;
    $('mirrorButton').hidden=false;
    $('useCamera').hidden=true;
    $('viewfinderHint').textContent='A good time looks good on you.';
    stream.getVideoTracks()[0].addEventListener('ended',()=>{
      if(state.mode==='camera') {
        cancelSession(false);state.mode=null;state.stream=null;
        $('startScreen').hidden=false;$('cameraStatus').textContent='Camera disconnected';
        $('cameraStatus').classList.remove('live');refresh();
        toast('Camera disconnected. Turn it on again to continue.');
      }
    });
    setLiveStyles();refresh();
  } catch(error) {
    stopCamera();
    $('viewfinder').classList.add('error');
    $('cameraError').hidden=false;
    $('cameraError').textContent=error.name==='NotAllowedError'?'Camera access is blocked. Allow it in your browser settings, or use your own photos below.':error.name==='NotFoundError'?'No camera found. You can upload photos below or try the demo.':'Your camera could not open. Try closing other camera apps, or upload your photos below.';
  } finally {
    $('enableCamera').disabled=false;
    $('enableCamera').innerHTML='<svg><use href="#i-camera"/></svg> Turn on my camera';
  }
}
function stopCamera() {
  if(state.stream) state.stream.getTracks().forEach(track=>track.stop());
  state.stream=null;
}
function startDemo() {
  cameraRequest++;
  stopCamera();
  state.mode='demo';
  $('camera').hidden=true;$('demoCanvas').hidden=false;
  $('startScreen').hidden=true;$('cameraError').hidden=true;
  $('viewfinder').classList.remove('error');
  $('cameraStatus').textContent='Demo studio';$('cameraStatus').classList.remove('live');
  $('viewfinderMode').textContent='DEMO · NO CAMERA';$('viewfinderMode').hidden=false;
  $('mirrorButton').hidden=true;
  $('useCamera').hidden=false;
  $('viewfinderHint').textContent='A little practice, a little play.';
  cancelAnimationFrame(demoAnimation);
  function animate(t) {drawDemo($('demoCanvas'),t/1000);demoAnimation=requestAnimationFrame(animate);}
  demoAnimation=requestAnimationFrame(animate);
  setLiveStyles();refresh();
  toast('Demo mode: try a session with our little studio flowers.');
  $('cameraStatus').title='Tap to use your camera instead';
  $('cameraStatus').style.cursor='pointer';
}
function drawDemo(canvas,time) {
  const c=canvas.getContext('2d');const w=canvas.width,h=canvas.height;
  c.clearRect(0,0,w,h);
  const bg=c.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#e5d5bd');bg.addColorStop(1,'#baa88d');
  c.fillStyle=bg;c.fillRect(0,0,w,h);
  for(let i=0;i<10;i++) {c.fillStyle=i%2?'#e7dac122':'#a7937c0b';c.fillRect(i*w/10,0,w/10,h);}
  c.fillStyle='#b2b19b';c.fillRect(0,h*.76,w,h*.24);
  c.strokeStyle='#f7efdb66';c.lineWidth=2;
  for(let x=0;x<w;x+=50) {c.beginPath();c.moveTo(x,h*.76);c.lineTo(x-200,h);c.stroke();}
  for(let y=h*.78;y<h;y+=30) {c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
  c.fillStyle='#4d584b';c.beginPath();c.ellipse(w*.5,h*.8,w*.15,h*.025,0,0,Math.PI*2);c.fill();
  const sway=Math.sin(time)*8;
  c.strokeStyle='#65714f';c.lineWidth=12;
  [[w*.41+sway,h*.37],[w*.6-sway,h*.31],[w*.52,h*.51]].forEach(([x,y],i)=>{
    c.beginPath();c.moveTo(w*.51,h*.74);c.quadraticCurveTo(x+30,h*.55,x,y);c.stroke();
    c.save();c.translate(x,y);c.rotate(Math.sin(time+i)*.08);
    for(let p=0;p<8;p++) {c.save();c.rotate(p*Math.PI/4);c.fillStyle=i===0?'#f5e5cd':i===1?'#a95b50':'#e4c1b1';c.beginPath();c.ellipse(0,-67,28,55,0,0,Math.PI*2);c.fill();c.restore();}
    c.fillStyle='#ccad67';c.beginPath();c.arc(0,0,49,0,Math.PI*2);c.fill();
    c.fillStyle='#5c4832';c.beginPath();c.arc(-16,-5,4,0,Math.PI*2);c.arc(16,-5,4,0,Math.PI*2);c.fill();
    c.strokeStyle='#5c4832';c.lineWidth=3;c.beginPath();c.arc(0,5,17,.15,Math.PI-.15);c.stroke();c.restore();
  });
  c.fillStyle='#7c8c74';c.beginPath();c.moveTo(w*.41,h*.64);c.lineTo(w*.6,h*.64);c.lineTo(w*.57,h*.81);c.quadraticCurveTo(w*.5,h*.85,w*.44,h*.81);c.closePath();c.fill();
  c.strokeStyle='#aab49b';c.lineWidth=3;c.beginPath();c.moveTo(w*.44,h*.66);c.lineTo(w*.46,h*.79);c.stroke();
  c.fillStyle='#fff6df';c.font='italic 29px Editorial, Georgia';c.textAlign='center';c.fillText('a little room to bloom.',w*.5,h*.94);
}

const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function captureSession() {
  if(state.running || !state.mode) return;
  if(state.mode==='camera' && !$('camera').videoWidth) {toast('Your camera is still getting ready. Try again in a moment.');return;}
  state.running=true;
  $('viewfinder').scrollIntoView({behavior:'smooth',block:'center'});
  const id=++state.runId;
  const indices=state.retake!==null?[state.retake]:Array.from({length:total()},(_,i)=>i).filter(i=>!state.photos[i]);
  lockSettings(true);$('finishOverlay').hidden=true;$('poseOverlay').hidden=false;
  refresh();
  try {
    for(const i of indices) {
      if(id!==state.runId) return;
      $('poseCount').textContent=`POSE ${i+1} OF ${total()}`;
      $('poseText').textContent=poses[i];
      $('sessionTitle').textContent=`Making moment ${i+1} of ${total()}.`;
      $('sessionDescription').textContent='Relax. Make a face. Have a little fun.';
      const frame=$('filmTray').children[i];frame?.classList.add('current');
      for(let s=Number($('timer').value);s>0;s--) {
        if(id!==state.runId) return;
        $('countdown').hidden=false;$('countdown').textContent=String(s);
        $('countdown').classList.remove('tick');void $('countdown').offsetWidth;$('countdown').classList.add('tick');
        await delay(1000);
      }
      if(id!==state.runId) return;
      $('countdown').hidden=true;
      const photo=await takePhoto(i);
      if(id!==state.runId) return;
      state.photos[i]=photo;
      if(!state.capturedAt) state.capturedAt=new Date();
      $('flash').classList.remove('fire');void $('flash').offsetWidth;$('flash').classList.add('fire');
      refresh();await delay(650);
    }
    if(id===state.runId) {
      state.retake=null;
      toast(complete()?'Your keepsake is ready. Make it yours, then save it.':'Moment captured.');
    }
  } catch(error) {
    toast('That photo could not be captured. Check your camera and try again.');
  } finally {
    if(id===state.runId) {
      state.running=false;lockSettings(false);
      $('countdown').hidden=true;$('poseOverlay').hidden=true;
      refresh();
    }
  }
}
async function takePhoto(index) {
  const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;
  const c=canvas.getContext('2d');
  if(state.mode==='demo') {drawDemo(canvas,index*1.7+Math.random());}
  else {
    const video=$('camera');
    if(!video.videoWidth || !state.stream?.active) throw new Error('Camera disconnected');
    c.save();if(state.mirrored) {c.translate(canvas.width,0);c.scale(-1,1);}
    drawCover(c,video,0,0,canvas.width,canvas.height);c.restore();
  }
  const src=canvas.toDataURL('image/jpeg',.94);
  const img=await loadImage(src);
  return {src,img,demo:state.mode==='demo'};
}
function cancelSession(showToast=true) {
  state.runId++;state.running=false;state.retake=null;
  $('countdown').hidden=true;$('poseOverlay').hidden=true;
  lockSettings(false);refresh();
  if(showToast) toast('Session paused. Your captured moments are still here.');
}
function selectRetake(index) {
  if(state.running) return;
  state.retake=index;refresh();
  if(!state.mode) toast('Turn on your camera to retake this photo.');
  $('viewfinder').scrollIntoView({behavior:'smooth',block:'center'});
}
function resetSession() {
  state.photos=Array(6).fill(null);state.retake=null;state.capturedAt=null;
  $('finishOverlay').hidden=true;refresh();
}
function drawCover(c,img,x,y,w,h) {
  const iw=img.videoWidth||img.naturalWidth||img.width,ih=img.videoHeight||img.naturalHeight||img.height;
  const scale=Math.max(w/iw,h/ih);const sw=w/scale,sh=h/scale;
  c.drawImage(img,(iw-sw)/2,(ih-sh)/2,sw,sh,x,y,w,h);
}
function drawBow(c,x,y,size,color) {
  c.save();c.translate(x,y);c.scale(size/100,size/100);c.strokeStyle=color;c.lineWidth=4;
  c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-75,-65,-75,45,0,0);c.bezierCurveTo(75,-65,75,45,0,0);c.moveTo(0,0);c.quadraticCurveTo(-6,24,-25,38);c.moveTo(0,0);c.quadraticCurveTo(7,23,24,35);c.stroke();c.restore();
}
function renderSheet() {
  const canvas=$('photoSheet'),l=layouts[state.layout];
  canvas.width=l.width;canvas.height=l.height;
  const c=canvas.getContext('2d'),dark=state.color==='ink';
  const ink=dark?'#f5e7d2':'#644738';
  c.fillStyle=colors[state.color];c.fillRect(0,0,l.width,l.height);
  const margin=state.layout==='strip'?42:44,gap=20;
  const pw=(l.width-margin*2-gap*(l.columns-1))/l.columns,ph=pw*.75;
  for(let i=0;i<l.count;i++) {
    const x=margin+(i%l.columns)*(pw+gap),y=margin+Math.floor(i/l.columns)*(ph+gap+8);
    const photo=state.photos[i];
    if(photo) {c.save();c.filter=filters[state.filter];drawCover(c,photo.img,x,y,pw,ph);c.restore();}
    else {
      c.fillStyle=dark?'#514c43':'#e9e0d2';c.fillRect(x,y,pw,ph);
      c.strokeStyle=dark?'#8c8171':'#b7a58b';c.lineWidth=2;
      c.beginPath();c.arc(x+pw/2,y+ph*.44,ph*.14,0,Math.PI*2);c.stroke();
      for(let petal=0;petal<7;petal++) {const a=petal*Math.PI*2/7;c.beginPath();c.ellipse(x+pw/2+Math.sin(a)*ph*.23,y+ph*.44+Math.cos(a)*ph*.23,ph*.08,ph*.12,-a,0,Math.PI*2);c.stroke();}
      c.fillStyle=dark?'#c4b59d':'#9f8c72';c.textAlign='center';c.font='italic '+Math.round(ph*.08)+'px Editorial, Georgia';c.fillText('a moment waiting to happen',x+pw/2,y+ph*.85);
    }
    c.fillStyle=ink;c.textAlign='left';c.font='italic 13px Editorial, Georgia';c.fillText('to you',x,y+ph+16);
  }
  const bottom=margin+l.rows*(ph+gap+8)-gap-8;
  c.fillStyle=ink;c.textAlign='center';
  const cap=$('caption').value.trim()||'a little moment, just for you.';
  let size=state.layout==='strip'?29:40;c.font='italic '+size+'px Editorial, Georgia';
  while(c.measureText(cap).width>l.width-margin*2 && size>14) {size--;c.font='italic '+size+'px Editorial, Georgia';}
  c.fillText(cap,l.width/2,bottom+79);
  drawBow(c,l.width/2,bottom+125,43,dark?'#e8cdb4':'#893b39');
  const date=state.capturedAt||new Date();
  const label=date.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
  c.font='13px Arial';c.textAlign='left';c.fillText(label,margin,l.height-26);
  c.textAlign='right';c.fillText(state.photos.slice(0,total()).some(p=>p?.demo)?'DEMO · TO YOU, WITH LOVE':'TO YOU, WITH LOVE',l.width-margin,l.height-26);
  $('photoSheetWrap').style.width=state.layout==='strip'?'108px':'';
}
function loadImage(src) {return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=src;});}
function saveCanvas(canvas,name) {
  canvas.toBlob(blob=>{
    if(!blob) {toast('The download could not be created. Please try again.');return;}
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=name;document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
    toast('Your keepsake is ready in your downloads.');
  },'image/png');
}
function fileName(suffix='') {
  const d=state.capturedAt||new Date();
  return `to-you-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}${suffix}.png`;
}
async function uploadPhotos(event) {
  const files=Array.from(event.target.files||[]);event.target.value='';
  if(!files.length) return;
  const accepted=files.filter(f=>f.type.startsWith('image/')).slice(0,total());
  if(!accepted.length) {toast('Choose JPG, PNG, or another supported image file.');return;}
  $('uploadButton').disabled=true;
  try {
    const photos=await Promise.all(accepted.map(async file=>{
      const url=URL.createObjectURL(file);
      try {
        const img=await loadImage(url),canvas=document.createElement('canvas');canvas.width=1200;canvas.height=900;
        drawCover(canvas.getContext('2d'),img,0,0,1200,900);
        const src=canvas.toDataURL('image/jpeg',.94);
        return {src,img:await loadImage(src),demo:false};
      } finally {URL.revokeObjectURL(url);}
    }));
    state.photos=Array(6).fill(null);photos.forEach((p,i)=>state.photos[i]=p);
    state.capturedAt=new Date();state.retake=null;refresh();
    toast(complete()?'Your photos are in. Add your own little touch.':`${photos.length} photos added. Capture the remaining moments with your camera.`);
  } catch(error) {toast('One of those images could not open. Try JPG or PNG photos.');}
  finally {$('uploadButton').disabled=false;}
}
function wrapText(c,text,x,y,maxWidth,lineHeight) {
  for(const line of text.split('\n')) {
    let current='';
    for(const word of line.split(' ')) {
      const candidate=current?current+' '+word:word;
      if(c.measureText(candidate).width>maxWidth && current) {c.fillText(current,x,y);y+=lineHeight;current=word;}
      else current=candidate;
      // Split unbroken text as well as ordinary words.
      while(c.measureText(current).width>maxWidth) {
        let cut=current.length;while(cut>1 && c.measureText(current.slice(0,cut)).width>maxWidth)cut--;
        c.fillText(current.slice(0,cut),x,y);y+=lineHeight;current=current.slice(cut);
      }
    }
    c.fillText(current,x,y);y+=lineHeight;
  }
  return y;
}
function saveLetter() {
  const sheet=$('photoSheet');
  const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=sheet.height+840;
  const c=canvas.getContext('2d');c.fillStyle='#f7f0e4';c.fillRect(0,0,canvas.width,canvas.height);
  c.fillStyle='#873b39';c.font='italic 60px Editorial, Georgia';c.fillText('to you, with love.',100,110);
  c.fillStyle='#584536';c.font='32px Editorial, Georgia';
  let y=wrapText(c,'To '+($('recipient').value.trim()||'someone lovely')+',',100,190,1200,48);
  c.font='italic 32px Editorial, Georgia';
  y=wrapText(c,$('letterMessage').value.trim()||"Here's a little piece of today, just for you.",100,y+26,1200,47);
  c.font='italic 29px Editorial, Georgia';c.fillText('With love, '+($('sender').value.trim()||'me'),100,y+28);
  const maxH=canvas.height-(y+100)-100;
  const ratio=Math.min(1100/sheet.width,maxH/sheet.height);
  c.drawImage(sheet,(1400-sheet.width*ratio)/2,y+90,sheet.width*ratio,sheet.height*ratio);
  saveCanvas(canvas,fileName('-with-love'));
}

$('enableCamera').addEventListener('click',enableCamera);
$('tryDemo').addEventListener('click',startDemo);
$('useCamera').addEventListener('click',()=>{$('startScreen').hidden=false;enableCamera();});
$('cameraStatus').addEventListener('click',()=>{if(state.mode==='demo'&&!state.running){$('startScreen').hidden=false;enableCamera();}});
$('startCapture').addEventListener('click',captureSession);
$('cancelCapture').addEventListener('click',()=>cancelSession());
$('againOverlay').addEventListener('click',resetSession);
$('mirrorButton').addEventListener('click',()=>{state.mirrored=!state.mirrored;$('mirrorButton').setAttribute('aria-pressed',String(state.mirrored));setLiveStyles();toast(state.mirrored?'Photos will match your mirrored preview.':'Photos will save without mirroring.');});
document.querySelectorAll('[data-layout]').forEach(button=>button.addEventListener('click',()=>{
  if(state.running) return;state.layout=button.dataset.layout;state.retake=null;
  choose('[data-layout]',button);refresh();
}));
document.querySelectorAll('[data-color]').forEach(button=>button.addEventListener('click',()=>{state.color=button.dataset.color;choose('[data-color]',button);renderSheet();}));
document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{state.filter=button.dataset.filter;choose('[data-filter]',button);setLiveStyles();refresh();}));
$('caption').addEventListener('input',renderSheet);
$('uploadButton').addEventListener('click',()=>$('photoUpload').click());
$('photoUpload').addEventListener('change',uploadPhotos);
$('downloadButton').addEventListener('click',()=>{if(complete())saveCanvas($('photoSheet'),fileName());});
$('printButton').addEventListener('click',()=>{
  if(!complete()) return;
  const printWindow=window.open('','_blank','width=700,height=900');
  if(!printWindow) {toast('Allow pop-ups for this site to print your keepsake.');return;}
  printWindow.document.write('<!doctype html><html><head><title>to you — keepsake</title><style>body{margin:0;text-align:center}img{display:block;max-width:100%;max-height:94vh;margin:3vh auto}@page{margin:10mm}</style></head><body><img alt="Your keepsake"></body></html>');
  printWindow.document.close();const img=printWindow.document.querySelector('img');
  img.onload=()=>{printWindow.focus();printWindow.print();};img.src=$('photoSheet').toDataURL('image/png');
});
['aboutButton','howButton'].forEach(id=>$(id).addEventListener('click',()=>$('aboutDialog').showModal()));
document.querySelectorAll('.close-dialog').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}}));
$('letterButton').addEventListener('click',()=>{if(!complete())return;$('letterEditor').hidden=false;$('sealedLetter').hidden=true;$('letterDialog').showModal();});
$('sealLetter').addEventListener('click',()=>{
  $('letterEditor').hidden=true;$('sealedLetter').hidden=false;
  $('envelope').classList.remove('opened');$('openLetter').hidden=true;$('envelopeHint').hidden=false;
  $('envelopeTo').textContent='to: '+($('recipient').value.trim()||'someone lovely');
  $('letterText').textContent=$('letterMessage').value.trim()||"Here's a little piece of today, just for you.";
  $('letterSignature').textContent='With love, '+($('sender').value.trim()||'me');
  $('letterPhoto').src=$('photoSheet').toDataURL('image/png');
});
$('envelope').addEventListener('click',()=>{$('envelope').classList.add('opened');$('envelopeHint').hidden=true;$('openLetter').hidden=false;});
$('editLetter').addEventListener('click',()=>{$('letterEditor').hidden=false;$('sealedLetter').hidden=true;});
$('downloadLetter').addEventListener('click',saveLetter);
window.addEventListener('pagehide',()=>{cameraRequest++;state.runId++;state.running=false;stopCamera();cancelAnimationFrame(demoAnimation);});
window.addEventListener('pageshow',event=>{if(event.persisted){state.mode=null;$('startScreen').hidden=false;$('demoCanvas').hidden=true;$('cameraStatus').textContent='Camera is off';$('cameraStatus').classList.remove('live');lockSettings(false);refresh();}});
document.addEventListener('keydown',event=>{
  if(event.code==='Space' && !['INPUT','TEXTAREA','SELECT','BUTTON'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')) {
    if(!$('startCapture').disabled) {event.preventDefault();captureSession();}
  }
});
refresh();
document.fonts.ready.then(renderSheet);
