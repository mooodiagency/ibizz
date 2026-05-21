-- Voer dit uit in Supabase SQL editor om de Social Agent interview notulen
-- toe te voegen aan de notulen tabel. Verschijnt daarna in het Notulist archief.

insert into notulen (
  title,
  client_name,
  datum,
  aanwezig,
  samenvatting,
  agendapunten,
  besluiten,
  actiepunten,
  volgende_vergadering,
  transcript,
  created_by_name
)
values (
  'Social Agent kennis sessie',
  'ibizz intern',
  '21 mei 2026',
  array['Khalid Karmoudi', 'Senior Social Media Specialist'],

  -- Samenvatting
  'Sessie waarin de huidige social workflow van ibizz is doorgenomen — kalender, content creatie, multi-platform adaptatie, goedkeuringsflow via Planable, paid social workflow (eerst in Planable, daarna handmatig in Meta Ads Manager), community management, rapportage en AI-integratie. Focus lag op het identificeren van repetitief werk (vooral het overzetten van Planable naar Ads Manager) en het bepalen waar AI tijd kan besparen zonder de klantgerichte kwaliteit en goedkeuringsflow te ondermijnen.',

  -- Agendapunten (jsonb array)
  '[
    {"titel": "Werkwijze & onboarding", "toelichting": "Week 1 begint met kanaal-audit en brand discovery. Standaard kanalen: IG+FB (B2C), LinkedIn (B2B), TikTok bij jongere doelgroep, YouTube bij long-form video klanten. Gemiddeld 3-5 posts per week per kanaal. Klant kost 8-15 uur per maand: 40% creatie, 25% planning + Planable goedkeuring, 20% community management, 15% rapportage. Social niet geschikt onder €500/mnd of bij niche B2B met te kleine doelgroep."},
    {"titel": "Content kalender & planning", "toelichting": "Maandelijkse kalender in Planable. Verdeling 60% gepland / 30% actueel / 10% reactief. 2-3 weken vooruit plannen. Content pijlers per klant: educatief, sales, behind-the-scenes, customer story, brand awareness. Funnel: 50% TOFU / 30% MOFU / 20% BOFU."},
    {"titel": "Content creatie", "toelichting": "Ideeën uit brainstorm + performance learnings + trending watch + klant nieuws. Visuals via shoots, designers en steeds vaker Brandstudio. Eén post 45-90 min. Frameworks: hook-story-CTA, PAS, AIDA voor LinkedIn. Hashtags IG 5-10, LinkedIn 3-5, TikTok 3-5. Brand consistency via vast brand-doc + eindredactie."},
    {"titel": "Multi-platform adaptatie", "toelichting": "Niet één post voor alle platforms — master concept met platform-specifieke variaties. Formaten: 1080x1080, 1080x1350 (IG portrait), 1080x1920 (stories/reels/TikTok), 1200x628 LinkedIn landscape. Copy nooit kopiëren tussen platforms — zelfde boodschap, andere verpakking."},
    {"titel": "Approval flow met Planable", "toelichting": "Planable is de hartader. Workflow: content in Planable -> klant reageert -> ibizz past aan -> klant accepteert -> ingepland of handmatig naar Ads Manager. 2-3 revisie rondes, 3-5 dagen tot goedgekeurd. Deadline minimaal 48u voor live datum. Klanten die te laat reageren is terugkerend probleem."},
    {"titel": "Publishing & scheduling", "toelichting": "Planable doet scheduling — werkt voor organic. Stories handmatig. Frustraties: geen Ads Manager integratie, beperkte analytics, geen multi-platform copy varianten native, TikTok scheduling brakkig. Beste tijden per klant uit insights. First-comment hashtags handmatig."},
    {"titel": "Community management", "toelichting": "Meestal bij klant zelf, ibizz monitort. SLA: 4u op werkdagen, 24u in weekend. Negatieve comments: protocol publiekelijk erkennen + via DM verder. AI kan triage en suggesties doen, geen auto-reply."},
    {"titel": "Paid social — Planable naar Ads Manager", "toelichting": "Grootste pijn. Ad concept in Planable, klant keurt goed, dan handmatig in Meta Ads Manager: campagne + ad set + creatives + copy + URL + UTM tags. 20-30 min per ad set kopieerwerk. Voor 5-10 ads = 2-5 uur per campagne. 70% van klanten doet paid. Verhouding 60% paid Meta / 40% organic. Best presterende formaten mei 2026: Reels met UGC-look, carousel productvergelijking, video testimonials 15-30sec."},
    {"titel": "Rapportage & KPIs", "toelichting": "Maandelijks rapport: bereik, engagement rate, volgersgroei, website klikken, conversies, top 3 posts, aandachtspunten, plan. Goede engagement rates 2026: IG 2-3%, LinkedIn 3-4%, TikTok 5-9%, FB 1-2%. Ideaal dashboard: multi-platform, vergelijking met vorige maand+jaar, AI wat-valt-op sectie, doelen vs realisatie. Alerts gewenst: virale post, bereik daling >20%, influencer comment, negatieve sentiment spike."},
    {"titel": "Huidige tools", "toelichting": "Planable (~$50/klant/mnd, core), Meta Business Suite (gratis), Sprout Social (2 grote klanten), Canva Pro, ChatGPT/Claude Pro, CapCut. Wil vervangen: aparte reporting tooling, Ads Manager kopieerwerk, strategie/brainstorm sessies. Planable goedkeuring workflow moet behouden blijven."},
    {"titel": "AI integratie", "toelichting": "AI tijd-besparers: Ads Manager kopieerwerk (grootste), copy variaties (5 hooks per concept), multi-platform adaptatie, comment triage, rapport draft. AI mag NIET: auto-publishen, comments/DMs sturen, ads live zetten, budget wijzigen. Nu al: ChatGPT voor 30% copy drafts, Brandstudio voor 20% visuals. Bij 80% AI-content verschuift rol naar regisseur+kwaliteit."},
    {"titel": "Trends & reactief", "toelichting": "Spotten via TikTok For You, IG Reels Explore, Reddit, X. TikTok audio binnen 24-48u, branded trends binnen week, politiek/maatschappelijk meestal niet. Brand-first — liever trend skippen dan off-brand."},
    {"titel": "Influencers & UGC", "toelichting": "Influencer marketing incidenteel, bij product launches. UGC actief — vragen klanten van klanten om content, reposten met toestemming. UGC presteert vrijwel altijd beter dan branded content. Shop features per geval relevant."},
    {"titel": "Integratie met andere ibizz tools", "toelichting": "SEO ↔ Social: SEO content -> social teaser, social trend -> SEO blog. Personas delen. Brandstudio structureler gebruiken (campagne master -> alle social formaten). Friday voor task tracking (post maken, klant herinneren, ads live zetten)."},
    {"titel": "Klant cases", "toelichting": "Geknald: zonnepanelen klant met UGC reels strategie, engagement +180%, leads +40% in 3 maanden. Niet gewerkt: B2B accountant kantoor, te kleine doelgroep voor social. Klant fouten: inconsistent posten, te verkoperig, verkeerd formaat, geen reactie op comments, geen analyse."},
    {"titel": "Agent ontwerp visie", "toelichting": "Ideale dag: dashboard toont klanten die goedgekeurd hebben in Planable, Social Agent heeft die al als paused concept-ads in Ads Manager staan. Check en klik live. AI heeft ook rapport-draft klaar. Geen kopieerwerk meer. Ene ding: Planable -> Ads Manager brug dichtgooien zonder workflow change."}
  ]'::jsonb,

  -- Besluiten (text array)
  array[
    'Planable blijft de approval flow — Social Agent vervangt het NIET, maar bouwt erbovenop',
    'Grootste pijnpunt = Planable -> Meta Ads Manager handmatige kopieerwerk. Eerste focus van Social Agent moet dit oplossen',
    'AI mag wel content draften en variaties genereren, mag NIET zelfstandig publiceren of in Ads Manager wijzigen zonder goedkeuring',
    'Personas worden gedeeld met SEO en SEA Agent — één bron van waarheid per klant',
    'Brandstudio integratie wordt structureler — uit één campagne master automatisch alle social formaten',
    'Multi-platform adaptatie — één concept, AI maakt platform-specifieke varianten',
    'Community management blijft mensenwerk, AI doet triage + suggesties',
    'Maandelijkse klant rapportage wordt AI-assisted (draft + insights), eindredactie door mens'
  ],

  -- Actiepunten (jsonb array)
  '[
    {"actie": "Plan Social Agent uitwerken in dezelfde stijl als SEO Agent (sprints, datamodel, integraties)", "eigenaar": "Khalid", "deadline": null},
    {"actie": "Onderzoeken Meta Marketing API — kan de Social Agent direct ad sets aanmaken in Ads Manager (mits goedkeuring)?", "eigenaar": "Khalid", "deadline": null},
    {"actie": "Onderzoeken Planable API — bestaat die? Anders content handmatig uit Planable halen", "eigenaar": "Khalid", "deadline": null},
    {"actie": "Persona structuur afstemmen met SEO Agent zodat ze dezelfde tabel kunnen gebruiken", "eigenaar": "Khalid", "deadline": null},
    {"actie": "Brandstudio batch export — feature om uit één master alle social formaten in één klik te genereren", "eigenaar": "Khalid", "deadline": null},
    {"actie": "Multi-platform copy generator — AI prompt + UI om uit één briefing platform-varianten te genereren", "eigenaar": "Khalid", "deadline": null},
    {"actie": "Reporting dashboard specificatie maken (multi-platform view, wat-valt-op AI sectie)", "eigenaar": "Khalid", "deadline": null},
    {"actie": "Trend watcher onderzoeken — TikTok For You scrapen / Trending audio detectie", "eigenaar": "Khalid", "deadline": null}
  ]'::jsonb,

  -- Volgende vergadering
  'Plan Social Agent presenteren — datum nog te bepalen',

  -- Transcript (volledige interview tekst)
  '[Notulen kennis sessie Social Agent — 21 mei 2026]

Gesprek tussen Khalid Karmoudi en Senior Social Media Specialist over de huidige social workflow van ibizz, met als doel input verzamelen voor de te bouwen Social Agent.

Volledig uitgewerkt verslag staat in docs/INTERVIEW-SOCIAL.md in de friday-pm repo.

Kern: Planable is de approval-hartader, grootste pijn is het handmatige overzetten van Planable naar Meta Ads Manager. AI moet daar de meeste tijdsbesparing leveren, zonder de klantgerichte goedkeuringsflow te ondermijnen.',

  -- Created by name
  'Khalid Karmoudi'
);
