CREATE INDEX `idx_traffic_accidents_year_lat_lng` ON `traffic_accidents` (`source_year`,`lat`,`lng`);
CREATE INDEX `idx_traffic_accidents_child_year_lat_lng` ON `traffic_accidents` (`involves_child`,`source_year`,`lat`,`lng`);
CREATE INDEX `idx_traffic_accidents_ped_year_lat_lng` ON `traffic_accidents` (`involves_pedestrian`,`source_year`,`lat`,`lng`);
