#!/usr/bin/env node
/**
 * Synct backlog.md → Google Drive Ordner
 * Wird als Git Post-Commit Hook aufgerufen.
 * Manuell: node scripts/sync-backlog.js
 */

const fs = require('fs');
const path = require('path');

const FOLDER_ID = '1TlBf5BNjQZLtYwd1hb1kc-o3KTKxwRij';
const BACKLOG_PATH = path.join(__dirname, '..', 'BACKLOG.md');
const DRIVE_FILENAME = 'backlog.md';

async function syncBacklog() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) {
    console.error('❌ GOOGLE_SERVICE_ACCOUNT_JSON nicht gesetzt');
    process.exit(0);
  }

  let credentials;
  try {
    credentials = JSON.parse(serviceAccountJson);
  } catch {
    console.error('❌ GOOGLE_SERVICE_ACCOUNT_JSON ist kein gültiges JSON');
    process.exit(0);
  }

  const { google } = require('googleapis');

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });

  const drive = google.drive({ version: 'v3', auth });

  if (!fs.existsSync(BACKLOG_PATH)) {
    console.log('ℹ️  BACKLOG.md nicht gefunden, skip.');
    process.exit(0);
  }

  const content = fs.readFileSync(BACKLOG_PATH, 'utf8');

  const existing = await drive.files.list({
    q: `name='${DRIVE_FILENAME}' and '${FOLDER_ID}' in parents and trashed=false`,
    fields: 'files(id, name)',
  });

  const file = existing.data.files?.[0];

  if (file) {
    await drive.files.update({
      fileId: file.id,
      media: { mimeType: 'text/plain', body: content },
    });
    console.log(`✅ backlog.md aktualisiert (Drive ID: ${file.id})`);
  } else {
    const created = await drive.files.create({
      requestBody: {
        name: DRIVE_FILENAME,
        parents: [FOLDER_ID],
        mimeType: 'text/plain',
      },
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
