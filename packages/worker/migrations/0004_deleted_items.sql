-- 已删除文件记录表
CREATE TABLE IF NOT EXISTS deleted_items (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_path TEXT DEFAULT '',
    file_type TEXT DEFAULT 'file' CHECK(file_type IN ('file', 'folder')),
    file_size INTEGER DEFAULT 0,
    deleted_at TEXT NOT NULL,
    parent_id TEXT,
    -- 存储文件的额外信息（JSON格式）
    metadata TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_deleted_items_user ON deleted_items(user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_items_file ON deleted_items(file_id);
CREATE INDEX IF NOT EXISTS idx_deleted_items_deleted_at ON deleted_items(deleted_at);
