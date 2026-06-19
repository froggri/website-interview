const crypto = require('crypto');
const { getUser, saveUser, deleteUser, getAllTokens } = require('../../lib/kv');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkAuth(req, res)) return;

  if (req.method === 'GET') {
    const tokens = (await getAllTokens()) || [];
    const users = (await Promise.all(tokens.map(t => getUser(t)))).filter(Boolean);
    return res.status(200).json(
      users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    );
  }

  if (req.method === 'POST') {
    const { name, context = '', questions = [] } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const token = crypto.randomBytes(8).toString('hex');
    const user = { token, name, context, questions, createdAt: new Date().toISOString() };
    await saveUser(token, user);
    return res.status(201).json(user);
  }

  if (req.method === 'PUT') {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'token required' });
    const existing = await getUser(token);
    if (!existing) return res.status(404).json({ error: 'not found' });
    const { name, context, questions } = req.body || {};
    const updated = {
      ...existing,
      name: name ?? existing.name,
      context: context ?? existing.context,
      questions: questions ?? existing.questions,
    };
    await saveUser(token, updated);
    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'token required' });
    await deleteUser(token);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
};
