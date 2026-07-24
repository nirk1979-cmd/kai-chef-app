// /api/tts.js - Proxies to OpenAI Text-to-Speech
// Uses the same OPENAI_API_KEY that Whisper uses (already configured on Vercel).
// Returns audio/mpeg audio that the client plays via <audio>.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
  }

  const { text, voice = 'onyx', model = 'tts-1' } = req.body || {};
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'text is required' });
  }

  // Safety: OpenAI limit is 4096 chars per request
  const input = String(text).slice(0, 4000);

  // Voices: alloy, echo, fable, onyx, nova, shimmer
  //   onyx  - deep warm male (default for chef Kai)
  //   nova  - warm friendly female
  //   fable - british accent male
  //   echo  - crisp male
  //   shimmer - soft female
  //   alloy - neutral
  const allowedVoices = ['alloy','echo','fable','onyx','nova','shimmer'];
  const chosenVoice = allowedVoices.includes(voice) ? voice : 'onyx';

  try {
    const openaiResp = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model === 'tts-1-hd' ? 'tts-1-hd' : 'tts-1',
        voice: chosenVoice,
        input: input,
        speed: 1.0,
        response_format: 'mp3'
      })
    });

    if (!openaiResp.ok) {
      const err = await openaiResp.text();
      return res.status(openaiResp.status).json({ error: 'OpenAI TTS failed', details: err.slice(0, 300) });
    }

    const arrayBuffer = await openaiResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).send(buffer);
  } catch (err) {
    return res.status(500).json({ error: 'TTS request failed', details: String(err).slice(0, 200) });
  }
}
