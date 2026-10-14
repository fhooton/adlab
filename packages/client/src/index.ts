import {
  buildRequest,
  type CommandDef,
  type CommandInput,
  type CommandKey,
  commands,
  ExitCode,
} from "@adlab/contracts";

export interface ClientOptions {
  baseUrl: string;
  token?: string;
  /** Extra headers, e.g. a session cookie for scripted human steps in the demo. */
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

export class AdlabError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AdlabError";
  }

  get exitCode(): number {
    return exitCodeFor(this.status);
  }
}

export function exitCodeFor(status: number): number {
  if (status === 202) return ExitCode.pendingApproval;
  if (status >= 200 && status < 300) return ExitCode.ok;
  if (status === 400) return ExitCode.invalid;
  if (status === 401 || status === 403) return ExitCode.auth;
  if (status === 404) return ExitCode.notFound;
  if (status === 409) return ExitCode.conflict;
  if (status === 422) return ExitCode.blocked;
  return ExitCode.error;
}

/** Thin typed client over the command registry. Used by the CLI, the MCP server and scripts. */
export class AdlabClient {
  constructor(private readonly opts: ClientOptions) {}

  async call(
    def: CommandDef,
    input: Record<string, unknown> = {},
  ): Promise<{ status: number; body: unknown }> {
    const req = buildRequest(def, input);
    const url = new URL(req.path, this.opts.baseUrl);
    for (const [k, v] of Object.entries(req.query ?? {}))
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    const headers: Record<string, string> = { accept: "application/json", ...this.opts.headers };
    if (this.opts.token) headers.authorization = `Bearer ${this.opts.token}`;
    if (req.body !== undefined) headers["content-type"] = "application/json";
    let res: Response;
    try {
      res = await (this.opts.fetch ?? fetch)(url, {
        method: req.method,
        headers,
        body: req.body === undefined ? undefined : JSON.stringify(req.body),
      });
    } catch (err) {
      throw new AdlabError(
        0,
        "unreachable",
        `Cannot reach the adlab API at ${this.opts.baseUrl}. Is \`npm run dev\` running? (${(err as Error).message})`,
      );
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const e = (body as { error?: { code: string; message: string; details?: unknown } }).error;
      throw new AdlabError(res.status, e?.code ?? "error", e?.message ?? `HTTP ${res.status}`, e?.details);
    }
    return { status: res.status, body };
  }

  async run<K extends CommandKey>(key: K, input: CommandInput<K> = {} as CommandInput<K>): Promise<any> {
    return (await this.call(commands[key], input as Record<string, unknown>)).body;
  }
}
