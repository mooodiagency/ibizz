# SEA Agent — Roadmap

Status van de SEA Agent en wat er nog komt. Bijgewerkt op basis van de kennisinterviews met de SEA specialist.

---

## ✅ Sprint 1-6 — Klaar

- Briefs (titel, brand, budget, target CPA, locatie, doel, doelgroep, ICP)
- Strategy generatie (campaign types, budget verdeling, expected results)
- Keyword research (campaigns → ad groups → keywords met match type + intent)
- Ahrefs API verrijking (search volume, CPC, keyword difficulty)
- Ad copy generatie (RSA: headlines, descriptions, paths)
- Negative keywords (globaal + brand-specifiek, AI/upload/manual)
- Export naar Google Ads Editor (XLSX)

---

## 🚧 Sprint 7 — Inhoudelijke verfijning

Op basis van interviewinzichten — geen externe koppelingen nodig.

### Match types & defaults
- [x] Broad match standaard uit, alleen exact + phrase
- [x] Waarschuwing als broad wordt gekozen (banner + amber badge)
- [x] AI prompt prefereert phrase + exact

### Budget validatie
- [x] Drempels per campaign type (in lib/budget-thresholds.ts):
  - Search: minimum €10/dag
  - Performance Max: minimum €20/dag
  - Demand Gen: minimum €10.000/maand
  - Algemeen: niet onder €5/dag
- [x] CPA helper op basis van product marge (recommendedMaxCpa)
- [x] Waarschuwing in Overview én NewBriefModal

### Targeting (in export)
- [x] Locatie targeting "Presence" (aanwezigheid) ipv interesse
- [x] Tablets uit (-100% bid adj.)
- [x] Apps uit in PMax (-100% bid adj.)
- [x] Networks = Google search only voor Search campagnes
- [ ] Demografische uitsluitingen per brief (leeftijd, geslacht)

### Ad copy
- [ ] A/B varianten per ad group: "hard" (actiegericht) + "soft" (merkverhaal)
- [ ] Brand naam vast op headline positie 2
- [ ] Performance-based regeneratie (slechte headlines vervangen)

### Extensions / Assets
- [ ] Sitelinks (4-6 per campaign)
- [ ] Callouts
- [ ] Telefoonnummer (per brand/brief)
- [ ] Company info + logo (vereist account verificatie)
- [ ] Export deze ook naar Google Ads Editor XLSX

### Bid strategy
- [ ] Datamodel: bid strategy per campaign
- [ ] Aanbeveling-engine:
  - Geen data → Klikken Maximaliseren
  - Data aanwezig → Conversies Maximaliseren of Conversiewaarde Maximaliseren
  - tROAS alleen bij specifieke strategische doelen
- [ ] Brand campaign concept (lage bid 1-2ct op eigen merknaam)

### Keyword cannibalisatie
- [ ] Detectie: zelfde keyword in meerdere campaigns/ad groups
- [ ] Waarschuwing in UI bij conflict

---

## 🎯 Sprint 7.5 — SEA specialist feedback (sessie 18 mei)

Punten uit de demo-sessie met de SEA specialisten.

### Locatie targeting uitbreiden
- [ ] Datamodel: brief.location → structured (type: 'radius' | 'postcodes' | 'coordinates')
- [ ] UI: postcodes invoeren + coördinaten + straal
- [ ] Export: juiste Google Ads Editor locatie rows per type

### Ad copy editor verbeteringen
- [ ] **Karakter-counter** in textarea (headlines max 30, descriptions max 90)
- [ ] Live waarschuwing bij overschrijden + harde stop
- [ ] Hoofdlettergebruik validatie (geen ALL CAPS, Title Case helpen)

### LLM keuze + benchmarking
- [ ] LLM picker per stap (Claude / OpenAI / Gemini)
- [ ] Default per stap configureerbaar
- [ ] A/B test infrastructuur: zelfde brief × meerdere LLM's → vergelijk output
- [ ] Test inzicht: welk model presteert het best voor Search-campagnes

### Chat feedback per stap
- [ ] "Chat met AI" panel op elke pipeline stap
- [ ] Gebruiker kan extra context/feedback geven → AI itereert
- [ ] Bewaart conversatie-history per brief-stap

### Optimalisatie bestaande campagnes
- [ ] Pull bestaande Google Ads campagne data (vereist Google Ads API)
- [ ] AI analyseert performance + stelt verbeteringen voor
- [ ] Apart pipeline-type: "Optimize" naast "Create new"

### Concurrentie- & kostprijs analyse
- [ ] Onderzoek: Google Ads Keyword Planner API ipv Ahrefs/SEMrush
- [ ] SERP analyse: automatisch concurrent posities ophalen
- [ ] Concurrentmerken automatisch detecteren

### Website analyse opschoning
- [ ] Meta-data filtering in scrape-website (geen ads, scripts, etc.)
- [ ] Betere extractie van product/service info
- [ ] Cache scrapes per domain

### Soli Power praktijkcase patronen
- [x] PMax als basis op nichemarkten werkt
- [ ] AI suggestie: ad scheduling (geen nacht/weekend voor bepaalde sectoren)
- [ ] Doelgroep validatie tegen de strategie

---

## 🌐 Sprint 8+ — Google integraties

Externe koppelingen — vereisen OAuth setup per klant.

### 1. Google Analytics 4 API (laagste drempel — eerste prioriteit)

**Wat het doet:**
- Pull conversies, e-commerce data, doelgroepen, paths, micro-conversies
- Rijke context bij keyword research: welke pages converteren?
- CPA per kanaal vergelijking

**Setup:**
- GA4 property ID per klant
- OAuth2 of service account
- Geen review proces nodig

**Waarom eerst:** Read-only, laagste implementatie drempel, levert direct waarde voor inzichten en dashboards.

### 2. Google Ads API (push integratie)

**Wat het doet:**
- Push campagnes, ad groups, keywords, RSA's, negatives, extensions automatisch live
- Pull real-time spend, impressies, klikken, conversies
- Vervangt de XLSX export → directe sync

**Setup:**
- Google Ads developer token (review proces, kan weken duren)
- OAuth2 per klant
- Customer ID (Google Ads account ID)

**Waarom later:** Vereist Google review. Tegen die tijd is de tool inhoudelijk volwassen, wat de aanvraag versterkt.

### 3. Google Tag Manager API

**Wat het doet:**
- Push: tracking tags automatisch instellen (Google Ads conversion, GA4 events)
- Pull: check welke tags al draaien, validatie of conversion tracking werkt
- Tracking monitor: alerts bij flatlines (interview-wens)

**Setup:**
- GTM container ID per klant
- OAuth2 met `tagmanager.edit.containers` scope

**Waarom als laatste:** Bouwt voort op de andere twee koppelingen. Versterkt de "tracking gezond?"-functie.

---

## 📊 Sprint 9+ — Reporting & monitoring

Vereist (deels) de Google koppelingen.

- [ ] Live dashboard per klant (Looker Studio stijl): budget, cost, vertoningen, klikken, conversies, conversiewaarde, CPA, ROAS
- [ ] Alerts bij €0 spend / flatlines / tracking failures
- [ ] Multi-channel view: Google Ads + Meta + Shopify gecombineerd
- [ ] Rapporten met **inzichten + conclusies + vooruitblik** (niet alleen cijfers)
- [ ] AI samenvattingen van wat opvalt + aanbevolen acties

---

## 🛡️ AI guardrails

Belangrijke regels uit de interviews:

- AI mag **wel** copy aanpassen
- AI mag **niet** zelfstandig budgetten of biedstrategieën wijzigen
- AI mag **wel** suggesties doen, gebruiker keurt goed
- Strategie, doelen en merkverhaal blijven mensenwerk
- Operationeel/bulkwerk (campagnes opbouwen) kan grotendeels door agent

Dit moet als **approval flow** in de UI zitten zodra we Google Ads API gaan pushen.

---

## ✏️ Cookie consent / Tracking checks

- [ ] Consent Mode v2 validatie bij elke nieuwe klant
- [ ] Check op cookie pop-up correctheid (vereist GTM API)
- [ ] Voorkeur: hardcoded tracking direct op website boven GTM (zoals interview adviseert)
