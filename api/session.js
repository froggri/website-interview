const { getUser, getSession } = require('../lib/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'GET') return res.status(405).end();

  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'token required' });

  const [user, session] = await Promise.all([getUser(token), getSession(token)]);
  if (!user) return res.status(404).json({ error: 'Invalid token' });

  return res.status(200).json({ user, session: session || null });
};
