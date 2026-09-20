CREATE TABLE "profile_social_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"network" text NOT NULL,
	"url" text NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profile_social_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "age" smallint;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "city" text;--> statement-breakpoint
-- Existing profiles get a username made from their display name (lowercase, accents stripped,
-- anything else a hyphen, at most 30 characters, a numeric suffix on a repeat). Where nothing
-- acceptable comes out (an emoji-only name, the "Jogador" placeholder, a reserved word, fewer than
-- 3 characters) the username stays empty and the owner picks one at the onboarding. The reserved list
-- is the one in src/lib/profile/username.ts as it stood when this ran.
DO $$
DECLARE
	profile record;
	base text;
	candidate text;
	n integer;
BEGIN
	FOR profile IN SELECT "id", "display_name" FROM "profiles" ORDER BY "created_at", "id" LOOP
		base := lower(profile."display_name");
		base := translate(base, 'áàâãäåéèêëíìîïóòôõöúùûüçñýÿ', 'aaaaaaeeeeiiiiooooouuuucnyy');
		base := regexp_replace(base, '[^a-z0-9]+', '-', 'g');
		base := regexp_replace(base, '^-+|-+$', '', 'g');
		base := regexp_replace(left(base, 30), '-+$', '');

		CONTINUE WHEN char_length(base) < 3
			OR base IN ('jogador', 'account', 'admin', 'api', 'auth', 'forgot-password', 'healthz', 'images',
				'login', 'logout', 'onboarding', 'reset-password', 'signup', 'tables', 'about', 'ajuda', 'assets',
				'busca', 'conta', 'contato', 'dashboard', 'edit', 'explore', 'help', 'home', 'jogadores', 'mesa',
				'mesas', 'new', 'perfil', 'privacidade', 'privacy', 'profile', 'profiles', 'register', 'search',
				'settings', 'sistema', 'sistemas', 'static', 'suporte', 'support', 'system', 'systems', 'table',
				'termos', 'terms', 'user', 'users', 'usuario', 'usuarios', 'administrador', 'anonymous',
				'mesa-aberta', 'mesaaberta', 'moderador', 'moderator', 'null', 'staff', 'undefined');

		candidate := base;
		n := 1;
		WHILE EXISTS (SELECT 1 FROM "profiles" WHERE "username" = candidate) LOOP
			n := n + 1;
			-- The suffix has to fit inside the 30 characters.
			candidate := regexp_replace(left(base, 30 - char_length('-' || n)), '-+$', '') || '-' || n;
		END LOOP;

		UPDATE "profiles" SET "username" = candidate WHERE "id" = profile."id";
	END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "profile_social_links" ADD CONSTRAINT "profile_social_links_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "profile_social_links_profile_idx" ON "profile_social_links" USING btree ("profile_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_username_unique" ON "profiles" USING btree (lower("username"));--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_username_format" CHECK ("profiles"."username" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');