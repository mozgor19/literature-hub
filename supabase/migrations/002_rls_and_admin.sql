-- ============================================================
-- Add is_admin flag to users (populated from ADMIN_EMAILS env var at sign-in)
-- ============================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- ============================================================
-- Row-Level Security for the articles table
--
-- NOTE: The app uses the *service role* key for most queries, which bypasses
-- RLS.  For DELETE the app switches to a client authenticated as the current
-- user (see src/lib/supabase-user.ts), making RLS the second line of defense.
-- ============================================================

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

-- Everyone can read (the app additionally gates behind NextAuth)
CREATE POLICY "articles_select_all"
  ON articles FOR SELECT
  USING (true);

-- Any authenticated app user may insert
CREATE POLICY "articles_insert_authenticated"
  ON articles FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Only the owner OR an admin may delete
CREATE POLICY "articles_delete_owner_or_admin"
  ON articles FOR DELETE
  USING (
    added_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.is_admin = true
    )
  );
