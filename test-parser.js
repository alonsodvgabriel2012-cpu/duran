const {parseScript}=require('./parser.js');const assert=require('assert');
const r=parseScript(`0 a 5 seg: Hola, bienvenidos al canal.
5-10 seg: Hoy veremos 3 cosas: una, dos y tres.
continúa la misma escena
[10 – 15.5 s]: Entre las 10:30 y las 11:00
0:15-0:20: Tiempo con minutos

Frase sin marca.`);
console.log(r);
assert.equal(r[0].text,'Hola, bienvenidos al canal.');assert.equal(r[0].start,0);assert.equal(r[0].end,5);
assert.equal(r[1].text,'Hoy veremos 3 cosas: una, dos y tres. continúa la misma escena');
assert.equal(r[2].end,15.5);assert.equal(r[3].start,15);assert.equal(r[3].end,20);
assert.equal(r[4].start,20);
for(const s of r)assert(!/\bseg\b|^\d+\s*(a|-)\s*\d+/i.test(s.text),'Tiempo filtrado en texto: '+s.text);
console.log('OK parser');
