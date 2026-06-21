# Backlog — website-interview / Vancierge PO-Tool

Dieses File ist die zentrale Backlog-Quelle. Ziel: zu GitHub Issues migrieren sobald `gh` CLI eingerichtet ist.
Status-Labels: `[ ]` offen · `[~]` in Arbeit · `[x]` done · `[?]` unklar / Konzept nötig

---

## Done (Phasen)

- [x] **Phase 2 — API-Routen** (Contacts, Deals, Sessions, Activities, Tasks, Invoices, Inquiries)
- [x] **Phase 3 — Intelligentes Gesprächsverhalten** (context-aware Prompt, Dual-Briefing via /session/complete)
- [x] **Phase 4 — Admin-View Rebuild** (Kanban-Pipeline, Deal-Detail mit Tabs, Task/Aktivitäten/Rechnung)

---

## Backlog — Product

### Qualifikations-Mini-Dialog (Pre-Interview)
Bevor ein Stakeholder das volle Interview bekommt: kurzer Dialog (3–5 Nachrichten)
zur Vorqualifikation — kann Philipp das leisten? Passt der Case?
- Neue Session-Type: `qualification`
- Kurz + günstig → ggf. Claude Haiku statt Sonnet
- Outcome: `qualifiziert` / `nicht passend` → Philipp bekommt Notification
- Einstieg über Landing Page, OHNE dass Philipp erst einen Link generieren muss

### Token-Budget-Steuerung
Verschiedene Modelle je Session-Type:
- `qualification`: Claude Haiku (günstig, 5 Exchanges max)
- `requirements` / `design`: Claude Sonnet (aktuell)
- `review`: Sonnet mit reduziertem max_tokens
- Admin-Config: max_exchanges und model je Session-Type einstellbar

### Vertragsfluss / Rechtliches
Aktuell: kein formaler Vertragsschritt im Pipeline.
Nötig für production-use:
- Deal-Stage `Angebot`: Angebots-Template generieren (AI-gestützt, basierend auf Briefing)
- Deal-Stage `Gewonnen`: Vertrag als „akzeptiert" markieren (Datum + Notiz)
- Rechnungsfluss bereits in Phase 1 modelliert
- Perspektivisch: e-Signatur Integration (HelloSign / DocuSign API)

### Preismodell-Logik im Tool
Philipp-Vision: „Grobes Mockup kostet nichts, alles darüber hinaus kostet."
- Lead-Magnet: Landing Page → Briefing Interview → Grob-Konzept (Free)
- Paid: Umsetzung, Design, SEO etc.
- Tool-seitig: kein Paywall nötig — CRM-Pipeline managed den Übergang manuell
- Backlog: Proposal-Template-Generator im Deal-Detail (AI-Assistent schlägt Preise vor
  basierend auf Scope im Briefing)

### Erweiterte Service-Typen (über Websites hinaus)
Philipp bietet perspektivisch mehr als nur Websites an.
Neue Session-Types mit eigenem System-Prompt und Briefing-Format:
- `seo-audit` — SEO-Status-Analyse, Keyword-Recherche, Content-Gaps
- `media-strategy` — Zielgruppe, Kanäle, Content-Plan, KPIs
- `tracking-setup` — GA4, Tag Manager, Conversion-Ziele, Datenschutz
- `landing-page` — Conversion-Optimierung, A/B-Testing-Plan, Copy-Richtung
- `social-media` — Plattformwahl, Posting-Rhythmus, Tonalität

Je Service: eigener Briefing-JSON-Output + suggestedNextSteps-Template

### Wiedervorlage / Follow-up Automation
Nach „Qualifiziert": automatische Erinnerung nach X Tagen wenn kein Interview gestartet.
KV-basiert: `followup:{contactId}` mit Datum → Cron-Job oder manueller Check im Admin.

---

## Backlog — Tech / Infrastruktur

### gh CLI Setup für GitHub Issues
Ziel: Claude Code kann Issues direkt anlegen + updaten.
Benötigt:
1. `gh` CLI installieren (sudo apt install gh)
2. `gh auth login` (Browser-Interaktion nötig, einmalig)
3. Danach: gh issue create / edit aus dem Code möglich
Alternativ: GitHub PAT (Personal Access Token) als Env-Var → REST API via curl

### Cron Job für timed Tasks
Vercel Cron (via vercel.json) für:
- Überfällige Rechnungen → Status update
- Follow-up Erinnerungen
- Täglicher Health-Check (KV Ping)

### Datenschutz / DSGVO
Stakeholder-Interviews enthalten personenbezogene Daten (Name, Beruf, Ziele).
- Privacy Policy Seite (Template)
- Daten-Löschung via Admin (bereits implementiert für legacy, für neue Entities nötig)
- Session-Daten TTL? (optional: KV EXPIRE nach X Monaten)

### Resend-Template-System
Statt Plain-Text-Mails: HTML-Templates für:
- Bestätigungsmail nach Anfrage
- Interview-Einladung
- Briefing-Zusammenfassung als Mail an Philipp

### Mobile Admin
Admin-View Phase 4 → muss auf Tablet nutzbar sein.
Kanban auf Mobile: vertikal statt horizontal (Stage-Auswahl via Dropdown).

---

## Ideen / Explorativ

### SaaS-Vision
Tool ist momentan 1-User (Philipp). Multi-Tenant wäre:
- Auth-Layer (Clerk / NextAuth — nicht ohne Framework schwierig)
- Pro-User KV-Namespacing (`user:{userId}:contact:{id}`)
- Billing (Stripe)
→ Erst wenn MVP validiert ist. Kein premature SaaS.

### KI-Assistent für Philipp im Admin
Nicht für Stakeholder — für Philipp selbst:
„Analysiere das Briefing und schlag einen ersten Website-Struktur-Entwurf vor."
„Schreib mir einen Angebots-Entwurf basierend auf Deal X."
Im Deal-Detail: Chat-Panel das den vollständigen Kontext kennt.

### Referenz-Websites Scraper
Stakeholder nennt im Interview Referenz-URLs → Screenshots via Puppeteer/Playwright
automatisch anhängen → Philipp sieht visuell was gemeint war.
→ Komplexe Infrastruktur, weit weg.

---

## Done

- [x] Interview-Agent (MVP) — Chat + Briefing-Output
- [x] Token-based Invitation Links (/i/:code)
- [x] Admin-View (Login, Kontaktliste, Detail, Design-Toggle, Kontext-Chat)
- [x] Intake-Flow (kein Token → Selbst-Registrierung → Freigeben)
- [x] Design-Session + HTML-Mockup-Generierung
- [x] Duplicate-Button, Kontext per KI sammeln
- [x] Phase 1: CRM-Datenmodell + Migration
- [x] System-Prompt-Fix: Context-aware Einstieg (überspringt bekannte Fakten)
