// Netlify Function: Proxy de Edge TTS
exports.handler = async (event) => {
  try {
    // Lee el texto tanto si viene por POST (body) como si viene por GET (URL query)
    const params = new URLSearchParams(event.body || event.rawQuery || '');
    let text = params.get('text') || '';

    // Si viene en formato JSON
    if (!text && event.body) {
      try {
        const jsonBody = JSON.parse(event.body);
        text = jsonBody.text || jsonBody.q || '';
      } catch (e) {}
    }

    text = text.trim().slice(0, 600);

    if (!text) {
      return { statusCode: 400, body: 'Texto vacio' };
    }

    // Petición de audio
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=es&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    if (!res.ok) throw new Error('Error en proveedor');

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
