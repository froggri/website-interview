const { kv } = require('@vercel/kv');

module.exports = {
  getUser: t => kv.get(`user:${t}`),

  async saveUser(t, data) {
    await kv.set(`user:${t}`, data);
    await kv.sadd('tokens', t);
  },

  async deleteUser(t) {
    await Promise.all([
      kv.del(`user:${t}`),
      kv.del(`session:${t}`),
      kv.srem('tokens', t),
    ]);
  },

  getAllTokens: () => kv.smembers('tokens'),
  getSession: t => kv.get(`session:${t}`),
  saveSession: (t, s) => kv.set(`session:${t}`, s),
};
