// Netlify Function: Proxy de voces Edge / Google según selección de voz
const TLD_MAP = {
  'es-CL': 'com.mx',
  'es-CL-LorenzoNeural': 'com.mx',
  'es-MX': 'com.mx',
  'es-MX-JorgeNeural': 'com.mx',
  'es-ES': 'es',
  'es-US': 'com'
};

exports.handler = async (event) => {
  try {
    const params = new URLSearchParams(event.body || event.rawQuery || '');
    let text = params.get('text') || '';
    let voice = params.get('voice') || 'es-CL';

    if (!text && event.body) {
      try {
        const jsonBody = JSON.parse(event.body);
        text = jsonBody.text || jsonBody.q || '';
        if (jsonBody.voice) voice = jsonBody.voice;
      } catch (e) {}
    }

    text = text.trim().slice(0, 600);
    if (!text) return { statusCode: 400, body: 'Texto vacio' };

    const tld = TLD_MAP[voice] || 'com.mx';
    
    // Generación de la voz con los parámetros seleccionados
    const url = `https://translate.google.${tld}/translate_tts?ie=UTF-8&client=tw-ob&tl=es&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    if (!res.ok) throw new Error('Error al conectar con el motor de voz');

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
