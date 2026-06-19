const { kv } = require('@vercel/kv');
const { randomUUID, randomBytes } = require('crypto');

// ================================================================
// LEGACY — kept intact for api/chat.js, api/session.js,
//          api/intake.js, api/admin/users.js
// ================================================================

const getUser       = t => kv.get(`user:${t}`);
const getAllTokens   = ()  => kv.smembers('tokens');
const getSession    = t => kv.get(`session:${t}`);
const saveSession   = (t, s) => kv.set(`session:${t}`, s);

async function saveUser(t, data) {
  await kv.set(`user:${t}`, data);
  await kv.sadd('tokens', t);
}

async function deleteUser(t) {
  await Promise.all([
    kv.del(`user:${t}`),
    kv.del(`session:${t}`),
    kv.srem('tokens', t),
  ]);
}

// ================================================================
// CONTACTS  —  contact:{id},  contacts:index (list)
// ================================================================

async function createContact(data) {
  const id  = randomUUID();
  const now = new Date().toISOString();
  const doc = {
    id,
    name:      data.name      || '',
    email:     data.email     || '',
    phone:     data.phone     || '',
    company:   data.company   || '',
    context:   data.context   || '',
    status:    data.status    || 'lead',
    tags:      data.tags      || [],
    notes:     data.notes     || '',
    source:    data.source    || 'manuell',
    createdAt: now,
    updatedAt: now,
  };
  await kv.set(`contact:${id}`, doc);
  await kv.rpush('contacts:index', id);
  return doc;
}

const getContact = id => kv.get(`contact:${id}`);

async function updateContact(id, updates) {
  const existing = await getContact(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() };
  await kv.set(`contact:${id}`, updated);
  return updated;
}

async function getAllContacts() {
  const ids = (await kv.lrange('contacts:index', 0, -1)) || [];
  const docs = await Promise.all(ids.map(getContact));
  return docs.filter(Boolean);
}

// ================================================================
// DEALS  —  deal:{id},  deals:index,  deals:by-contact:{contactId}
// ================================================================

async function createDeal(data) {
  const id  = randomUUID();
  const now = new Date().toISOString();
  const doc = {
    id,
    contactId:   data.contactId,
    title:       data.title       || 'Unbenannter Deal',
    stage:       data.stage       || 'anfrage',
    value:       data.value       ?? null,
    currency:    'EUR',
    description: data.description || '',
    closedAt:    null,
    createdAt:   now,
    updatedAt:   now,
  };
  await kv.set(`deal:${id}`, doc);
  await kv.rpush('deals:index', id);
  await kv.rpush(`deals:by-contact:${data.contactId}`, id);
  return doc;
}

const getDeal = id => kv.get(`deal:${id}`);

async function updateDeal(id, updates) {
  const existing = await getDeal(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() };
  await kv.set(`deal:${id}`, updated);
  return updated;
}

async function getAllDeals() {
  const ids = (await kv.lrange('deals:index', 0, -1)) || [];
  const docs = await Promise.all(ids.map(getDeal));
  return docs.filter(Boolean);
}

async function getDealsByContact(contactId) {
  const ids = (await kv.lrange(`deals:by-contact:${contactId}`, 0, -1)) || [];
  const docs = await Promise.all(ids.map(getDeal));
  return docs.filter(Boolean);
}

// ================================================================
// SESSIONS (new schema)
// session:{id},  sessions:by-deal:{dealId},  token:{token}
// ================================================================

async function createSession(data) {
  const id    = randomUUID();
  const token = data.token || randomBytes(4).toString('hex');
  const now   = new Date().toISOString();
  const doc   = {
    id,
    dealId:      data.dealId,
    contactId:   data.contactId,
    token,
    type:        data.type   || 'requirements',
    title:       data.title  || 'Interview',
    status:      data.status || 'offen',
    questions:   data.questions || [],
    messages:    [],
    briefingText: null,
    briefingJson: null,
    completedAt: null,
    createdAt:   now,
  };
  await kv.set(`session:${id}`, doc);
  await kv.rpush(`sessions:by-deal:${data.dealId}`, id);
  await kv.set(`token:${token}`, { sessionId: id, dealId: data.dealId, contactId: data.contactId });
  return doc;
}

const getSessionById = id => kv.get(`session:${id}`);

async function updateSessionById(id, updates) {
  const existing = await getSessionById(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates, id };
  await kv.set(`session:${id}`, updated);
  return updated;
}

const getTokenLookup = token => kv.get(`token:${token}`);

async function getSessionByToken(token) {
  const lookup = await getTokenLookup(token);
  if (!lookup) return null;
  return getSessionById(lookup.sessionId);
}

async function getSessionsByDeal(dealId) {
  const ids = (await kv.lrange(`sessions:by-deal:${dealId}`, 0, -1)) || [];
  const docs = await Promise.all(ids.map(getSessionById));
  return docs.filter(Boolean);
}

// ================================================================
// ACTIVITIES
// activity:{id},  activities:by-contact:{cId},  activities:by-deal:{dId}
// ================================================================

async function createActivity(data) {
  const id  = randomUUID();
  const doc = {
    id,
    contactId: data.contactId,
    dealId:    data.dealId    || null,
    sessionId: data.sessionId || null,
    type:      data.type      || 'note',
    direction: data.direction || 'internal',
    subject:   data.subject   || null,
    body:      data.body      || '',
    createdBy: data.createdBy || 'philipp',
    createdAt: new Date().toISOString(),
  };
  await kv.set(`activity:${id}`, doc);
  await kv.rpush(`activities:by-contact:${data.contactId}`, id);
  if (data.dealId) await kv.rpush(`activities:by-deal:${data.dealId}`, id);
  return doc;
}

const getActivity = id => kv.get(`activity:${id}`);

async function getActivitiesByContact(contactId) {
  const ids = (await kv.lrange(`activities:by-contact:${contactId}`, 0, -1)) || [];
  const docs = await Promise.all(ids.map(getActivity));
  return docs.filter(Boolean);
}

async function getActivitiesByDeal(dealId) {
  const ids = (await kv.lrange(`activities:by-deal:${dealId}`, 0, -1)) || [];
  const docs = await Promise.all(ids.map(getActivity));
  return docs.filter(Boolean);
}

// ================================================================
// TASKS
// task:{id},  tasks:by-deal:{dealId},  tasks:by-parent:{parentId}
// ================================================================

async function createTask(data) {
  const id  = randomUUID();
  const now = new Date().toISOString();
  const doc = {
    id,
    dealId:      data.dealId,
    parentId:    data.parentId    || null,
    title:       data.title       || 'Neue Aufgabe',
    description: data.description || null,
    status:      'offen',
    priority:    data.priority    || 'mittel',
    dueAt:       data.dueAt       || null,
    order:       data.order       ?? Date.now(),
    createdAt:   now,
    updatedAt:   now,
  };
  await kv.set(`task:${id}`, doc);
  await kv.rpush(`tasks:by-deal:${data.dealId}`, id);
  if (data.parentId) await kv.rpush(`tasks:by-parent:${data.parentId}`, id);
  return doc;
}

const getTask = id => kv.get(`task:${id}`);

async function updateTask(id, updates) {
  const existing = await getTask(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates, id, updatedAt: new Date().toISOString() };
  await kv.set(`task:${id}`, updated);
  return updated;
}

async function deleteTask(id) {
  const subtaskIds = (await kv.lrange(`tasks:by-parent:${id}`, 0, -1)) || [];
  await Promise.all([
    ...subtaskIds.map(sid => kv.del(`task:${sid}`)),
    kv.del(`tasks:by-parent:${id}`),
    kv.del(`task:${id}`),
  ]);
}

async function getTasksByDeal(dealId) {
  const ids = (await kv.lrange(`tasks:by-deal:${dealId}`, 0, -1)) || [];
  const docs = await Promise.all(ids.map(getTask));
  return docs.filter(Boolean);
}

const getSubtasks = parentId => kv.lrange(`tasks:by-parent:${parentId}`, 0, -1)
  .then(ids => Promise.all((ids || []).map(getTask)))
  .then(docs => docs.filter(Boolean));

// ================================================================
// INVOICES
// invoice:{id},  invoices:index,  invoices:by-deal:{dealId}
// invoice:counter  (auto-increment for invoice numbers)
// ================================================================

async function createInvoice(data) {
  const id  = randomUUID();
  const doc = {
    id,
    dealId:      data.dealId,
    contactId:   data.contactId,
    number:      data.number,
    status:      'entwurf',
    lineItems:   data.lineItems   || [],
    amountNet:   data.amountNet   || 0,
    taxRate:     data.taxRate     ?? 19,
    amountGross: data.amountGross || 0,
    currency:    'EUR',
    notes:       data.notes       || null,
    issuedAt:    null,
    dueAt:       data.dueAt       || null,
    paidAt:      null,
    createdAt:   new Date().toISOString(),
  };
  await kv.set(`invoice:${id}`, doc);
  await kv.rpush('invoices:index', id);
  await kv.rpush(`invoices:by-deal:${data.dealId}`, id);
  return doc;
}

const getInvoice = id => kv.get(`invoice:${id}`);

async function updateInvoice(id, updates) {
  const existing = await getInvoice(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates, id };
  await kv.set(`invoice:${id}`, updated);
  return updated;
}

async function getAllInvoices() {
  const ids = (await kv.lrange('invoices:index', 0, -1)) || [];
  const docs = await Promise.all(ids.map(getInvoice));
  return docs.filter(Boolean);
}

async function getNextInvoiceNumber() {
  const count = await kv.incr('invoice:counter');
  return `${new Date().getFullYear()}-${String(count).padStart(3, '0')}`;
}

async function getInvoicesByDeal(dealId) {
  const ids = (await kv.lrange(`invoices:by-deal:${dealId}`, 0, -1)) || [];
  const docs = await Promise.all(ids.map(getInvoice));
  return docs.filter(Boolean);
}

// ================================================================
// INQUIRIES
// inquiry:{id},  inquiries:index
// ================================================================

async function createInquiry(data) {
  const id  = randomUUID();
  const doc = {
    id,
    name:      data.name    || '',
    email:     data.email   || '',
    phone:     data.phone   || '',
    company:   data.company || '',
    message:   data.message || '',
    status:    'neu',
    notes:     '',
    createdAt: new Date().toISOString(),
  };
  await kv.set(`inquiry:${id}`, doc);
  await kv.rpush('inquiries:index', id);
  return doc;
}

const getInquiry = id => kv.get(`inquiry:${id}`);

async function updateInquiry(id, updates) {
  const existing = await getInquiry(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates, id };
  await kv.set(`inquiry:${id}`, updated);
  return updated;
}

async function getAllInquiries() {
  const ids = (await kv.lrange('inquiries:index', 0, -1)) || [];
  const docs = await Promise.all(ids.map(getInquiry));
  return docs.filter(Boolean);
}

// ================================================================
// EXPORTS
// ================================================================

module.exports = {
  // ── Legacy (api/chat.js · api/session.js · api/intake.js · api/admin/users.js)
  getUser,
  saveUser,
  deleteUser,
  getAllTokens,
  getSession,
  saveSession,

  // ── Contacts
  createContact,
  getContact,
  updateContact,
  getAllContacts,

  // ── Deals
  createDeal,
  getDeal,
  updateDeal,
  getAllDeals,
  getDealsByContact,

  // ── Sessions (new schema)
  createSession,
  getSessionById,
  updateSessionById,
  getSessionByToken,
  getTokenLookup,
  getSessionsByDeal,

  // ── Activities
  createActivity,
  getActivity,
  getActivitiesByContact,
  getActivitiesByDeal,

  // ── Tasks
  createTask,
  getTask,
  updateTask,
  deleteTask,
  getTasksByDeal,
  getSubtasks,

  // ── Invoices
  createInvoice,
  getInvoice,
  updateInvoice,
  getAllInvoices,
  getNextInvoiceNumber,
  getInvoicesByDeal,

  // ── Inquiries
  createInquiry,
  getInquiry,
  updateInquiry,
  getAllInquiries,

  // ── Raw client (for complex/ad-hoc operations)
  kv,
};
