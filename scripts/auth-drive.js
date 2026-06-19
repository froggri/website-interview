#!/usr/bin/env node
/**
 * Einmalig ausführen: node scripts/auth-drive.js
 * Speichert ein Refresh-Token in ~/.drive-token.json
 * Danach funktioniert scripts/sync-backlog.js ohne weitere Eingaben.
 *
 * Voraussetzung: oauth-client.json im Projektordner
 * (GCP Console → Credentials → OAuth 2.0 Client ID → Desktop App → Download JSON)
 */

const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLIENT_FILE = path.join(__dirname, '..', 'oauth-client.json');
const TOKEN_PATH  = path.join(os.homedir(), '.drive-token.json');

if (!fs.existsSync(CLIENT_FILE)) {
  console.error('❌ oauth-client.json nicht gefunden.');
  console.error('   GCP Console → Credentials → OAuth 2.0 Client ID → Desktop App → Download JSON');
  console.error(`   Speichern als: ${CLIENT_FILE}`);
  process.exit(1);
}

const { client_id, client_secret } = JSON.parse(fs.readFileSync(CLIENT_FILE)).installed;
const REDIRECT = 'http://localhost:3500';

const oauth2 = new google.auth.OAuth2(client_id, client_secret, REDIRECT);

const authUrl = oauth2.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/drive'],
  prompt: 'consent',
});

console.log('\n───────────────────────────────────────────');
console.log('Öffne diese URL in deinem Browser:\n');
console.log(authUrl);
console.log('\n───────────────────────────────────────────');
console.log('Warte auf Redirect zu localhost:3500 ...\n');

const server = http.createServer(async (req, res) => {
  const { query } = url.parse(req.url, true);
  if (!query.code) {
    res.end('Kein Code erhalten.');
    return;
  }
  try {
    const { tokens } = await oauth2.getToken(query.code);
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
    console.log(`✅ Token gespeichert: ${TOKEN_PATH}`);
    console.log('   Du kannst das Browser-Tab schließen.');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<html><body style="font-family:sans-serif;padding:40px"><h2>✅ Authentifizierung erfolgreich!</h2><p>Du kannst dieses Tab schließen.</p></body></html>');
  } catch (err) {
    console.error('❌ Token-Austausch fehlgeschlagen:', err.message);
    res.end('Fehler: ' + err.message);
  } finally {
    server.close();
  }
});

server.listen(3500, () => {
  console.log('Lokaler Server läuft auf Port 3500');
});
