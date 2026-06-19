#!/usr/bin/env node
/**
 * Synct BACKLOG.md → Google Drive Ordner
 * Nutzt Token aus ~/.drive-token.json (einmalig erstellt via scripts/auth-drive.js)
 * Manuell: node scripts/sync-backlog.js
 * Automatisch: git post-commit hook
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { google } = require('googleapis');

const FOLDER_ID    = '1TlBf5BNjQZLtYwd1hb1kc-o3KTKxwRij';
const BACKLOG_PATH = path.join(__dirname, '..', 'BACKLOG.md');
const DRIVE_FILE   = 'backlog.md';
const TOKEN_PATH   = path.join(os.homedir(), '.drive-token.json');
const CLIENT_FILE  = path.join(__dirname, '..', 'oauth-client.json');

async function syncBacklog() {
  if (!fs.existsSync(BACKLOG_PATH)) {
    console.log('ℹ️  BACKLOG.md nicht gefunden, skip.');
    process.exit(0);
  }
  if (!fs.existsSync(TOKEN_PATH)) {
    console.error('❌ ~/.drive-token.json nicht gefunden. Einmalig: node scripts/auth-drive.js');
    process.exit(0);
  }
  if (!fs.existsSync(CLIENT_FILE)) {
    console.error('❌ oauth-client.json nicht gefunden.');
    process.exit(0);
  }

  const { client_id, client_secret } = JSON.parse(fs.readFileSync(CLIENT_FILE)).installed;
  const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));

  const oauth2 = new google.auth.OAuth2(client_id, client_secret);
  oauth2.setCredentials(tokens);

  // Token-Refresh automatisch speichern
  oauth2.on('tokens', updated => {
    const merged = { ...tokens, ...updated };
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2));
  });

  const drive = google.drive({ version: 'v3', auth: oauth2 });
  const content = fs.readFileSync(BACKLOG_PATH, 'utf8');

  const existing = await drive.files.list({
    q: `name='${DRIVE_FILE}' and '${FOLDER_ID}' in parents and trashed=false`,
    fields: 'files(id)',
  });

  const file = existing.data.files?.[0];

  if (file) {
    await drive.files.update({
      fileId: file.id,
      media: { mimeType: 'text/plain', body: content },
    });
    console.log(`✅ backlog.md aktualisiert (${new Date().toLocaleTimeString('de-DE')})`);
  } else {
    const created = await drive.files.create({
      requestBody: { name: DRIVE_FILE, parents: [FOLDER_ID], mimeType: 'text/plain' },
      media: { mimeType: 'text/plain', body: content },
      fields: 'id',
    });
    console.log(`✅ backlog.md neu angelegt (Drive ID: ${created.data.id})`);
  }
}

syncBacklog().catch(err => {
  console.error('❌ Sync fehlgeschlagen:', err.message);
  process.exit(0);
});
