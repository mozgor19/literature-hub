-- ============================================================
-- 007  Organizations / git repo URL
-- ============================================================

-- ── Organization reference table ─────────────────────────────
CREATE TABLE organizations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT organizations_name_unique UNIQUE (name)
);

CREATE INDEX idx_organizations_name_trgm ON organizations USING gin(name gin_trgm_ops);

-- ── Article ↔ organization join ───────────────────────────────
CREATE TABLE article_organizations (
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  org_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  PRIMARY KEY (article_id, org_id)
);

CREATE INDEX idx_article_organizations_org ON article_organizations(org_id);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE organizations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orgs_select_all"
  ON organizations FOR SELECT USING (true);

CREATE POLICY "orgs_insert_authenticated"
  ON organizations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "article_orgs_select_all"
  ON article_organizations FOR SELECT USING (true);

CREATE POLICY "article_orgs_insert_authenticated"
  ON article_organizations FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "article_orgs_delete_authenticated"
  ON article_organizations FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── Git repo URL column ───────────────────────────────────────
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS git_repo_url TEXT;
