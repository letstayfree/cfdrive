-- Migration: 0001_initial_schema
-- Description: Initial database schema for CFDrive

-- ============================================
-- 系统配置表 (用于首次安装检测)
-- ============================================
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- 用户表
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'guest',
    status TEXT NOT NULL DEFAULT 'active',
    avatar_url TEXT,
    last_login_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================
-- 用户会话表
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- ============================================
-- 文件夹权限表
-- ============================================
CREATE TABLE IF NOT EXISTS folder_permissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    folder_id TEXT NOT NULL,
    folder_path TEXT NOT NULL,
    permission TEXT NOT NULL,
    granted_by TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_permissions_user ON folder_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_folder ON folder_permissions(folder_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_unique ON folder_permissions(user_id, folder_id);

-- ============================================
-- 分享链接表
-- ============================================
CREATE TABLE IF NOT EXISTS shares (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    file_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    created_by TEXT NOT NULL,
    password_hash TEXT,
    expires_at TEXT,
    max_downloads INTEGER,
    download_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_shares_code ON shares(code);
CREATE INDEX IF NOT EXISTS idx_shares_creator ON shares(created_by);

-- ============================================
-- 访问日志表
-- ============================================
CREATE TABLE IF NOT EXISTS access_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    resource_path TEXT,
    ip_address TEXT,
    user_agent TEXT,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_logs_user ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_action ON access_logs(action);
CREATE INDEX IF NOT EXISTS idx_logs_created ON access_logs(created_at);

-- ============================================
-- 文件收藏表
-- ============================================
CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_unique ON favorites(user_id, file_id);

-- ============================================
-- 文件标签表
-- ============================================
CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_unique ON tags(user_id, name);

-- ============================================
-- 文件-标签关联表
-- ============================================
CREATE TABLE IF NOT EXISTS file_tags (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL,
    tag_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_file_tags_unique ON file_tags(file_id, tag_id);
CREATE INDEX IF NOT EXISTS idx_file_tags_file ON file_tags(file_id);

-- ============================================
-- IP 白名单表
-- ============================================
CREATE TABLE IF NOT EXISTS ip_whitelist (
    id TEXT PRIMARY KEY,
    ip_pattern TEXT NOT NULL,
    description TEXT,
    created_by TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- ============================================
-- 两步验证表
-- ============================================
CREATE TABLE IF NOT EXISTS two_factor_auth (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    secret TEXT NOT NULL,
    backup_codes TEXT,
    is_enabled INTEGER DEFAULT 0,
    verified_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
