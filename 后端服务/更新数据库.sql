-- 更新现有数据库：添加 password_changed 字段
-- 在启动服务前执行（如果需要）

-- 添加字段（如果不存在）
ALTER TABLE users ADD COLUMN password_changed INTEGER DEFAULT 0;

-- 将现有用户的 password_changed 设置为 1（表示已经修改过密码，不需要强制修改）
UPDATE users SET password_changed = 1;

-- 如果需要重置某个用户为默认密码状态（强制首次登录修改）
-- UPDATE users SET password_changed = 0 WHERE username = 'admin';




