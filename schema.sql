CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname TEXT NOT NULL,
  nickname_normalized TEXT NOT NULL UNIQUE,
  avatar_key TEXT,
  joined_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_members_joined_at ON members(joined_at DESC);