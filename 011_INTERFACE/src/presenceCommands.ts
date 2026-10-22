/**
 * RealityStateOS — Interface / PresenceCommands
 * Wires a real subset of cli_commands.md's command tree — user/profile/
 * presence/trust — to 007_PRESENCE's IdentityService, mirroring restApi.ts's
 * endpoint coverage on the CLI side. `rsos user revoke` is registered as
 * destructive per the spec's "Destructive commands... require --yes".
 */
import { Cli } from "./cli";
import { IdentityService } from "../../007_PRESENCE/dist/identityService";

export function registerPresenceCommands(cli: Cli, identity: IdentityService): void {
  cli.register("user create", async (_pos, flags) => {
    return identity.create(String(flags.name ?? ""), String(flags.email ?? ""));
  });

  cli.register("user list", async (_pos, flags) => {
    const filter = flags.filter as "active" | "revoked" | undefined;
    return identity.list(filter);
  });

  cli.register("user show", async (pos) => identity.get(pos[0]));

  cli.register("user revoke", async (pos) => identity.revoke(pos[0]), { destructive: true });

  cli.register("profile get", async (pos) => identity.get(pos[0]));

  cli.register("profile set", async (pos) => {
    const [id, field, value] = pos;
    if (field !== "displayName" && field !== "email") {
      throw new Error(`unsupported profile field: ${field}`);
    }
    return identity.setField(id, field, value);
  });

  cli.register("presence status", async (pos) => (await identity.get(pos[0])).presence);

  cli.register("trust score", async (pos) => (await identity.get(pos[0])).trust);
}
