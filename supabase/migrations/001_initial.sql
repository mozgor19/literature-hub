-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE users (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT,
  image      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Self-referential hierarchy: top field = parent_id IS NULL
CREATE TABLE fields (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name             TEXT NOT NULL,
  parent_id        UUID REFERENCES fields(id) ON DELETE SET NULL,
  drive_folder_id  TEXT,
  created_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE tags (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE articles (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title              TEXT NOT NULL,
  authors            TEXT NOT NULL,
  year               INTEGER,
  abstract           TEXT,
  source_url         TEXT,
  notes              TEXT,
  field_id           UUID NOT NULL REFERENCES fields(id),
  drive_file_id      TEXT NOT NULL,
  drive_web_link     TEXT NOT NULL,
  drive_folder_path  TEXT NOT NULL,
  added_by           UUID REFERENCES users(id) ON DELETE SET NULL,
  added_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE article_tags (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id     UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, tag_id)
);

CREATE TABLE projects (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- References only – never duplicates the Drive file
CREATE TABLE project_articles (
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  added_at   TIMESTAMPTZ DEFAULT NOW(),
  added_by   UUID NOT NULL REFERENCES users(id),
  PRIMARY KEY (project_id, article_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_fields_parent_id      ON fields(parent_id);
CREATE INDEX idx_articles_field_id     ON articles(field_id);
CREATE INDEX idx_articles_year         ON articles(year);
CREATE INDEX idx_articles_added_at     ON articles(added_at DESC);
CREATE INDEX idx_article_tags_tag_id   ON article_tags(tag_id);
CREATE INDEX idx_project_articles_art  ON project_articles(article_id);
CREATE INDEX idx_tags_name             ON tags(name text_pattern_ops);

-- Trigram indexes for free-text search
CREATE INDEX idx_articles_title_trgm   ON articles USING gin(title   gin_trgm_ops);
CREATE INDEX idx_articles_authors_trgm ON articles USING gin(authors gin_trgm_ops);

-- ============================================================
-- SEED: example top-level fields
-- ============================================================

INSERT INTO fields (name, parent_id, drive_folder_id, created_by)
VALUES
  ('Robotics',  NULL, NULL, NULL),
  ('Aerospace', NULL, NULL, NULL),
  ('AI',        NULL, NULL, NULL);
