export type Status = 'todo' | 'in_progress' | 'review' | 'done'

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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
