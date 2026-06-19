const { getActivitiesByContact, getActivitiesByDeal, createActivity } = require('../lib/kv');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkAuth(req, res)) return;

  if (req.method === 'GET') {
    const { dealId, contactId } = req.query;
    if (!dealId && !contactId) return res.status(400).json({ error: 'dealId or contactId required' });
    const activities = dealId
      ? await getActivitiesByDeal(dealId)
      : await getActivitiesByContact(contactId);
    return res.status(200).json(activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  if (req.method === 'POST') {
    const { contactId, dealId, sessionId, type, direction, subject, body, createdBy } = req.body || {};
    if (!contactId) return res.status(400).json({ error: 'contactId required' });
    if (!body) return res.status(400).json({ error: 'body required' });
    const activity = await createActivity({ contactId, dealId, sessionId, type, direction, subject, body, createdBy });
    return res.status(201).json(activity);
  }

  return res.status(405).end();
};
