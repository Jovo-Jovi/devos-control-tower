
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
            "event_rejections": {
                  Row: {
                    "reason": string,"received_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "reason": string,"received_at"?: string
                  }
                  Update: {
                    "reason"?: string,"received_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"event_usage": {
                  Row: {
                    "account_alias": string,"agent": string,"cache_read": number | null,"cache_write": number | null,"event_id": number,"id": number,"input": number | null,"model": string,"output": number | null,"source": string,"tool": string
                  }
                  ComputedFields: never
                  Insert: {
                    "account_alias": string,"agent": string,"cache_read"?: number | null,"cache_write"?: number | null,"event_id": number,"id"?: never,"input"?: number | null,"model": string,"output"?: number | null,"source": string,"tool": string
                  }
                  Update: {
                    "account_alias"?: string,"agent"?: string,"cache_read"?: number | null,"cache_write"?: number | null,"event_id"?: number,"id"?: never,"input"?: number | null,"model"?: string,"output"?: number | null,"source"?: string,"tool"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_usage_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "at": string,"body_hash": string,"evidence": string | null,"id": number,"origin": string,"phase": string | null,"project_id": string,"received_at": string,"run_id": string,"seq": number,"source": string,"status": string,"step": string,"task": string | null,"v": number
                  }
                  ComputedFields: never
                  Insert: {
                    "at": string,"body_hash": string,"evidence"?: string | null,"id"?: never,"origin": string,"phase"?: string | null,"project_id": string,"received_at"?: string,"run_id": string,"seq": number,"source": string,"status": string,"step": string,"task"?: string | null,"v": number
                  }
                  Update: {
                    "at"?: string,"body_hash"?: string,"evidence"?: string | null,"id"?: never,"origin"?: string,"phase"?: string | null,"project_id"?: string,"received_at"?: string,"run_id"?: string,"seq"?: number,"source"?: string,"status"?: string,"step"?: string,"task"?: string | null,"v"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "runs"
      referencedColumns: ["id"]
    }
                  ]
                },"owner_allowlist": {
                  Row: {
                    "github_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "github_id": string
                  }
                  Update: {
                    "github_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"projects": {
                  Row: {
                    "created_at": string,"id": string,"key": string,"owner_github_id": string,"repo": string,"stale_after_minutes": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"key": string,"owner_github_id": string,"repo": string,"stale_after_minutes"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"key"?: string,"owner_github_id"?: string,"repo"?: string,"stale_after_minutes"?: number
                  }
                  Relationships: [
                    
                  ]
                },"runs": {
                  Row: {
                    "created_at": string,"id": string,"project_id": string,"run_key": string,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"project_id": string,"run_key": string,"source": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"project_id"?: string,"run_key"?: string,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "runs_project_id_fkey"
      columns: ["project_id"]
isOneToOne: false
      referencedRelation: "projects"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "ingest_event":
{ Args: { "payload": Json,"src": string }; Returns: Json
                           },
"is_owner":
{ Args: Record<PropertyKey, never>; Returns: boolean
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
            
          }
        }
} as const
