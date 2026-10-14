import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { AdlabClient, AdlabError } from "@adlab/client";
import { commandList } from "@adlab/contracts";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

/**
 * Thin MCP server over the same command registry as the CLI. Tools are named after commands
 * (brief.create → brief_create). Dashboard-only commands are not exposed: agents can request
 * spend, never approve it.
 */
const repoRoot = fileURLToPath(new URL("../../../", import.meta.url));
if (existsSync(`${repoRoot}.env`)) process.loadEnvFile(`${repoRoot}.env`);

const client = new AdlabClient({
  baseUrl: process.env.ADLAB_API_URL || "http://localhost:8787",
  token: process.env.ADLAB_API_TOKEN,
});
const exposed = commandList.filter((c) => !c.humanOnly);
const toolName = (name: string) => name.replace(/\./g, "_");

const server = new Server({ name: "adlab", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: exposed.map((c) => ({
    name: toolName(c.name),
    description: `${c.summary}${c.spend === "requests_approval" ? " A human must approve it in the adlab dashboard; you cannot." : ""}`,
    inputSchema: z.toJSONSchema(c.input, { io: "input", unrepresentable: "any" }) as { type: "object" },
    annotations: {
      readOnlyHint: c.method === "GET",
      destructiveHint: false,
      idempotentHint: c.method === "GET",
    },
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const def = exposed.find((c) => toolName(c.name) === req.params.name);
  if (!def) return { isError: true, content: [{ type: "text", text: `Unknown tool ${req.params.name}` }] };
  try {
    const { status, body } = await client.call(def, (req.params.arguments ?? {}) as Record<string, unknown>);
    const note =
      status === 202
        ? "\n\nPENDING HUMAN APPROVAL: ask the user to approve this in the adlab dashboard (Approvals)."
        : "";
    return { content: [{ type: "text", text: JSON.stringify(body, null, 2) + note }] };
  } catch (err) {
    const e =
      err instanceof AdlabError
        ? { code: err.code, status: err.status, message: err.message, details: err.details }
        : { message: (err as Error).message };
    return { isError: true, content: [{ type: "text", text: JSON.stringify({ error: e }, null, 2) }] };
  }
});

await server.connect(new StdioServerTransport());
