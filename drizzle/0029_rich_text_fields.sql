-- Multiline fields become rich text: the small HTML subset of src/lib/text/rich.ts. A visible limit
-- (1000 characters) now sits on top of markup, so the private columns' length checks widen to the hard
-- cap (the limit times RICH_HTML_FACTOR) and the existing plain text is converted to paragraphs.
ALTER TABLE "game_tables" DROP CONSTRAINT "game_tables_join_details_length";--> statement-breakpoint
ALTER TABLE "game_tables" DROP CONSTRAINT "game_tables_welcome_message_length";--> statement-breakpoint
-- The same conversion as plainToHtml: escaped, a blank line starts a paragraph, a line break stays one.
CREATE FUNCTION "plain_to_html"(plain text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
	SELECT '<p>' || regexp_replace(
		regexp_replace(
			replace(replace(replace(btrim(replace(replace(plain, E'\r\n', E'\n'), E'\r', E'\n')), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'),
			E'\n{2,}', '</p><p>', 'g'),
		E'\n', '<br>', 'g') || '</p>'
$$;--> statement-breakpoint
UPDATE "game_tables" SET
	"description" = CASE WHEN btrim("description") = '' THEN '' ELSE "plain_to_html"("description") END,
	"extra_info" = CASE WHEN btrim("extra_info") = '' THEN NULL ELSE "plain_to_html"("extra_info") END,
	"welcome_message" = CASE WHEN btrim("welcome_message") = '' THEN NULL ELSE "plain_to_html"("welcome_message") END,
	"join_details" = CASE WHEN btrim("join_details") = '' THEN NULL ELSE "plain_to_html"("join_details") END;--> statement-breakpoint
UPDATE "notifications" SET "body" = "plain_to_html"("body")
	WHERE "type" = 'system_announcement' AND btrim("body") <> '';--> statement-breakpoint
UPDATE "events" SET "payload" = jsonb_set("payload", '{body}', to_jsonb("plain_to_html"("payload"->>'body')))
	WHERE "type" = 'SystemAnnouncementSent' AND btrim(coalesce("payload"->>'body', '')) <> '';--> statement-breakpoint
DROP FUNCTION "plain_to_html"(text);--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_join_details_length" CHECK (char_length("game_tables"."join_details") <= 6000);--> statement-breakpoint
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_welcome_message_length" CHECK (char_length("game_tables"."welcome_message") <= 6000);
