CREATE TABLE notifications (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('comment_on_article', 'reply_to_comment')),
  article_id  UUID          REFERENCES articles(id) ON DELETE CASCADE,
  comment_id  UUID          REFERENCES comments(id) ON DELETE SET NULL,
  actor_id    UUID          REFERENCES users(id)    ON DELETE SET NULL,
  is_read     BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Service role inserts; anon/authenticated users cannot insert directly
CREATE POLICY "notifications_insert_service"
  ON notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notifications_delete_own"
  ON notifications FOR DELETE
  USING (user_id = auth.uid());
