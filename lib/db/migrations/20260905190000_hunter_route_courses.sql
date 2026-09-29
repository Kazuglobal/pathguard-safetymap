CREATE TABLE IF NOT EXISTS hunter_route_schools (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hunter_route_memberships (
  user_id TEXT PRIMARY KEY NOT NULL,
  school_id TEXT NOT NULL REFERENCES hunter_route_schools(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('student', 'teacher')),
  school_year INTEGER CHECK(school_year BETWEEN 1 AND 9),
  created_at TEXT NOT NULL,
  CHECK(role = 'teacher' OR school_year IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_hunter_route_memberships_school ON hunter_route_memberships(school_id, role);

CREATE TABLE IF NOT EXISTS hunter_route_invitations (
  token_hash TEXT PRIMARY KEY NOT NULL,
  school_id TEXT NOT NULL REFERENCES hunter_route_schools(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hunter_route_invitations_school ON hunter_route_invitations(school_id, expires_at);

CREATE TABLE IF NOT EXISTS hunter_route_courses (
  id TEXT PRIMARY KEY NOT NULL,
  owner_id TEXT NOT NULL,
  school_id TEXT REFERENCES hunter_route_schools(id),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
  published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0, 1)),
  data_json TEXT NOT NULL CHECK(json_valid(data_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(published = 0 OR school_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_hunter_route_courses_owner ON hunter_route_courses(owner_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_hunter_route_courses_school ON hunter_route_courses(school_id, published, updated_at);

CREATE TABLE IF NOT EXISTS hunter_route_progress (
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL REFERENCES hunter_route_courses(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK(revision >= 1),
  scene_id TEXT NOT NULL,
  scenario TEXT NOT NULL,
  cleared INTEGER NOT NULL CHECK(cleared IN (0, 1)),
  missed_kinds_json TEXT NOT NULL CHECK(json_valid(missed_kinds_json)),
  attempts INTEGER NOT NULL DEFAULT 1 CHECK(attempts >= 1),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(user_id, course_id, revision, scene_id, scenario)
);
CREATE INDEX IF NOT EXISTS idx_hunter_route_progress_course ON hunter_route_progress(course_id, revision, user_id);
