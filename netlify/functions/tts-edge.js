// Netlify Function: Proxy con voz masculina real de ElevenLabs (Gratis sin registro)
exports.handler = async (event) => {
  try {
    const params = new URLSearchParams(event.body || event.rawQuery || '');
    let text = params.get('text') || '';

    if (!text && event.body) {
      try {
        const jsonBody = JSON.parse(event.body);
        text = jsonBody.text || jsonBody.q || '';
      } catch (e) {}
    }

    text = text.trim().slice(0, 600);
    if (!text) return { statusCode: 400, body: 'Texto vacio' };

    // ID de voz masculina real (Adam/Antoni en ElevenLabs)
    const voiceId = "pNInz6obpgDQGcFmaJgB"; 

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0'
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2"
      })
    });

    if (!response.ok) {
      // Si falla, regresa un audio de respaldo en lugar de error 500
      const fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=es&q=${encodeURIComponent(text)}`;
      const resFallback = await fetch(fallbackUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const fallbackBuffer = await resFallback.arrayBuffer();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*' },
        body: Buffer.from(fallbackBuffer).toString('base64'),
        isBase64Encoded: true
      };
    }

    const arrayBuffer = await response.arrayBuffer();
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
