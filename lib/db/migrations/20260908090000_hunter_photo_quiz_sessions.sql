CREATE TABLE IF NOT EXISTS hunter_photo_quiz_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES hunter_route_courses(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK(revision > 0),
  scenario TEXT NOT NULL CHECK(scenario IN ('normal','rain','evening','earthquake')),
  version INTEGER NOT NULL DEFAULT 0 CHECK(version >= 0),
  state_json TEXT NOT NULL CHECK(json_valid(state_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_photo_quiz_progress ON hunter_photo_quiz_sessions(user_id, course_id, revision, scenario, updated_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_photo_quiz_active ON hunter_photo_quiz_sessions(user_id, course_id, revision, scenario)
  WHERE json_extract(state_json, '$.stage') <> 'complete';
CREATE TABLE IF NOT EXISTS hunter_photo_quiz_events (
  session_id TEXT NOT NULL REFERENCES hunter_photo_quiz_sessions(id) ON DELETE CASCADE,
  request_id TEXT NOT NULL,
  response_json TEXT NOT NULL CHECK(json_valid(response_json)),
  created_at TEXT NOT NULL,
  PRIMARY KEY(session_id, request_id)
);
CREATE INDEX IF NOT EXISTS idx_photo_quiz_event_time ON hunter_photo_quiz_events(session_id, created_at);
