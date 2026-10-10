-- Append-only versions. Publish only after offline validation; never expose raw accident rows.
CREATE TABLE IF NOT EXISTS accident_snapshots (
 version TEXT PRIMARY KEY, published INTEGER NOT NULL DEFAULT 0 CHECK(published IN (0,1)),
 updated_at TEXT NOT NULL, metadata_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS accident_areas (
 version TEXT NOT NULL REFERENCES accident_snapshots(version), code TEXT NOT NULL,
 parent_code TEXT NOT NULL, name TEXT NOT NULL, PRIMARY KEY(version,code)
);
CREATE TABLE IF NOT EXISTS accident_locations (
 version TEXT NOT NULL REFERENCES accident_snapshots(version), id TEXT NOT NULL,
 name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('intersection','road')),
 prefecture TEXT NOT NULL, municipality TEXT NOT NULL, latitude REAL NOT NULL, longitude REAL NOT NULL,
 scope_json TEXT NOT NULL, PRIMARY KEY(version,id)
);
CREATE INDEX IF NOT EXISTS accident_locations_area ON accident_locations(version,prefecture,municipality,kind);
CREATE TABLE IF NOT EXISTS accident_location_counts (
 version TEXT NOT NULL, location_id TEXT NOT NULL, year INTEGER NOT NULL, hour INTEGER NOT NULL,
 participants INTEGER NOT NULL, fatal INTEGER NOT NULL, accident_class TEXT NOT NULL,
 count INTEGER NOT NULL CHECK(count>0),
 PRIMARY KEY(version,location_id,year,hour,participants,fatal,accident_class),
 FOREIGN KEY(version,location_id) REFERENCES accident_locations(version,id)
);
CREATE TABLE IF NOT EXISTS accident_quality_counts (
 version TEXT NOT NULL REFERENCES accident_snapshots(version), prefecture TEXT NOT NULL, municipality TEXT NOT NULL,
 year INTEGER NOT NULL, hour INTEGER NOT NULL, participants INTEGER NOT NULL, fatal INTEGER NOT NULL,
 assigned INTEGER NOT NULL, uncertain INTEGER NOT NULL, excluded INTEGER NOT NULL,
 PRIMARY KEY(version,prefecture,municipality,year,hour,participants,fatal)
);
CREATE INDEX IF NOT EXISTS accident_counts_dimensions ON accident_location_counts(version,year,hour,participants,fatal,location_id);
CREATE INDEX IF NOT EXISTS accident_quality_dimensions ON accident_quality_counts(version,year,prefecture,municipality);
