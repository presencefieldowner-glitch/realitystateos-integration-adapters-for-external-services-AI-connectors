/**
 * RealityStateOS — Interface / Cli
 * A real command registry + dispatcher implementing cli_commands.md's
 * (RFC-0003) global design rules generically for every registered command:
 * `--dry-run` short-circuits before the handler runs; destructive commands
 * require `--yes`. Binary name `realitystateos` / `rsos` — this module
 * provides the dispatch core; a `bin/rsos` entry point wiring stdin/stdout
 * is a thin follow-up once the process wants a bound CLI, not a design gap.
 */

export interface ParsedArgs {
  command: string[];
  flags: Record<string, string | boolean>;
}

/** `--flag value` -> flags.flag = "value"; `--flag` (no value, or followed
 * by another flag) -> flags.flag = true. Everything else is positional. */
export function parseArgs(argv: string[]): ParsedArgs {
  const command: string[] = [];
  const flags: Record<string, string | boolean> = {};
  let i = 0;
  while (i < argv.length) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i += 1;
      }
    } else {
      command.push(arg);
      i += 1;
    }
  }
  return { command, flags };
}

export type CommandHandler = (
  positional: string[],
  flags: Record<string, string | boolean>
) => unknown | Promise<unknown>;

export interface RegisterOptions {
  destructive?: boolean;
}

export class UnknownCommandError extends Error {
  constructor(command: string[]) {
    super(`unknown command: "${command.join(" ")}"`);
  }
}

export class ConfirmationRequiredError extends Error {
  constructor(path: string) {
    super(`"${path}" is destructive and requires --yes (or an interactive confirm, not available in this API)`);
  }
}

export interface DryRunResult {
  dryRun: true;
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

interface RegisteredCommand {
  handler: CommandHandler;
  destructive: boolean;
}

export class Cli {
  private commands = new Map<string, RegisteredCommand>();

  register(path: string, handler: CommandHandler, options: RegisterOptions = {}): void {
    this.commands.set(path, { handler, destructive: options.destructive ?? false });
  }

  /** Longest-prefix match against registered command paths, e.g. "user
   * create --email a@b.com" matches "user create" with positional []. */
  async run(argv: string[]): Promise<unknown | DryRunResult> {
    const { command, flags } = parseArgs(argv);

    for (let len = command.length; len > 0; len--) {
      const path = command.slice(0, len).join(" ");
      const entry = this.commands.get(path);
      if (!entry) continue;

      const positional = command.slice(len);

      if (flags["dry-run"]) {
        return { dryRun: true, command: path, positional, flags };
      }
      if (entry.destructive && !flags["yes"]) {
        throw new ConfirmationRequiredError(path);
      }
      return entry.handler(positional, flags);
    }

    throw new UnknownCommandError(command);
  }

  registeredPaths(): string[] {
    return [...this.commands.keys()];
  }
}
