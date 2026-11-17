CREATE TABLE "mail_deliveries" (
	"key" text PRIMARY KEY NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mail_deliveries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "session_close_reminders" (
	"table_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"step" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_close_reminders_table_id_starts_at_step_pk" PRIMARY KEY("table_id","starts_at","step"),
	CONSTRAINT "session_close_reminders_step" CHECK ("session_close_reminders"."step" IN ('1h', '7d'))
);
--> statement-breakpoint
ALTER TABLE "session_close_reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "session_close_reminders" ADD CONSTRAINT "session_close_reminders_table_id_game_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."game_tables"("id") ON DELETE cascade ON UPDATE no action;