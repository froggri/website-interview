const { getAllContacts, createContact, getContact, updateContact } = require('../lib/kv');

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

  const { id } = req.query;

  if (id) {
    if (req.method === 'GET') {
      const contact = await getContact(id);
      if (!contact) return res.status(404).json({ error: 'not found' });
      return res.status(200).json(contact);
    }
    if (req.method === 'PATCH') {
      const updated = await updateContact(id, req.body || {});
      if (!updated) return res.status(404).json({ error: 'not found' });
      return res.status(200).json(updated);
    }
    return res.status(405).end();
  }

  if (req.method === 'GET') {
    const contacts = await getAllContacts();
    return res.status(200).json(contacts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  if (req.method === 'POST') {
    const { name, email, phone, company, context, status, tags, notes, source } = req.body || {};
    if (!name) return res.status(400).json({ error: 'name required' });
    const contact = await createContact({ name, email, phone, company, context, status, tags, notes, source });
    return res.status(201).json(contact);
  }

  return res.status(405).end();
};
