const {
  getAllDeals, createDeal, getDeal, updateDeal, getDealsByContact,
  getSessionsByDeal, createSession,
  getTasksByDeal, getSubtasks, createTask,
  getActivitiesByDeal,
} = require('../lib/kv');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkAuth(req, res)) return;

  const { dealId, sub, contactId } = req.query;

  // /api/deals/:dealId/sessions
  if (dealId && sub === 'sessions') {
    if (req.method === 'GET') {
      const sessions = await getSessionsByDeal(dealId);
      return res.status(200).json(sessions);
    }
    if (req.method === 'POST') {
      const deal = await getDeal(dealId);
      if (!deal) return res.status(404).json({ error: 'deal not found' });
      const { type, title, questions } = req.body || {};
      const session = await createSession({
        dealId,
        contactId: deal.contactId,
        type: type || 'requirements',
        title: title || 'Interview',
        questions: questions || [],
      });
      return res.status(201).json(session);
    }
    return res.status(405).end();
  }

  // /api/deals/:dealId/tasks
  if (dealId && sub === 'tasks') {
    if (req.method === 'GET') {
      const all = await getTasksByDeal(dealId);
      const roots = all.filter(t => !t.parentId);
      const withSubs = await Promise.all(roots.map(async t => ({
        ...t,
        subtasks: await getSubtasks(t.id),
      })));
      return res.status(200).json(withSubs.sort((a, b) => a.order - b.order));
    }
    if (req.method === 'POST') {
      const task = await createTask({ dealId, ...(req.body || {}) });
      return res.status(201).json(task);
    }
    return res.status(405).end();
  }

  // /api/deals/:dealId
  if (dealId) {
    if (req.method === 'GET') {
      const deal = await getDeal(dealId);
      if (!deal) return res.status(404).json({ error: 'not found' });
      const [sessions, activities, tasks] = await Promise.all([
        getSessionsByDeal(dealId),
        getActivitiesByDeal(dealId),
        getTasksByDeal(dealId),
      ]);
      return res.status(200).json({ ...deal, sessions, activities, tasks });
    }
    if (req.method === 'PATCH') {
      const updated = await updateDeal(dealId, req.body || {});
      if (!updated) return res.status(404).json({ error: 'not found' });
      return res.status(200).json(updated);
    }
    return res.status(405).end();
  }

  // /api/deals
  if (req.method === 'GET') {
    const deals = contactId
      ? await getDealsByContact(contactId)
      : await getAllDeals();
    return res.status(200).json(deals.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  if (req.method === 'POST') {
    const { contactId: cid, title, stage, value, description } = req.body || {};
    if (!cid) return res.status(400).json({ error: 'contactId required' });
    const deal = await createDeal({ contactId: cid, title, stage, value, description });
    return res.status(201).json(deal);
  }

  return res.status(405).end();
};
