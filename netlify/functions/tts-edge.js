// Netlify Function: Proxy para Edge TTS (Voces masculinas neuronales)
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

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

    // Inicializar el cliente de Edge TTS
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_STEREO_MP3);

    const readable = tts.toStream(text);
    const chunks = [];

    for await (const chunk of readable) {
      chunks.push(chunk);
    }

    const audioBuffer = Buffer.concat(chunks);
    const base64Audio = audioBuffer.toString('base64');

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
