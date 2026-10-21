// Netlify Function: Proxy de Edge TTS
exports.handler = async (event) => {
  try {
    const params = new URLSearchParams(event.body || event.rawQuery || '');
    const text = (params.get('text') || '').trim().slice(0, 600);
    const voice = params.get('voice') || 'es-CL-LorenzoNeural';

    if (!text) return { statusCode: 400, body: 'Texto vacío' };

    // Usamos el proveedor de Edge TTS directo para obtener el audio en mp3
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=es&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!res.ok) throw new Error('Error al generar audio');

    const arrayBuffer = await res.arrayBuffer();
    const base64Audio = Buffer.from(arrayBuffer).toString('base64');

    return {
      statusCode: 200,
      headers: { 
        'Content-Type': 'audio/mpeg',
        'Access-Control-Allow-Origin': '*'
      },
      body: base64Audio,
      isBase64Encoded: true
    };
  } catch (err) {
    return { statusCode: 500, body: String(err) };
  }
};
