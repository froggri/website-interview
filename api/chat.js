const { getUser, getSession, saveSession, saveUser } = require('../lib/kv');

const DESIGN_PROMPT = `Du bist ein erfahrener UI/UX Designer und Creative Director, der im Auftrag von Philipp ein Design-Briefing Interview führt. Philipp baut eine Website für diese Person.

Führe ein natürliches Gespräch über Design-Präferenzen. Stelle immer nur EINE Frage pro Nachricht.

Themen (organisch einbauen):
1. Lieblingsfarben und welche Farben abgelehnt werden
2. Welche Websites oder Marken visuell gefallen (Referenzen)
3. Stimmung: minimalistisch oder aufwändig? Modern oder klassisch?
4. Typografie: sachlich, verspielt, elegant oder technisch?
5. Bildsprache: Fotos, Illustrationen, Icons, abstrakt?
6. Welches Gefühl soll die Website beim Besucher auslösen?

Nach 5-6 Fragen: Erstelle ein vollständiges responsives One-Page-Mockup als HTML/CSS.

Das Mockup soll professionelle Qualität haben, alle Design-Entscheidungen widerspiegeln und realistische Platzhalter-Inhalte enthalten. Nur inline CSS, keine externen Abhängigkeiten.

Beende exakt mit diesem Format (kein Text danach):
===MOCKUP_START===
<!DOCTYPE html>
[vollständiges HTML mit inline CSS]
===MOCKUP_END===

Antworte auf Deutsch. Beginne mit herzlicher Begrüßung.`;

const BASE_PROMPT = `Du bist ein erfahrener Product Owner und strategischer Berater, der im Auftrag von Philipp ein strukturiertes Website-Briefing-Interview führt. Philipp ist ein guter Freund, der für seinen Gesprächspartner eine professionelle Website bauen möchte.

Führe ein natürliches, empathisches Gespräch. Stelle immer nur EINE Frage pro Nachricht. Hak nach wenn Antworten zu oberflächlich sind. Bestätige gute Antworten kurz bevor du zur nächsten Frage gehst.

Wenn der Gesprächspartner Bilder teilt (z. B. von sich, seiner Firma, Stil-Referenzen), kommentiere sie kurz und beziehe sie in deine nächste Frage ein.

Themen (organisch einbauen, nicht als Liste vorlesen):
1. Was machst du beruflich? Was ist dein Hauptgeschäft, dein Angebot?
2. Wer sind deine Kunden / Zielgruppe?
3. Was soll jemand nach dem Besuch der Website verstanden haben?
4. Was unterscheidet dich von anderen in deiner Branche?
5. Welche Seiten soll die Website haben?
6. Gibt es Beispiel-Websites die dir gefallen?
7. Wie soll die Website sich anfühlen? Tonalität, Stil?
8. Was ist dein wichtigstes Ziel mit der Website?
9. Technische Anforderungen? (Kontaktformular, Newsletter, Buchung...)
10. Was soll auf keinen Fall auf der Website sein?

Nach mindestens 8 Fragen: Interview freundlich beenden, dann EXAKT dieses Format ausgeben:

===BRIEFING_START===
NAME: [Vorname]
BERUF: [Beruf/Business in 1-2 Sätzen]
ZIELGRUPPE: [Wer sind die Kunden, 2-3 Sätze]
KERNBOTSCHAFT: [Was die Website in einem Satz kommunizieren soll]
USP: [Was ihn/sie unterscheidet, 2-3 Punkte]
STRUKTUR: [Welche Seiten/Bereiche]
STIL: [Tonalität, Stil, Referenzen]
ZIEL: [Primäres Ziel der Website]
TECHNIK: [Technische Wünsche]
AUSSCHLUESSE: [Was nicht auf die Website soll]
BESONDERHEITEN: [Alles andere Wichtige]
===BRIEFING_END===

Antworte immer auf Deutsch. Beginne mit herzlicher Begrüßung, nenne den Namen der Person, erkläre kurz was ihr heute macht.`;

function buildSystemPrompt(user) {
  let p = user?.designSession ? DESIGN_PROMPT : BASE_PROMPT;
  if (user?.context) {
    p += `\n\nHintergrund zu ${user.name} (von Philipp vorab notiert): ${user.context}`;
  }
  if (user?.questions?.length > 0) {
    p += `\n\nPhilipp hat folgende spezifische Fragen / Punkte für dieses Interview notiert:\n${user.questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;
  }
  return p;
}

function stripImages(messages) {
  return messages.map(m => {
    if (!Array.isArray(m.content)) return m;
    return {
      ...m,
      content: m.content.map(b =>
        b.type === 'image' ? { type: 'text', text: '[Bild hochgeladen]' } : b
      ),
    };
  });
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, token } = req.body || {};
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });

  let user = null, existingSession = null;
  if (token) {
    [user, existingSession] = await Promise.all([getUser(token), getSession(token)]);
  }

  const isDesign = user?.designSession;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: isDesign ? 4096 : 1024,
      system: buildSystemPrompt(user),
      messages,
    }),
  });

  if (!response.ok) {
    return res.status(response.status).json({ error: await response.text() });
  }

  const data = await response.json();
  const reply = data.content?.[0]?.text ?? '';

  if (token && user) {
    const mockupMatch = reply.match(/===MOCKUP_START===([\s\S]*?)===MOCKUP_END===/);
    const briefingMatch = reply.match(/===BRIEFING_START===([\s\S]*?)===BRIEFING_END===/);

    const replyForStorage = mockupMatch
      ? reply.replace(/===MOCKUP_START===([\s\S]*?)===MOCKUP_END===/, '[HTML-Mockup generiert]')
      : reply;

    const allMsgs = [...messages, { role: 'assistant', content: replyForStorage }];

    let briefing = existingSession?.briefing ?? null;
    if (briefingMatch) briefing = briefingMatch[0];
    if (mockupMatch) briefing = '===MOCKUP===' + mockupMatch[1].trim();

    const sessionStatus = briefing ? 'completed' : 'in_progress';

    await Promise.all([
      saveSession(token, {
        messages: stripImages(allMsgs),
        briefing,
        startedAt: existingSession?.startedAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
      saveUser(token, { ...user, sessionStatus, lastActivity: new Date().toISOString() }),
    ]);
  }

  return res.status(200).json(data);
};
