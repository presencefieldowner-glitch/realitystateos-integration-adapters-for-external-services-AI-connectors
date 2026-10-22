# 011_INTERFACE — Status: Partially implemented (REST + CLI real; GraphQL/WebSocket/Mobile/Desktop/XR planned)

REST/GraphQL/WebSocket/CLI/SDK/Mobile/Desktop/Web/XR surfaces — this module implements the two surfaces that had a concrete, testable spec to build against (RFC-0005's REST endpoints, RFC-0003's CLI tree) for real, and documents the rest as an explicit, honest seam rather than a silent gap.

| File | Provides |
|---|---|
| `restApi.ts` | `RestApi` — a real, bound Node `http` server implementing RFC-0005's exact endpoint list (`GET/POST/PATCH /v1/profiles...`, `/presence`, `/trust`, `/revoke`) against `007_PRESENCE`. JSON only at this edge, per `formats.md` §3. |
| `cli.ts` | `Cli` — a real command registry/dispatcher implementing `cli_commands.md`'s global design rules *generically* for every registered command: `--dry-run` short-circuits before the handler runs, destructive commands require `--yes`. |
| `presenceCommands.ts` | Wires a real subset of the command tree (`user create/list/show/revoke`, `profile get/set`, `presence status`, `trust score`) to `007_PRESENCE`, mirroring `restApi.ts`'s coverage on the CLI side. |
| `plannedSurfaces.ts` | `allPlannedSurfaces()` — explicit status report that GraphQL, WebSocket, Mobile, Desktop, and XR are **not implemented**, with the reason for each. Same honesty principle LakeTiticaca's own `api.py` docstring uses ("no servers actually bound here — that's 011_INTERFACE's job") — now applied to this module's own remaining gaps. |

Depends on `007_PRESENCE` (IdentityService) via compiled `dist/` imports.

## Known deviations from spec
- Only REST + CLI are real, bound surfaces. GraphQL (`interface.graphql_port`) and WebSocket (`interface.websocket_port`) have reserved config but no server — building those is a real follow-up, not a stub pretending to work.
- Mobile/Desktop/XR are separate client codebases entirely, out of scope for this module.
- The CLI dispatcher only wires the Presence-related command subset — the rest of `cli_commands.md` (module/config/graph/tape/agent/events/admin commands) is real infrastructure (`Cli.register()`) waiting for the same wiring pattern against their respective modules.
- `--json` output formatting is left to the eventual bound `bin/rsos` entry point — `Cli.run()` always returns structured data; this module doesn't build a terminal pretty-printer.

Build/test: `npm install && npm test`.
