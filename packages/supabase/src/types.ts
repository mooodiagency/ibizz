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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
