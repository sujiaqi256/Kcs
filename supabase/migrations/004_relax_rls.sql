-- ============================================================
-- RLS 策略：放宽权限，允许 anon/authenticated 用户操作
-- auth 认证由 auth_server 自行管理，不需要 Supabase Auth 严格 RLS
-- ============================================================

-- ── users ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS users_select_own ON users;
DROP POLICY IF EXISTS users_update_own ON users;
DROP POLICY IF EXISTS users_insert_auth ON users;

CREATE POLICY users_select_all ON users
  FOR SELECT USING (true);

CREATE POLICY users_insert_all ON users
  FOR INSERT WITH CHECK (true);

CREATE POLICY users_update_all ON users
  FOR UPDATE USING (true);

-- ── schedule ──────────────────────────────────────────────────
DROP POLICY IF EXISTS schedule_select_own ON schedule;
DROP POLICY IF EXISTS schedule_insert_own ON schedule;
DROP POLICY IF EXISTS schedule_delete_own ON schedule;

CREATE POLICY schedule_all ON schedule
  FOR ALL USING (true) WITH CHECK (true);

-- ── carpool ───────────────────────────────────────────────────
DROP POLICY IF EXISTS carpool_select_auth ON carpool;
DROP POLICY IF EXISTS carpool_insert_own ON carpool;
DROP POLICY IF EXISTS carpool_update_own ON carpool;
DROP POLICY IF EXISTS carpool_delete_own ON carpool;

CREATE POLICY carpool_all ON carpool
  FOR ALL USING (true) WITH CHECK (true);

-- ── carpool_messages ──────────────────────────────────────────
DROP POLICY IF EXISTS carpool_messages_select_own ON carpool_messages;
DROP POLICY IF EXISTS carpool_messages_insert_own ON carpool_messages;

CREATE POLICY carpool_messages_all ON carpool_messages
  FOR ALL USING (true) WITH CHECK (true);

-- ── posts ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS posts_select_auth ON posts;
DROP POLICY IF EXISTS posts_insert_own ON posts;
DROP POLICY IF EXISTS posts_update_own ON posts;
DROP POLICY IF EXISTS posts_delete_own ON posts;

CREATE POLICY posts_all ON posts
  FOR ALL USING (true) WITH CHECK (true);

-- ── comments ──────────────────────────────────────────────────
DROP POLICY IF EXISTS comments_select_auth ON comments;
DROP POLICY IF EXISTS comments_insert_own ON comments;
DROP POLICY IF EXISTS comments_delete_own ON comments;

CREATE POLICY comments_all ON comments
  FOR ALL USING (true) WITH CHECK (true);

-- ── post_likes ────────────────────────────────────────────────
DROP POLICY IF EXISTS post_likes_select_auth ON post_likes;
DROP POLICY IF EXISTS post_likes_insert_own ON post_likes;
DROP POLICY IF EXISTS post_likes_update_own ON post_likes;
DROP POLICY IF EXISTS post_likes_delete_own ON post_likes;

CREATE POLICY post_likes_all ON post_likes
  FOR ALL USING (true) WITH CHECK (true);

-- ── favorites ─────────────────────────────────────────────────
DROP POLICY IF EXISTS favorites_select_own ON favorites;
DROP POLICY IF EXISTS favorites_insert_own ON favorites;
DROP POLICY IF EXISTS favorites_delete_own ON favorites;

CREATE POLICY favorites_all ON favorites
  FOR ALL USING (true) WITH CHECK (true);

-- ── market_items ──────────────────────────────────────────────
DROP POLICY IF EXISTS market_items_select_auth ON market_items;
DROP POLICY IF EXISTS market_items_insert_own ON market_items;
DROP POLICY IF EXISTS market_items_update_own ON market_items;
DROP POLICY IF EXISTS market_items_delete_own ON market_items;

CREATE POLICY market_items_all ON market_items
  FOR ALL USING (true) WITH CHECK (true);

-- ── grades ────────────────────────────────────────────────────
DROP POLICY IF EXISTS grades_select_own ON grades;
DROP POLICY IF EXISTS grades_insert_service ON grades;
DROP POLICY IF EXISTS grades_delete_service ON grades;

CREATE POLICY grades_all ON grades
  FOR ALL USING (true) WITH CHECK (true);

-- ── empty_rooms ───────────────────────────────────────────────
DROP POLICY IF EXISTS empty_rooms_select_all ON empty_rooms;
DROP POLICY IF EXISTS empty_rooms_insert_service ON empty_rooms;
DROP POLICY IF EXISTS empty_rooms_update_service ON empty_rooms;
DROP POLICY IF EXISTS empty_rooms_delete_service ON empty_rooms;

CREATE POLICY empty_rooms_all ON empty_rooms
  FOR ALL USING (true) WITH CHECK (true);
