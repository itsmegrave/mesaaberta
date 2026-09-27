CREATE TABLE "postal_codes" (
	"cep" text PRIMARY KEY NOT NULL,
	"neighbourhood" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "postal_codes_cep_format" CHECK ("postal_codes"."cep" ~ '^[0-9]{8}$')
);
--> statement-breakpoint
ALTER TABLE "postal_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "postal_code" text;--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "location_neighbourhood" text;--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "location_city" text;--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "location_state" text;--> statement-breakpoint
CREATE INDEX "game_tables_location_idx" ON "game_tables" USING btree ("location_state","location_city");--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_postal_code_format" CHECK ("game_tables"."postal_code" ~ '^[0-9]{8}$');