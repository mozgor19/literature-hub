-- ============================================================
-- 006  Author normalisation
-- ============================================================
-- Feature 2 (deep fields) needs NO migration — fields.parent_id
-- is already a self-referential FK.  Only author tables here.
-- ============================================================

-- ── Author reference table ────────────────────────────────────
CREATE TABLE authors (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT authors_name_unique UNIQUE (name)
);

CREATE INDEX idx_authors_name_trgm ON authors USING gin(name gin_trgm_ops);

-- ── Article ↔ author join ─────────────────────────────────────
CREATE TABLE article_authors (
  article_id UUID    NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  author_id  UUID    NOT NULL REFERENCES authors(id)  ON DELETE CASCADE,
  position   INTEGER NOT NULL DEFAULT 0,          -- reading order
  PRIMARY KEY (article_id, author_id)
);

CREATE INDEX idx_article_authors_author  ON article_authors(author_id);
CREATE INDEX idx_article_authors_pos     ON article_authors(article_id, position);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE authors         ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_authors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authors_select_all"
  ON authors FOR SELECT USING (true);

CREATE POLICY "authors_insert_authenticated"
  ON authors FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "article_authors_select_all"
  ON article_authors FOR SELECT USING (true);

CREATE POLICY "article_authors_insert_authenticated"
  ON article_authors FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "article_authors_delete_authenticated"
  ON article_authors FOR DELETE USING (auth.uid() IS NOT NULL);

-- ── Review flag on articles ───────────────────────────────────
ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS authors_needs_review BOOLEAN NOT NULL DEFAULT false;

-- ── Backfill existing free-text authors ──────────────────────
-- Handles: commas, "and" / "ve" / "&", semicolons, "et al."
-- Flags rows with 0 parsed names or suspiciously many (>8).
DO $$
DECLARE
  r       RECORD;
  raw     TEXT;
  parts   TEXT[];
  part    TEXT;
  cleaned TEXT;
  aid     UUID;
  pos     INT;
BEGIN
  FOR r IN SELECT id, authors FROM articles LOOP
    raw := r.authors;
    pos := 0;

    -- Strip "et al." suffix (case-insensitive)
    raw := regexp_replace(raw, '\s*,?\s*et\s+al\.?\s*$', '', 'ig');

    -- Normalise word-level conjunctions to commas
    raw := regexp_replace(raw, '\s+(and|ve|&)\s+', ', ', 'ig');

    -- Semicolons → commas
    raw := regexp_replace(raw, '\s*;\s*', ', ', 'g');

    -- Split on commas
    parts := regexp_split_to_array(raw, '\s*,\s*');

    FOREACH part IN ARRAY parts LOOP
      cleaned := btrim(regexp_replace(part, '\s+', ' ', 'g'));
      CONTINUE WHEN length(cleaned) < 2;

      INSERT INTO authors (name) VALUES (cleaned)
        ON CONFLICT (name) DO NOTHING;

      SELECT id INTO aid FROM authors WHERE name = cleaned;

      INSERT INTO article_authors (article_id, author_id, position)
      VALUES (r.id, aid, pos)
        ON CONFLICT DO NOTHING;

      pos := pos + 1;
    END LOOP;

    -- Flag for human review when result looks uncertain
    IF pos = 0 OR pos > 8 OR r.authors ILIKE '%et al%' THEN
      UPDATE articles SET authors_needs_review = true WHERE id = r.id;
    END IF;
  END LOOP;
END $$;
