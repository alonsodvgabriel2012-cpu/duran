// Netlify Function: TTS gratuito sin claves para voces de hombre
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

    // Mapeo a voces masculinas / regionales públicas
    let lang = 'es-es';
    if (voice.includes('CL') || voice.includes('Lorenzo')) lang = 'es-cl';
    if (voice.includes('MX') || voice.includes('Jorge')) lang = 'es-mx';

    // Petición directa a endpoint público de audio
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=${encodeURIComponent(text)}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!response.ok) throw new Error('Error al obtener el audio');

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
    return { 
      statusCode: 200, 
      headers: { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*' },
      body: '' 
    };
  }
};
