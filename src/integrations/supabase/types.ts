export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          person_id: string
        }
        Insert: {
          person_id: string
        }
        Update: {
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admins_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admins_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admins_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admins_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      app_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_person_id: string | null
          after: Json | null
          before: Json | null
          created_at: string | null
          id: number
          record_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor_person_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          id?: never
          record_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor_person_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string | null
          id?: never
          record_id?: string | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_person_id_fkey"
            columns: ["actor_person_id"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_person_id_fkey"
            columns: ["actor_person_id"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_person_id_fkey"
            columns: ["actor_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_actor_person_id_fkey"
            columns: ["actor_person_id"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      auth_attempts: {
        Row: {
          created_at: string
          detail: string | null
          email_attempted: string
          id: string
          outcome: string
          person_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: string | null
          email_attempted: string
          id?: string
          outcome: string
          person_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: string | null
          email_attempted?: string
          id?: string
          outcome?: string
          person_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "auth_attempts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_attempts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_attempts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auth_attempts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      confirmation_sends: {
        Row: {
          created_at: string
          event_year: number
          id: string
          person_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_year: number
          id?: string
          person_id: string
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_year?: number
          id?: string
          person_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "confirmation_sends_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmation_sends_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmation_sends_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmation_sends_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      divisions: {
        Row: {
          code: string
          label: string
          sort_order: number
          visible: boolean
        }
        Insert: {
          code: string
          label: string
          sort_order: number
          visible?: boolean
        }
        Update: {
          code?: string
          label?: string
          sort_order?: number
          visible?: boolean
        }
        Relationships: []
      }
      duplicate_rulings: {
        Row: {
          created_at: string
          id: string
          note: string | null
          person_a_id: string
          person_b_id: string
          ruled_at: string
          ruled_by: string | null
          ruling: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          person_a_id: string
          person_b_id: string
          ruled_at?: string
          ruled_by?: string | null
          ruling: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          person_a_id?: string
          person_b_id?: string
          ruled_at?: string
          ruled_by?: string | null
          ruling?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_rulings_ruled_by_fkey"
            columns: ["ruled_by"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_rulings_ruled_by_fkey"
            columns: ["ruled_by"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_rulings_ruled_by_fkey"
            columns: ["ruled_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_rulings_ruled_by_fkey"
            columns: ["ruled_by"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      editions: {
        Row: {
          created_at: string
          ends_on: string
          event_year: number
          is_current: boolean
          lodging_note: string | null
          published: boolean
          starts_on: string
          title: string
          travel_note: string | null
        }
        Insert: {
          created_at?: string
          ends_on: string
          event_year: number
          is_current?: boolean
          lodging_note?: string | null
          published?: boolean
          starts_on: string
          title: string
          travel_note?: string | null
        }
        Update: {
          created_at?: string
          ends_on?: string
          event_year?: number
          is_current?: boolean
          lodging_note?: string | null
          published?: boolean
          starts_on?: string
          title?: string
          travel_note?: string | null
        }
        Relationships: []
      }
      event_rsvps: {
        Row: {
          created_at: string
          event_id: string
          id: string
          party_size: number
          person_id: string
          responded_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          party_size?: number
          person_id: string
          responded_at?: string
          status: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          party_size?: number
          person_id?: string
          responded_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      events: {
        Row: {
          day_number: number | null
          division: string | null
          ends_at: string | null
          event_year: number
          id: string
          is_placeholder: boolean
          location: string | null
          map_url: string | null
          notes: string | null
          sort_order: number
          starts_at: string | null
          ticket_url: string | null
          time_tbd: boolean
          title: string
        }
        Insert: {
          day_number?: number | null
          division?: string | null
          ends_at?: string | null
          event_year: number
          id?: string
          is_placeholder?: boolean
          location?: string | null
          map_url?: string | null
          notes?: string | null
          sort_order?: number
          starts_at?: string | null
          ticket_url?: string | null
          time_tbd?: boolean
          title: string
        }
        Update: {
          day_number?: number | null
          division?: string | null
          ends_at?: string | null
          event_year?: number
          id?: string
          is_placeholder?: boolean
          location?: string | null
          map_url?: string | null
          notes?: string | null
          sort_order?: number
          starts_at?: string | null
          ticket_url?: string | null
          time_tbd?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_division_fkey"
            columns: ["division"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "events_event_year_fkey"
            columns: ["event_year"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["event_year"]
          },
        ]
      }
      identities: {
        Row: {
          auth_user_id: string | null
          created_at: string | null
          email: string
          id: string
          is_primary: boolean
          person_id: string
          primary_set_manually_at: string | null
          provider: string
          verified_at: string | null
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string | null
          email: string
          id?: string
          is_primary?: boolean
          person_id: string
          primary_set_manually_at?: string | null
          provider: string
          verified_at?: string | null
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string | null
          email?: string
          id?: string
          is_primary?: boolean
          person_id?: string
          primary_set_manually_at?: string | null
          provider?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identities_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identities_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identities_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identities_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      internal_secrets: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value_hash: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value_hash: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value_hash?: string
        }
        Relationships: []
      }
      magic_link_issues: {
        Row: {
          email: string
          issued_at: string
          link: string
          person_id: string | null
        }
        Insert: {
          email: string
          issued_at?: string
          link: string
          person_id?: string | null
        }
        Update: {
          email?: string
          issued_at?: string
          link?: string
          person_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "magic_link_issues_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_link_issues_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_link_issues_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "magic_link_issues_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      news_items: {
        Row: {
          author: string | null
          body: string
          category: string
          created_at: string
          created_by: string | null
          dedupe_key: string | null
          discord_delivery_error: string | null
          discord_delivery_status: string
          discord_message_id: string | null
          discord_posted_at: string | null
          event_year: number | null
          id: string
          post_type: string
          published_at: string | null
          related_url: string | null
          status: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          discord_delivery_error?: string | null
          discord_delivery_status?: string
          discord_message_id?: string | null
          discord_posted_at?: string | null
          event_year?: number | null
          id?: string
          post_type?: string
          published_at?: string | null
          related_url?: string | null
          status?: string
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          body?: string
          category?: string
          created_at?: string
          created_by?: string | null
          dedupe_key?: string | null
          discord_delivery_error?: string | null
          discord_delivery_status?: string
          discord_message_id?: string | null
          discord_posted_at?: string | null
          event_year?: number | null
          id?: string
          post_type?: string
          published_at?: string | null
          related_url?: string | null
          status?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      news_pending_updates: {
        Row: {
          category: string
          consumed_at: string | null
          consumed_news_id: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          related_url: string | null
          status: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          consumed_at?: string | null
          consumed_news_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          related_url?: string | null
          status?: string
          summary?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          consumed_at?: string | null
          consumed_news_id?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          related_url?: string | null
          status?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_pending_updates_consumed_news_id_fkey"
            columns: ["consumed_news_id"]
            isOneToOne: false
            referencedRelation: "news_items"
            referencedColumns: ["id"]
          },
        ]
      }
      news_roundup_members: {
        Row: {
          created_at: string
          event_year: number
          id: string
          news_id: string | null
          person_id: string
        }
        Insert: {
          created_at?: string
          event_year: number
          id?: string
          news_id?: string | null
          person_id: string
        }
        Update: {
          created_at?: string
          event_year?: number
          id?: string
          news_id?: string | null
          person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "news_roundup_members_news_id_fkey"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_roundup_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_roundup_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_roundup_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "news_roundup_members_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      news_settings: {
        Row: {
          created_at: string
          daily_digest_time: string
          enabled: boolean
          id: boolean
          last_digest_date: string | null
          last_weekly_date: string | null
          timezone: string
          updated_at: string
          weekly_day: number
          weekly_time: string
        }
        Insert: {
          created_at?: string
          daily_digest_time?: string
          enabled?: boolean
          id?: boolean
          last_digest_date?: string | null
          last_weekly_date?: string | null
          timezone?: string
          updated_at?: string
          weekly_day?: number
          weekly_time?: string
        }
        Update: {
          created_at?: string
          daily_digest_time?: string
          enabled?: boolean
          id?: boolean
          last_digest_date?: string | null
          last_weekly_date?: string | null
          timezone?: string
          updated_at?: string
          weekly_day?: number
          weekly_time?: string
        }
        Relationships: []
      }
      people: {
        Row: {
          archived: boolean
          created_at: string
          current_city: string | null
          deceased: boolean
          deceased_confirmed_at: string | null
          deceased_confirmed_by: string | null
          deceased_note: string | null
          first_name: string
          grad_year: number | null
          id: string
          is_anchor: boolean
          last_name: string | null
          member_no: number
          merged_at: string | null
          merged_into_person_id: string | null
          needs_review: boolean
          open_to_network: boolean
          played_as: string | null
          seed_division: string | null
          seed_division_alt: string | null
          seed_id: string | null
          share_email: boolean
          show_on_board: boolean
        }
        Insert: {
          archived?: boolean
          created_at?: string
          current_city?: string | null
          deceased?: boolean
          deceased_confirmed_at?: string | null
          deceased_confirmed_by?: string | null
          deceased_note?: string | null
          first_name: string
          grad_year?: number | null
          id?: string
          is_anchor?: boolean
          last_name?: string | null
          member_no?: number
          merged_at?: string | null
          merged_into_person_id?: string | null
          needs_review?: boolean
          open_to_network?: boolean
          played_as?: string | null
          seed_division?: string | null
          seed_division_alt?: string | null
          seed_id?: string | null
          share_email?: boolean
          show_on_board?: boolean
        }
        Update: {
          archived?: boolean
          created_at?: string
          current_city?: string | null
          deceased?: boolean
          deceased_confirmed_at?: string | null
          deceased_confirmed_by?: string | null
          deceased_note?: string | null
          first_name?: string
          grad_year?: number | null
          id?: string
          is_anchor?: boolean
          last_name?: string | null
          member_no?: number
          merged_at?: string | null
          merged_into_person_id?: string | null
          needs_review?: boolean
          open_to_network?: boolean
          played_as?: string | null
          seed_division?: string | null
          seed_division_alt?: string | null
          seed_id?: string | null
          share_email?: boolean
          show_on_board?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "people_deceased_confirmed_by_fkey"
            columns: ["deceased_confirmed_by"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_deceased_confirmed_by_fkey"
            columns: ["deceased_confirmed_by"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_deceased_confirmed_by_fkey"
            columns: ["deceased_confirmed_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_deceased_confirmed_by_fkey"
            columns: ["deceased_confirmed_by"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "people_merged_into_person_id_fkey"
            columns: ["merged_into_person_id"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_merged_into_person_id_fkey"
            columns: ["merged_into_person_id"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_merged_into_person_id_fkey"
            columns: ["merged_into_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "people_merged_into_person_id_fkey"
            columns: ["merged_into_person_id"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "people_seed_division_alt_fkey"
            columns: ["seed_division_alt"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "people_seed_division_fkey"
            columns: ["seed_division"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["code"]
          },
        ]
      }
      photo_slots: {
        Row: {
          key: string
          photo_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          key: string
          photo_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          key?: string
          photo_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "photo_slots_photo_id_fkey"
            columns: ["photo_id"]
            isOneToOne: false
            referencedRelation: "photos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_slots_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_slots_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_slots_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_slots_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      photos: {
        Row: {
          alt: string | null
          board_year: number | null
          height: number | null
          id: string
          original_name: string | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          alt?: string | null
          board_year?: number | null
          height?: number | null
          id?: string
          original_name?: string | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          alt?: string | null
          board_year?: number | null
          height?: number | null
          id?: string
          original_name?: string | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      preapproved_emails: {
        Row: {
          consumed_at: string | null
          consumed_by: string | null
          email: string
          note: string | null
        }
        Insert: {
          consumed_at?: string | null
          consumed_by?: string | null
          email: string
          note?: string | null
        }
        Update: {
          consumed_at?: string | null
          consumed_by?: string | null
          email?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "preapproved_emails_consumed_by_fkey"
            columns: ["consumed_by"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preapproved_emails_consumed_by_fkey"
            columns: ["consumed_by"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preapproved_emails_consumed_by_fkey"
            columns: ["consumed_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preapproved_emails_consumed_by_fkey"
            columns: ["consumed_by"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      rsvps: {
        Row: {
          event_year: number
          id: string
          party_size: number
          person_id: string
          responded_at: string | null
          src: string | null
          status: string
        }
        Insert: {
          event_year: number
          id?: string
          party_size?: number
          person_id: string
          responded_at?: string | null
          src?: string | null
          status: string
        }
        Update: {
          event_year?: number
          id?: string
          party_size?: number
          person_id?: string
          responded_at?: string | null
          src?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rsvps_event_year_fkey"
            columns: ["event_year"]
            isOneToOne: false
            referencedRelation: "editions"
            referencedColumns: ["event_year"]
          },
          {
            foreignKeyName: "rsvps_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rsvps_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      sends: {
        Row: {
          blocked_reason: string | null
          bounce_type: string | null
          bounced: boolean
          complained: boolean
          created_at: string
          error: string | null
          id: string
          kind: string
          opened_at: string | null
          outcome: string
          person_id: string | null
          provider: string | null
          provider_message_id: string | null
          sent_at: string | null
          sequence_id: string | null
          status: string
          to_email: string | null
        }
        Insert: {
          blocked_reason?: string | null
          bounce_type?: string | null
          bounced?: boolean
          complained?: boolean
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          opened_at?: string | null
          outcome?: string
          person_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          status?: string
          to_email?: string | null
        }
        Update: {
          blocked_reason?: string | null
          bounce_type?: string | null
          bounced?: boolean
          complained?: boolean
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          opened_at?: string | null
          outcome?: string
          person_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          sequence_id?: string | null
          status?: string
          to_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sends_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sends_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sends_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sends_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "sends_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      sequences: {
        Row: {
          active: boolean
          anchors_only: boolean
          audience_states: string[]
          id: string
          key: string
          offset_days: number
        }
        Insert: {
          active?: boolean
          anchors_only?: boolean
          audience_states: string[]
          id?: string
          key: string
          offset_days: number
        }
        Update: {
          active?: boolean
          anchors_only?: boolean
          audience_states?: string[]
          id?: string
          key?: string
          offset_days?: number
        }
        Relationships: []
      }
      stints: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string | null
          division: string
          id: string
          person_id: string
          role: string
          source: string
          year: number
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          division: string
          id?: string
          person_id: string
          role?: string
          source: string
          year: number
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string | null
          division?: string
          id?: string
          person_id?: string
          role?: string
          source?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "stints_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stints_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stints_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stints_confirmed_by_fkey"
            columns: ["confirmed_by"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "stints_division_fkey"
            columns: ["division"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "stints_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stints_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stints_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stints_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      suggestions: {
        Row: {
          created_at: string | null
          id: string
          payload: Json
          peer_verified_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_by: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload: Json
          peer_verified_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: Json
          peer_verified_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          submitted_by?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_peer_verified_by_fkey"
            columns: ["peer_verified_by"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_peer_verified_by_fkey"
            columns: ["peer_verified_by"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_peer_verified_by_fkey"
            columns: ["peer_verified_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_peer_verified_by_fkey"
            columns: ["peer_verified_by"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "suggestions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suggestions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      suppressions: {
        Row: {
          created_at: string | null
          email: string
          reason: string
        }
        Insert: {
          created_at?: string | null
          email: string
          reason: string
        }
        Update: {
          created_at?: string | null
          email?: string
          reason?: string
        }
        Relationships: []
      }
      team_names: {
        Row: {
          confidence: string
          division: string
          end_year: number | null
          id: string
          name: string | null
          start_year: number | null
        }
        Insert: {
          confidence: string
          division: string
          end_year?: number | null
          id?: string
          name?: string | null
          start_year?: number | null
        }
        Update: {
          confidence?: string
          division?: string
          end_year?: number | null
          id?: string
          name?: string | null
          start_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "team_names_division_fkey"
            columns: ["division"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["code"]
          },
        ]
      }
      throttle_events: {
        Row: {
          bucket: string
          created_at: string
          id: string
          kind: string
        }
        Insert: {
          bucket: string
          created_at?: string
          id?: string
          kind: string
        }
        Update: {
          bucket?: string
          created_at?: string
          id?: string
          kind?: string
        }
        Relationships: []
      }
      verifications: {
        Row: {
          created_at: string | null
          id: string
          person_id: string
          verified_by: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          person_id: string
          verified_by: string
        }
        Update: {
          created_at?: string | null
          id?: string
          person_id?: string
          verified_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "verifications_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
          {
            foreignKeyName: "verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "verifications_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
    }
    Views: {
      board_coaches: {
        Row: {
          deceased: boolean | null
          first_name: string | null
          id: string | null
          last_name: string | null
          played_as: string | null
          role_label: string | null
          state: string | null
        }
        Relationships: []
      }
      board_people: {
        Row: {
          board_division: string | null
          board_year: number | null
          coach_role: string | null
          deceased: boolean | null
          divisions: string[] | null
          first_name: string | null
          has_coached: boolean | null
          id: string | null
          is_coach: boolean | null
          is_current: boolean | null
          last_name: string | null
          played_as: string | null
          state: string | null
          team_label: string | null
        }
        Relationships: []
      }
      board_year_counts: {
        Row: {
          board_year: number | null
          claimed: number | null
          going: number | null
          total: number | null
        }
        Relationships: []
      }
      current_players: {
        Row: {
          division: string | null
          person_id: string | null
          year: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stints_division_fkey"
            columns: ["division"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "stints_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stints_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stints_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stints_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      identities_needing_second_email: {
        Row: {
          email: string | null
          id: string | null
          person_id: string | null
        }
        Insert: {
          email?: string | null
          id?: string | null
          person_id?: string | null
        }
        Update: {
          email?: string | null
          id?: string | null
          person_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identities_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_coaches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identities_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "board_people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identities_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identities_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "person_board_placement"
            referencedColumns: ["person_id"]
          },
        ]
      }
      person_board_placement: {
        Row: {
          board_division: string | null
          board_year: number | null
          person_id: string | null
          stint_count: number | null
        }
        Insert: {
          board_division?: never
          board_year?: never
          person_id?: string | null
          stint_count?: never
        }
        Update: {
          board_division?: never
          board_year?: never
          person_id?: string | null
          stint_count?: never
        }
        Relationships: []
      }
    }
    Functions: {
      admin_rsvp_detail: {
        Args: { p_event_year?: number }
        Returns: {
          event_year: number
          id: string
          party_size: number
          person_id: string
          responded_at: string
          src: string
          status: string
        }[]
      }
      current_edition_year: { Args: never; Returns: number }
      current_person_id: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      promote_verified_primary: {
        Args: { _identity_id: string }
        Returns: boolean
      }
      set_current_edition: { Args: { _event_year: number }; Returns: undefined }
      signin_token_state: {
        Args: { _token: string; _user_id: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
