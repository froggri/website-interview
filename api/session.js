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
    const updated = await updateSessionById(sessionId, {
      status: 'abgeschlossen',
      completedAt: new Date().toISOString(),
    });
    if (session.briefingText) {
      await createActivity({
        contactId: session.contactId,
        dealId:    session.dealId,
        sessionId: session.id,
        type:      'session-summary',
        direction: 'internal',
        subject:   `Briefing: ${session.title}`,
        body:      session.briefingText,
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
