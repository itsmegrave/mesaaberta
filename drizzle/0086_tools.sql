CREATE TABLE "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"site_url" text NOT NULL,
	"description" text NOT NULL,
	"logo_path" text,
	"platform_id" uuid,
	"submitter_id" uuid,
	"approved_at" timestamp with time zone,
	"approved_by" uuid,
	"removed_at" timestamp with time zone,
	"removed_by" uuid,
	"removal_reason" "report_reason",
	"removal_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tools_slug_format" CHECK ("tools"."slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
	CONSTRAINT "tools_kind_known" CHECK ("tools"."kind" IN ('vtt', 'chat', 'call', 'helper')),
	CONSTRAINT "tools_name_length" CHECK (char_length("tools"."name") BETWEEN 1 AND 60),
	CONSTRAINT "tools_description_length" CHECK (char_length("tools"."description") BETWEEN 1 AND 140),
	CONSTRAINT "tools_site_url_length" CHECK (char_length("tools"."site_url") <= 300),
	CONSTRAINT "tools_removal_note_length" CHECK (char_length("tools"."removal_note") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "tools" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tools" ADD CONSTRAINT "tools_submitter_id_profiles_id_fk" FOREIGN KEY ("submitter_id") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tools_slug_unique" ON "tools" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "tools_site_unique" ON "tools" USING btree (lower("site_url")) WHERE "tools"."removed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "tools_submitter_idx" ON "tools" USING btree ("submitter_id");--> statement-breakpoint
CREATE INDEX "tools_approved_idx" ON "tools" USING btree ("approved_at","removed_at");--> statement-breakpoint
-- The first tools: the table platforms (except "Outro"), each linked to its catalog entry so its
-- card links to the tables that use it. Approved from the start, with no submitter.
INSERT INTO "tools" ("slug", "name", "kind", "site_url", "description", "logo_path", "platform_id", "approved_at")
SELECT v.slug, v.name, v.kind, v.site_url, v.description, v.logo_path, p.id, now()
FROM (VALUES
	('discord', 'Discord', 'chat', 'https://discord.com', 'Servidores com canais de voz e texto e bots de dados. É onde a maioria das mesas online se encontra.', '/tools/discord.svg'),
	('foundry-vtt', 'Foundry VTT', 'vtt', 'https://foundryvtt.com', 'Mesa virtual que você instala ou hospeda, com mapas, fichas e módulos da comunidade. Licença paga uma vez.', '/tools/foundry-vtt.svg'),
	('roll20', 'Roll20', 'vtt', 'https://roll20.net', 'Mesa virtual no navegador, com mapas, fichas e rolagens. Tem plano gratuito.', '/tools/roll20.svg'),
	('owlbear-rodeo', 'Owlbear Rodeo', 'vtt', 'https://www.owlbear.rodeo', 'Mesa virtual leve no navegador: sobe o mapa, chama o grupo e joga. Tem plano gratuito.', '/tools/owlbear-rodeo.png'),
	('tabletop-simulator', 'Tabletop Simulator', 'vtt', 'https://www.tabletopsimulator.com', 'Simulador de mesa em 3D na Steam, com física, dados e miniaturas.', NULL),
	('fantasy-grounds', 'Fantasy Grounds', 'vtt', 'https://www.fantasygrounds.com', 'Mesa virtual para computador, com regras automatizadas para vários sistemas.', '/tools/fantasy-grounds.png'),
	('alchemy-rpg', 'Alchemy RPG', 'vtt', 'https://alchemyrpg.com', 'Mesa virtual no navegador com foco em clima: cenas, trilhas e efeitos.', '/tools/alchemy-rpg.png'),
	('talespire', 'TaleSpire', 'vtt', 'https://talespire.com', 'Mesa virtual em 3D com blocos para montar cenários e miniaturas. Na Steam.', NULL),
	('google-meet', 'Google Meet', 'call', 'https://meet.google.com', 'Chamada de vídeo no navegador, sem instalar nada: basta um link.', '/tools/google-meet.svg'),
	('zoom', 'Zoom', 'call', 'https://zoom.us', 'Chamadas de vídeo com compartilhamento de tela.', '/tools/zoom.svg'),
	('telegram', 'Telegram', 'chat', 'https://telegram.org', 'Mensagens e grupos, com chamadas de voz em grupo.', '/tools/telegram.svg'),
	('whatsapp', 'WhatsApp', 'chat', 'https://www.whatsapp.com', 'Mensagens e chamadas pelo celular. Bom para combinar a próxima sessão.', '/tools/whatsapp.svg'),
	('old-dragon-online', 'Old Dragon Online', 'helper', 'https://olddragon.com.br', 'Fichas e ferramentas online do Old Dragon 2e, RPG brasileiro de fantasia.', '/tools/old-dragon-online.png')
) AS v(slug, name, kind, site_url, description, logo_path)
LEFT JOIN "platforms" p ON lower(p.slug) = v.slug
ON CONFLICT DO NOTHING;
