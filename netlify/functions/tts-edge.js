// Netlify Function: Proxy estable para Edge TTS usando API pública optimizada
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

    // Petición a un servicio proxy de Edge TTS altamente compatible con Netlify
    const response = await fetch(`https://api.streamelements.com/kappa/v2/speech?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`);

    if (!response.ok) {
      throw new Error('Fallo al conectar con el sintetizador de voz neuronal');
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
