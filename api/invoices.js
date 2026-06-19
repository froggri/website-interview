const { getAllInvoices, createInvoice, getInvoice, updateInvoice, getNextInvoiceNumber } = require('../lib/kv');

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

  const { invoiceId, sub } = req.query;

  // /api/invoices/next-number
  if (sub === 'next-number') {
    if (req.method !== 'GET') return res.status(405).end();
    const number = await getNextInvoiceNumber();
    return res.status(200).json({ number });
  }

  // /api/invoices/:invoiceId
  if (invoiceId) {
    if (req.method === 'GET') {
      const invoice = await getInvoice(invoiceId);
      if (!invoice) return res.status(404).json({ error: 'not found' });
      return res.status(200).json(invoice);
    }
    if (req.method === 'PATCH') {
      const updated = await updateInvoice(invoiceId, req.body || {});
      if (!updated) return res.status(404).json({ error: 'not found' });
      return res.status(200).json(updated);
    }
    return res.status(405).end();
  }

  // /api/invoices
  if (req.method === 'GET') {
    const invoices = await getAllInvoices();
    return res.status(200).json(invoices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
  }

  if (req.method === 'POST') {
    const { dealId, contactId, lineItems, taxRate, dueAt, notes } = req.body || {};
    if (!dealId) return res.status(400).json({ error: 'dealId required' });
    const number = await getNextInvoiceNumber();
    const items = (lineItems || []).map(item => ({
      description: item.description || '',
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      total: (item.quantity || 1) * (item.unitPrice || 0),
    }));
    const amountNet = items.reduce((sum, i) => sum + i.total, 0);
    const rate = taxRate ?? 19;
    const amountGross = Math.round(amountNet * (1 + rate / 100) * 100) / 100;
    const invoice = await createInvoice({
      dealId, contactId, number,
      lineItems: items,
      amountNet, taxRate: rate, amountGross,
      dueAt, notes,
    });
    return res.status(201).json(invoice);
  }

  return res.status(405).end();
};
