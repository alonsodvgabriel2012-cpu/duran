/* Parser de guiones: "0 a 5 seg: texto". Los tiempos SOLO sincronizan; nunca forman parte del texto. */
(function(root){
  const N='(\\d{1,2}:\\d{2}(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?)';
  const SEP='(?:-|–|—|a|al|hasta|to)';
  const U='(?:seg(?:undos?)?\\.?|s|sec)?';
  const RE=new RegExp('^\\s*[\\[\\(]?\\s*'+N+'\\s*'+U+'\\s*'+SEP+'\\s*'+N+'\\s*'+U+'\\s*[\\]\\)]?\\s*:\\s*(.*)$','i');
  const toSec=s=>{s=s.replace(',','.');if(s.includes(':')){const[m,x]=s.split(':');return (+m)*60+parseFloat(x)}return parseFloat(s)};
  function parseScript(raw,wps){
    wps=wps||2.5; const out=[]; let cur=null;
    const lines=String(raw||'').replace(/\r/g,'').split('\n');
    for(const line of lines){
      const m=line.match(RE);
      if(m){ if(cur)out.push(cur); cur={start:toSec(m[1]),end:toSec(m[2]),text:m[3].trim(),timed:true}; }
      else if(!line.trim()){ if(cur)cur.closed=true; }
      else { if(cur&&cur.timed&&!cur.closed) cur.text+=(cur.text?' ':'')+line.trim();
        else { if(cur)out.push(cur); cur={start:null,end:null,text:line.trim(),timed:false}; } }
    }
    if(cur)out.push(cur);
    let t=0; // sin marcas: calcula duración por nº de palabras
    for(const s of out){
      if(!s.timed){const w=s.text.split(/\s+/).length;s.start=t;s.end=t+Math.max(1.5,w/wps);}
      if(s.end<=s.start)s.end=s.start+Math.max(1.5,s.text.split(/\s+/).length/wps);
      t=s.end;
    }
    return out.filter(s=>s.text).map(({start,end,text})=>({start,end,text}));
  }
  const api={parseScript};
  if(typeof module!=='undefined')module.exports=api; else root.Parser=api;
})(this);
