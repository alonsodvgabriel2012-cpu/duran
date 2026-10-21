// Netlify Function: voces neuronales de Microsoft Edge (gratis, sin clave) -> devuelve un MP3.
// Usa "msedge-tts", la implementación para Node.js del servicio Edge TTS (el mismo que usa la librería "edge-tts").
// Petición:  POST /.netlify/functions/tts-edge   con JSON { text, voice, rate?, natural? }
// Respuesta: MP3 (Content-Type: audio/mpeg), cuerpo en base64 (isBase64Encoded: true).
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const VOICES = new Set([
  'es-CL-LorenzoNeural', 'es-CL-CatalinaNeural',
  'es-MX-DaliaNeural', 'es-MX-JorgeNeural',
  'es-ES-AlvaroNeural', 'es-ES-ElviraNeural', 'es-US-PalomaNeural'
]);
const MAX_CHARS = 600;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const withPauses = (s) => esc(s)
  .replace(/([,;:])\s+/g, '$1<break time="160ms"/> ')
  .replace(/([.!?…])\s+/g, '$1<break time="320ms"/> ');
const fail = (statusCode, msg) => ({ statusCode, headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' }, body: msg });

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return fail(405, 'Usa POST con JSON { text, voice }');

  let body;
  try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : (event.body || '{}')); }
  catch (e) { return fail(400, 'JSON invalido'); }

  const text = String(body.text || '').trim().slice(0, MAX_CHARS);
  if (!text) return fail(400, 'texto vacio');
  if (!VOICES.has(body.voice)) return fail(400, 'voz no disponible');
  const rate = Math.min(1.6, Math.max(0.5, Number(body.rate) || 1));

  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(body.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(body.natural ? withPauses(text) : esc(text), { rate });
    const chunks = [];
    for await (const c of audioStream) chunks.push(c);
    const audio = Buffer.concat(chunks);
    if (!audio.length) throw new Error('audio vacio');
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
      body: audio.toString('base64'),
      isBase64Encoded: true
    };
  } catch (e) {
    return fail(502, 'Fallo la voz Edge: ' + String(e && e.message || e));
  } finally {
    try { tts.close(); } catch (e) {}
  }
};
