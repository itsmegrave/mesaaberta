CREATE TYPE "public"."catalog_status" AS ENUM('pending', 'approved', 'rejected', 'disabled');--> statement-breakpoint
CREATE TABLE "game_table_platforms" (
	"table_id" uuid NOT NULL,
	"platform_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "game_table_platforms_table_id_platform_id_pk" PRIMARY KEY("table_id","platform_id")
);
--> statement-breakpoint
ALTER TABLE "game_table_platforms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "game_table_tags" (
	"table_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "game_table_tags_table_id_tag_id_pk" PRIMARY KEY("table_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "game_table_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "platforms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "catalog_status" DEFAULT 'approved' NOT NULL,
	"position" integer DEFAULT 1000 NOT NULL,
	"suggested_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"merged_into" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platforms_slug_format" CHECK ("platforms"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "platforms" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"status" "catalog_status" DEFAULT 'approved' NOT NULL,
	"position" integer DEFAULT 1000 NOT NULL,
	"suggested_by" uuid,
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"merged_into" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_slug_format" CHECK ("tags"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "game_table_platforms" ADD CONSTRAINT "game_table_platforms_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_table_platforms" ADD CONSTRAINT "game_table_platforms_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_table_tags" ADD CONSTRAINT "game_table_tags_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_table_tags" ADD CONSTRAINT "game_table_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_suggested_by_profiles_id_fk" FOREIGN KEY ("suggested_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platforms" ADD CONSTRAINT "platforms_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_suggested_by_profiles_id_fk" FOREIGN KEY ("suggested_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tags" ADD CONSTRAINT "tags_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_table_platforms_platform_idx" ON "game_table_platforms" USING btree ("platform_id");--> statement-breakpoint
CREATE INDEX "game_table_tags_tag_idx" ON "game_table_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "platforms_slug_unique" ON "platforms" USING btree (lower("slug"));--> statement-breakpoint
CREATE UNIQUE INDEX "tags_slug_unique" ON "tags" USING btree (lower("slug"));
--> statement-breakpoint
-- The starting catalog, approved. Admins add to it (and GMs suggest) through the app later.
INSERT INTO "platforms" ("name", "slug", "position") VALUES
	('Discord', 'discord', 1),
	('Foundry VTT', 'foundry-vtt', 2),
	('Roll20', 'roll20', 3),
	('Owlbear Rodeo', 'owlbear-rodeo', 4),
	('Tabletop Simulator', 'tabletop-simulator', 5),
	('Fantasy Grounds', 'fantasy-grounds', 6),
	('Alchemy RPG', 'alchemy-rpg', 7),
	('TaleSpire', 'talespire', 8),
	('Google Meet', 'google-meet', 9),
	('Zoom', 'zoom', 10),
	('Telegram', 'telegram', 11),
	('WhatsApp', 'whatsapp', 12)
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "tags" ("name", "slug", "position") VALUES
	('Iniciantes', 'iniciantes', 1),
	('Roleplay', 'roleplay', 2),
	('Combate tático', 'combate-tatico', 3),
	('Dungeon crawl', 'dungeon-crawl', 4),
	('Exploração', 'exploracao', 5),
	('Investigação', 'investigacao', 6),
	('Mistério', 'misterio', 7),
	('Terror', 'terror', 8),
	('Horror cósmico', 'horror-cosmico', 9),
	('Alta fantasia', 'alta-fantasia', 10),
	('Fantasia sombria', 'fantasia-sombria', 11),
	('Ficção científica', 'ficcao-cientifica', 12),
	('Cyberpunk', 'cyberpunk', 13),
	('Pós-apocalíptico', 'pos-apocaliptico', 14),
	('Sobrevivência', 'sobrevivencia', 15),
	('Intriga política', 'intriga-politica', 16),
	('Sandbox', 'sandbox', 17),
	('Humor', 'humor', 18),
	('Mesa segura', 'mesa-segura', 19),
	('LGBTQIA+ friendly', 'lgbtqia-friendly', 20),
	('Mesa +18', 'maiores-de-18', 21)
ON CONFLICT DO NOTHING;
