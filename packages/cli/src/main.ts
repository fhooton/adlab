import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AdlabClient, AdlabError } from "@adlab/client";
import { type CommandDef, commandList, ExitCode } from "@adlab/contracts";
import { Command } from "commander";
import { z } from "zod";
import { coerceFlag, flagsFor } from "./schema-flags";

/**
 * adlab — the agent-facing command surface. Non-interactive, JSON on stdout, `--dry-run`,
 * meaningful exit codes. Generated from the command registry in @adlab/contracts.
 */
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
const envFile = `${repoRoot}.env`;
if (existsSync(envFile)) process.loadEnvFile(envFile);

const print = (value: unknown, pretty: boolean) =>
  process.stdout.write(`${JSON.stringify(value, null, pretty ? 2 : 0)}\n`);

function readInput(opts: Record<string, unknown>, def: CommandDef): Record<string, unknown> {
  let input: Record<string, unknown> = {};
  if (typeof opts.file === "string") {
    const text = opts.file === "-" ? readFileSync(0, "utf8") : readFileSync(opts.file, "utf8");
    input = JSON.parse(text);
  }
  if (typeof opts.input === "string") input = { ...input, ...JSON.parse(opts.input) };
  for (const f of flagsFor(def.input)) {
    const camel = f.flag.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    if (opts[camel] !== undefined) input[f.key] = coerceFlag(f.type, opts[camel] as string);
  }
  return input;
}

const program = new Command()
  .name("adlab")
  .description(
    "Agent-operated ad testing. Every command prints JSON. Exit codes: 0 ok, 1 error, 2 invalid input, 3 auth, 4 conflict, 5 pending human approval, 6 not found, 7 blocked (budget/policy/kill switch).",
  )
  .option("--pretty", "pretty-print JSON", false)
  .showHelpAfterError();

program
  .command("commands")
  .description("List every command with its HTTP route and whether it needs approval")
  .action(() => {
    print(
      commandList.map((c) => ({
        command: c.name.replace(".", " "),
        summary: c.summary,
        method: c.method,
        path: c.path,
        spend: c.spend ?? null,
        humanOnly: Boolean(c.humanOnly),
      })),
      program.opts().pretty,
    );
  });

program
  .command("schema")
  .argument("<command>", 'e.g. "variants create" or variants.create')
  .description("Print the JSON Schema for a command's input")
  .action((name: string) => {
    const def = commandList.find((c) => c.name === name.replace(" ", "."));
    if (!def) {
      print({ error: { code: "not_found", message: `Unknown command ${name}` } }, true);
      process.exit(ExitCode.notFound);
    }
    print(z.toJSONSchema(def.input, { io: "input", unrepresentable: "any" }), true);
  });

const groups = new Map<string, Command>();
for (const def of commandList) {
  const [group, action] = def.name.includes(".")
    ? (def.name.split(".") as [string, string])
    : [def.name, null];
  let cmd: Command;
  if (action) {
    let g = groups.get(group);
    if (!g) {
      g = program.command(group).description(`${group} commands`);
      groups.set(group, g);
    }
    cmd = g.command(action);
  } else cmd = program.command(group);
  cmd.description(
    `${def.summary}${def.spend === "requests_approval" ? " [creates approval]" : ""}${def.humanOnly ? " [dashboard only]" : ""}`,
  );
  cmd.option("-i, --input <json>", "input as a JSON object");
  cmd.option("-f, --file <path>", "read input JSON from a file, or - for stdin");
  cmd.option("--dry-run", "validate input locally and print the request without sending it", false);
  for (const f of flagsFor(def.input)) {
    const label =
      f.type === "boolean" ? `--${f.flag}` : `--${f.flag} <${f.type === "string[]" ? "a,b" : f.type}>`;
    cmd.option(label, f.description ?? (f.required ? "required" : "optional"));
  }
  cmd.action(async (opts: Record<string, unknown>) => {
    const pretty = Boolean(program.opts().pretty);
    try {
      const input = readInput(opts, def);
      const parsed = def.input.safeParse(input);
      if (!parsed.success) {
        print(
          { error: { code: "invalid", message: "Input failed validation", details: parsed.error.issues } },
          pretty,
        );
        process.exit(ExitCode.invalid);
      }
      if (opts.dryRun) {
        print(
          {
            dryRun: true,
            command: def.name,
            method: def.method,
            path: def.path,
            input: parsed.data,
            spend: def.spend ?? null,
          },
          pretty,
        );
        return;
      }
      const client = new AdlabClient({
        baseUrl: process.env.ADLAB_API_URL || "http://localhost:8787",
        token: process.env.ADLAB_API_TOKEN,
      });
      const { status, body } = await client.call(def, input);
      print(body, pretty);
      if (status === 202) {
        process.stderr.write(
          "Pending human approval in the dashboard. Stop and ask the user to approve it.\n",
        );
        process.exit(ExitCode.pendingApproval);
      }
    } catch (err) {
      if (err instanceof AdlabError) {
        print(
          { error: { code: err.code, status: err.status, message: err.message, details: err.details } },
          pretty,
        );
        process.exit(err.status === 0 ? ExitCode.error : err.exitCode);
      }
      print({ error: { code: "error", message: (err as Error).message } }, pretty);
      process.exit(ExitCode.error);
    }
  });
}

await program.parseAsync(process.argv);
