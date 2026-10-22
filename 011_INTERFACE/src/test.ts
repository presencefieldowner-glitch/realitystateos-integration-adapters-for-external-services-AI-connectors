import { RestApi } from "./restApi";
import { Cli, parseArgs, UnknownCommandError, ConfirmationRequiredError } from "./cli";
import { registerPresenceCommands } from "./presenceCommands";
import { allPlannedSurfaces } from "./plannedSurfaces";
import { IdentityService } from "../../007_PRESENCE/dist/identityService";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ok  - ${name}`);
  } catch (e) {
    failed++;
    console.log(`FAIL - ${name}`);
    console.log(`       ${(e as Error).message}`);
  }
}

function assert(cond: boolean, msg = "assertion failed"): void {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log("cli.parseArgs");
  await test("splits positional command words from --flags", () => {
    const parsed = parseArgs(["user", "create", "--email", "a@b.com", "--verbose"]);
    assert(parsed.command.join(",") === "user,create");
    assert(parsed.flags.email === "a@b.com");
    assert(parsed.flags.verbose === true);
  });

  console.log("Cli");
  await test("run() dispatches to the longest matching registered command", async () => {
    const cli = new Cli();
    cli.register("user create", (_pos, flags) => ({ created: flags.name }));
    const result = await cli.run(["user", "create", "--name", "Ada"]);
    assert((result as any).created === "Ada");
  });

  await test("run() throws UnknownCommandError for an unregistered command", async () => {
    const cli = new Cli();
    let threw = false;
    try {
      await cli.run(["nope", "nope"]);
    } catch (e) {
      threw = e instanceof UnknownCommandError;
    }
    assert(threw);
  });

  await test("--dry-run short-circuits before the handler runs", async () => {
    const cli = new Cli();
    let called = false;
    cli.register("user create", () => {
      called = true;
      return {};
    });
    const result = await cli.run(["user", "create", "--dry-run"]);
    assert(called === false);
    assert((result as any).dryRun === true);
  });

  await test("destructive commands require --yes", async () => {
    const cli = new Cli();
    cli.register("user revoke", (pos) => ({ revoked: pos[0] }), { destructive: true });
    let threw = false;
    try {
      await cli.run(["user", "revoke", "id1"]);
    } catch (e) {
      threw = e instanceof ConfirmationRequiredError;
    }
    assert(threw);
    const result = await cli.run(["user", "revoke", "id1", "--yes"]);
    assert((result as any).revoked === "id1");
  });

  console.log("presenceCommands");
  await test("user create/show/list/revoke round-trip through the real Cli+IdentityService", async () => {
    const identity = new IdentityService();
    const cli = new Cli();
    registerPresenceCommands(cli, identity);

    const created: any = await cli.run(["user", "create", "--name", "Ada", "--email", "ada@example.com"]);
    assert(created.displayName === "Ada");

    const shown: any = await cli.run(["user", "show", created.id]);
    assert(shown.email === "ada@example.com");

    const revoked: any = await cli.run(["user", "revoke", created.id, "--yes"]);
    assert(revoked.status === "revoked");

    const list: any = await cli.run(["user", "list", "--filter", "revoked"]);
    assert(list.length === 1);
  });

  console.log("RestApi");
  await test("POST/GET/PATCH/revoke/presence/trust round-trip over real HTTP", async () => {
    const identity = new IdentityService();
    const api = new RestApi(identity);
    const port = await api.listen(0);
    const base = `http://127.0.0.1:${port}`;

    try {
      const health = await fetch(`${base}/health`);
      assert(health.status === 200);

      const createRes = await fetch(`${base}/v1/profiles`, {
        method: "POST",
        body: JSON.stringify({ displayName: "Ada", email: "ada-api@example.com" }),
      });
      assert(createRes.status === 201);
      const created = await createRes.json();
      assert(created.displayName === "Ada");

      const getRes = await fetch(`${base}/v1/profiles/${created.id}`);
      assert(getRes.status === 200);

      const missingRes = await fetch(`${base}/v1/profiles/does-not-exist`);
      assert(missingRes.status === 404);

      const patchRes = await fetch(`${base}/v1/profiles/${created.id}`, {
        method: "PATCH",
        body: JSON.stringify({ displayName: "Ada Lovelace" }),
      });
      assert(patchRes.status === 200);
      const patched = await patchRes.json();
      assert(patched.displayName === "Ada Lovelace");

      const presenceRes = await fetch(`${base}/v1/profiles/${created.id}/presence`);
      assert(presenceRes.status === 200);
      const presence = await presenceRes.json();
      assert(presence.status === "unknown");

      const trustRes = await fetch(`${base}/v1/profiles/${created.id}/trust`);
      assert((await trustRes.json()).score === 0);

      const revokeRes = await fetch(`${base}/v1/profiles/${created.id}/revoke`, { method: "POST" });
      assert((await revokeRes.json()).status === "revoked");

      const dupRes = await fetch(`${base}/v1/profiles`, {
        method: "POST",
        body: JSON.stringify({ displayName: "Someone", email: "ada-api@example.com" }),
      });
      assert(dupRes.status === 409);
    } finally {
      await api.close();
    }
  });

  console.log("plannedSurfaces");
  await test("allPlannedSurfaces() honestly reports graphql/websocket/mobile/desktop/xr as not implemented", () => {
    const statuses = allPlannedSurfaces();
    assert(statuses.length === 5);
    assert(statuses.every((s) => s.implemented === false));
    assert(statuses.some((s) => s.surface === "graphql"));
  });

  console.log(`\n${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main();
