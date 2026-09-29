
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "categories": {
                  Row: {
                    "archived": boolean,"color_key": Database["public"]['Enums']["palette_key"],"created_at": string,"id": string,"name": string,"sort_order": number,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "archived"?: boolean,"color_key"?: Database["public"]['Enums']["palette_key"],"created_at"?: string,"id"?: string,"name": string,"sort_order"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "archived"?: boolean,"color_key"?: Database["public"]['Enums']["palette_key"],"created_at"?: string,"id"?: string,"name"?: string,"sort_order"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"class_blocks": {
                  Row: {
                    "color_key": Database["public"]['Enums']["palette_key"],"created_at": string,"end_time": string,"id": string,"location": string,"start_time": string,"title": string,"updated_at": string,"user_id": string,"weekdays": (number)[]
                  }
                  Insert: {
                    "color_key"?: Database["public"]['Enums']["palette_key"],"created_at"?: string,"end_time": string,"id"?: string,"location"?: string,"start_time": string,"title": string,"updated_at"?: string,"user_id"?: string,"weekdays": (number)[]
                  }
                  Update: {
                    "color_key"?: Database["public"]['Enums']["palette_key"],"created_at"?: string,"end_time"?: string,"id"?: string,"location"?: string,"start_time"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string,"weekdays"?: (number)[]
                  }
                  Relationships: [
                    
                  ]
                },"subtasks": {
                  Row: {
                    "created_at": string,"done": boolean,"id": string,"position": number,"task_id": string,"title": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"done"?: boolean,"id"?: string,"position"?: number,"task_id": string,"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"done"?: boolean,"id"?: string,"position"?: number,"task_id"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "subtasks_task_id_user_id_fkey"
      columns: ["task_id","user_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"tags": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"task_occurrence_overrides": {
                  Row: {
                    "completed": boolean,"created_at": string,"moved_to": string | null,"occurrence_date": string,"task_id": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "completed"?: boolean,"created_at"?: string,"moved_to"?: string | null,"occurrence_date": string,"task_id": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "completed"?: boolean,"created_at"?: string,"moved_to"?: string | null,"occurrence_date"?: string,"task_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_occurrence_overrides_task_id_user_id_fkey"
      columns: ["task_id","user_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"task_tags": {
                  Row: {
                    "created_at": string,"tag_id": string,"task_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"tag_id": string,"task_id": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"tag_id"?: string,"task_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_tags_tag_id_user_id_fkey"
      columns: ["tag_id","user_id"]
isOneToOne: false
      referencedRelation: "tags"
      referencedColumns: ["id","user_id"]
    },{
      foreignKeyName: "task_tags_task_id_user_id_fkey"
      columns: ["task_id","user_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","user_id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "category_id": string | null,"completed_at": string | null,"created_at": string,"due_date": string | null,"due_time": string | null,"id": string,"notes": string,"priority": Database["public"]['Enums']["task_priority"],"recurrence_kind": Database["public"]['Enums']["recurrence_kind"],"recurrence_until": string | null,"recurrence_weekdays": (number)[],"reminder_time": string | null,"status": Database["public"]['Enums']["task_status"],"title": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "category_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"due_date"?: string | null,"due_time"?: string | null,"id"?: string,"notes"?: string,"priority"?: Database["public"]['Enums']["task_priority"],"recurrence_kind"?: Database["public"]['Enums']["recurrence_kind"],"recurrence_until"?: string | null,"recurrence_weekdays"?: (number)[],"reminder_time"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"title": string,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "category_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"due_date"?: string | null,"due_time"?: string | null,"id"?: string,"notes"?: string,"priority"?: Database["public"]['Enums']["task_priority"],"recurrence_kind"?: Database["public"]['Enums']["recurrence_kind"],"recurrence_until"?: string | null,"recurrence_weekdays"?: (number)[],"reminder_time"?: string | null,"status"?: Database["public"]['Enums']["task_status"],"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_category_id_user_id_fkey"
      columns: ["category_id","user_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id","user_id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "save_task":
{ Args: { "p": Json }; Returns: string
                           }
          }
          Enums: {
            "palette_key": "clay"|"moss"|"slate"|"plum"|"ochre"|"teal"|"rose"|"graphite","recurrence_kind": "none"|"daily"|"weekly"|"weekdays"|"monthly","task_priority": "low"|"medium"|"high"|"urgent","task_status": "todo"|"in_progress"|"done"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "palette_key": ["clay", "moss", "slate", "plum", "ochre", "teal", "rose", "graphite"],"recurrence_kind": ["none", "daily", "weekly", "weekdays", "monthly"],"task_priority": ["low", "medium", "high", "urgent"],"task_status": ["todo", "in_progress", "done"]
          }
        }
} as const

