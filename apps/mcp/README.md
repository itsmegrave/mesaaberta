# @mesaaberta/mcp

The [MCP](https://modelcontextprotocol.io) server of Mesa Aberta: Claude (claude.ai, Claude Code,
the desktop app) and other MCP clients read the site as the person who connected them. It is a door
to the api and nothing more: no database, no business rule, no store and no secret.

**Status: phase 1, read-only, behind `use_mcp`.** Every tool reads; none changes anything. Writes
(asking for a seat, the GM's answers, messages) come in a later phase, each one confirmed by the
person before it runs.

## How a client gets in

1. The person adds `https://mcp.mesaaberta.app/mcp` as a connector.
2. The first request has no token, so `/mcp` answers 401 with
   `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/mcp"`.
   That document names the Supabase project's OAuth 2.1 server (`<SUPABASE_URL>/auth/v1`) as the
   authorization server; the client discovers it and registers itself (dynamic client
   registration).
3. Supabase sends the person to the site's consent page, `/oauth/consent` (the project's
   "Authorization Path"). Signed in as usual, they see the client's name, what it can read and
   where they go back to, and approve or deny (`supabase.auth.oauth.approveAuthorization`).
4. Each `/mcp` request then carries the access token. `src/auth.ts` checks it against the project's
   JWKS: issuer, audience `authenticated`, expiry, an asymmetric signature (ES256 or RS256) and the
   `client_id` claim. A site session token has no `client_id`, so it is refused: nothing reaches
   the MCP without the consent step.
5. `use_mcp` must be on for the person (targeted by id), and `GET /v1/me` must answer an active
   profile with a username. Then the tools call the api over the Service Binding with
   `x-actor-id` = the token's `sub`, exactly as the web Worker does, and the api authorizes as
   usual.

Revoking: the person's grant lives in Supabase Auth; deleting it there (or turning `use_mcp` off)
ends access. A "Connected apps" screen in the account is a later phase.

## Tools

| Tool                                      | api route                                                        |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `search_tables`                           | `GET /v1/reads/tables`                                           |
| `get_table`                               | `GET /v1/reads/detail/:slug`                                     |
| `my_tables`                               | `GET /v1/reads/dashboard`                                        |
| `my_calendar`                             | `GET /v1/me/calendar`                                            |
| `list_systems`, `get_system`              | `GET /v1/reads/systems[/:slug]` (behind `api_directory_systems`) |
| `list_places`, `get_place`                | `GET /v1/reads/places[/:slug]` (behind `api_directory_places`)   |
| `list_gamemasters`                        | `GET /v1/reads/gamemasters` (behind `api_directory_gms`)         |
| `get_profile`                             | `GET /v1/profiles/:username`                                     |
| `my_notifications`                        | `GET /v1/me/notifications`                                       |
| `list_conversations`, `read_conversation` | `GET /v1/messages/inbox`, `GET /v1/messages/:id`                 |

Each tool answers the api's JSON as text, or `{ "error": code }` (`not_found`, `forbidden`,
`rate_limited`, `unavailable`) with `isError`. Reading messages here does not mark them read.

## Settings

| Variable                                       | What                                                                                    |
| ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| `SUPABASE_URL`                                 | The project whose OAuth 2.1 server signs people in. Blank: `/mcp` answers 503.          |
| `MCP_URL`                                      | The public address of `/mcp`, named in the metadata (`https://mcp.mesaaberta.app/mcp`). |
| `API`                                          | Service Binding to `mesaaberta-api`. Self-hosted: `API_URL` + `API_INTERNAL_TOKEN`.     |
| `GROWTHBOOK_API_HOST`, `GROWTHBOOK_CLIENT_KEY` | The flags. Without them every flag is off, so the MCP stays shut.                       |
| `SENTRY_DSN`                                   | Errors and logs, as on the other Workers.                                               |

Supabase side (dashboard, Authentication): turn on the **OAuth Server** with the Authorization Path
`/oauth/consent` and dynamic client registration, and sign JWTs with an asymmetric key (ES256 or
RS256): clients and this Worker verify tokens with the published JWKS.

## Run it

```sh
bunx wrangler dev -c apps/mcp/wrangler.jsonc --var SUPABASE_URL:https://<ref>.supabase.co
bun run --bun vitest run --project server ../mcp   # from apps/web
bunx wrangler deploy --dry-run -c apps/mcp/wrangler.jsonc
```

With a token in hand, the [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
(`npx @modelcontextprotocol/inspector`) lists and calls the tools against a local or deployed URL.

The server is stateless (Streamable HTTP, JSON answers): every POST builds the server, answers and
ends, so `GET` and `DELETE` on `/mcp` answer 405.
