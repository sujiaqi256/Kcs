-- 在 users 表添加教务系统 session cookies 持久化列
ALTER TABLE users ADD COLUMN IF NOT EXISTS jw_session_cookies jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS jw_cookies_updated_at timestamptz;
