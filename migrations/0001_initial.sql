CREATE TABLE IF NOT EXISTS reviews (
  game_key TEXT PRIMARY KEY,
  game_name TEXT NOT NULL,
  developer TEXT NOT NULL DEFAULT '',
  game_url TEXT NOT NULL DEFAULT '',
  final_score REAL NOT NULL,
  final_score10 REAL NOT NULL,
  report_json TEXT NOT NULL,
  model TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS reviews_created_at_idx
  ON reviews(created_at DESC);

CREATE TABLE IF NOT EXISTS game_knowledge (
  game_key TEXT PRIMARY KEY,
  game_name TEXT NOT NULL,
  genre TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  known_facts_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS game_knowledge_updated_at_idx
  ON game_knowledge(updated_at DESC);
