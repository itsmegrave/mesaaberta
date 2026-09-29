-- The exact age becomes an age range: a range is enough to find a table, so the number is not kept
-- anywhere (LGPD art. 6º, III). Each age already saved moves to its range, then the column goes.
CREATE TYPE "public"."age_range" AS ENUM('13_17', '18_24', '25_34', '35_44', '45_54', '55_plus');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "age_range" "age_range";--> statement-breakpoint
UPDATE "profiles" SET "age_range" = (CASE
    WHEN "age" < 13 THEN NULL
    WHEN "age" <= 17 THEN '13_17'
    WHEN "age" <= 24 THEN '18_24'
    WHEN "age" <= 34 THEN '25_34'
    WHEN "age" <= 44 THEN '35_44'
    WHEN "age" <= 54 THEN '45_54'
    ELSE '55_plus'
  END)::"public"."age_range"
  WHERE "age" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" DROP COLUMN "age";
