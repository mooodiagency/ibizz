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
- [ ] Broad match standaard uit, alleen exact + phrase
- [ ] Waarschuwing als broad wordt gekozen
- [ ] Default match type per intent (transactional → exact, commercial → phrase)

### Budget validatie
- [ ] Drempels per campaign type:
  - Search: minimum €10/dag
  - Performance Max: minimum €20/dag
  - Demand Gen: minimum €10.000/maand
  - Algemeen: niet onder €5/dag
- [ ] CPA helper op basis van product marge
  - €50-€150 producten → max CPA ~€25
  - <€50 producten → max CPA ~€10
- [ ] Waarschuwing bij te lage budget/CPA verhouding

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

### Targeting
- [ ] Locatie targeting: standaard "aanwezigheid", niet "interesse"
- [ ] Demografische uitsluitingen per brief (leeftijd, geslacht)
- [ ] Device exclusions (tablets standaard uit)
- [ ] Apps uitsluiten in PMax (standaard)

### Keyword cannibalisatie
- [ ] Detectie: zelfde keyword in meerdere campaigns/ad groups
- [ ] Waarschuwing in UI bij conflict

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
