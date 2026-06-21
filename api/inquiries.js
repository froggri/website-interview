const { getAllInquiries, createInquiry, getInquiry, updateInquiry } = require('../lib/kv');
const { Resend } = require('resend');

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

    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const from = process.env.RESEND_FROM || 'onboarding@resend.dev';
        const philippEmail = process.env.CONTACT_EMAIL || 'philipp.grimmel@googlemail.com';
        await Promise.all([
          resend.emails.send({
            from,
            to: email,
            subject: 'Deine Anfrage ist angekommen',
            html: `<div style="font-family:sans-serif;max-width:500px;color:#111">
              <p>Hi ${name},</p>
              <p>deine Anfrage ist angekommen. Ich melde mich in der Regel innerhalb von 48 Stunden bei dir.</p>
              ${company ? `<p><strong>Dein Unternehmen:</strong> ${company}</p>` : ''}
              <p><strong>Deine Nachricht:</strong><br>${message.replace(/\n/g, '<br>')}</p>
              <p>Bis bald,<br>Philipp</p>
            </div>`,
          }),
          resend.emails.send({
            from,
            to: philippEmail,
            subject: `Neue Anfrage von ${name}`,
            html: `<div style="font-family:sans-serif;max-width:500px;color:#111">
              <p><strong>Name:</strong> ${name}</p>
              <p><strong>E-Mail:</strong> ${email}</p>
              ${company ? `<p><strong>Unternehmen:</strong> ${company}</p>` : ''}
              ${phone ? `<p><strong>Telefon:</strong> ${phone}</p>` : ''}
              <p><strong>Nachricht:</strong><br>${message.replace(/\n/g, '<br>')}</p>
              <p><a href="${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : ''}/admin">→ Im Admin ansehen</a></p>
            </div>`,
          }),
        ]);
      } catch (mailErr) {
        console.error('Resend error:', mailErr.message);
      }
    }

    return res.status(201).json({ ok: true, id: inquiry.id });
  }

  return res.status(405).end();
};
