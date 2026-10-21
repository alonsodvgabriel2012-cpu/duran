// Netlify Function: Proxy directo para Edge TTS (Voces masculinas neuronales)
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

    // Endpoint directo a la API de Edge TTS
    const edgeUrl = `https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/single/tts?OsName=Windows&OsVersion=10.0.19045.1000&ClientName=mseedgedriver`;
    
    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='es-ES'><voice name='${voice}'><prosody pitch='+0Hz' rate='+0%'>${text}</prosody></voice></speak>`;

    const res = await fetch(edgeUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'
      },
      body: ssml
    });

    if (!res.ok) throw new Error('Error en Edge TTS: ' + res.status);

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
