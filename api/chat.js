// api/chat.js
// Serverless function that proxies requests to Anthropic's API.
// The API key stays on the server as an environment variable and never reaches the browser.
//
// Uses Node.js runtime (not Edge) so we can extend maxDuration to 60s -
// some Hebrew recipe generations take 20-45s and were hitting Edge's 25s cap, causing 504.

export const config = {
  runtime: 'nodejs',
  maxDuration: 60,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server not configured. Set ANTHROPIC_API_KEY on Vercel.' });
  }

  try {
    const body = req.body || {};
    if (body.max_tokens && body.max_tokens > 4096) body.max_tokens = 4096;
    if (!body.model) body.model = 'claude-sonnet-5';

    // Give Claude up to 55s - just under Vercel's 60s function limit
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const text = await response.text();
    res.setHeader('Content-Type', 'application/json');
    return res.status(response.status).send(text);
  } catch (error) {
    if (error.name === 'AbortError') {
      return res.status(504).json({ error: 'Claude לקח יותר מדי זמן. נסה שוב עם בקשה פשוטה יותר.' });
    }
    return res.status(500).json({ error: error.message || 'Internal error' });
  }
}
