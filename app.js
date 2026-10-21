'use strict';
const $=id=>document.getElementById(id), clamp=(x,a,b)=>Math.max(a,Math.min(b,x)), ease=p=>p*p*(3-2*p);
const S={scenes:[],clips:[],voice:[],own:null,music:null,sel:null,t:0,playing:false,PX:40};
let actx=null,srcs=[],raf=0,tStart=0,tBase=0,uid=1;
let PID;try{PID=localStorage.getItem('curProj')}catch(e){}if(!PID){PID='p'+Date.now().toString(36);try{localStorage.setItem('curProj',PID)}catch(e){}}
const FK=(l,p)=>`f${p||PID}:${l}`;
const cv=$('cv'),ctx=cv.getContext('2d');
S.texts=[];S.selT=null;const ELS={},D=()=>({track:0,x:50,y:50,sz:45,fx:{b:100,c:100,s:100,bl:0,sp:0}});
const PRE={normal:[100,100,100,0,0],vivid:[105,115,150,0,0],bw:[100,110,0,0,0],warm:[105,105,110,35,0],cine:[92,125,85,0,0],soft:[105,95,100,0,4],old:[100,90,80,80,0]};
const fxStr=f=>(!f||(f.b===100&&f.c===100&&f.s===100&&f.bl===0&&f.sp===0))?'none':`brightness(${f.b}%) contrast(${f.c}%) saturate(${f.s}%) sepia(${f.sp}%) blur(${f.bl}px)`;
/* ---------- guardado (IndexedDB) ---------- */
const idb=()=>new Promise((ok,no)=>{const r=indexedDB.open('editor',1);r.onupgradeneeded=()=>r.result.createObjectStore('kv');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
async function kvSet(k,v){try{const d=await idb();d.transaction('kv','readwrite').objectStore('kv').put(v,k)}catch(e){}}
async function kvDel(k){try{const d=await idb();d.transaction('kv','readwrite').objectStore('kv').delete(k)}catch(e){}}
async function kvGet(k){try{const d=await idb();return await new Promise(ok=>{const q=d.transaction('kv').objectStore('kv').get(k);q.onsuccess=()=>ok(q.result);q.onerror=()=>ok(null)})}catch(e){return null}}
const INP=['script','fmt','res','selector-voces','rate','sCol','sStr','sW','sSz','sY','sF','sUp','sOn','mv','nat'];
const snapState=()=>JSON.stringify({scenes:S.scenes,texts:S.texts,lib:S.lib.map(m=>({id:m.id,name:m.name,isV:m.isV})),clips:S.clips.map(c=>({...c,el:undefined}))});
let hist=[],hi=-1,ct=0;const sched=()=>{clearTimeout(ct);ct=setTimeout(commit,400)};
function commit(){const s=snapState();if(s===hist[hi]){return}hist=hist.slice(0,hi+1);hist.push(s);if(hist.length>80)hist.shift();hi=hist.length-1;
  kvSet('proj:'+PID,{state:JSON.parse(s),inputs:INP.map(i=>[i,$(i).type==='checkbox'?$(i).checked:$(i).value])});$('saved').textContent='✔ Guardado automáticamente';window.onProjectSaved&&window.onProjectSaved();btns()}
const btns=()=>{$('bUndo').disabled=hi<=0;$('bRedo').disabled=hi>=hist.length-1};
function restore(s){const o=JSON.parse(s),old=S.scenes.map(x=>x.text);S.scenes=o.scenes;S.texts=o.texts;S.lib=o.lib.map(l=>ELS[l.id]).filter(Boolean);
  S.clips=o.clips.map(c=>{const m=ELS[c.lid];return m?{...c,el:m.el}:null}).filter(Boolean);S.sel=S.selT=null;S.voice=S.scenes.map((x,i)=>old[i]===x.text?S.voice[i]:null);listScenes();listLib();edit();draw();render(S.t)}
$('bUndo').onclick=()=>{commit();if(hi>0){hi--;restore(hist[hi]);btns()}};$('bRedo').onclick=()=>{if(hi<hist.length-1){hi++;restore(hist[hi]);btns()}};
addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&!/INPUT|TEXTAREA/.test(document.activeElement.tagName)&&e.key==='z'){e.preventDefault();$(e.shiftKey?'bRedo':'bUndo').click()}});
$('bNew').onclick=()=>window.newProject&&window.newProject();
async function restoreProject(){let r=await kvGet('proj:'+PID);
  if(!r){const old=await kvGet('proj');if(old&&old.state&&!(await kvGet('projects'))){r=old;await kvSet('proj:'+PID,old);for(const l of old.state.lib){const f=await kvGet('f'+l.id);if(f)await kvSet(FK(l.id),f)}}}
  const ok=r&&r.state&&(r.state.clips.length||r.state.scenes.length||r.state.texts.length);
  if(ok){let mx=0;for(const l of r.state.lib){const f=await kvGet(FK(l.id));if(!f)continue;const url=URL.createObjectURL(f),el=document.createElement(l.isV?'video':'img');if(l.isV){el.muted=true;el.playsInline=true;el.preload='auto'}el.src=url;
    await new Promise(q=>{el.onloadeddata=el.onload=el.onloadedmetadata=q;el.onerror=q;setTimeout(q,6000)});ELS[l.id]={id:l.id,name:l.name,el,isV:l.isV,url};S.files.set(el,f);mx=Math.max(mx,l.id)}
    uid=Math.max(uid,mx+1,...r.state.clips.map(c=>c.id||0),...r.state.texts.map(x=>x.id||0))+1;r.inputs.forEach(([i,v])=>{if(i==='voice'){if(AZ[v])$('selector-voces').value=AZ[v];return}const el=$(i);if(!el)return;if(el.type==='checkbox')el.checked=v;else el.value=v});
    $('rv').textContent=$('rate').value;$('mvv').textContent=$('mv').value;setSize();restore(JSON.stringify(r.state));S.clips.forEach(c=>loadAbuf(c));$('saved').textContent='Proyecto anterior recuperado (la voz y la música se vuelven a cargar)'}
  hist=[snapState()];hi=0;btns()}
const dims=(h)=>$('fmt').value==='16:9'?[Math.round(h*16/9),h]:[h,Math.round(h*16/9)];
const fmtT=t=>Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0');
const total=()=>Math.max(1,...S.scenes.map(s=>s.end),...S.clips.map(c=>c.start+c.dur),S.own?S.own.duration:0);
const AC=()=>actx||(actx=new AudioContext());
function setSize(){const[w,h]=dims(720);cv.width=w;cv.height=h;render(S.t)}
/* ---------- guion / escenas ---------- */
$('bParse').onclick=()=>{S.scenes=Parser.parseScript($('script').value);S.voice=[];listScenes();draw();
  $('log').textContent=S.scenes.length+' escenas detectadas. Duración: '+fmtT(total())+'. Los tiempos solo sincronizan (no se leen ni se muestran).'};
$('bEx').onclick=()=>{$('script').value='0 a 5 seg: Hola, bienvenidos a mi canal. Hoy vamos a aprender algo muy útil.\n5 a 11 seg: Primero, prepara tus imágenes y tus videos favoritos.\n11 a 16 seg: Después, pega tu guion y genera la voz en español.\n16 a 21 seg: Por último, exporta tu video en MP4 listo para YouTube.';$('bParse').click()};
function listScenes(){const d=$('scenes');d.innerHTML='';S.scenes.forEach((s,i)=>{const e=document.createElement('div');e.className='sc';
  e.innerHTML=`<div class="row">#${i+1} <input type="number" step="0.1" value="${s.start}"> a <input type="number" step="0.1" value="${s.end}"> s</div><textarea></textarea>`;
  const[a,b]=e.querySelectorAll('input'),t=e.querySelector('textarea');t.value=s.text;
  a.onchange=()=>{s.start=+a.value;draw()};b.onchange=()=>{s.end=+b.value;draw()};t.oninput=()=>{s.text=t.value;S.voice[i]=null;hideDl();render(S.t);sched()};d.appendChild(e)})}
/* ---------- medios ---------- */
S.lib=[];S.files=new Map();S.abuf=new Map();
/* lee el sonido de un video (del celular o del PC) para mezclarlo en vista previa y MP4; si no tiene sonido, lo deja en 0 */
async function loadAbuf(c){if(!c.isV||!(c.vol>0)||S.abuf.has(c.el))return;const f=S.files.get(c.el);if(!f)return;
  if(f.size>250e6){c.vol=0;$('log2').textContent='"'+c.name+'" es muy pesado para leer su sonido (más de 250 MB): se agregó sin sonido.';return}
  try{S.abuf.set(c.el,await AC().decodeAudioData(await f.arrayBuffer()))}catch(e){c.vol=0;if(S.sel===c)edit()}}
async function addFiles(files){for(const f of files){const isV=f.type.startsWith('video');if(!isV&&!f.type.startsWith('image'))continue;const url=URL.createObjectURL(f);
  const el=document.createElement(isV?'video':'img');if(isV){el.muted=true;el.playsInline=true;el.setAttribute('playsinline','');el.preload='auto'}el.src=url;
  await new Promise(r=>{el.onloadeddata=el.onload=el.onloadedmetadata=r;el.onerror=r;setTimeout(r,6000)});
  const end=Math.max(0,...S.clips.map(c=>c.start+c.dur));const lid=uid++;ELS[lid]={id:lid,name:f.name,el,isV,url};S.files.set(el,f);S.lib.push(ELS[lid]);kvSet(FK(lid),f);if(isV){el.addEventListener('seeked',()=>render(S.t));el.currentTime=0.05}
  S.clips.push({...D(),id:uid++,lid,name:f.name,el,isV,start:end,dur:isV?(el.duration||5):5,in:0,speed:1,vol:isV?1:0,tr:.5,motion:['zoomin','panl','zoomout','panr'][S.clips.length%4],trans:'fade'})}
  listLib();draw();render(S.t);for(const c of S.clips)await loadAbuf(c);render(S.t)}
function listLib(){const d=$('lib');d.innerHTML='';S.lib.forEach(m=>{const e=document.createElement('div');e.className='li';
  const th=document.createElement(m.isV?'video':'img');th.src=m.url+(m.isV?'#t=0.5':'');if(m.isV){th.muted=true;th.preload='metadata';th.setAttribute('playsinline','')}
  const sp=document.createElement('span');sp.textContent=(m.isV?'🎬 ':'🖼 ')+m.name+(m.isV&&m.el.duration?' ('+fmtT(m.el.duration)+')':'');
  const b=document.createElement('button');b.textContent='✕';b.title='Quitar';b.onclick=()=>{S.lib=S.lib.filter(x=>x!==m);S.clips=S.clips.filter(c=>c.el!==m.el);S.sel=null;edit();listLib();draw();render(S.t)};
  e.append(th,sp,b);d.appendChild(e)})}
$('fMedia').onchange=async e=>{await addFiles(e.target.files);e.target.value=''};
['dragover','dragenter'].forEach(ev=>$('drop').addEventListener(ev,e=>{e.preventDefault();$('drop').classList.add('over')}));
['dragleave','drop'].forEach(ev=>$('drop').addEventListener(ev,e=>{e.preventDefault();$('drop').classList.remove('over')}));
$('drop').addEventListener('drop',e=>addFiles(e.dataTransfer.files));
$('bFit').onclick=()=>{if(!S.clips.length||!S.scenes.length)return alert('Primero analiza el guion y sube imágenes/videos.');
  const base=[...S.clips].sort((a,b)=>a.start-b.start).filter((c,i,a)=>a.findIndex(x=>x.el===c.el)===i);
  const k5=$('k5')&&$('k5').checked;let tt=0;
  S.clips=S.scenes.map((s,i)=>{const o=base[i%base.length],d=(k5&&!o.isV)?5:Math.max(.5,s.end-s.start),st=k5?tt:s.start;tt=st+d;
    return{...o,fx:{...o.fx},id:uid++,start:st,dur:d,motion:['zoomin','panl','zoomout','panr'][i%4]}});draw();render(S.t)};
$('fMusic').onchange=async e=>{const f=e.target.files[0];if(!f)return;$('log2').textContent='Leyendo el sonido de "'+f.name+'"…';try{S.music={buf:await AC().decodeAudioData(await f.arrayBuffer()),name:f.name};$('log2').textContent='';draw()}catch(err){$('log2').textContent='No se pudo leer el sonido de ese archivo (¿el video no tiene audio o el formato no es compatible?).'}e.target.value=''};
$('fVoice').onchange=async e=>{const f=e.target.files[0];S.own=f?await AC().decodeAudioData(await f.arrayBuffer()):null;draw()};
/* ---------- voz ---------- */
const VK={'es-ES-AlvaroNeural':'es-ES-H','es-MX-DaliaNeural':'es-MX','es-MX-JorgeNeural':'es-MX-H','es-CL-CatalinaNeural':'es-CL','es-CL-LorenzoNeural':'es-CL-H'};   /* voz neuronal -> clave del respaldo Google */
const AZ={'es-ES':'es-ES-ElviraNeural','es-ES-H':'es-ES-AlvaroNeural','es-MX':'es-MX-DaliaNeural','es-MX-H':'es-MX-JorgeNeural','es-US':'es-US-PalomaNeural','es-CL':'es-CL-CatalinaNeural','es-CL-H':'es-CL-LorenzoNeural'};
const lsGet=k=>{try{return localStorage.getItem(k)||''}catch(e){return''}},lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
$('azKey').value=lsGet('azKey');$('azReg').value=lsGet('azReg')||'eastus';$('azKey').onchange=()=>lsSet('azKey',$('azKey').value.trim());$('azReg').onchange=()=>lsSet('azReg',$('azReg').value.trim());
const esc=t=>t.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[m]));
/* --- voz natural: pausas, respiraciones y ajuste de velocidad por escena --- */
const NAT=()=>$('nat').checked;
const natSSML=t=>esc(t).replace(/([,;:])\s+/g,'$1<break time="160ms"/> ').replace(/([.!?…])\s+/g,'$1<break time="320ms"/> ');
let EDGE_OK,EDGE_WHY;
const FN_EDGE='/.netlify/functions/tts-edge',FN_GOOGLE='/.netlify/functions/tts';
const FN_404=n=>'La función de Netlify "'+n+'" no existe en este sitio (error 404 en '+(n==='tts'?FN_GOOGLE:FN_EDGE)+'). Netlify no desplegó las funciones: arrastrar la carpeta a Netlify Drop no las instala. Despliega desde GitHub (Add new site > Import from Git) o con Netlify CLI (netlify deploy --prod), o usa Azure / la voz integrada / sube tu narración.';
const webOn=()=>$('vEng').value==='web';
const canRate=()=>localOn()||(!webOn()&&(!!$('azKey').value.trim()||EDGE_OK===true));
/* --- Voz del navegador (Web Speech API): gratis, local, instantánea y sin límites ---
   OJO: el navegador reproduce esta voz por los altavoces y NO permite capturarla como audio,
   por eso suena en la vista previa pero no se puede mezclar dentro del MP4 exportado. --- */
const TTS=('speechSynthesis' in window)&&window.SpeechSynthesisUtterance?window.speechSynthesis:null;
let wTimers=[];
const wRank=v=>{const l=(v.lang||'').replace('_','-').toLowerCase();return l==='es-cl'?0:l==='es-mx'?1:l==='es-us'?2:l.startsWith('es')?3:9};
function loadWV(){if(!TTS)return;const sel=$('wVoice'),cur=lsGet('wVoiceSel')||sel.value,all=TTS.getVoices(),es=all.filter(v=>/^es/i.test((v.lang||'').replace('_','-')));
  const list=(es.length?es:all).slice().sort((a,b)=>wRank(a)-wRank(b)||a.name.localeCompare(b.name));sel.innerHTML='';
  list.forEach(v=>{const o=document.createElement('option');o.value=v.voiceURI||v.name;o.textContent=v.name+' ('+v.lang+')';sel.appendChild(o)});
  if([...sel.options].some(o=>o.value===cur))sel.value=cur}
const wEst=(text,rate)=>{const w=(text.match(/\S+/g)||[]).length,p=(text.match(/[,;:.!?…]/g)||[]).length;return Math.max(.8,(w/2.6+p*.22)/clamp(rate,.5,2))};
function wUtter(text,rate){const u=new SpeechSynthesisUtterance(text),v=TTS.getVoices().find(x=>(x.voiceURI||x.name)===$('wVoice').value);
  if(v){u.voice=v;u.lang=v.lang}else u.lang='es-ES';u.rate=clamp(rate,.5,2);return u}
function webStop(){wTimers.forEach(clearTimeout);wTimers=[];if(TTS)try{TTS.cancel()}catch(e){}}
/* programa la voz de cada escena junto con la reproducción; si no cabe en su tiempo, habla un poco más rápido (hasta 1.4x) */
function webPlay(t0){webStop();if(!TTS||!webOn()||S.own)return;const base=+$('wRate').value||1;
  S.scenes.forEach(s=>{if(s.end<=t0)return;const text=s.text.replace(/\s+/g,' ').trim();if(!text)return;
    const win=Math.max(.5,s.end-Math.max(s.start,t0)),fit=clamp(wEst(text,base)/win,1,1.4),dt=Math.max(0,s.start-t0);
    wTimers.push(setTimeout(()=>{if(!S.playing)return;try{TTS.cancel();TTS.speak(wUtter(text,base*fit))}catch(e){}},dt*1000))})}
/* marcador de voz por escena (solo para tiempos y subtítulos): no contiene audio */
function webMark(i){const s=S.scenes[i],text=s.text.replace(/\s+/g,' ').trim(),win=Math.max(.5,s.end-s.start),est=wEst(text,+$('wRate').value||1);
  return{web:true,est,duration:Math.min(est,win),parts:null}}
/* --- Voz integrada (meSpeak/eSpeak, corre en tu navegador): gratis, sin límites y SÍ queda grabada en el MP4. Suena más robótica que la voz del navegador. --- */
const localOn=()=>$('vEng').value==='local';
const MSP='https://cdn.jsdelivr.net/npm/mespeak@2.0.2/';let mspP;
function loadMsp(){return mspP||(mspP=(async()=>{
  const mod=await import(MSP+'+esm'),m=mod.default||mod.meSpeak||mod;if(!m||typeof m.speak!=='function')throw new Error('la librería de voz no se cargó bien');
  const [cfg,vo]=await Promise.all([fetch(MSP+'src/mespeak_config.json').then(r=>r.json()),fetch(MSP+'voices/es-la.json').then(r=>r.json())]);
  await m.loadConfig(cfg);await m.loadVoice(vo);return m})().catch(e=>{mspP=null;throw e}))}
function toBuf(x){if(x instanceof ArrayBuffer)return x;if(ArrayBuffer.isView(x))return x.buffer.slice(x.byteOffset,x.byteOffset+x.byteLength);
  if(Array.isArray(x))return new Uint8Array(x).buffer;if(typeof x==='string'){const b=atob(x.replace(/^data:[^,]*,/,'')),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u.buffer}return null}
async function localTts(text,m){try{const sp=await loadMsp(),raw=sp.speak(text,{rawdata:true,voice:'es-la',variant:$('lVoice').value,speed:Math.round(clamp(150*(m||1)*(+$('lRate').value||1),80,320)),pitch:+$('lPitch').value||50,amplitude:100}),b=toBuf(raw);
    if(!b||b.byteLength<100)throw new Error('no devolvió audio');return new Response(b,{status:200})}
  catch(e){return new Response('No se pudo generar la voz integrada ('+(e.message||e)+'). Necesita internet la primera vez. Prueba otro motor de voz.',{status:500})}}
async function ttsFetch(text,extra){const key=$('azKey').value.trim(),nv=$('selector-voces').value,v=VK[nv]||'es-ES',m=clamp(+$('rate').value*(extra||1),.6,1.6);
  if(localOn()){$('eng').textContent='Motor: voz integrada';return localTts(text,clamp(extra||1,.6,1.6))}
  if(key){$('eng').textContent='Motor: Azure (se respeta la voz que elijas)';const pr=Math.round((m-1)*100);return fetch(`https://${$('azReg').value.trim()||'eastus'}.tts.speech.microsoft.com/cognitiveservices/v1`,{method:'POST',
    headers:{'Ocp-Apim-Subscription-Key':key,'Content-Type':'application/ssml+xml','X-Microsoft-OutputFormat':'audio-24khz-96kbitrate-mono-mp3'},
    body:`<speak version="1.0" xml:lang="es-ES"><voice name="${nv}"><prosody rate="${pr>=0?'+':''}${pr}%">${NAT()?natSSML(text):esc(text)}</prosody></voice></speak>`})}
  if(EDGE_OK!==false){let why='';try{const r=await fetch(FN_EDGE,{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({text,voice:nv,rate:m,natural:NAT()})});if(r.ok){EDGE_OK=true;$('eng').textContent='Motor: Edge gratis (se respeta la voz que elijas)';return r}
    if(r.status===404){why=FN_404('tts-edge');EDGE_OK=false}else{why='La función tts-edge respondió con error '+r.status+': '+(await r.text()).replace(/<[^>]*>/g,' ').trim().slice(0,200)}}
  catch(e){why='No se pudo contactar la función tts-edge ('+(e.message||e)+'). ¿Estás sin internet o abriste el archivo localmente?';EDGE_OK=false}
    EDGE_WHY=why;$('eng').textContent='⚠ '+why+' Se usará la voz de Google.'}
  $('eng').textContent=($('eng').textContent.startsWith('⚠ ')?$('eng').textContent+' ':'')+(v.endsWith('-H')?'⚠ Motor: Google gratis, que solo tiene voz de mujer. Para voz de hombre usa Azure o despliega desde GitHub (voz Edge).':'Motor: Google gratis (solo voz de mujer)');
  let g;try{g=await fetch(FN_GOOGLE,{method:'POST',body:new URLSearchParams({text,voice:v})})}catch(e){return new Response((EDGE_WHY?EDGE_WHY+'\n':'')+'Tampoco se pudo contactar la función tts ('+(e.message||e)+').',{status:502})}
  if(g.status===404)return new Response((EDGE_WHY||FN_404('tts-edge'))+'\nLa función de respaldo "tts" tampoco existe en este sitio (404).',{status:404});
  return g}
function sents(t){const out=[];for(let x of t.replace(/\s+/g,' ').trim().split(/(?<=[.!?…])\s+/)){
  while(x.length>170){let k=x.lastIndexOf(',',170);if(k<40)k=x.lastIndexOf(' ',170);if(k<1)k=170;out.push(x.slice(0,k+1).trim());x=x.slice(k+1).trim()}if(x)out.push(x)}return out}
/* --- respiración sintética: ruido filtrado con inhalación (sube rápido, baja suave) --- */
const BR=()=>+($('brAmt')?$('brAmt').value:40)/100*.26;
function breathData(sr,len,amp){const n=Math.max(8,Math.round(sr*len)),o=new Float32Array(n),a=Math.exp(-2*Math.PI*3300/sr),b=Math.exp(-2*Math.PI*380/sr);let lp=0,hp=0,pk=1e-6;
  for(let i=0;i<n;i++){lp=a*lp+(1-a)*(Math.random()*2-1);hp=b*hp+(1-b)*lp;const t=i/n,env=t<.38?Math.pow(Math.sin(t/.38*Math.PI/2),2):Math.pow(Math.cos((t-.38)/.62*Math.PI/2),1.6);o[i]=(lp-hp)*env;pk=Math.max(pk,Math.abs(o[i]))}
  const k=amp/pk;for(let i=0;i<n;i++)o[i]*=k;return o}
function breathBuf(c){const d=breathData(c.sampleRate,.34,BR()),b=c.createBuffer(1,d.length,c.sampleRate);b.getChannelData(0).set(d);return b}
function addBreath(d,sr,pos,len){const z=breathData(sr,len,BR()*(.85+Math.random()*.3));for(let j=0;j<z.length&&pos+j<d.length;j++)if(pos+j>=0)d[pos+j]+=z[j]}
/* pausas dentro de una frase (comas): busca silencios en el audio generado */
function findPauses(x,sr){const w=Math.round(sr*.01),nw=Math.floor(x.length/w),r=new Float32Array(nw);let pk=0;
  for(let i=0;i<nw;i++){let e=0;for(let j=0;j<w;j++){const v=x[i*w+j];e+=v*v}r[i]=Math.sqrt(e/w);pk=Math.max(pk,r[i])}
  const th=Math.max(.003,pk*.05),out=[];let a=-1;
  for(let i=0;i<=nw;i++){const q=i<nw&&r[i]<th;if(q&&a<0)a=i;if(!q&&a>=0){const len=(i-a)*.01;if(a>8&&i<nw&&len>=.17)out.push({t:a*.01,len});a=-1}}return out}
async function sceneVoice(i,extra){const a=AC(),bufs=[];
  for(const c of sents(S.scenes[i].text)){const r=await ttsFetch(c,extra*(NAT()?.97+Math.random()*.06:1));if(!r.ok)throw new Error('Escena '+(i+1)+': '+(await r.text()).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,400));bufs.push({b:await a.decodeAudioData(await r.arrayBuffer()),c})}
  const sr=bufs[0].b.sampleRate,end=k=>/[.!?…]$/.test(bufs[k].c),last=bufs.length-1,
    gp=k=>k>=last?0:Math.round((NAT()?(end(k)?.62:.4):.12)*sr);
  const o=a.createBuffer(1,bufs.reduce((n,x,k)=>n+x.b.length+gp(k),0),sr),d=o.getChannelData(0),parts=[];let p=0;
  bufs.forEach((x,k)=>{const src=x.b.getChannelData(0);d.set(src,p);parts.push({text:x.c,t0:p/sr,t1:(p+x.b.length)/sr});
    if(NAT()){
      findPauses(src,sr).forEach(q=>{const bl=Math.min(.34,Math.max(.12,q.len*.8));addBreath(d,sr,p+Math.round((q.t+q.len-bl-.03)*sr),bl)});   /* respiración en cada coma/pausa */
      if(k<last){const gl=gp(k)/sr,bl=Math.min(end(k)?.36:.24,gl*.75);addBreath(d,sr,p+x.b.length+Math.round((gl-bl-.04)*sr),bl)}}      /* y entre frases */
    p+=x.b.length+gp(k)});
  o.parts=parts;return o}
async function genVoice(){$('log2').textContent='';const idx=S.scenes.map((_,i)=>i).filter(i=>!S.voice[i]),total=idx.length;let done=0;if(!total)return;
  if(webOn()&&!S.own){idx.forEach(i=>{S.voice[i]=webMark(i)});$('prog').style.display='none';warnFit();return}   /* voz del navegador: instantáneo, no hay nada que generar */
  $('prog').style.display='block';$('prog').value=0;$('log2').textContent='Generando voz… 0 de '+total+' escenas';
  const worker=async()=>{while(idx.length){const i=idx.shift();let o=await sceneVoice(i,1);const win=S.scenes[i].end-S.scenes[i].start;
    if(canRate()&&win>.5&&o.duration>win*1.02)o=await sceneVoice(i,Math.min(1.5,o.duration/win+.03));
    S.voice[i]=o;done++;$('prog').value=done/total;$('log2').textContent='Generando voz… '+done+' de '+total+' escenas'}};
  try{await Promise.all([worker()])}finally{idx.length=0}
  $('prog').style.display='none';warnFit()}
function warnFit(){const w=[];S.scenes.forEach((s,i)=>{const v=S.voice[i];{const d=v&&(v.web?v.est:v.duration),lim=v&&v.web?1.4:1.3;if(v&&d>(s.end-s.start)*(v.web?lim:1.02))w.push(`Escena ${i+1}: la voz dura ~${d.toFixed(1)}s y tu tiempo es ${(s.end-s.start).toFixed(1)}s (se acelera hasta ${lim}x; si no alcanza, alarga la escena).`)}});
  $('log2').textContent=w.join('\n')||(S.voice.some(Boolean)?'Voz lista y dentro de los tiempos.':'')}
/* --- reproducir y descargar la voz (con respiraciones) como MP3 --- */
let voiceUrl=null,lameP=null;
function hideDl(){$('voz-mp3').style.display='none';$('audio-voz').pause();$('audio-voz').removeAttribute('src');if(voiceUrl){URL.revokeObjectURL(voiceUrl);voiceUrl=null}}
const loadLame=()=>window.lamejs?Promise.resolve(window.lamejs):(lameP||(lameP=new Promise((ok,no)=>{const sc=document.createElement('script');sc.src='https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js';
  sc.onload=()=>window.lamejs?ok(window.lamejs):no(new Error('lamejs no se cargó'));sc.onerror=()=>no(new Error('no se pudo descargar el codificador MP3'));setTimeout(()=>no(new Error('el codificador MP3 tardó demasiado')),15000);document.head.appendChild(sc)}).catch(e=>{lameP=null;throw e})));
function toMp3(f32,sr,L){const pcm=new Int16Array(f32.length);for(let i=0;i<f32.length;i++){const v=Math.max(-1,Math.min(1,f32[i]));pcm[i]=v<0?v*32768:v*32767}
  const enc=new L.Mp3Encoder(1,sr,128),out=[];for(let i=0;i<pcm.length;i+=1152){const b=enc.encodeBuffer(pcm.subarray(i,i+1152));if(b.length)out.push(new Uint8Array(b))}const e=enc.flush();if(e.length)out.push(new Uint8Array(e));return new Blob(out,{type:'audio/mpeg'})}
function toWav(f32,sr){const n=f32.length,b=new DataView(new ArrayBuffer(44+n*2)),w=(o,t)=>{for(let i=0;i<t.length;i++)b.setUint8(o+i,t.charCodeAt(i))};
  w(0,'RIFF');b.setUint32(4,36+n*2,true);w(8,'WAVEfmt ');b.setUint32(16,16,true);b.setUint16(20,1,true);b.setUint16(22,1,true);b.setUint32(24,sr,true);b.setUint32(28,sr*2,true);b.setUint16(32,2,true);b.setUint16(34,16,true);w(36,'data');b.setUint32(40,n*2,true);
  for(let i=0;i<n;i++){const v=Math.max(-1,Math.min(1,f32[i]));b.setInt16(44+i*2,v<0?v*32768:v*32767,true)}return new Blob([b],{type:'audio/wav'})}
async function showDl(){
  if(S.own||!S.scenes.length||S.scenes.some((x,i)=>!S.voice[i]||S.voice[i].web))return hideDl();
  const prev=$('log2').textContent;$('log2').textContent='Preparando el archivo de audio…';
  try{const SR=44100,Tv=Math.max(...S.scenes.map(x=>x.end))+.5,oc=new OfflineAudioContext(1,Math.ceil(Tv*SR),SR);schedule(oc,0,0,oc.destination,Tv,true);
    const f32=(await oc.startRendering()).getChannelData(0);let blob,ext='mp3';
    try{blob=toMp3(f32,SR,await loadLame())}catch(e){blob=toWav(f32,SR);ext='wav'}
    if(voiceUrl)URL.revokeObjectURL(voiceUrl);voiceUrl=URL.createObjectURL(blob);
    $('audio-voz').src=voiceUrl;const a=$('btn-descargar-voz');a.href=voiceUrl;a.download='voz-'+$('selector-voces').value+'.'+ext;a.textContent='⬇ Descargar '+ext.toUpperCase();$('voz-mp3').style.display='';
    $('log2').textContent=prev}catch(e){$('log2').textContent=(prev?prev+'\n':'')+'No se pudo preparar el archivo de audio: '+e.message}}
$('bVoice').onclick=async()=>{if(!S.scenes.length)$('bParse').click();$('bVoice').disabled=true;try{await genVoice();await showDl()}catch(e){$('log2').textContent='No se pudo generar la voz: '+e.message+'\nPuedes subir tu propia narración en el panel derecho.'}$('bVoice').disabled=false;$('prog').style.display='none'};
/* --- panel de voz: motor, voz del navegador --- */
$('wRate').value=lsGet('wRateSel')||1;$('wrv').textContent=(+$('wRate').value).toFixed(2);$('vEng').value=['web','local','auto'].includes(lsGet('vEng2'))?lsGet('vEng2'):'auto';$('lVoice').value=lsGet('lVoiceSel')||'f3';$('lRate').value=lsGet('lRateSel')||1;$('lrv').textContent=(+$('lRate').value).toFixed(2);$('lPitch').value=lsGet('lPitchSel')||50;$('brAmt').value=lsGet('brAmt')||40;$('brv').textContent=$('brAmt').value;
const vUI=()=>{const v=$('vEng').value;$('webBox').style.display=v==='web'?'':'none';$('localBox').style.display=v==='local'?'':'none';$('freeBox').style.display=v==='auto'?'':'none';$('brBox').style.display=v==='web'?'none':'';$('eng').textContent=''};vUI();
if(TTS){loadWV();TTS.onvoiceschanged=loadWV}else $('wTs').textContent='Tu navegador no tiene voz integrada. Usa Chrome, Edge o Safari, o elige el otro motor.';
$('vEng').onchange=()=>{lsSet('vEng2',$('vEng').value);S.voice=[];webStop();vUI();hideDl()};
{const sv=lsGet('selVoz');if(sv&&[...$('selector-voces').options].some(o=>o.value===sv))$('selector-voces').value=sv}
$('lVoice').onchange=()=>{lsSet('lVoiceSel',$('lVoice').value);S.voice=[]};$('lPitch').onchange=()=>{lsSet('lPitchSel',$('lPitch').value);S.voice=[]};$('lRate').oninput=()=>{$('lrv').textContent=(+$('lRate').value).toFixed(2);lsSet('lRateSel',$('lRate').value);S.voice=[]};
$('lTest').onclick=async()=>{const t=$('lTs');t.textContent='Generando prueba (la primera vez descarga la voz)…';$('lTest').disabled=true;try{const r=await localTts('Hola, esta es mi voz. ¿Te gusta cómo suena? Dime si prefieres otra.',1);if(!r.ok)throw new Error(await r.text());const a=AC(),b=await a.decodeAudioData(await r.arrayBuffer());await a.resume();const x=a.createBufferSource();x.buffer=b;x.connect(a.destination);x.start();t.textContent='Sonando… si te gusta, déjala elegida.'}catch(e){t.textContent=e.message}$('lTest').disabled=false};
$('wVoice').onchange=()=>{lsSet('wVoiceSel',$('wVoice').value);S.voice=[]};
$('wRate').oninput=()=>{$('wrv').textContent=(+$('wRate').value).toFixed(2);lsSet('wRateSel',$('wRate').value);S.voice=[]};
$('brAmt').oninput=()=>{$('brv').textContent=$('brAmt').value;lsSet('brAmt',$('brAmt').value);S.voice=[]};
$('wTest').onclick=()=>{if(!TTS){$('wTs').textContent='Tu navegador no tiene voz integrada.';return}webStop();TTS.speak(wUtter('Hola, esta es mi voz. ¿Te gusta cómo suena? Dime si prefieres otra.',+$('wRate').value||1));$('wTs').textContent='Sonando… si te gusta, déjala elegida.'};
$('rate').oninput=()=>{$('rv').textContent=$('rate').value;S.voice=[]};$('selector-voces').onchange=()=>{S.voice=[];lsSet('selVoz',$('selector-voces').value);hideDl()};$('nat').onchange=()=>{S.voice=[];render(S.t)};
/* ---------- render ---------- */
const subs=['sCol','sStr','sW','sSz','sY','sF','sUp','sOn'];subs.forEach(i=>$(i).oninput=()=>render(S.t));
$('mv').oninput=()=>$('mvv').textContent=$('mv').value;
$('fmt').onchange=()=>{$('sY').value=$('fmt').value==='9:16'?72:85;setSize()};
function vtime(c,t){const d=c.el.duration||1;return clamp(c.in+(t-c.start)*c.speed,0,d-.05)}
function prevOf(c){return S.clips.filter(x=>x!==c&&(x.track||0)===(c.track||0)&&x.start+x.dur<=c.start+.01).sort((a,b)=>b.start+b.dur-a.start-a.dur)[0]}
function mot(c,t,w,h){const e=ease(clamp((t-c.start)/c.dur,0,1)),m=c.motion;let s=1,dx=0,dy=0;
  if(m==='zoomin')s=1+.12*e;else if(m==='zoomout')s=1.12-.12*e;else if(m==='panl'){s=1.12;dx=(.5-e)*.08*w}else if(m==='panr'){s=1.12;dx=(e-.5)*.08*w}
  else if(m==='panu'){s=1.12;dy=(.5-e)*.08*h}else if(m==='pand'){s=1.12;dy=(e-.5)*.08*h}else if(m==='kenburns'){s=1+.15*e;dx=(e-.5)*.05*w;dy=(.5-e)*.04*h}else if(m==='pulse')s=1.04+.03*Math.sin((t-c.start)*4);
  return{s,dx,dy}}
let EO=null;const EL=c=>(EO&&EO.get(c.el))||c.el;
function drawClip(g,c,t,w,h,alpha,tx0,ty0,zs){const E=EL(c),iw=c.isV?E.videoWidth:E.naturalWidth,ih=c.isV?E.videoHeight:E.naturalHeight;if(!iw)return;
  const{s,dx,dy}=mot(c,t,w,h),k=Math.max(w/iw,h/ih)*s*(zs||1);g.save();g.globalAlpha=alpha;g.filter=fxStr(c.fx);g.drawImage(E,(w-iw*k)/2+dx+(tx0||0),(h-ih*k)/2+dy+(ty0||0),iw*k,ih*k);g.restore()}
function drawOver(g,c,t,w,h){const E=EL(c),iw=c.isV?E.videoWidth:E.naturalWidth,ih=c.isV?E.videoHeight:E.naturalHeight;if(!iw)return;
  const{s,dx,dy}=mot(c,t,w,h),k=Math.min(w*c.sz/100/iw,h*c.sz/100/ih)*s,al=clamp(Math.min((t-c.start)/.3,(c.start+c.dur-t)/.3),0,1);
  g.save();g.globalAlpha=al;g.filter=fxStr(c.fx);g.shadowColor='rgba(0,0,0,.5)';g.shadowBlur=20*w/1280;g.drawImage(E,w*c.x/100-iw*k/2+dx,h*c.y/100-ih*k/2+dy,iw*k,ih*k);g.restore()}
function active(t,tr){tr=tr||0;return S.clips.filter(c=>(c.track||0)===tr&&t>=c.start&&t<c.start+c.dur).sort((a,b)=>b.start-a.start)[0]}
function wrap(g,text,mw){const L=[];let cur='';for(const wd of text.split(/\s+/)){const x=cur?cur+' '+wd:wd;if(g.measureText(x).width>mw&&cur){L.push(cur);cur=wd}else cur=x}L.push(cur);return L}
function drawText(g,x,t,w,h){const tt=t-x.start,du=x.dur;let al=Math.min(clamp(tt/.35,0,1),clamp((du-tt)/.3,0,1)),sc=1,dy=0,txt=x.text;const px=x.size*Math.min(w,h)/1080;
  if(x.anim==='pop'){const p=clamp(tt/.4,0,1);sc=.5+.5*p+Math.sin(p*Math.PI)*.15}else if(x.anim==='slide')dy=(1-ease(clamp(tt/.5,0,1)))*h*.08;
  else if(x.anim==='type'){txt=txt.slice(0,Math.ceil(txt.length*clamp(tt/Math.min(2,du*.6),0,1)));al=clamp((du-tt)/.3,0,1)}else if(x.anim==='none')al=1;
  if(!txt)return;g.save();g.globalAlpha=al;g.translate(w*x.x/100,h*x.y/100+dy);g.scale(sc,sc);g.font=`bold ${px}px "${x.font}",Arial,sans-serif`;g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';
  const L=wrap(g,txt,w*.85),lh=px*1.2,y0=-(L.length-1)*lh/2;g.lineWidth=x.sw*px/64;g.strokeStyle=x.stroke;g.fillStyle=x.color;g.shadowColor='rgba(0,0,0,.35)';g.shadowBlur=px*.15;
  L.forEach((l,i)=>{if(g.lineWidth>0)g.strokeText(l,0,y0+i*lh);g.fillText(l,0,y0+i*lh)});g.restore()}
function render(t,g,w,h){g=g||ctx;w=w||cv.width;h=h||cv.height;g.fillStyle='#111';g.fillRect(0,0,w,h);
  const c=active(t);if(c){const tt=t-c.start,TR=Math.min(c.tr,c.dur/2);
    if(c.trans!=='cut'&&TR>0&&tt<TR){const prev=prevOf(c);if(prev)drawClip(g,prev,prev.start+prev.dur,w,h,1);const p=ease(tt/TR);
      if(c.trans==='fade')drawClip(g,c,t,w,h,p);else if(c.trans==='slide')drawClip(g,c,t,w,h,1,(1-p)*w);else if(c.trans==='slideu')drawClip(g,c,t,w,h,1,0,(1-p)*h);
      else if(c.trans==='zoom')drawClip(g,c,t,w,h,p,0,0,1.35-.35*p);else if(c.trans==='wipe'){g.save();g.beginPath();g.rect(0,0,w*p,h);g.clip();drawClip(g,c,t,w,h,1);g.restore()}else drawClip(g,c,t,w,h,1)}
    else drawClip(g,c,t,w,h,1)}
  const o=active(t,1);if(o)drawOver(g,o,t,w,h);
  S.texts.forEach(x=>{if(t>=x.start&&t<x.start+x.dur)drawText(g,x,t,w,h)});
  if($('sOn').checked){const sc=S.scenes.find(s=>t>=s.start&&t<s.end);if(sc)drawSub(g,subText(sc,t),w,h)}}
const SUBC=new Map();
function phr(text){const out=[];for(const seg of text.replace(/\s+/g,' ').trim().split(/(?<=[,;:.!?…])\s+/)){const w=seg.split(' '),n=Math.ceil(w.length/6),sz=Math.ceil(w.length/n);for(let k=0;k<w.length;k+=sz)out.push(w.slice(k,k+sz).join(' '))}return out.filter(Boolean)}
function subText(sc,t){const i=S.scenes.indexOf(sc),v=S.voice[i],key=i+'|'+sc.text+'|'+sc.start+'|'+sc.end+'|'+(v?v.duration:0);let L=SUBC.get(key);
  if(!L){const r=v?clamp(v.duration/Math.max(.5,sc.end-sc.start),1,1.3):1,
      spans=v&&v.parts?v.parts.map(p=>({text:p.text,a:sc.start+p.t0/r,b:sc.start+p.t1/r})):[{text:sc.text,a:sc.start,b:sc.end}];
    L=[];spans.forEach(sp=>{const ps=phr(sp.text),tw=ps.reduce((n,x)=>n+x.split(' ').length,0);let a=sp.a;ps.forEach(x=>{L.push({text:x,a});a+=(sp.b-sp.a)*x.split(' ').length/tw})});
    if(SUBC.size>200)SUBC.clear();SUBC.set(key,L)}
  let cur=L[0];for(const p of L){if(p.a<=t)cur=p;else break}return cur?cur.text:sc.text}
function drawSub(g,text,w,h){if($('sUp').checked)text=text.toUpperCase();const px=+$('sSz').value*Math.min(w,h)/1080;
  g.font=`bold ${px}px "${$('sF').value}",Arial,sans-serif`;g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';
  const mw=w*.88,lines=[];let cur='';for(const wd of text.split(/\s+/)){const x=cur?cur+' '+wd:wd;if(g.measureText(x).width>mw&&cur){lines.push(cur);cur=wd}else cur=x}lines.push(cur);
  const lh=px*1.2,y0=h*$('sY').value/100-(lines.length-1)*lh/2;g.lineWidth=$('sW').value*px/64;g.strokeStyle=$('sStr').value;g.fillStyle=$('sCol').value;
  lines.forEach((l,i)=>{if(g.lineWidth>0)g.strokeText(l,w/2,y0+i*lh);g.fillText(l,w/2,y0+i*lh)})}
function syncVideos(t,play){const A=[active(t,0),active(t,1)].filter(Boolean);new Set(S.clips.map(c=>c.el)).forEach(el=>{if(typeof el.pause!=='function')return;const a=A.find(x=>x.el===el);if(a){const v=vtime(a,t);el.playbackRate=a.speed;if(!play||Math.abs(el.currentTime-v)>.4)el.currentTime=v;if(play&&el.paused)el.play().catch(()=>{})}else if(!el.paused)el.pause()})}
/* ---------- audio (mismo mezclador para vista previa y exportación) ---------- */
function schedule(c,t0,base,dest,end,vo){const L=[];
  const add=(buf,ts,rate,gain)=>{const d=buf.duration/rate;if(ts+d<=t0)return;const s=c.createBufferSource();s.buffer=buf;s.playbackRate.value=rate;const g=c.createGain();g.gain.value=gain;s.connect(g).connect(dest);
    const off=Math.max(0,(t0-ts)*rate);s.start(base+Math.max(0,ts-t0),off);L.push(s)};
  if(S.own)add(S.own,0,1,1);else S.scenes.forEach((s,i)=>{const v=S.voice[i];if(!v||v.web)return;const fit=(x,q)=>clamp(x.duration/Math.max(.5,q.end-q.start),1,1.3);add(v,s.start,fit(v,s),1);
    if(NAT()){const pv=S.voice[i-1],pe=pv?S.scenes[i-1].start+pv.duration/fit(pv,S.scenes[i-1]):0;
      if(s.start-pe>=.9||(i===0&&s.start>=.6))add(breathBuf(c),Math.max(0,s.start-.38),1,1)}});
  if(!vo&&S.music){const s=c.createBufferSource(),g=c.createGain();s.buffer=S.music.buf;s.loop=true;const v=+$('mv').value;g.gain.setValueAtTime(v,base);
    g.gain.setValueAtTime(v,base+Math.max(0,end-t0-2));g.gain.linearRampToValueAtTime(0,base+Math.max(.1,end-t0));s.connect(g).connect(dest);s.start(base,t0%S.music.buf.duration);L.push(s)}
  S.clips.forEach(k=>{const ab=!vo&&k.isV&&k.vol>0&&S.abuf.get(k.el);if(!ab||k.start+k.dur<=t0)return;const s=c.createBufferSource(),g=c.createGain();s.buffer=ab;s.playbackRate.value=k.speed;g.gain.value=k.vol;s.connect(g).connect(dest);
    const el=Math.max(0,t0-k.start);s.start(base+Math.max(0,k.start-t0),k.in+el*k.speed);s.stop(base+Math.max(0,k.start-t0)+k.dur-el);L.push(s)});return L}
/* ---------- reproducción ---------- */
function stop(){S.playing=false;webStop();cancelAnimationFrame(raf);srcs.forEach(s=>{try{s.stop()}catch(e){}});srcs=[];S.clips.forEach(c=>c.isV&&c.el.pause());$('bPlay').textContent='▶ Reproducir'}
$('bPlay').onclick=async()=>{if(S.playing)return stop();const a=AC();await a.resume();const T=total();if(S.t>=T-.05)S.t=0;S.playing=true;$('bPlay').textContent='⏸ Pausa';
  srcs=schedule(a,S.t,a.currentTime+.05,a.destination,T);webPlay(S.t);tBase=S.t;tStart=performance.now();
  const loop=()=>{S.t=tBase+(performance.now()-tStart)/1000;if(S.t>=T){S.t=T;stop()}syncVideos(S.t,S.playing);render(S.t);ui();if(S.playing)raf=requestAnimationFrame(loop)};loop()};
$('seek').oninput=()=>{const was=S.playing;stop();S.t=+$('seek').value;syncVideos(S.t,false);setTimeout(()=>render(S.t),60);ui()};
function ui(){$('seek').max=total();$('seek').value=S.t;$('tm').textContent=fmtT(S.t)+' / '+fmtT(total());$('ph').style.left=S.t*S.PX+'px'}
/* ---------- línea de tiempo ---------- */
function blk(par,l,w,txt,col,cls){const b=document.createElement('div');b.className='blk '+(cls||'');b.style.cssText=`left:${l*S.PX}px;width:${Math.max(8,w*S.PX)}px;background:${col}`;b.textContent=txt;par.appendChild(b);return b}
const TK=['tS','tX','tO','tC','tM'];
function bind(b,it){const isC=it.el!==undefined,v=isC&&it.isV;
  const pick=()=>{S.sel=isC?it:null;S.selT=isC?null:it;edit()};
  ['l','r'].forEach(side=>{const h=document.createElement('i');h.className='hd '+side;b.appendChild(h);h.onpointerdown=ev=>{ev.stopPropagation();ev.preventDefault();pick();const x0=ev.clientX,s0=it.start,d0=it.dur,i0=it.in,mx=v?((it.el.duration||9999)-.05):1e9;
    const mv=e=>{const dt=(e.clientX-x0)/S.PX;if(side==='r'){it.dur=Math.round(clamp(d0+dt,.3,v?(mx-it.in)/it.speed:1e9)*10)/10}else{let d=clamp(dt,-s0,d0-.3);if(v)d=Math.max(d,-i0/it.speed);d=Math.round(d*10)/10;it.start=s0+d;it.dur=d0-d;if(v)it.in=Math.max(0,i0+d*it.speed)}edit();draw();render(S.t)};
    const up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up)};addEventListener('pointermove',mv);addEventListener('pointerup',up)}});
  b.onpointerdown=ev=>{pick();ev.preventDefault();const x0=ev.clientX,s0=it.start;const mv=e=>{it.start=Math.max(0,Math.round((s0+(e.clientX-x0)/S.PX)*10)/10);b.style.left=it.start*S.PX+'px'},
    up=()=>{removeEventListener('pointermove',mv);removeEventListener('pointerup',up);edit();draw();render(S.t)};addEventListener('pointermove',mv);addEventListener('pointerup',up)}}
function draw(){const T=Math.ceil(total())+5,W=T*S.PX;TK.forEach(i=>{$(i).innerHTML='';$(i).parentElement.style.width=W+90+'px'});
  let r='';for(let i=0;i<T;i+=5)r+=`<span style="position:absolute;left:${90+i*S.PX}px;font-size:10px;color:#888">${fmtT(i)}</span>`;$('ruler').innerHTML=r;$('ruler').style.width=W+90+'px';
  S.scenes.forEach((s,i)=>blk($('tS'),s.start,s.end-s.start,(i+1)+'. '+s.text,S.voice[i]?'#ffd400':'#b8a64a'));
  S.texts.forEach(x=>bind(blk($('tX'),x.start,x.dur,'T '+x.text,'#ff7ab8',x===S.selT?'sel':''),x));
  S.clips.forEach(c=>bind(blk($(c.track===1?'tO':'tC'),c.start,c.dur,c.name+(c.speed!==1?' ('+c.speed+'x)':''),c.track===1?'#ffb86b':c.isV?'#6fb7ff':'#7fe3a0',c===S.sel?'sel':''),c));
  if(S.music)blk($('tM'),0,total(),'♪ '+S.music.name,'#d79bff');ui();sched()}
function edit(){const c=S.sel,x=S.selT;$('clipEd').style.display=c?'block':'none';$('textEd').style.display=x?'block':'none';
  if(x){$('xTx').value=x.text;$('xSt').value=x.start.toFixed(1);$('xDu').value=x.dur.toFixed(1);$('xSz').value=x.size;$('xCol').value=x.color;$('xStr').value=x.stroke;$('xFont').value=x.font;$('xAn').value=x.anim;$('xX').value=x.x;$('xY').value=x.y}
  if(!c)return;$('cS').value=c.start.toFixed(1);$('cD').value=c.dur.toFixed(1);$('cM').value=c.motion;$('cT').value=c.trans;$('cTr').value=c.tr;$('cTk').value=c.track||0;$('cSz').value=c.sz;$('cPx').value=c.x;$('cPy').value=c.y;
  $('cIn').value=c.in.toFixed(1);$('cSp').value=c.speed;$('cVol').value=c.vol;$('cB').value=c.fx.b;$('cCo').value=c.fx.c;$('cSa').value=c.fx.s;$('cBl').value=c.fx.bl;$('cSe').value=c.fx.sp;
  document.querySelectorAll('.vonly').forEach(e=>e.style.display=c.isV?'block':'none');document.querySelectorAll('.oonly').forEach(e=>e.style.display=c.track===1?'block':'none')}
const maxD=c=>c.isV?((c.el.duration||9999)-.05-c.in)/c.speed:1e9;
$('cS').onchange=()=>{S.sel.start=Math.max(0,+$('cS').value);draw();render(S.t)};$('cD').onchange=()=>{S.sel.dur=clamp(+$('cD').value,.3,maxD(S.sel));edit();draw();render(S.t)};
$('cIn').onchange=()=>{const c=S.sel;c.in=clamp(+$('cIn').value,0,(c.el.duration||0)-.5);c.dur=Math.min(c.dur,maxD(c));edit();draw();render(S.t)};
$('cSp').onchange=()=>{const c=S.sel,n=+$('cSp').value;c.dur=clamp(c.dur*c.speed/n,.3,(c.el.duration-.05-c.in)/n);c.speed=n;edit();draw();render(S.t)};
$('cVol').oninput=async()=>{const c=S.sel;c.vol=+$('cVol').value;if(c.vol>0&&!S.abuf.has(c.el)){$('log2').textContent='Leyendo el sonido del video…';try{S.abuf.set(c.el,await AC().decodeAudioData(await S.files.get(c.el).arrayBuffer()));$('log2').textContent=''}catch(e){c.vol=0;$('cVol').value=0;$('log2').textContent='Este video no tiene sonido o no se pudo leer.'}}sched()};
$('cM').onchange=()=>{S.sel.motion=$('cM').value;render(S.t);sched()};$('cT').onchange=()=>{S.sel.trans=$('cT').value;render(S.t);sched()};$('cTr').oninput=()=>{S.sel.tr=+$('cTr').value;render(S.t);sched()};
$('cTk').onchange=()=>{S.sel.track=+$('cTk').value;edit();draw();render(S.t)};
[['cSz','sz'],['cPx','x'],['cPy','y']].forEach(([i,k])=>$(i).oninput=()=>{S.sel[k]=+$(i).value;render(S.t);sched()});
[['cB','b'],['cCo','c'],['cSa','s'],['cBl','bl'],['cSe','sp']].forEach(([i,k])=>$(i).oninput=()=>{S.sel.fx[k]=+$(i).value;render(S.t);sched()});
$('cPre').onchange=()=>{const p=PRE[$('cPre').value];S.sel.fx={b:p[0],c:p[1],s:p[2],sp:p[3],bl:p[4]};edit();render(S.t);sched()};
$('cX').onclick=$('bDel').onclick=()=>{if(S.selT){S.texts=S.texts.filter(x=>x!==S.selT);S.selT=null}else if(S.sel){S.clips=S.clips.filter(c=>c!==S.sel);S.sel=null}else return;edit();draw();render(S.t)};
$('bText').onclick=()=>{const x={id:uid++,text:'Tu texto aquí',start:Math.round(S.t*10)/10,dur:3,x:50,y:30,size:90,color:'#ffffff',stroke:'#000000',sw:6,font:'Arial Black',anim:'pop'};S.texts.push(x);S.selT=x;S.sel=null;edit();draw();render(S.t)};
[['xTx','text'],['xSz','size'],['xCol','color'],['xStr','stroke'],['xFont','font'],['xAn','anim'],['xX','x'],['xY','y']].forEach(([i,k])=>$(i).oninput=()=>{const n=$(i).type==='range'?+$(i).value:$(i).value;S.selT[k]=n;if(k==='text')draw();render(S.t);sched()});
$('xSt').onchange=()=>{S.selT.start=Math.max(0,+$('xSt').value);draw();render(S.t)};$('xDu').onchange=()=>{S.selT.dur=Math.max(.3,+$('xDu').value);draw();render(S.t)};
$('bSplit').onclick=()=>{const c=S.sel&&S.t>S.sel.start&&S.t<S.sel.start+S.sel.dur?S.sel:active(S.t);if(!c||S.t<c.start+.2||S.t>c.start+c.dur-.2)return alert('Mueve la barra de tiempo dentro del clip (lejos de sus bordes) y pulsa Dividir.');
  const a=S.t-c.start,n={...c,fx:{...c.fx},id:uid++,start:S.t,dur:c.dur-a,in:c.in+a*c.speed,trans:'cut'};c.dur=a;S.clips.push(n);S.sel=n;S.selT=null;edit();draw();render(S.t)};
$('bDup').onclick=()=>{const c=S.sel;if(!c)return alert('Toca un clip primero.');const n={...c,fx:{...c.fx},id:uid++,start:c.start+c.dur};S.clips.push(n);S.sel=n;edit();draw()};
$('bJoin').onclick=()=>{const L=[...S.clips].filter(c=>!c.track).sort((a,b)=>a.start-b.start);let t=L.length?L[0].start:0;L.forEach(c=>{c.start=Math.round(t*10)/10;t=c.start+c.dur});draw();render(S.t)};
/* ---------- exportación MP4 (WebCodecs + mp4-muxer, sin marca de agua) ---------- */
function saveMp4(){const f=window.__lastMp4;if(!f)return;const u=URL.createObjectURL(f),a=document.createElement('a');a.href=u;a.download=f.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),60000)}
$('bSave').onclick=saveMp4;
$('bShare').onclick=async()=>{const f=window.__lastMp4;if(!f)return;try{await navigator.share({files:[f],title:'Mi video'})}catch(e){if(e.name!=='AbortError')saveMp4()}};
function seeked(v,t){return new Promise(r=>{if(Math.abs(v.currentTime-t)<.001)return r();const f=()=>{v.removeEventListener('seeked',f);r()};v.addEventListener('seeked',f);v.currentTime=t;setTimeout(r,1500)})}
$('bExport').onclick=async()=>{if(!window.VideoEncoder||!window.AudioEncoder)return alert('Tu navegador no soporta la exportación. Usa Google Chrome o Microsoft Edge actualizados (escritorio).');
  stop();$('dl').style.display='none';const btn=$('bExport');btn.disabled=true;const P=$('prog');P.style.display='block';const L=$('log2');
  try{if(!S.scenes.length)throw new Error('Pega un guion y pulsa "Analizar guion".');
    if(webOn()&&!S.own){if(!confirm('La voz del navegador suena en la vista previa pero NO se puede grabar dentro del MP4.\n\nAceptar = exportar con la "Voz integrada" (más robótica, pero queda en el video).\nCancelar = no exportar.'))throw new Error('Exportación cancelada');$('vEng').value='local';lsSet('vEng','local');S.voice=[];vUI()}
    if(!S.own&&!S.voice.length||S.scenes.some((s,i)=>!S.own&&!S.voice[i])){L.textContent='Generando voz…';try{await genVoice()}catch(e){if(!confirm('No se pudo generar la voz ('+e.message+'). ¿Exportar sin voz?'))throw new Error('Exportación cancelada');}}
    const T=total(),fps=30,[w,h]=dims(+$('res').value),SR=48000;L.textContent='Mezclando audio…';
    const oc=new OfflineAudioContext(2,Math.ceil(T*SR),SR);schedule(oc,0,0,oc.destination,T).forEach(()=>{});const mix=await oc.startRendering();let mixPk=0;{const c0=mix.getChannelData(0);for(let i=0;i<c0.length;i+=7)mixPk=Math.max(mixPk,Math.abs(c0[i]))}
    let vc={codec:'avc1.640034',width:w,height:h,bitrate:h>=1000?10e6:6e6,framerate:fps},vk='avc';if(!(await VideoEncoder.isConfigSupported(vc)).supported){vc.codec='vp09.00.40.08';vk='vp9';if(!(await VideoEncoder.isConfigSupported(vc)).supported)throw new Error('Tu navegador no puede codificar video a esta resolución. Prueba 720p o usa Chrome/Edge.')}
    let ac={codec:'mp4a.40.2',sampleRate:SR,numberOfChannels:2,bitrate:192e3},ak='aac';if(!(await AudioEncoder.isConfigSupported(ac)).supported){ac.codec='opus';ak='opus';if(!(await AudioEncoder.isConfigSupported(ac)).supported)throw new Error('Tu navegador no puede codificar audio. Usa Chrome/Edge.')}
    const target=new Mp4Muxer.ArrayBufferTarget(),mux=new Mp4Muxer.Muxer({target,video:{codec:vk,width:w,height:h},audio:{codec:ak,numberOfChannels:2,sampleRate:SR},fastStart:'in-memory'});
    const ve=new VideoEncoder({output:(c,m)=>mux.addVideoChunk(c,m),error:e=>{throw e}});ve.configure(vc);
    const ae=new AudioEncoder({output:(c,m)=>mux.addAudioChunk(c,m),error:e=>{throw e}});ae.configure(ac);
    const ch0=mix.getChannelData(0),ch1=mix.getChannelData(1),N=2048;
    for(let p=0;p<ch0.length;p+=N){const n=Math.min(N,ch0.length-p),d=new Float32Array(n*2);d.set(ch0.subarray(p,p+n));d.set(ch1.subarray(p,p+n),n);
      const ad=new AudioData({format:'f32-planar',sampleRate:SR,numberOfFrames:n,numberOfChannels:2,timestamp:Math.round(p/SR*1e6),data:d});ae.encode(ad);ad.close()}
    const ec=document.createElement('canvas');ec.width=w;ec.height=h;const eg=ec.getContext('2d'),F=Math.ceil(T*fps);L.textContent='Renderizando video…';
    /* Los videos se REPRODUCEN mientras se exporta (en vez de saltar cuadro por cuadro, que es muy lento): el tiempo de exportación ≈ la duración de tus videos */
    const els=new Set(S.clips.filter(c=>c.isV).map(c=>c.el)),st=new Map(),sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const need=t=>{const m=new Map();for(const trk of [0,1]){const c=active(t,trk);if(c&&c.isV){const tr=Math.min(c.tr,c.dur/2),pv=!trk&&c.trans!=='cut'&&t-c.start<tr?prevOf(c):null;
        if(pv&&pv.isV&&pv.el!==c.el)m.set(pv.el,{t:vtime(pv,pv.start+pv.dur),sp:1,still:true});m.set(c.el,{t:vtime(c,t),sp:c.speed,still:false})}}return m};
    async function getFrame(el,o){let q=st.get(el);if(!q){q={play:false};st.set(el,q)}
      if(!o.still&&q.play&&!el.paused&&el.currentTime-o.t<.12&&o.t-el.currentTime<.25){let n=0;while(el.currentTime<o.t-.012&&n++<250)await sleep(4);return}
      el.pause();q.play=false;el.playbackRate=clamp(o.sp,.0625,16);await seeked(el,o.t);if(!o.still){q.play=true;el.play().catch(()=>{q.play=false})}}
    for(let i=0;i<F;i++){const t=i/fps,m=need(t);
      for(const [el,o] of m)await getFrame(el,o);
      for(const el of els){const q=st.get(el);if(!m.has(el)&&q&&q.play){el.pause();q.play=false}}
      render(t,eg,w,h);const vf=new VideoFrame(ec,{timestamp:Math.round(i*1e6/fps),duration:Math.round(1e6/fps)});ve.encode(vf,{keyFrame:i%60===0});vf.close();
      while(ve.encodeQueueSize>8)await new Promise(r=>setTimeout(r,5));if(i%15===0){P.value=i/F;L.textContent=`Renderizando video… ${Math.round(i/F*100)}%`;await new Promise(r=>setTimeout(r))}}
    els.forEach(v=>v.pause());await ve.flush();await ae.flush();mux.finalize();
    const vf2=new File([target.buffer],'mi-video.mp4',{type:'video/mp4'});window.__lastMp4=vf2;const canShare=!!(navigator.canShare&&navigator.canShare({files:[vf2]})),mobile=/Android|iPhone|iPad/i.test(navigator.userAgent);
    $('dl').style.display='flex';$('bShare').style.display=canShare?'':'none';
    if(!mobile||!canShare)saveMp4();
    const hasVoice=!!(S.own||S.voice.some(v=>v&&!v.web)),aud=mixPk<.002?'⚠ El video quedó SIN audio'+(hasVoice?'.':(webOn()?' porque la voz del navegador no se puede grabar dentro del MP4 (usa "Voz con audio en el MP4" o sube tu narración).':' porque no se generó la voz (sube tu narración o cambia de motor) ni hay música.')):(ak==='opus'?'⚠ Audio guardado en formato Opus: tu teléfono no tiene AAC y Fotos/Galería puede reproducirlo sin sonido (en YouTube y en computador sí suena). Si pasa, exporta desde un computador.':'🔊 Audio incluido (AAC).');
    L.textContent=aud+'\n✅ Listo: mi-video.mp4 ('+(target.buffer.byteLength/1e6).toFixed(1)+' MB) '+w+'x'+h+(canShare&&mobile?'. Toca "Guardar en Fotos / Compartir" y elige "Guardar video" (iPhone) o Google Fotos / Galería (Android).':'. Se descargó en tu carpeta de Descargas.');window.onExported&&window.onExported(target.buffer.byteLength)
  }catch(e){L.textContent='Error: '+e.message}
  EO=null;btn.disabled=false;P.style.display='none';render(S.t)};
setSize();draw();restoreProject();window.__S=S;window.__render=render;
