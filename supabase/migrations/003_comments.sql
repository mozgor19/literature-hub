-- ============================================================
-- Comments / discussion on articles
-- ============================================================

CREATE TABLE comments (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id  UUID NOT NULL REFERENCES articles(id)  ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  parent_id   UUID          REFERENCES comments(id)  ON DELETE SET NULL,
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  is_edited   BOOLEAN NOT NULL DEFAULT false,
  is_deleted  BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX idx_comments_article_created ON comments(article_id, created_at);
CREATE INDEX idx_comments_parent_id       ON comments(parent_id);

-- ============================================================
-- RLS: same philosophy as articles — service role bypasses,
-- user-scoped client enforces. Add policies for defence-in-depth.
-- ============================================================

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select_all"
  ON comments FOR SELECT USING (true);

CREATE POLICY "comments_insert_authenticated"
  ON comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "comments_update_own"
  ON comments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "comments_delete_owner_or_admin"
  ON comments FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );
