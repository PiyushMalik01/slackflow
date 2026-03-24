// Auto-generated types from Supabase schema
// Run: supabase gen types typescript --project-id <id> > lib/db/types.ts
// This is a hand-crafted version for development until Supabase is connected

export type TaskStatus =
  | 'pending'
  | 'draft_ready'
  | 'approved'
  | 'edited'
  | 'dismissed'
  | 'sent'
  | 'failed'

export type TaskCategory = string // Formerly ENUM, now flexible TEXT

export type RoleType = string // Formerly ENUM, now flexible TEXT

export interface Database {
  public: {
    Tables: {
      workspaces: {
        Row: {
          id: string
          owner_id: string
          slack_team_id: string
          name: string
          access_token_enc: string
          access_token_iv: string
          bot_user_id: string
          monitored_channels: string[]
          installed_at: string
          updated_at: string
          team_group_chat_id: string | null
          daily_digest_time: string | null
          accent_color: string
        }
        Insert: Omit<Database['public']['Tables']['workspaces']['Row'], 'id' | 'installed_at' | 'updated_at'> & {
          id?: string
          installed_at?: string
          updated_at?: string
          monitored_channels?: string[]
          team_group_chat_id?: string | null
          daily_digest_time?: string | null
          accent_color?: string
        }
        Update: Partial<Database['public']['Tables']['workspaces']['Insert']>
      }
      roles: {
        Row: {
          id: string
          owner_id: string
          type: RoleType
          name: string
          telegram_chat_id: string | null
          status: 'pending_link' | 'linked' | 'unlinked'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['roles']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
          status?: 'pending_link' | 'linked' | 'unlinked'
        }
        Update: Partial<Database['public']['Tables']['roles']['Insert']>
      }
      workspace_roles: {
        Row: {
          id: string
          workspace_id: string
          role_id: string
          category_id: string
        }
        Insert: Omit<Database['public']['Tables']['workspace_roles']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['workspace_roles']['Insert']>
      }
      tasks: {
        Row: {
          id: string
          workspace_id: string
          channel: string
          thread_ts: string
          original_text: string
          sender_name: string | null
          category: TaskCategory | null
          category_confidence: number | null
          draft_text: string | null
          edited_text: string | null
          final_text: string | null
          status: TaskStatus
          role_id: string | null
          telegram_message_id: number | null
          ai_model: string | null
          ai_tokens_used: number | null
          ai_prompt_version: string | null
          draft_generated_at: string | null
          sent_at: string | null
          category_id: string | null
          thread_context: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['tasks']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
          category_id?: string | null
          ai_prompt_version?: string | null
          thread_context?: string | null
        }
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>
      }
      activity_log: {
        Row: {
          id: string
          workspace_id: string | null
          task_id: string | null
          actor: string
          action: string
          details: Record<string, unknown> | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['activity_log']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['activity_log']['Insert']>
      }
      rate_limits: {
        Row: {
          id: string
          key: string
          count: number
          window_start: string
        }
        Insert: Omit<Database['public']['Tables']['rate_limits']['Row'], 'id'> & { id?: string }
        Update: Partial<Database['public']['Tables']['rate_limits']['Insert']>
      }
      categories: {
        Row: {
          id: string
          owner_id: string
          name: string
          description: string
          color: string
          emoji: string
          is_default: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
          description?: string
          color?: string
          emoji?: string
          is_default?: boolean
        }
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
      invite_tokens: {
        Row: {
          id: string
          role_id: string
          token: string
          expires_at: string
          used_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['invite_tokens']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
          used_at?: string | null
        }
        Update: Partial<Database['public']['Tables']['invite_tokens']['Insert']>
      }
      telegram_sessions: {
        Row: {
          id: string
          chat_id: string
          task_id: string
          state: 'editing' | 'confirming'
          draft_text: string | null
          expires_at: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['telegram_sessions']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
          draft_text?: string | null
        }
        Update: Partial<Database['public']['Tables']['telegram_sessions']['Insert']>
      }
      processed_events: {
        Row: {
          event_id: string
          workspace_id: string
          processed_at: string
        }
        Insert: {
          event_id: string
          workspace_id: string
          processed_at?: string
        }
        Update: Partial<Database['public']['Tables']['processed_events']['Insert']>
      }
      slack_user_cache: {
        Row: {
          slack_user_id: string
          workspace_id: string
          display_name: string
          avatar_url: string | null
          cached_at: string
        }
        Insert: {
          slack_user_id: string
          workspace_id: string
          display_name: string
          avatar_url?: string | null
          cached_at?: string
        }
        Update: Partial<Database['public']['Tables']['slack_user_cache']['Insert']>
      }
    }
  }
}

export interface Category {
  id: string
  owner_id: string
  name: string
  description: string
  color: string
  emoji: string
  is_default: boolean
  created_at: string
}

export interface InviteToken {
  id: string
  role_id: string
  token: string
  expires_at: string
  used_at: string | null
  created_at: string
}

export interface TelegramSession {
  id: string
  chat_id: string
  task_id: string
  state: 'editing' | 'confirming'
  draft_text: string | null
  expires_at: string
  created_at: string
}

export interface ProcessedEvent {
  event_id: string
  workspace_id: string
  processed_at: string
}

export interface SlackUserCache {
  slack_user_id: string
  workspace_id: string
  display_name: string
  avatar_url: string | null
  cached_at: string
}
