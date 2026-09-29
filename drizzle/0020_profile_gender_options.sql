-- Gender was free text; it becomes a list of options, and "Outro" keeps the person's own words.
-- What people already typed is kept: a known answer (ignoring case, accents, spaces and hyphens)
-- becomes its option, anything else becomes "other" with the original text in gender_other.
CREATE TYPE "public"."gender_identity" AS ENUM('woman', 'man', 'trans_woman', 'trans_man', 'non_binary', 'agender', 'genderfluid', 'travesti', 'other');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "gender_other" text;--> statement-breakpoint
CREATE FUNCTION pg_temp.gender_option(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN value IS NULL THEN NULL ELSE CASE regexp_replace(
      translate(lower(btrim(value)), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
      '[[:space:]_-]+', ' ', 'g'
    )
    WHEN '' THEN NULL
    WHEN 'mulher' THEN 'woman'
    WHEN 'feminino' THEN 'woman'
    WHEN 'mulher cis' THEN 'woman'
    WHEN 'homem' THEN 'man'
    WHEN 'masculino' THEN 'man'
    WHEN 'homem cis' THEN 'man'
    WHEN 'mulher trans' THEN 'trans_woman'
    WHEN 'homem trans' THEN 'trans_man'
    WHEN 'nao binario' THEN 'non_binary'
    WHEN 'nao binaria' THEN 'non_binary'
    WHEN 'nao binarie' THEN 'non_binary'
    WHEN 'pessoa nao binaria' THEN 'non_binary'
    WHEN 'agenero' THEN 'agender'
    WHEN 'genero fluido' THEN 'genderfluid'
    WHEN 'travesti' THEN 'travesti'
    ELSE 'other'
  END END
$$;--> statement-breakpoint
UPDATE "profiles" SET "gender_other" = left(btrim("gender"), 40)
  WHERE "gender" IS NOT NULL AND pg_temp.gender_option("gender") = 'other';--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "gender" SET DATA TYPE "public"."gender_identity"
  USING pg_temp.gender_option("gender")::"public"."gender_identity";
