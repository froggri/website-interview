const { getTask, updateTask, deleteTask, createTask, getSubtasks } = require('../lib/kv');

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!checkAuth(req, res)) return;

  const { taskId, sub } = req.query;
  if (!taskId) return res.status(400).json({ error: 'taskId required' });

  // /api/tasks/:taskId/subtasks
  if (sub === 'subtasks') {
    if (req.method !== 'POST') return res.status(405).end();
    const parent = await getTask(taskId);
    if (!parent) return res.status(404).json({ error: 'not found' });
    const subtask = await createTask({ dealId: parent.dealId, parentId: taskId, ...(req.body || {}) });
    return res.status(201).json(subtask);
  }

  // /api/tasks/:taskId/reorder
  if (sub === 'reorder') {
    if (req.method !== 'PATCH') return res.status(405).end();
    const { order } = req.body || {};
    if (order === undefined) return res.status(400).json({ error: 'order required' });
    const updated = await updateTask(taskId, { order });
    if (!updated) return res.status(404).json({ error: 'not found' });
    return res.status(200).json(updated);
  }

  // /api/tasks/:taskId
  if (req.method === 'GET') {
    const task = await getTask(taskId);
    if (!task) return res.status(404).json({ error: 'not found' });
    const subtasks = await getSubtasks(taskId);
    return res.status(200).json({ ...task, subtasks });
  }

  if (req.method === 'PATCH') {
    const updated = await updateTask(taskId, req.body || {});
    if (!updated) return res.status(404).json({ error: 'not found' });
    return res.status(200).json(updated);
  }

  if (req.method === 'DELETE') {
    await deleteTask(taskId);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).end();
};
