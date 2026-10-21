// Netlify Function: proxy de voz gratuita (Google). Recibe SOLO texto del guion.
const TLD={'es-ES':'es','es-ES-H':'es','es-MX':'com.mx','es-MX-H':'com.mx','es-US':'com','es-CL':'com.mx','es-CL-H':'com.mx'};
exports.handler=async(ev)=>{
  try{
    const p=new URLSearchParams(ev.body||ev.rawQuery||'');const text=(p.get('text')||'').trim().slice(0,600);
    if(!text)return{statusCode:400,body:'texto vacio'};
    const tld=TLD[p.get('voice')]||'es';
    const r=await fetch(`https://translate.google.${tld}/translate_tts?ie=UTF-8&client=tw-ob&tl=es&q=${encodeURIComponent(text)}`,{headers:{'User-Agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36'}});
    if(!r.ok)return{statusCode:502,body:'Fallo el proveedor de voz (HTTP '+r.status+')'};
    return{statusCode:200,headers:{'Content-Type':'audio/mpeg'},body:Buffer.from(await r.arrayBuffer()).toString('base64'),isBase64Encoded:true};
  }catch(e){return{statusCode:500,body:String(e)}}
};
