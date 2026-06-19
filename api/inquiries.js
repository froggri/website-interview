const { getAllInquiries, createInquiry, getInquiry, updateInquiry } = require('../lib/kv');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const isAdmin = req.headers['x-admin-token'] === process.env.ADMIN_PASSWORD && !!process.env.ADMIN_PASSWORD;
  const { inquiryId } = req.query;

  // /api/inquiries/:inquiryId — admin only
  if (inquiryId) {
    if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    if (req.method === 'GET') {
      const inquiry = await getInquiry(inquiryId);
      if (!inquiry) return res.status(404).json({ error: 'not found' });
      return res.status(200).json(inquiry);
    }
    if (req.method === 'PATCH') {
      const updated = await updateInquiry(inquiryId, req.body || {});
      if (!updated) return res.status(404).json({ error: 'not found' });
      return res.status(200).json(updated);
    }
    return res.status(405).end();
  }

  // GET /api/inquiries — admin only
  if (req.method === 'GET') {
    if (!isAdmin) return res.status(401).json({ error: 'Unauthorized' });
    const inquiries = await getAllInquiries();
    return res.status(200).json(inquiries.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  // POST /api/inquiries — public
  if (req.method === 'POST') {
    const { name, email, phone, company, message } = req.body || {};
    if (!name || !email || !message) return res.status(400).json({ error: 'name, email and message required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'invalid email' });
    const inquiry = await createInquiry({ name, email, phone, company, message });
    // TODO Phase 5: Send confirmation email via Resend
    return res.status(201).json({ ok: true, id: inquiry.id });
  }

  return res.status(405).end();
};
