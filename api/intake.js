const crypto = require('crypto');
const { saveUser } = require('../lib/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { name } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name required' });
  }

  const token = crypto.randomBytes(4).toString('hex');
  const user = {
    token,
    name: name.trim(),
    context: '',
    questions: [],
    invited: false,
    createdAt: new Date().toISOString(),
  };
  await saveUser(token, user);
  return res.status(201).json({ token });
};
