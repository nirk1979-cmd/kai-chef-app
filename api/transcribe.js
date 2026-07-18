// api/transcribe.js
// Serverless function that proxies audio to OpenAI's Whisper API for Hebrew transcription.
// Requires OPENAI_API_KEY environment variable set on Vercel.

export const config = {
  runtime: 'edge',
};

export default async function handler(request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: 'OpenAI API key not configured',
        hint: 'Add OPENAI_API_KEY environment variable in Vercel project settings.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Client sends raw audio bytes as the request body
    const contentType = request.headers.get('content-type') || 'audio/webm';
    const audioBuffer = await request.arrayBuffer();

    if (audioBuffer.byteLength === 0) {
      return new Response(
        JSON.stringify({ error: 'Empty audio' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Basic size guard - max 25MB (Whisper limit)
    if (audioBuffer.byteLength > 25 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: 'Audio too large (max 25MB)' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determine file extension from content type
    let filename = 'audio.webm';
    if (contentType.includes('mp4') || contentType.includes('m4a')) filename = 'audio.m4a';
    else if (contentType.includes('mp3') || contentType.includes('mpeg')) filename = 'audio.mp3';
    else if (contentType.includes('ogg')) filename = 'audio.ogg';
    else if (contentType.includes('wav')) filename = 'audio.wav';

    // Build multipart form data for OpenAI
    const formData = new FormData();
    const audioBlob = new Blob([audioBuffer], { type: contentType });
    formData.append('file', audioBlob, filename);
    formData.append('model', 'whisper-1');
    formData.append('language', 'he');
    formData.append('response_format', 'json');
    formData.append('temperature', '0');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: data.error?.message || 'Transcription failed',
          status: response.status
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ text: (data.text || '').trim() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
