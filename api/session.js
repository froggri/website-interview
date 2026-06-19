const {
  getUser, getSession,
  getTokenLookup, getSessionById, getContact,
  createActivity, updateSessionById,
} = require('../lib/kv');

async function resolveToken(token) {
  const lookup = await getTokenLookup(token);
  if (lookup) {
    const [session, contact] = await Promise.all([
      getSessionById(lookup.sessionId),
      getContact(lookup.contactId),
    ]);
    if (session && contact) return { type: 'new', session, contact };
  }
  const [user, session] = await Promise.all([getUser(token), getSession(token)]);
  if (user) return { type: 'legacy', user, session };
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // POST /api/session/complete (routed via ?sub=complete)
  if (req.method === 'POST' && req.query.sub === 'complete') {
    const pw = process.env.ADMIN_PASSWORD;
    if (!pw || req.headers['x-admin-token'] !== pw) return res.status(401).json({ error: 'Unauthorized' });
    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
    const session = await getSessionById(sessionId);
    if (!session) return res.status(404).json({ error: 'session not found' });

    let briefingText = session.briefingText;
    let briefingJson = session.briefingJson;

    // Generate dual briefing from transcript if we have messages but no briefing yet
    const msgs = session.messages || [];
    const hasConversation = msgs.filter(m => m.role === 'user').length >= 3;
    if (hasConversation && !briefingText && process.env.ANTHROPIC_API_KEY) {
      const transcript = msgs
        .map(m => `${m.role === 'assistant' ? 'PO' : 'Stakeholder'}: ${typeof m.content === 'string' ? m.content : '[Bild]'}`)
        .join('\n\n');

      const briefingPrompt = `Du bist Business Analyst. Analysiere dieses Interview-Transkript und erstelle ein vollständiges Briefing in zwei Formaten.

TRANSKRIPT:
${transcript}

Erstelle exakt folgende zwei Blöcke — nichts davor, nichts danach:

===BRIEFING_START===
NAME: [Vorname des Stakeholders]
BERUF: [Beruf/Business in 1-2 Sätzen]
ZIELGRUPPE: [Zielgruppe, 2-3 Sätze]
KERNBOTSCHAFT: [Was die Website kommunizieren soll, 1 Satz]
USP: [Alleinstellungsmerkmale, 2-3 Punkte]
STRUKTUR: [Gewünschte Seiten/Bereiche]
STIL: [Tonalität, Stil, Referenzen]
ZIEL: [Primäres Website-Ziel]
TECHNIK: [Technische Anforderungen]
AUSSCHLUESSE: [Was nicht auf die Website soll]
BESONDERHEITEN: [Weitere wichtige Infos]
===BRIEFING_END===

===BRIEFING_JSON_START===
{"name":"...","beruf":"...","zielgruppe":"...","kernbotschaft":"...","usp":["..."],"struktur":["..."],"stil":"...","ziel":"...","technik":["..."],"ausschluesse":["..."],"besonderheiten":"..."}
===BRIEFING_JSON_END===`;

      try {
        const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: 2048,
            messages: [{ role: 'user', content: briefingPrompt }],
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const reply = aiData.content?.[0]?.text ?? '';
          const textMatch = reply.match(/===BRIEFING_START===([\s\S]*?)===BRIEFING_END===/);
          const jsonMatch = reply.match(/===BRIEFING_JSON_START===([\s\S]*?)===BRIEFING_JSON_END===/);
          if (textMatch) briefingText = textMatch[0];
          if (jsonMatch) {
            try { briefingJson = JSON.parse(jsonMatch[1].trim()); } catch {}
          }
        }
      } catch {}
    }

    const updated = await updateSessionById(sessionId, {
      status: 'abgeschlossen',
      completedAt: new Date().toISOString(),
      briefingText,
      briefingJson,
    });

    if (briefingText) {
      await createActivity({
        contactId: session.contactId,
        dealId:    session.dealId,
        sessionId: session.id,
        type:      'session-summary',
        direction: 'internal',
        subject:   `Briefing: ${session.title}`,
        body:      briefingText,
        createdBy: 'ai',
      });
    }
    return res.status(200).json(updated);
  }

  // GET /api/session?token=
  if (req.method !== 'GET') return res.status(405).end();
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token required' });

  const resolved = await resolveToken(token);
  if (!resolved) return res.status(404).json({ error: 'Invalid token' });

  if (resolved.type === 'new') {
    const { session, contact } = resolved;
    const user = {
      name:          contact.name,
      invited:       true,
      designSession: session.type === 'design',
      sessionStatus: session.status === 'abgeschlossen' ? 'completed'
                   : session.status === 'in-bearbeitung' ? 'in_progress'
                   : null,
    };
    const legacySession = session.messages?.length || session.briefingText
      ? { messages: session.messages || [], briefing: session.briefingText || null }
      : null;
    return res.status(200).json({ user, session: legacySession });
  }

  return res.status(200).json({ user: resolved.user, session: resolved.session || null });
};
