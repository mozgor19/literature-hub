-- ============================================================
-- 008  Per-user article read status
-- ============================================================
-- Absent row = 'unread' (the default state).
-- Only 'reading' and 'read' are stored; deleting the row resets to 'unread'.

CREATE TABLE article_read_status (
  user_id    UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  status     TEXT NOT NULL CHECK (status IN ('reading', 'read')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, article_id)
);

CREATE INDEX idx_article_read_status_article ON article_read_status(article_id);
CREATE INDEX idx_article_read_status_user    ON article_read_status(user_id);

-- RLS: each user can only read/write their own rows.
-- The API route also enforces user_id = session.user.id at the application layer.
ALTER TABLE article_read_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_status_select_own"
  ON article_read_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "read_status_insert_own"
  ON article_read_status FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "read_status_update_own"
  ON article_read_status FOR UPDATE
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "read_status_delete_own"
  ON article_read_status FOR DELETE
  USING (auth.uid() = user_id);
