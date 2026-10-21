// Netlify Function: Proxy directo para Edge TTS con mapeo de voces neuronales
const VOICE_MAP = {
  'es-CL-LorenzoNeural': 'es-CL-LorenzoNeural',
  'es-MX-JorgeNeural': 'es-MX-JorgeNeural',
  'es-ES-AlvaroNeural': 'es-ES-AlvaroNeural',
  'es-CL': 'es-CL-LorenzoNeural',
  'es-MX': 'es-MX-JorgeNeural'
};

exports.handler = async (event) => {
  try {
    const params = new URLSearchParams(event.body || event.rawQuery || '');
    let text = params.get('text') || '';
    let voice = params.get('voice') || 'es-CL-LorenzoNeural';

    if (!text && event.body) {
      try {
        const jsonBody = JSON.parse(event.body);
        text = jsonBody.text || jsonBody.q || '';
        if (jsonBody.voice) voice = jsonBody.voice;
      } catch (e) {}
    }

    text = text.trim().slice(0, 600);
    if (!text) return { statusCode: 400, body: 'Texto vacio' };

    // Seleccionar la voz neuronal o usar Lorenzo como predeterminada
    const selectedVoice = VOICE_MAP[voice] || 'es-CL-LorenzoNeural';

    // Petición al servicio de síntesis de voz neuronal de Microsoft
    const url = `https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(selectedVoice)}&text=${encodeURIComponent(text)}`;
    const res = await fetch(url);

    if (!res.ok) {
      // Fallback a voz alternativa de hombre si la específica falla
      const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=es&q=${encodeURIComponent(text)}`;
      const fallbackRes = await fetch(fallbackUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const fallbackBuffer = await fallbackRes.arrayBuffer();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*' },
        body: Buffer.from(fallbackBuffer).toString('base64'),
        isBase64Encoded: true
      };
    }

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
