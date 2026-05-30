export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      users: {
        Row: { id: string; email: string; name: string | null; image: string | null; is_admin: boolean; created_at: string }
        Insert: { id?: string; email: string; name?: string | null; image?: string | null; is_admin?: boolean; created_at?: string }
        Update: { id?: string; email?: string; name?: string | null; image?: string | null; is_admin?: boolean; created_at?: string }
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
      organizations: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string; created_at?: string }
        Relationships: []
      }
      article_organizations: {
        Row: { article_id: string; org_id: string }
        Insert: { article_id: string; org_id: string }
        Update: { article_id?: string; org_id?: string }
        Relationships: [
          { foreignKeyName: "article_organizations_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] },
          { foreignKeyName: "article_organizations_org_id_fkey"; columns: ["org_id"]; isOneToOne: false; referencedRelation: "organizations"; referencedColumns: ["id"] }
        ]
      }
      articles: {
        Row: { id: string; title: string; authors: string; year: number | null; abstract: string | null; source_url: string | null; notes: string | null; git_repo_url: string | null; field_id: string; drive_file_id: string; drive_web_link: string; drive_folder_path: string; added_by: string | null; added_at: string; authors_needs_review: boolean }
        Insert: { id?: string; title: string; authors: string; year?: number | null; abstract?: string | null; source_url?: string | null; notes?: string | null; git_repo_url?: string | null; field_id: string; drive_file_id: string; drive_web_link: string; drive_folder_path: string; added_by?: string | null; added_at?: string; authors_needs_review?: boolean }
        Update: { id?: string; title?: string; authors?: string; year?: number | null; abstract?: string | null; source_url?: string | null; notes?: string | null; git_repo_url?: string | null; field_id?: string; drive_file_id?: string; drive_web_link?: string; drive_folder_path?: string; added_by?: string | null; added_at?: string; authors_needs_review?: boolean }
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
      authors: {
        Row: { id: string; name: string; created_at: string }
        Insert: { id?: string; name: string; created_at?: string }
        Update: { id?: string; name?: string; created_at?: string }
        Relationships: []
      }
      article_authors: {
        Row: { article_id: string; author_id: string; position: number }
        Insert: { article_id: string; author_id: string; position?: number }
        Update: { article_id?: string; author_id?: string; position?: number }
        Relationships: [
          { foreignKeyName: "article_authors_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] },
          { foreignKeyName: "article_authors_author_id_fkey"; columns: ["author_id"]; isOneToOne: false; referencedRelation: "authors"; referencedColumns: ["id"] }
        ]
      }
      comments: {
        Row: { id: string; article_id: string; user_id: string; parent_id: string | null; body: string; created_at: string; updated_at: string; is_edited: boolean; is_deleted: boolean }
        Insert: { id?: string; article_id: string; user_id: string; parent_id?: string | null; body: string; created_at?: string; updated_at?: string; is_edited?: boolean; is_deleted?: boolean }
        Update: { id?: string; article_id?: string; user_id?: string; parent_id?: string | null; body?: string; created_at?: string; updated_at?: string; is_edited?: boolean; is_deleted?: boolean }
        Relationships: [
          { foreignKeyName: "comments_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] },
          { foreignKeyName: "comments_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "comments_parent_id_fkey"; columns: ["parent_id"]; isOneToOne: false; referencedRelation: "comments"; referencedColumns: ["id"] }
        ]
      }
      notifications: {
        Row: { id: string; user_id: string; type: string; article_id: string | null; comment_id: string | null; actor_id: string | null; is_read: boolean; created_at: string }
        Insert: { id?: string; user_id: string; type: string; article_id?: string | null; comment_id?: string | null; actor_id?: string | null; is_read?: boolean; created_at?: string }
        Update: { id?: string; user_id?: string; type?: string; article_id?: string | null; comment_id?: string | null; actor_id?: string | null; is_read?: boolean; created_at?: string }
        Relationships: [
          { foreignKeyName: "notifications_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "notifications_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] },
          { foreignKeyName: "notifications_comment_id_fkey"; columns: ["comment_id"]; isOneToOne: false; referencedRelation: "comments"; referencedColumns: ["id"] },
          { foreignKeyName: "notifications_actor_id_fkey"; columns: ["actor_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] }
        ]
      }
      article_read_status: {
        Row: { user_id: string; article_id: string; status: string; updated_at: string }
        Insert: { user_id: string; article_id: string; status: string; updated_at?: string }
        Update: { user_id?: string; article_id?: string; status?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: "article_read_status_user_id_fkey"; columns: ["user_id"]; isOneToOne: false; referencedRelation: "users"; referencedColumns: ["id"] },
          { foreignKeyName: "article_read_status_article_id_fkey"; columns: ["article_id"]; isOneToOne: false; referencedRelation: "articles"; referencedColumns: ["id"] }
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

export type DBComment = Database["public"]["Tables"]["comments"]["Row"]
export type DBAuthor = Database["public"]["Tables"]["authors"]["Row"]
export type DBOrganization = Database["public"]["Tables"]["organizations"]["Row"]
export type DBNotification = Database["public"]["Tables"]["notifications"]["Row"]

export interface AuthorWithCount extends DBAuthor {
  article_count: number
}

export interface OrgWithCount extends DBOrganization {
  article_count: number
}

export interface NotificationWithDetails extends DBNotification {
  actor: Pick<DBUser, "id" | "name" | "email" | "image"> | null
  article: Pick<DBArticle, "id" | "title"> | null
}

export type ReadStatus = "unread" | "reading" | "read"

export interface ArticleWithRelations extends DBArticle {
  tags: DBTag[]
  field: (DBField & { parent?: DBField | null }) | null
  added_by_user: Pick<DBUser, "id" | "name" | "email"> | null
  project_count: number
  comment_count: number
  normalized_authors: Pick<DBAuthor, "id" | "name">[]
  organizations: Pick<DBOrganization, "id" | "name">[]
  my_read_status: ReadStatus
}

export interface CommentWithUser extends DBComment {
  user: Pick<DBUser, "id" | "name" | "email" | "image">
  replies?: CommentWithUser[]
}

export interface FieldWithChildren extends DBField {
  children: FieldWithChildren[]
}
