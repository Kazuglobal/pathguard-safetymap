-- Counts of distinct original records possibly related to each current municipality.
-- Empty municipality means prefecture-wide uncertainty. Collapse overlapping city
-- relations for the same original record before aggregation; never sum nationally.
CREATE TABLE IF NOT EXISTS accident_regional_uncertainty_counts (
 version TEXT NOT NULL REFERENCES accident_snapshots(version),
 prefecture TEXT NOT NULL, municipality TEXT NOT NULL,
 year INTEGER NOT NULL, hour INTEGER NOT NULL, participants INTEGER NOT NULL,
 fatal INTEGER NOT NULL, uncertain INTEGER NOT NULL CHECK(uncertain>=0),
 excluded INTEGER NOT NULL CHECK(excluded>=0),
 PRIMARY KEY(version,prefecture,municipality,year,hour,participants,fatal)
);
