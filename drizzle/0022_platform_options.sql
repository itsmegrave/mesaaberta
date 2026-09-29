-- Add two more approved options to the platform catalog.
INSERT INTO "platforms" ("name", "slug", "position") VALUES
	('Old Dragon Online', 'old-dragon-online', 13),
	('Outro', 'outro', 14)
ON CONFLICT DO NOTHING;
