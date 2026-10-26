CREATE TYPE "public"."table_role" AS ENUM('player', 'gm', 'both');--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "table_role" "table_role";--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "table_role_inferred" boolean DEFAULT false NOT NULL;