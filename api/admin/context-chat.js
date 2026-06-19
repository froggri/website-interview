const CONTEXT_PROMPT = `Du hilfst Philipp dabei, schnell Kontext über eine Person zu sammeln, für die er eine Website bauen möchte. Philipp ist Website-Entwickler und kennt die Person.

Stelle 3-4 gezielte kurze Fragen:
1. Wer sind sie (Beruf, Branche, was machen sie konkret)?
2. Was ist das primäre Ziel der Website?
3. Gibt es besondere Anforderungen oder Wünsche?
4. Was weißt du bereits über ihre Zielgruppe?

Nach den Fragen fasse alles in 2-3 prägnanten Sätzen zusammen, die direkt als KI-Briefing-Kontext dienen.

Format (zuletzt):
===KONTEXT_START===
[Zusammenfassung in 2-3 Sätzen]
===KONTEXT_END===

Antworte auf Deutsch. Beginne direkt mit der ersten Frage.`;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || req.headers['x-admin-token'] !== pw) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: CONTEXT_PROMPT,
      messages,
    }),
  });

  if (!response.ok) {
    return res.status(response.status).json({ error: await response.text() });
  }

  return res.status(200).json(await response.json());
};
