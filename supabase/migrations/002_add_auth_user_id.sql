-- 添加 auth_user_id 列，用于关联 Supabase Auth 用户
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_user_id uuid;

-- 为现有用户创建 Supabase Auth 账户（可选，需要手动执行）
-- 对于已有用户，可以用以下 SQL 批量创建 Auth 账户：
-- INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at)
-- SELECT gen_random_uuid(), student_id || '@zqu.edu.cn', crypt('default_password', gen_salt('bf')), now()
-- FROM users WHERE auth_user_id IS NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);
