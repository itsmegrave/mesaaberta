CREATE TYPE "public"."conversation_kind" AS ENUM('table', 'direct');--> statement-breakpoint
ALTER TYPE "public"."notification_category" ADD VALUE 'messages';--> statement-breakpoint
CREATE TABLE "conversation_members" (
	"conversation_id" uuid NOT NULL,
	"profile_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone,
	"muted_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_members_conversation_id_profile_id_pk" PRIMARY KEY("conversation_id","profile_id")
);
--> statement-breakpoint
ALTER TABLE "conversation_members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "conversation_kind" NOT NULL,
	"table_id" uuid,
	"pair_key" text,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversations_kind_matches_columns" CHECK (("conversations"."kind" = 'table' AND "conversations"."table_id" IS NOT NULL AND "conversations"."pair_key" IS NULL) OR ("conversations"."kind" = 'direct' AND "conversations"."pair_key" IS NOT NULL AND "conversations"."table_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "conversations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid,
	"body" text NOT NULL,
	"table_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_body_length" CHECK (char_length("messages"."body") BETWEEN 1 AND 2000)
);
--> statement-breakpoint
ALTER TABLE "messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "direct_messages_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_profiles_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_members_profile_idx" ON "conversation_members" USING btree ("profile_id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_table_unique" ON "conversations" USING btree ("table_id") WHERE "conversations"."kind" = 'table';--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_pair_unique" ON "conversations" USING btree ("pair_key") WHERE "conversations"."kind" = 'direct';--> statement-breakpoint
CREATE INDEX "conversations_last_message_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_idx" ON "messages" USING btree ("conversation_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messages" USING btree ("sender_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_unread_message_idx" ON "notifications" USING btree ("recipient_id",("metadata"->>'conversationId')) WHERE "notifications"."type" = 'message_received' AND "notifications"."read_at" IS NULL;--> statement-breakpoint
INSERT INTO "conversations" ("kind", "table_id") SELECT 'table', "id" FROM "game_tables" WHERE "status" = 'active';--> statement-breakpoint
INSERT INTO "conversation_members" ("conversation_id", "profile_id") SELECT "c"."id", "t"."gm_id" FROM "conversations" "c" JOIN "game_tables" "t" ON "t"."id" = "c"."table_id" WHERE "c"."kind" = 'table';--> statement-breakpoint
INSERT INTO "conversation_members" ("conversation_id", "profile_id") SELECT "c"."id", "r"."player_id" FROM "conversations" "c" JOIN "registrations" "r" ON "r"."table_id" = "c"."table_id" WHERE "c"."kind" = 'table' AND "r"."status" = 'confirmed';
