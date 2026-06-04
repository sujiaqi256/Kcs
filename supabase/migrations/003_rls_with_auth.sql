-- ============================================================
-- RLS 策略：基于 Supabase Auth 的用户身份验证
-- 前提：users 表有 auth_user_id 列关联 Supabase Auth 用户
-- ============================================================

-- 启用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE empty_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE carpool ENABLE ROW LEVEL SECURITY;
ALTER TABLE carpool_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE grades ENABLE ROW LEVEL SECURITY;

-- ── 1. users ─────────────────────────────────────────────────
DROP POLICY IF EXISTS users_all ON users;
DROP POLICY IF EXISTS users_select_own ON users;
DROP POLICY IF EXISTS users_update_own ON users;

CREATE POLICY users_select_own ON users
  FOR SELECT USING (
    auth_user_id = auth.uid()
    OR auth.role() = 'service_role'
  );

CREATE POLICY users_update_own ON users
  FOR UPDATE USING (
    auth_user_id = auth.uid()
    OR auth.role() = 'service_role'
  );

CREATE POLICY users_insert_auth ON users
  FOR INSERT WITH CHECK (
    auth.role() = 'anon'
    OR auth.role() = 'service_role'
  );

-- ── 2. schedule（课表）──────────────────────────────────────
DROP POLICY IF EXISTS schedule_all ON schedule;
DROP POLICY IF EXISTS schedule_select_own ON schedule;
DROP POLICY IF EXISTS schedule_insert_own ON schedule;
DROP POLICY IF EXISTS schedule_delete_own ON schedule;

CREATE POLICY schedule_select_own ON schedule
  FOR SELECT USING (
    student_id IN (
      SELECT student_id FROM users WHERE auth_user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY schedule_insert_own ON schedule
  FOR INSERT WITH CHECK (
    auth.role() = 'service_role'
  );

CREATE POLICY schedule_delete_own ON schedule
  FOR DELETE USING (
    auth.role() = 'service_role'
  );

-- ── 3. empty_rooms（空教室）─────────────────────────────────
DROP POLICY IF EXISTS empty_rooms_all ON empty_rooms;

CREATE POLICY empty_rooms_select_all ON empty_rooms
  FOR SELECT USING (true);

CREATE POLICY empty_rooms_insert_service ON empty_rooms
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY empty_rooms_update_service ON empty_rooms
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY empty_rooms_delete_service ON empty_rooms
  FOR DELETE USING (auth.role() = 'service_role');

-- ── 4. carpool（拼车）───────────────────────────────────────
DROP POLICY IF EXISTS carpool_all ON carpool;

CREATE POLICY carpool_select_auth ON carpool
  FOR SELECT USING (
    auth.role() = 'anon'
    OR auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  );

CREATE POLICY carpool_insert_own ON carpool
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY carpool_update_own ON carpool
  FOR UPDATE USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY carpool_delete_own ON carpool
  FOR DELETE USING (
    user_id IN (
      SELECT id FROM users WHERE auth_user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

-- ── 5. carpool_messages（拼车聊天）──────────────────────────
DROP POLICY IF EXISTS carpool_messages_all ON carpool_messages;

CREATE POLICY carpool_messages_select_own ON carpool_messages
  FOR SELECT USING (
    sender_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR receiver_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

CREATE POLICY carpool_messages_insert_own ON carpool_messages
  FOR INSERT WITH CHECK (
    sender_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

-- ── 6. posts（论坛帖子）─────────────────────────────────────
DROP POLICY IF EXISTS posts_all ON posts;

CREATE POLICY posts_select_auth ON posts
  FOR SELECT USING (
    auth.role() = 'anon'
    OR auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  );

CREATE POLICY posts_insert_own ON posts
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

CREATE POLICY posts_update_own ON posts
  FOR UPDATE USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

CREATE POLICY posts_delete_own ON posts
  FOR DELETE USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

-- ── 7. comments（论坛评论）──────────────────────────────────
DROP POLICY IF EXISTS comments_all ON comments;

CREATE POLICY comments_select_auth ON comments
  FOR SELECT USING (
    auth.role() = 'anon'
    OR auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  );

CREATE POLICY comments_insert_own ON comments
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

CREATE POLICY comments_delete_own ON comments
  FOR DELETE USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

-- ── 8. post_likes（帖子点赞）────────────────────────────────
DROP POLICY IF EXISTS post_likes_all ON post_likes;

CREATE POLICY post_likes_select_auth ON post_likes
  FOR SELECT USING (
    auth.role() = 'anon'
    OR auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  );

CREATE POLICY post_likes_insert_own ON post_likes
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

CREATE POLICY post_likes_update_own ON post_likes
  FOR UPDATE USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

CREATE POLICY post_likes_delete_own ON post_likes
  FOR DELETE USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

-- ── 9. favorites（收藏）─────────────────────────────────────
DROP POLICY IF EXISTS favorites_all ON favorites;

CREATE POLICY favorites_select_own ON favorites
  FOR SELECT USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

CREATE POLICY favorites_insert_own ON favorites
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

CREATE POLICY favorites_delete_own ON favorites
  FOR DELETE USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

-- ── 10. market_items（二手集市）────────────────────────────
DROP POLICY IF EXISTS market_items_all ON market_items;

CREATE POLICY market_items_select_auth ON market_items
  FOR SELECT USING (
    auth.role() = 'anon'
    OR auth.role() = 'authenticated'
    OR auth.role() = 'service_role'
  );

CREATE POLICY market_items_insert_own ON market_items
  FOR INSERT WITH CHECK (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

CREATE POLICY market_items_update_own ON market_items
  FOR UPDATE USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

CREATE POLICY market_items_delete_own ON market_items
  FOR DELETE USING (
    user_id IN (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR auth.role() = 'service_role'
  );

-- ── 11. grades（成绩）───────────────────────────────────────
DROP POLICY IF EXISTS grades_all ON grades;

CREATE POLICY grades_select_own ON grades
  FOR SELECT USING (
    student_id IN (
      SELECT student_id FROM users WHERE auth_user_id = auth.uid()
    )
    OR auth.role() = 'service_role'
  );

CREATE POLICY grades_insert_service ON grades
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY grades_delete_service ON grades
  FOR DELETE USING (auth.role() = 'service_role');
