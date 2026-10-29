CREATE TABLE "place_feature_picks" (
	"place_id" uuid NOT NULL,
	"feature_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "place_feature_picks_place_id_feature_id_pk" PRIMARY KEY("place_id","feature_id")
);
--> statement-breakpoint
ALTER TABLE "place_feature_picks" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "place_features" (
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
	CONSTRAINT "place_features_slug_format" CHECK ("place_features"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
--> statement-breakpoint
ALTER TABLE "place_features" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "place_feature_picks" ADD CONSTRAINT "place_feature_picks_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_feature_picks" ADD CONSTRAINT "place_feature_picks_feature_id_place_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."place_features"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_features" ADD CONSTRAINT "place_features_suggested_by_profiles_id_fk" FOREIGN KEY ("suggested_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_features" ADD CONSTRAINT "place_features_reviewed_by_profiles_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "place_feature_picks_feature_idx" ON "place_feature_picks" USING btree ("feature_id");--> statement-breakpoint
CREATE UNIQUE INDEX "place_features_slug_unique" ON "place_features" USING btree (lower("slug"));--> statement-breakpoint
-- The catalog starts with the tags of the plan (facilities, what is played, what goes on), in the
-- order the form offers them. The first six are the old Comodidades, with the slugs their tags had.
INSERT INTO "place_features" ("name", "slug", "position") VALUES
  ('Acessível', 'accessible', 1),
  ('Empresta jogos', 'lends-games', 2),
  ('Mesas para reservar', 'bookable-tables', 3),
  ('Sem taxa para jogar', 'free-to-play', 4),
  ('Vende comida', 'sells-food', 5),
  ('Aberto à noite', 'open-late', 6),
  ('Sala reservada', 'private-room', 7),
  ('Abre no fim de semana', 'open-weekends', 8),
  ('Wi-Fi', 'wifi', 9),
  ('Tomadas nas mesas', 'power-outlets', 10),
  ('Ar-condicionado', 'air-conditioning', 11),
  ('Serve bebidas alcoólicas', 'sells-drinks', 12),
  ('Estacionamento', 'parking', 13),
  ('Perto de transporte público', 'public-transport', 14),
  ('Bom para crianças', 'kid-friendly', 15),
  ('Aceita pets', 'pet-friendly', 16),
  ('TV ou projetor', 'screen', 17),
  ('Mesas com cenário para miniaturas', 'terrain-tables', 18),
  ('Acervo de livros de RPG', 'rpg-library', 19),
  ('RPG de mesa', 'rpg', 20),
  ('Jogos de tabuleiro', 'board-games', 21),
  ('Card games', 'card-games', 22),
  ('Wargames e miniaturas', 'wargames', 23),
  ('Pintura de miniaturas', 'miniature-painting', 24),
  ('LARP', 'larp', 25),
  ('Xadrez e jogos clássicos', 'classic-games', 26),
  ('Videogames', 'video-games', 27),
  ('Quadrinhos e mangá', 'comics', 28),
  ('Recebe iniciantes', 'beginners', 29),
  ('Mestragem da casa', 'house-gms', 30),
  ('Mesas avulsas', 'one-shots', 31),
  ('Campanhas fixas', 'campaigns', 32),
  ('Eventos regulares', 'regular-events', 33),
  ('Torneios', 'tournaments', 34),
  ('Oficinas e aulas', 'workshops', 35),
  ('Demonstrações e lançamentos', 'demos', 36),
  ('Vende jogos e livros', 'sells-games', 37),
  ('Vende miniaturas e acessórios', 'sells-minis', 38),
  ('Aluga jogos', 'game-rental', 39)
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Each place keeps the Comodidades it had, now as picks, in the old list's order.
INSERT INTO "place_feature_picks" ("place_id", "feature_id", "position")
SELECT p."id", f."id", a."ord"::int
FROM "places" p
CROSS JOIN LATERAL unnest(p."amenities") WITH ORDINALITY AS a("amenity", "ord")
JOIN "place_features" f ON f."slug" = replace(a."amenity", '_', '-')
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- And a listed place keeps being found by them: a `feature` tag beside each old `amenity` one (the
-- release before this one still reads those), named as the catalog names it.
INSERT INTO "place_tags" ("place_id", "kind", "label", "slug")
SELECT t."place_id", 'feature', f."name", t."slug"
FROM "place_tags" t
JOIN "place_features" f ON f."slug" = t."slug"
WHERE t."kind" = 'amenity'
ON CONFLICT DO NOTHING;