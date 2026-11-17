-- Quem mestra starts with the people who already ran a table: a published (non-draft) table with
-- them as GM puts them in as "Mestra", marked inferred so Editar perfil can tell them why. Only
-- profiles with no answer yet are touched, so running it again changes nothing.
UPDATE "profiles" SET "table_role" = 'gm', "table_role_inferred" = true
WHERE "table_role" IS NULL
  AND EXISTS (
    SELECT 1 FROM "game_tables"
    WHERE "game_tables"."gm_id" = "profiles"."id"
      AND "game_tables"."status" <> 'draft'
      AND "game_tables"."published_at" IS NOT NULL
  );
