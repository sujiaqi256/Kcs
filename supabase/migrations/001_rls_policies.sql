-- ============================================================
-- RLS 策略迁移
-- 目标：前端使用 anon key（非 service_role），所有操作受 RLS 约束
-- 当前策略：anon 可读写所有（保持兼容），后续可逐步收紧
-- ============================================================

-- ── 1. users ─────────────────────────────────────────────────
DROP POLICY IF EXISTS users_all ON users;
CREATE POLICY users_all ON users
  FOR ALL USING (true) WITH CHECK (true);

-- ── 2. schedule（课表）──────────────────────────────────────
DROP POLICY IF EXISTS schedule_all ON schedule;
CREATE POLICY schedule_all ON schedule
  FOR ALL USING (true) WITH CHECK (true);

-- ── 3. empty_rooms（空教室）─────────────────────────────────
DROP POLICY IF EXISTS empty_rooms_all ON empty_rooms;
CREATE POLICY empty_rooms_all ON empty_rooms
  FOR ALL USING (true) WITH CHECK (true);

-- ── 4. available_courses（公选课）────────────────────────────
DROP POLICY IF EXISTS available_courses_all ON available_courses;
CREATE POLICY available_courses_all ON available_courses
  FOR ALL USING (true) WITH CHECK (true);

-- ── 5. carpool_rides（拼车）─────────────────────────────────
DROP POLICY IF EXISTS carpool_rides_all ON carpool_rides;
CREATE POLICY carpool_rides_all ON carpool_rides
  FOR ALL USING (true) WITH CHECK (true);

-- ── 6. carpool_messages（拼车聊天）──────────────────────────
DROP POLICY IF EXISTS carpool_messages_all ON carpool_messages;
CREATE POLICY carpool_messages_all ON carpool_messages
  FOR ALL USING (true) WITH CHECK (true);

-- ── 7. forum_posts（论坛帖子）──────────────────────────────
DROP POLICY IF EXISTS forum_posts_all ON forum_posts;
CREATE POLICY forum_posts_all ON forum_posts
  FOR ALL USING (true) WITH CHECK (true);

-- ── 8. forum_comments（论坛评论）───────────────────────────
DROP POLICY IF EXISTS forum_comments_all ON forum_comments;
CREATE POLICY forum_comments_all ON forum_comments
  FOR ALL USING (true) WITH CHECK (true);

-- ── 9. market_items（二手集市）─────────────────────────────
DROP POLICY IF EXISTS market_items_all ON market_items;
CREATE POLICY market_items_all ON market_items
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 说明：
-- 1. 前端从 service_role key 改为 anon key（主要安全改进）
-- 2. RLS 策略暂时保持宽松（兼容现有功能）
-- 3. 后续可逐步收紧策略，例如：
--    - 禁止匿名用户写入
--    - 限制用户只能修改自己的数据
--    - 空教室只允许 service_role 写入
-- ============================================================
