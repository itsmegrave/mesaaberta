ALTER TABLE "tools" ADD COLUMN "kinds" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_kinds_known" CHECK ("tools"."kinds" <@ ARRAY['vtt', 'chat', 'call', 'helper']::text[]);--> statement-breakpoint
-- Every tool keeps the section it had.
UPDATE "tools" SET "kinds" = ARRAY["kind"] WHERE cardinality("kinds") = 0;--> statement-breakpoint
-- Grave, 2026-11-12: Old Dragon Online is character sheets and help, and a virtual tabletop too.
UPDATE "tools" SET "kinds" = ARRAY['vtt', 'helper'], "kind" = 'vtt', "updated_at" = now() WHERE "slug" = 'old-dragon-online';
