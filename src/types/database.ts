export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: { id: string; email: string; name: string | null; image: string | null; created_at: string }
        Insert: { id?: string; email: string; name?: string | null; image?: string | null; created_at?: string }
        Update: { id?: string; email?: string; name?: string | null; image?: string | null; created_at?: string }
        Relationships: []
      }
      fields: {
        Row: { id: string; name: string; parent_id: string | null; drive_folder_id: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; name: string; parent_id?: string | null; drive_folder_id?: string | null; created_by?: string | null; created_at?: string }
        Update: { id?: string; name?: string; parent_id?: string | null; drive_folder_id?: string | null; created_by?: string | null; created_at?: string }
        Relationships: [
          { foreignKeyName: "fields_parent_id_fkey"; columns: ["parent_id"]; isOneToOne: false; referencedRelation: "fields"; referencedColumns: ["id"] },
          { foreignKeyName: "fields_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] }
        ]
      }
      tags: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string; created_at?: string }
        Relationships: []
      }
      articles: {
        Row: { id: string; title: string; authors: string; year: number | null; abstract: string | null; source_url: string | null; notes: string | null; field_id: string; drive_file_id: string; drive_web_link: string; drive_folder_path: string; added_by: string | null; added_at: string }
        Insert: { id?: string; title: string; authors: string; year?: number | null; abstract?: string | null; source_url?: string | null; notes?: string | null; field_id: string; drive_file_id: string; drive_web_link: string; drive_folder_path: string; added_by?: string | null; added_at?: string }
        Update: { id?: string; title?: string; authors?: string; year?: number | null; abstract?: string | null; source_url?: string | null; notes?: string | null; field_id?: string; drive_file_id?: string; drive_web_link?: string; drive_folder_path?: string; added_by?: string | null; added_at?: string }
        Relationships: [
          { foreignKeyName: "articles_field_id_fkey"; columns: ["field_id"]; isOneToOne: false; referencedRelation: "fields"; referencedColumns: ["id"] },
          { foreignKeyName: "articles_added_by_fkey"; columns: ["added_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] }
        ]
      }
      article_tags: {
        Row: { article_id: string; tag_id: string }
        Insert: { article_id: string; tag_id: string }
        Update: { article_id?: string; tag_id?: string }
        Relationships: [
          { foreignKeyName: "article_tags_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] },
          { foreignKeyName: "article_tags_tag_id_fkey"; columns: ["tag_id"]; isOneToOne: false; referencedRelation: "tags"; referencedColumns: ["id"] }
        ]
      }
      projects: {
        Row: { id: string; name: string; description: string | null; created_by: string | null; created_at: string }
        Insert: { id?: string; name: string; description?: string | null; created_by?: string | null; created_at?: string }
        Update: { id?: string; name?: string; description?: string | null; created_by?: string | null; created_at?: string }
        Relationships: [
          { foreignKeyName: "projects_created_by_fkey"; columns: ["created_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] }
        ]
      }
      project_articles: {
        Row: { project_id: string; article_id: string; added_at: string; added_by: string }
        Insert: { project_id: string; article_id: string; added_at?: string; added_by: string }
        Update: { project_id?: string; article_id?: string; added_at?: string; added_by?: string }
        Relationships: [
          { foreignKeyName: "project_articles_project_id_fkey"; columns: ["project_id"]; isOneToOne: false; referencedRelation: "projects"; referencedColumns: ["id"] },
          { foreignKeyName: "project_articles_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] },
          { foreignKeyName: "project_articles_added_by_fkey"; columns: ["added_by"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

// Convenience aliases
export type DBUser = Database["public"]["Tables"]["users"]["Row"]
export type DBField = Database["public"]["Tables"]["fields"]["Row"]
export type DBTag = Database["public"]["Tables"]["tags"]["Row"]
export type DBArticle = Database["public"]["Tables"]["articles"]["Row"]
export type DBProject = Database["public"]["Tables"]["projects"]["Row"]
export type DBProjectArticle = Database["public"]["Tables"]["project_articles"]["Row"]

export interface ArticleWithRelations extends DBArticle {
  tags: DBTag[]
  field: (DBField & { parent?: DBField | null }) | null
  added_by_user: Pick<DBUser, "id" | "name" | "email"> | null
  project_count: number
}

export interface FieldWithChildren extends DBField {
  children: DBField[]
}
