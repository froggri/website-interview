const { kv, createContact, createDeal, createSession, createActivity } = require('../../lib/kv');

function checkAuth(req, res) {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || req.headers['x-admin-token'] !== pw) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkAuth(req, res)) return;

  const tokens = (await kv.smembers('tokens')) || [];
  const results = { migrated: 0, skipped: 0, errors: [] };

  for (const token of tokens) {
    try {
      // Idempotency: skip if token:{token} lookup (new schema) already exists
      const alreadyMigrated = await kv.get(`token:${token}`);
      if (alreadyMigrated) { results.skipped++; continue; }

      const oldUser = await kv.get(`user:${token}`);
      if (!oldUser) { results.skipped++; continue; }

      const oldSession = await kv.get(`session:${token}`);

      // 1. CONTACT from old user data
      const contact = await createContact({
        name:    oldUser.name    || '',
        context: oldUser.context || '',
        source:  oldUser.invited === false ? 'landing-page' : 'manuell',
        status:  'lead',
      });

      // 2. DEAL — one default deal per legacy contact
      const deal = await createDeal({
        contactId: contact.id,
        title:     'Website-Projekt',
        stage:     oldUser.sessionStatus === 'completed' ? 'briefing' : 'anfrage',
      });

      // 3. SESSION — reuse old token so existing /i/{token} links keep working
      const session = await createSession({
        dealId:    deal.id,
        contactId: contact.id,
        token,
        type:      oldUser.designSession ? 'design' : 'requirements',
        title:     oldUser.designSession ? 'Design-Interview' : 'Requirements-Interview',
        questions: oldUser.questions || [],
        status:    oldUser.sessionStatus === 'completed'
          ? 'abgeschlossen'
          : (oldSession?.messages?.length > 1 ? 'in-bearbeitung' : 'offen'),
      });

      // 4. Populate new session with existing conversation data
      if (oldSession) {
        await kv.set(`session:${session.id}`, {
          ...session,
          messages:    oldSession.messages  || [],
          briefingText: oldSession.briefing || null,
          completedAt: oldUser.sessionStatus === 'completed'
            ? (oldSession.updatedAt || new Date().toISOString())
            : null,
        });

        // 5. ACTIVITY for completed sessions
        if (oldSession.briefing) {
          const isMockup = oldSession.briefing.startsWith('===MOCKUP===');
          await createActivity({
            contactId: contact.id,
            dealId:    deal.id,
            sessionId: session.id,
            type:      'session-summary',
            direction: 'internal',
            subject:   `Briefing: ${oldUser.designSession ? 'Design' : 'Requirements'} Interview`,
            body:      isMockup ? '[HTML-Mockup generiert]' : oldSession.briefing,
            createdBy: 'ai',
          });
        }
      }

      // 6. Keep old data intact as backup — legacy routes still read user:{token}
      await kv.set(`contact:legacy:${token}`, {
        ...oldUser,
        _migratedAt: new Date().toISOString(),
        _newContactId: contact.id,
        _newDealId: deal.id,
        _newSessionId: session.id,
      });

      results.migrated++;
    } catch (err) {
      results.errors.push({ token, error: err.message });
    }
  }

  return res.status(200).json({
    ok:       results.errors.length === 0,
    total:    tokens.length,
    migrated: results.migrated,
    skipped:  results.skipped,
    errors:   results.errors,
  });
};
