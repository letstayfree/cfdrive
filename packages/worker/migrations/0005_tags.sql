-- ============================================
-- 标签系统表
-- ============================================

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,                  -- 标签所属用户
    name TEXT NOT NULL,                     -- 标签名称
    color TEXT DEFAULT '#3B82F6',           -- 标签颜色（HEX格式）
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 确保同一用户的标签名称唯一
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_unique ON tags(user_id, name);
CREATE INDEX IF NOT EXISTS idx_tags_user ON tags(user_id);

-- 文件-标签关联表
CREATE TABLE IF NOT EXISTS file_tags (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,                  -- OneDrive 文件 ID
    tag_id TEXT NOT NULL,                   -- 标签 ID
    user_id TEXT NOT NULL,                  -- 用户 ID（便于查询）
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 确保同一文件不会重复添加同一标签
CREATE UNIQUE INDEX IF NOT EXISTS idx_file_tags_unique ON file_tags(file_id, tag_id);
CREATE INDEX IF NOT EXISTS idx_file_tags_file ON file_tags(file_id);
CREATE INDEX IF NOT EXISTS idx_file_tags_tag ON file_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_file_tags_user ON file_tags(user_id);
