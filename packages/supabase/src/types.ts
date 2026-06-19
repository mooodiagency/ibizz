export type Status = 'todo' | 'in_progress' | 'review' | 'done'

// ─── Brandstudio ────────────────────────────────────────────────────────
export type Brand = {
  id: string
  name: string
  color: string
  created_by: string | null
  created_by_name: string | null
  created_at: string
}

export type BrandCategory = {
  id: string
  brand_id: string
  name: string
  sort_order: number
  created_at: string
}

export type BrandImageStatus = 'pending' | 'approved' | 'rejected'

export type BrandImage = {
  id: string
  brand_id: string
  category_id: string | null
  name: string
  storage_path: string
  url: string
  status: BrandImageStatus
  reject_reason: string | null
  uploaded_by: string | null
  uploaded_by_name: string | null
  created_at: string
}

export type SeaBriefStatus = 'draft' | 'in_review' | 'approved' | 'archived'

export type SeaCampaignType = {
  type: string
  budget: number
  share_pct: number
  reasoning: string
}

// ─── Keyword research ─────────────────────────────────────────────────
export type SeaMatchType = 'broad' | 'phrase' | 'exact'
export type SeaIntent = 'informational' | 'commercial' | 'transactional' | 'branded'

export type SeaKeyword = {
  text: string
  match_type: SeaMatchType
  intent: SeaIntent
  /** Ahrefs enrichment (sprint 3.1) */
  search_volume?: number | null
  cpc?: number | null
  keyword_difficulty?: number | null
  enriched_at?: string | null
}

export type SeaAdCopy = {
  headlines: string[]      // max 30 chars each, RSA wants 15
  descriptions: string[]   // max 90 chars each, RSA wants 4
  final_url?: string | null
  display_path_1?: string | null
  display_path_2?: string | null
  generated_at?: string | null
}

export type SeaAdGroup = {
  name: string
  theme: string
  keywords: SeaKeyword[]
  ad_copy?: SeaAdCopy
}

export type SeaCampaign = {
  name: string
  type: 'Search' | 'Performance Max' | 'Display' | 'Demand Gen' | 'YouTube'
  segment: 'branded' | 'non-branded' | 'pmax'
  ad_groups: SeaAdGroup[]
}

export type SeaNegativeKeyword = {
  id: string
  brand_id: string | null   // null = global, set = brand-specific
  keyword: string
  match_type: SeaMatchType
  category: string
  notes: string | null
  created_at: string
  created_by: string | null
}

export type SeaKeywordResearchStatus = 'draft' | 'approved' | 'rejected'

export type SeaKeywordResearch = {
  id: string
  brief_id: string
  website_url: string | null
  scraped_summary: string | null
  campaigns: SeaCampaign[]
  status: SeaKeywordResearchStatus
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export type SeaBudgetItem = {
  name: string
  amount: number
  percentage: number
}

export type SeaExpectedResults = {
  estimated_leads: number | null
  estimated_cpa: number | null
  conversion_rate_pct: number | null
  notes: string | null
}

export type SeaTimelineItem = {
  week: string
  focus: string
}

export type SeaStrategyStatus = 'draft' | 'approved' | 'rejected'

export type SeaStrategy = {
  id: string
  brief_id: string
  summary: string | null
  budget_breakdown: SeaBudgetItem[]
  expected_results: SeaExpectedResults | null
  campaign_types: SeaCampaignType[]
  timeline: SeaTimelineItem[]
  considerations: string[]
  status: SeaStrategyStatus
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export type SeaBrief = {
  id: string
  brand_id: string | null
  title: string
  goal: string | null
  monthly_budget: number | null
  target_cpa: number | null
  target_audience: string | null
  icp: string | null
  location: string
  status: SeaBriefStatus
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

// ─── SEO Agent ────────────────────────────────────────────────────────

export type SeoBriefStatus = 'draft' | 'in_review' | 'approved' | 'archived'

export type SeoBrief = {
  id: string
  brand_id: string | null
  title: string
  goal: string | null
  monthly_target: string | null            // bv. "1000 organic visitors/maand"
  primary_market: string                   // locatie context
  website_url: string | null               // huidige klant website
  competitors: string[]                    // concurrent URLs
  status: SeoBriefStatus
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export type SeoPersonaDemographics = {
  age_range?: string | null
  occupation?: string | null
  location?: string | null
  family?: string | null
  income?: string | null
}

export type SeoPersona = {
  id: string
  brief_id: string
  name: string                              // "Tech-savvy Tom"
  avatar_emoji: string                      // "👤"
  one_liner: string | null                  // korte typering
  demographics: SeoPersonaDemographics | null
  pains: string[]
  motivations: string[]
  search_behavior: string[]                 // queries die ze typen
  channels: string[]                        // LinkedIn / FB / Google
  sort_order: number
  created_at: string
}

export type SeoThemeStatus = 'active' | 'on_hold' | 'archived'
export type SeoSearchIntent = 'informational' | 'commercial' | 'transactional' | 'navigational'

export type SeoTheme = {
  id: string
  brief_id: string
  name: string                              // "Belasting & ZZP"
  description: string | null
  search_intent: SeoSearchIntent | null
  status: SeoThemeStatus
  sort_order: number
  created_at: string
}

/** Koppelingstabel persona × theme */
export type SeoPersonaTheme = {
  persona_id: string
  theme_id: string
  created_at: string
}

export type SeoMessage = {
  id: string
  brief_id: string
  message: string
  notes: string | null
  created_at: string
}

export type SeoMessagePersona = {
  message_id: string
  persona_id: string
}

export type SeoPageStatus = 'idea' | 'planned' | 'in_progress' | 'review' | 'published'

export type SeoPage = {
  id: string
  brief_id: string
  persona_id: string | null
  theme_id: string | null
  topic: string                             // "Hoe doe ik btw-aangifte als ZZP'er?"
  target_keyword: string | null
  secondary_keywords: string[]
  search_intent: SeoSearchIntent | null
  estimated_volume: number | null
  status: SeoPageStatus
  notes: string | null
  /** Lessons learned referentie — wat is gebleken bij eerdere content voor deze persona */
  lessons_applied: string[]
  created_at: string
  updated_at: string
}

export type SeoWriterBriefStatus = 'draft' | 'sent' | 'completed'

export type SeoWriterBrief = {
  id: string
  page_id: string
  /** Volledige brief content — JSON met alle velden voor de schrijver */
  content: {
    persona_name: string
    pain_addressed: string
    theme: string
    message: string
    target_keyword: string
    secondary_keywords: string[]
    search_intent: string
    tone_of_voice: string
    word_count_target: number
    headings_structure: string[]
    must_include: string[]
    must_avoid: string[]
    lessons_learned: string[]
    internal_links: string[]
    examples_good?: string
    examples_bad?: string
  }
  pdf_url: string | null
  sent_to: string | null                    // "Caven"
  sent_at: string | null
  status: SeoWriterBriefStatus
  created_at: string
}

export type SeoArticleStatus = 'draft' | 'review' | 'approved' | 'published'

export type SeoArticle = {
  id: string
  page_id: string
  writer_brief_id: string | null
  title: string
  meta_title: string | null
  meta_description: string | null
  content_markdown: string
  model: string
  word_count: number
  status: SeoArticleStatus
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
  created_by: string | null
  created_by_name: string | null
}

export type SeoLessonType = 'success' | 'failure' | 'observation'

export type SeoLesson = {
  id: string
  brief_id: string
  persona_id: string | null
  theme_id: string | null
  type: SeoLessonType
  description: string                       // wat werkte / werkte niet
  context: string | null                    // bij welke content / page
  created_at: string
  created_by: string | null
}

// ─── Video Agent ────────────────────────────────────────────────────────
export type VideoBriefStatus = 'draft' | 'in_review' | 'approved' | 'archived'
export type VideoKostencategorie = 'LAAG' | 'LAAG-MIDDEL' | 'MIDDEL' | 'MIDDEL-HOOG' | 'HOOG'
export type VideoShotTag = 'REAL' | 'CGI' | 'STOCK'
export type VideoResearchPlatform = 'tiktok' | 'instagram' | 'youtube_shorts' | 'other'

export type VideoCastRole = {
  rol: string                                // bv. "hoofdactrice (FRENKY-drager)"
  aantal: number                             // 1, 2, 4-5 → opslaan als max (5)
  omschrijving: string | null                // "25-40 jaar, sterke uitstraling, casual reisstijl"
}

export type VideoLocation = {
  naam: string                               // "Eindhoven Airport (publiek)"
  scripts: number[]                          // [1, 2, 3, 4]
  toelichting: string | null                 // "5 scripts op één halve dag"
}

export type VideoBriefChange = {
  script_nummer: number | null               // null = brief-level change
  veld: string | null                        // bv "hook" / "locatie" / null
  tekst: string                              // bv "nieuwe vang-hook — actrice vangt FRENKY"
}

export type VideoProductieToets = {
  cast: string                               // "1 actrice"
  locatie: string                            // "Eindhoven Airport publiek"
  props: string                              // "FRENKY (gevuld voor gewicht), casual outfit"
  permits: string                            // "Geen — DJI OSMO Pocket 3 handheld"
  productietijd: string                      // "3 uur incl. reis"
  risico: string                             // "Drukte kan opnames hinderen — vroege ochtend"
  kostencategorie: VideoKostencategorie
}

export type VideoShot = {
  nummer: number
  tag: VideoShotTag
  beschrijving: string                       // "Wide — vrouw staat op vliegveld, FRENKY vliegt in"
  start_sec: number
  end_sec: number
}

export type VideoScriptLine = {
  type: 'vo' | 'direction'                   // 'vo' = voice-over (italic quotes), 'direction' = "(beat)"
  text: string
}

export type VideoTextOverlay = {
  start_sec: number
  end_sec: number | null                     // null = "Eind"
  text: string
}

export type VideoBrief = {
  id: string
  brand_id: string | null
  dag_titel: string                          // "Dag 1 — Op locatie"
  intro_subtitel: string | null              // "ibizz × FRENKY"
  overzicht: string | null                   // korte beschrijving wat in deze dag zit
  brand_context: string | null               // vrije tekst — ToV, positionering, doelgroep, USP's (input voor AI prompt)
  cast_totaal: VideoCastRole[]               // alle rollen gebundeld over alle scripts
  locaties: VideoLocation[]
  status: VideoBriefStatus
  versie: number                             // huidige versie nummer (start op 1, bumpt bij snapshot)
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export type VideoScript = {
  id: string
  brief_id: string
  nummer: number                             // 1..N
  titel: string                              // "De stille walk-by"
  doel: string | null
  inzicht: string | null
  locatie: string | null
  lengte_sec: number | null                  // ~35
  cast_rollen: VideoCastRole[]               // 'cast' is reserved in Postgres → opgeslagen als cast_rollen
  productie_toets: VideoProductieToets | null
  hook: string | null
  concept: string | null
  script_lines: VideoScriptLine[]            // voice-over + (beat)-directions in volgorde
  shotlist: VideoShot[]
  tekst_in_beeld: VideoTextOverlay[]
  montage: string | null
  cta: string | null
  caption: string | null
  variaties: string[]                        // alternatieve CTA/hook regels
  created_at: string
  updated_at: string
}

export type VideoResearch = {
  id: string
  brief_id: string
  platform: VideoResearchPlatform
  url: string
  caption: string | null
  views: number | null
  likes: number | null
  comments: number | null
  transcript: string | null                  // eerste 3 sec / hele video
  hook_pattern: string | null                // welke hook-techniek (POV, vergelijking, etc.)
  notes: string | null
  source: 'scraped' | 'manual'
  added_by: string | null
  added_by_name: string | null
  created_at: string
}

export type VideoBriefVersionSnapshot = {
  brief: VideoBrief
  scripts: VideoScript[]
}

export type VideoBriefVersion = {
  id: string
  brief_id: string
  versie: number
  snapshot: VideoBriefVersionSnapshot
  changelog: VideoBriefChange[]              // auto-gegenereerde "→ Script X: ..." regels
  created_at: string
  created_by: string | null
}

// ─── Motion Agent (foto → video) ────────────────────────────────────────
export type MotionModelId = 'veo-3.1' | 'veo-3.1-fast' | 'veo-3.1-lite' | 'kling' | 'seedance' | 'runway'
export type MotionAspectRatio = '16:9' | '9:16'
export type MotionResolution = '720p' | '1080p'
export type MotionStatus = 'running' | 'succeeded' | 'failed'

export type MotionTextOverlay = {
  id: string
  text: string
  xPct: number
  yPct: number
  fontSizePct: number
  color: string
  fontFamily: string
  weight: number
  align: 'left' | 'center' | 'right'
  uppercase: boolean
  bg: string | null
  shadow: boolean
  startSec: number
  endSec: number | null
}

export type MotionGeneration = {
  id: string
  brand_id: string | null
  user_id: string | null
  user_name: string | null
  prompt: string
  model: MotionModelId
  aspect_ratio: MotionAspectRatio
  resolution: MotionResolution
  duration_sec: number | null
  source_image_url: string                  // bron-foto (public URL)
  source_image_path: string                 // storage path bron-foto
  status: MotionStatus
  operation_name: string | null             // Veo long-running operation ref
  result_url: string | null                 // resultaat-video public URL
  result_storage_path: string | null
  error: string | null
  text_overlays: MotionTextOverlay[]         // non-destructieve tekst-lagen (editor)
  created_at: string
  updated_at: string
}

// ─── GEO Agent (AI-zichtbaarheid & citatie-intelligence) ────────────────
export type GeoProjectStatus = 'active' | 'paused' | 'archived'
export type GeoPromptIntent = 'informational' | 'commercial' | 'comparison' | 'transactional' | 'navigational'
export type GeoPromptSource = 'ai' | 'reddit' | 'cbs' | 'news' | 'trends' | 'manual'
export type GeoEngine = 'claude' | 'gemini' | 'openai' | 'perplexity'
export type GeoRunStatus = 'running' | 'done' | 'failed'
export type GeoSentiment = 'positive' | 'neutral' | 'negative'

export type GeoProject = {
  id: string
  brand_id: string | null
  name: string
  market: string                              // bv "Netherlands"
  website_url: string | null
  brand_terms: string[]                       // namen/varianten waarop we 't merk herkennen
  competitors: string[]
  topics: string[]
  status: GeoProjectStatus
  seo_brief_id: string | null                 // gekoppelde SEO-brief waar kansen heen gepusht worden
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export type GeoPrompt = {
  id: string
  project_id: string
  text: string
  intent: GeoPromptIntent
  topic: string | null
  persona: string | null
  desired_answer: string | null               // het antwoord dat de persona zoekt (ideaal antwoord)
  source: GeoPromptSource
  active: boolean
  created_at: string
}

export type GeoPersonaDemographics = {
  age_range: string | null
  region: string | null
  income: string | null
  household: string | null
  education: string | null
  occupation: string | null
}

export type GeoPersona = {
  id: string
  project_id: string
  name: string
  segment: string | null                      // korte segment-omschrijving
  demographics: GeoPersonaDemographics | null
  situation: string | null                    // context/leefsituatie
  motivations: string[]
  how_they_ask: string | null                 // hoe deze persona vragen formuleert aan AI
  share: number | null                        // ruwe % van de doelgroep
  source: 'cbs' | 'ai'
  created_at: string
}

export type GeoCitedSource = { domain: string; url: string | null; title: string | null }
export type GeoCompetitorCount = { name: string; count: number }

export type GeoRunSummary = {
  totalPrompts: number
  brandMentions: number
  sov: number                                 // share of voice 0-100
  avgAnswerFit: number | null                 // gemiddelde 0-100: matcht AI-antwoord wat de persona zoekt
  sentiment: { positive: number; neutral: number; negative: number }
  topCompetitors: GeoCompetitorCount[]
  topSources: { domain: string; count: number }[]
}

export type GeoRun = {
  id: string
  project_id: string
  engine: GeoEngine
  status: GeoRunStatus
  prompt_count: number
  summary: GeoRunSummary | null
  error: string | null
  created_at: string
  created_by: string | null
}

export type GeoResult = {
  id: string
  run_id: string
  prompt_id: string
  engine: GeoEngine
  answer: string
  brand_mentioned: boolean
  brand_position: number | null               // 1 = eerst genoemd, etc.
  competitors: string[]
  cited_sources: GeoCitedSource[]
  sentiment: GeoSentiment | null
  answer_fit: number | null                   // 0-100: matcht 't AI-antwoord wat de persona zocht
  created_at: string
}

export type GenerationStatus = 'draft' | 'approved' | 'rejected'

export type Generation = {
  id: string
  brand_id: string
  user_id: string | null
  user_name: string | null
  prompt: string
  model: string
  reference_image_ids: string[]
  result_url: string | null
  result_storage_path: string | null
  status: GenerationStatus
  created_at: string
}

export type Profile = {
  id: string
  name: string
  color: string
  function: string | null
  department: string | null
  phone: string | null
  availability: string
  bio: string | null
  created_at: string
}

export type Project = {
  id: string
  name: string
  color: string
  created_at: string
  created_by: string | null
}

export type ProjectSection = {
  id: string
  project_id: string
  name: string
  sort_order: number
  created_at: string
}

export type ProjectLine = {
  id: string
  project_id: string
  section_id: string | null
  name: string
  owner_id: string | null
  owner_name: string | null
  status: Status
  prio: number
  start_date: string
  due_date: string | null
  created_at: string
  sort_order: number
}

export type Attachment = {
  name: string
  url: string
  type: string
  size: number
}

export type NotulenEdit = {
  id: string
  notulen_id: string
  user_id: string | null
  user_name: string | null
  changes: { field: string; old: string; new: string }[]
  created_at: string
}

export type Notulen = {
  id: string
  project_id: string | null
  title: string
  client_name: string | null
  datum: string | null
  aanwezig: string[]
  samenvatting: string | null
  agendapunten: { titel: string; toelichting: string }[]
  besluiten: string[]
  actiepunten: { actie: string; eigenaar: string | null; deadline: string | null; task_id?: string | null }[]
  volgende_vergadering: string | null
  transcript: string | null
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export type LineView = {
  user_id: string
  line_id: string
  last_viewed_at: string
}

export type LineMessage = {
  id: string
  line_id: string
  user_id: string | null
  user_name: string
  content: string
  attachments: Attachment[]
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: { id: string; name?: string; color?: string; function?: string | null; department?: string | null; phone?: string | null; availability?: string; bio?: string | null; created_at?: string }
        Update: Partial<Profile>
        Relationships: []
      }
      projects: {
        Row: Project
        Insert: {
          id?: string
          name: string
          color?: string
          created_at?: string
          created_by?: string | null
        }
        Update: Partial<Project>
        Relationships: []
      }
      project_sections: {
        Row: ProjectSection
        Insert: {
          id?: string
          project_id: string
          name?: string
          sort_order?: number
          created_at?: string
        }
        Update: Partial<ProjectSection>
        Relationships: []
      }
      project_lines: {
        Row: ProjectLine
        Insert: {
          id?: string
          project_id: string
          section_id?: string | null
          name?: string
          owner_id?: string | null
          owner_name?: string | null
          status?: Status
          prio?: number
          start_date?: string
          due_date?: string | null
          created_at?: string
          sort_order?: number
        }
        Update: {
          id?: string
          project_id?: string
          section_id?: string | null
          name?: string
          owner_id?: string | null
          owner_name?: string | null
          status?: Status
          prio?: number
          start_date?: string
          due_date?: string | null
          created_at?: string
          sort_order?: number
        }
        Relationships: []
      }
      line_views: {
        Row: LineView
        Insert: { user_id: string; line_id: string; last_viewed_at?: string }
        Update: Partial<LineView>
        Relationships: []
      }
      line_messages: {
        Row: LineMessage
        Insert: {
          id?: string
          line_id: string
          user_id?: string | null
          user_name?: string
          content: string
          attachments?: Attachment[]
          created_at?: string
        }
        Update: Partial<LineMessage>
        Relationships: []
      }
      notulen_edits: {
        Row: NotulenEdit
        Insert: {
          id?: string
          notulen_id: string
          user_id?: string | null
          user_name?: string | null
          changes?: { field: string; old: string; new: string }[]
          created_at?: string
        }
        Update: Partial<NotulenEdit>
        Relationships: []
      }
      notulen: {
        Row: Notulen
        Insert: {
          id?: string
          project_id?: string | null
          title?: string
          client_name?: string | null
          datum?: string | null
          aanwezig?: string[]
          samenvatting?: string | null
          agendapunten?: { titel: string; toelichting: string }[]
          besluiten?: string[]
          actiepunten?: { actie: string; eigenaar: string | null; deadline: string | null; task_id?: string | null }[]
          volgende_vergadering?: string | null
          transcript?: string | null
          created_by?: string | null
          created_by_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<Notulen, 'id' | 'created_at'>>
        Relationships: []
      }
      apps: {
        Row: {
          id: string
          name: string
          description: string | null
          icon: string
          color: string
          url: string | null
          status: 'active' | 'coming_soon' | 'beta'
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          icon?: string
          color?: string
          url?: string | null
          status?: 'active' | 'coming_soon' | 'beta'
          created_at?: string
        }
        Update: Partial<{
          name: string
          description: string | null
          icon: string
          color: string
          url: string | null
          status: 'active' | 'coming_soon' | 'beta'
        }>
        Relationships: []
      }
      brands: {
        Row: Brand
        Insert: { id?: string; name: string; color?: string; created_by?: string | null; created_by_name?: string | null; created_at?: string }
        Update: Partial<Pick<Brand, 'name' | 'color' | 'created_by_name'>>
        Relationships: []
      }
      brand_categories: {
        Row: BrandCategory
        Insert: { id?: string; brand_id: string; name: string; sort_order?: number; created_at?: string }
        Update: Partial<Pick<BrandCategory, 'name' | 'sort_order'>>
        Relationships: []
      }
      brand_images: {
        Row: BrandImage
        Insert: {
          id?: string
          brand_id: string
          category_id?: string | null
          name: string
          storage_path: string
          url: string
          status?: BrandImageStatus
          reject_reason?: string | null
          uploaded_by?: string | null
          uploaded_by_name?: string | null
          created_at?: string
        }
        Update: Partial<Pick<BrandImage, 'name' | 'category_id' | 'status' | 'reject_reason'>>
        Relationships: []
      }
      sea_negative_keywords: {
        Row: SeaNegativeKeyword
        Insert: {
          id?: string
          brand_id?: string | null
          keyword: string
          match_type?: SeaMatchType
          category?: string
          notes?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: Partial<Pick<SeaNegativeKeyword, 'brand_id' | 'keyword' | 'match_type' | 'category' | 'notes'>>
        Relationships: []
      }
      sea_keyword_research: {
        Row: SeaKeywordResearch
        Insert: {
          id?: string
          brief_id: string
          website_url?: string | null
          scraped_summary?: string | null
          campaigns?: SeaCampaign[]
          status?: SeaKeywordResearchStatus
          created_by?: string | null
          created_by_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<SeaKeywordResearch, 'id' | 'brief_id' | 'created_at'>>
        Relationships: []
      }
      sea_strategies: {
        Row: SeaStrategy
        Insert: {
          id?: string
          brief_id: string
          summary?: string | null
          budget_breakdown?: SeaBudgetItem[]
          expected_results?: SeaExpectedResults | null
          campaign_types?: SeaCampaignType[]
          timeline?: SeaTimelineItem[]
          considerations?: string[]
          status?: SeaStrategyStatus
          created_by?: string | null
          created_by_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<SeaStrategy, 'id' | 'brief_id' | 'created_at'>>
        Relationships: []
      }
      sea_briefs: {
        Row: SeaBrief
        Insert: {
          id?: string
          brand_id?: string | null
          title: string
          goal?: string | null
          monthly_budget?: number | null
          target_cpa?: number | null
          target_audience?: string | null
          icp?: string | null
          location?: string
          status?: SeaBriefStatus
          created_by?: string | null
          created_by_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<SeaBrief, 'id' | 'created_at'>>
        Relationships: []
      }
      seo_briefs: {
        Row: SeoBrief
        Insert: {
          id?: string
          brand_id?: string | null
          title: string
          goal?: string | null
          monthly_target?: string | null
          primary_market?: string
          website_url?: string | null
          competitors?: string[]
          status?: SeoBriefStatus
          created_by?: string | null
          created_by_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<SeoBrief, 'id' | 'created_at'>>
        Relationships: []
      }
      seo_personas: {
        Row: SeoPersona
        Insert: {
          id?: string
          brief_id: string
          name: string
          avatar_emoji?: string
          one_liner?: string | null
          demographics?: SeoPersonaDemographics | null
          pains?: string[]
          motivations?: string[]
          search_behavior?: string[]
          channels?: string[]
          sort_order?: number
          created_at?: string
        }
        Update: Partial<Omit<SeoPersona, 'id' | 'brief_id' | 'created_at'>>
        Relationships: []
      }
      seo_themes: {
        Row: SeoTheme
        Insert: {
          id?: string
          brief_id: string
          name: string
          description?: string | null
          search_intent?: SeoSearchIntent | null
          status?: SeoThemeStatus
          sort_order?: number
          created_at?: string
        }
        Update: Partial<Omit<SeoTheme, 'id' | 'brief_id' | 'created_at'>>
        Relationships: []
      }
      seo_persona_themes: {
        Row: SeoPersonaTheme
        Insert: { persona_id: string; theme_id: string; created_at?: string }
        Update: never
        Relationships: []
      }
      seo_messages: {
        Row: SeoMessage
        Insert: {
          id?: string
          brief_id: string
          message: string
          notes?: string | null
          created_at?: string
        }
        Update: Partial<Pick<SeoMessage, 'message' | 'notes'>>
        Relationships: []
      }
      seo_message_personas: {
        Row: SeoMessagePersona
        Insert: { message_id: string; persona_id: string }
        Update: never
        Relationships: []
      }
      seo_pages: {
        Row: SeoPage
        Insert: {
          id?: string
          brief_id: string
          persona_id?: string | null
          theme_id?: string | null
          topic: string
          target_keyword?: string | null
          secondary_keywords?: string[]
          search_intent?: SeoSearchIntent | null
          estimated_volume?: number | null
          status?: SeoPageStatus
          notes?: string | null
          lessons_applied?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<SeoPage, 'id' | 'brief_id' | 'created_at'>>
        Relationships: []
      }
      seo_writer_briefs: {
        Row: SeoWriterBrief
        Insert: {
          id?: string
          page_id: string
          content: SeoWriterBrief['content']
          pdf_url?: string | null
          sent_to?: string | null
          sent_at?: string | null
          status?: SeoWriterBriefStatus
          created_at?: string
        }
        Update: Partial<Pick<SeoWriterBrief, 'content' | 'pdf_url' | 'sent_to' | 'sent_at' | 'status'>>
        Relationships: []
      }
      seo_articles: {
        Row: SeoArticle
        Insert: {
          id?: string
          page_id: string
          writer_brief_id?: string | null
          title: string
          meta_title?: string | null
          meta_description?: string | null
          content_markdown: string
          model: string
          word_count?: number
          status?: SeoArticleStatus
          is_active?: boolean
          notes?: string | null
          created_at?: string
          updated_at?: string
          created_by?: string | null
          created_by_name?: string | null
        }
        Update: Partial<Omit<SeoArticle, 'id' | 'page_id' | 'created_at'>>
        Relationships: []
      }
      seo_lessons: {
        Row: SeoLesson
        Insert: {
          id?: string
          brief_id: string
          persona_id?: string | null
          theme_id?: string | null
          type: SeoLessonType
          description: string
          context?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: Partial<Pick<SeoLesson, 'type' | 'description' | 'context'>>
        Relationships: []
      }
      video_briefs: {
        Row: VideoBrief
        Insert: {
          id?: string
          brand_id?: string | null
          dag_titel: string
          intro_subtitel?: string | null
          overzicht?: string | null
          brand_context?: string | null
          cast_totaal?: VideoCastRole[]
          locaties?: VideoLocation[]
          status?: VideoBriefStatus
          versie?: number
          created_by?: string | null
          created_by_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<VideoBrief, 'id' | 'created_at'>>
        Relationships: []
      }
      video_scripts: {
        Row: VideoScript
        Insert: {
          id?: string
          brief_id: string
          nummer: number
          titel: string
          doel?: string | null
          inzicht?: string | null
          locatie?: string | null
          lengte_sec?: number | null
          cast_rollen?: VideoCastRole[]
          productie_toets?: VideoProductieToets | null
          hook?: string | null
          concept?: string | null
          script_lines?: VideoScriptLine[]
          shotlist?: VideoShot[]
          tekst_in_beeld?: VideoTextOverlay[]
          montage?: string | null
          cta?: string | null
          caption?: string | null
          variaties?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<VideoScript, 'id' | 'brief_id' | 'created_at'>>
        Relationships: []
      }
      video_research: {
        Row: VideoResearch
        Insert: {
          id?: string
          brief_id: string
          platform: VideoResearchPlatform
          url: string
          caption?: string | null
          views?: number | null
          likes?: number | null
          comments?: number | null
          transcript?: string | null
          hook_pattern?: string | null
          notes?: string | null
          source?: 'scraped' | 'manual'
          added_by?: string | null
          added_by_name?: string | null
          created_at?: string
        }
        Update: Partial<Pick<VideoResearch, 'caption' | 'views' | 'likes' | 'comments' | 'transcript' | 'hook_pattern' | 'notes'>>
        Relationships: []
      }
      video_brief_versions: {
        Row: VideoBriefVersion
        Insert: {
          id?: string
          brief_id: string
          versie: number
          snapshot: VideoBriefVersionSnapshot
          changelog?: VideoBriefChange[]
          created_at?: string
          created_by?: string | null
        }
        Update: never
        Relationships: []
      }
      generations: {
        Row: Generation
        Insert: {
          id?: string
          brand_id: string
          user_id?: string | null
          user_name?: string | null
          prompt: string
          model: string
          reference_image_ids?: string[]
          result_url?: string | null
          result_storage_path?: string | null
          status?: GenerationStatus
          created_at?: string
        }
        Update: Partial<Pick<Generation, 'prompt' | 'status' | 'result_url' | 'result_storage_path'>>
        Relationships: []
      }
      motion_generations: {
        Row: MotionGeneration
        Insert: {
          id?: string
          brand_id?: string | null
          user_id?: string | null
          user_name?: string | null
          prompt: string
          model: MotionModelId
          aspect_ratio: MotionAspectRatio
          resolution: MotionResolution
          duration_sec?: number | null
          source_image_url: string
          source_image_path: string
          status?: MotionStatus
          operation_name?: string | null
          result_url?: string | null
          result_storage_path?: string | null
          error?: string | null
          text_overlays?: MotionTextOverlay[]
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<MotionGeneration, 'id' | 'created_at'>>
        Relationships: []
      }
      geo_projects: {
        Row: GeoProject
        Insert: {
          id?: string
          brand_id?: string | null
          name: string
          market?: string
          website_url?: string | null
          brand_terms?: string[]
          competitors?: string[]
          topics?: string[]
          status?: GeoProjectStatus
          seo_brief_id?: string | null
          created_by?: string | null
          created_by_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Omit<GeoProject, 'id' | 'created_at'>>
        Relationships: []
      }
      geo_prompts: {
        Row: GeoPrompt
        Insert: {
          id?: string
          project_id: string
          text: string
          intent?: GeoPromptIntent
          topic?: string | null
          persona?: string | null
          desired_answer?: string | null
          source?: GeoPromptSource
          active?: boolean
          created_at?: string
        }
        Update: Partial<Omit<GeoPrompt, 'id' | 'project_id' | 'created_at'>>
        Relationships: []
      }
      geo_personas: {
        Row: GeoPersona
        Insert: {
          id?: string
          project_id: string
          name: string
          segment?: string | null
          demographics?: GeoPersonaDemographics | null
          situation?: string | null
          motivations?: string[]
          how_they_ask?: string | null
          share?: number | null
          source?: 'cbs' | 'ai'
          created_at?: string
        }
        Update: Partial<Omit<GeoPersona, 'id' | 'project_id' | 'created_at'>>
        Relationships: []
      }
      geo_runs: {
        Row: GeoRun
        Insert: {
          id?: string
          project_id: string
          engine: GeoEngine
          status?: GeoRunStatus
          prompt_count?: number
          summary?: GeoRunSummary | null
          error?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: Partial<Omit<GeoRun, 'id' | 'project_id' | 'created_at'>>
        Relationships: []
      }
      geo_results: {
        Row: GeoResult
        Insert: {
          id?: string
          run_id: string
          prompt_id: string
          engine: GeoEngine
          answer: string
          brand_mentioned?: boolean
          brand_position?: number | null
          competitors?: string[]
          cited_sources?: GeoCitedSource[]
          sentiment?: GeoSentiment | null
          answer_fit?: number | null
          created_at?: string
        }
        Update: never
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
