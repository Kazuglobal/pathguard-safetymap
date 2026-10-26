CREATE TABLE school_districts (
 id TEXT PRIMARY KEY NOT NULL, municipality_code TEXT NOT NULL, school_code TEXT NOT NULL,
 prefecture TEXT NOT NULL, city TEXT NOT NULL, name TEXT NOT NULL,
 source_url TEXT NOT NULL, data_year INTEGER NOT NULL
);
CREATE INDEX idx_school_district_region ON school_districts(prefecture, city);
CREATE TABLE school_district_boundaries (
 id TEXT PRIMARY KEY NOT NULL, district_id TEXT NOT NULL REFERENCES school_districts(id) ON DELETE CASCADE,
 geometry TEXT NOT NULL CHECK(json_valid(geometry)),
 min_lng REAL NOT NULL, min_lat REAL NOT NULL, max_lng REAL NOT NULL, max_lat REAL NOT NULL
);
CREATE INDEX idx_school_boundary_district ON school_district_boundaries(district_id);
CREATE TABLE local_alert_districts (
 alert_id TEXT NOT NULL REFERENCES local_safety_alerts(id) ON DELETE CASCADE,
 district_id TEXT NOT NULL REFERENCES school_districts(id) ON DELETE CASCADE,
 PRIMARY KEY(alert_id, district_id)
);
CREATE INDEX idx_alert_district ON local_alert_districts(district_id, alert_id);
CREATE TABLE local_alert_locations (
 alert_id TEXT PRIMARY KEY NOT NULL REFERENCES local_safety_alerts(id) ON DELETE CASCADE,
 address TEXT, evidence TEXT, source_url TEXT, longitude REAL, latitude REAL,
 status TEXT NOT NULL, checked_at TEXT NOT NULL
);
