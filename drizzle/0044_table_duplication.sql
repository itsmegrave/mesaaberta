ALTER TABLE "game_tables" ADD COLUMN "duplicated_from_table_id" uuid;--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "duplication_request_key" uuid;--> statement-breakpoint
ALTER TABLE "game_tables" ADD COLUMN "duplication_event_id" uuid;--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_duplicated_from_table_id_game_tables_id_fk" FOREIGN KEY ("duplicated_from_table_id") REFERENCES "public"."game_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_tables_duplicated_from_idx" ON "game_tables" USING btree ("duplicated_from_table_id");--> statement-breakpoint
CREATE UNIQUE INDEX "game_tables_duplication_request_unique" ON "game_tables" USING btree ("gm_id","duplication_request_key");