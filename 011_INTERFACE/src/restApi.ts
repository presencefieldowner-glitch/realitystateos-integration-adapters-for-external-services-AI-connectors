/**
 * RealityStateOS — Interface / RestApi
 * A real, bound Node HTTP server implementing RFC-0005 (user_profile.md)'s
 * exact API surface for module 007_PRESENCE. JSON at the edge, per
 * formats.md §3 ("JSON is allowed only at the REST API edge... translated
 * immediately at the boundary") — internally everything still flows through
 * typed UserProfile objects, not ad hoc JSON.
 */
import * as http from "http";
import {
  IdentityService,
  ProfileNotFoundError,
  EmailAlreadyExistsError,
  InvalidLifecycleTransitionError,
} from "../../007_PRESENCE/dist/identityService";

async function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(json) });
  res.end(json);
}

export class RestApi {
  private server?: http.Server;

  constructor(private readonly identity: IdentityService) {}

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean); // e.g. ["v1","profiles","<id>"]

    try {
      if (url.pathname === "/health" && req.method === "GET") {
        return sendJson(res, 200, { status: "ok" });
      }

      if (parts[0] === "v1" && parts[1] === "profiles") {
        if (parts.length === 2 && req.method === "POST") {
          const body = await readJsonBody(req);
          const profile = await this.identity.create(
            String(body.displayName ?? ""),
            String(body.email ?? "")
          );
          return sendJson(res, 201, profile);
        }
        if (parts.length === 3 && req.method === "GET") {
          return sendJson(res, 200, await this.identity.get(parts[2]));
        }
        if (parts.length === 3 && req.method === "PATCH") {
          const body = await readJsonBody(req);
          const [field] = Object.keys(body);
          if (field !== "displayName" && field !== "email") {
            return sendJson(res, 400, { error: `unsupported field: ${field}` });
          }
          const profile = await this.identity.setField(parts[2], field, String(body[field]));
          return sendJson(res, 200, profile);
        }
        if (parts.length === 4 && parts[3] === "revoke" && req.method === "POST") {
          return sendJson(res, 200, await this.identity.revoke(parts[2]));
        }
        if (parts.length === 4 && parts[3] === "presence" && req.method === "GET") {
          return sendJson(res, 200, (await this.identity.get(parts[2])).presence);
        }
        if (parts.length === 4 && parts[3] === "trust" && req.method === "GET") {
          return sendJson(res, 200, (await this.identity.get(parts[2])).trust);
        }
      }

      return sendJson(res, 404, { error: "not found" });
    } catch (e) {
      if (e instanceof ProfileNotFoundError) return sendJson(res, 404, { error: e.message });
      if (e instanceof EmailAlreadyExistsError) return sendJson(res, 409, { error: e.message });
      if (e instanceof InvalidLifecycleTransitionError) return sendJson(res, 400, { error: e.message });
      return sendJson(res, 500, { error: (e as Error).message });
    }
  }

  /** Binds to `port` (0 = ephemeral, useful for tests) and resolves with the
   * actually-bound port. */
  listen(port = 0): Promise<number> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        void this.handle(req, res);
      });
      this.server.listen(port, () => {
        const addr = this.server!.address();
        resolve(typeof addr === "object" && addr ? addr.port : port);
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) return resolve();
      this.server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}
