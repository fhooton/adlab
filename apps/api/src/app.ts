import { readFile } from "node:fs/promises";
import path from "node:path";
import { type AspectRatio, type CommandKey, commands, type ErrorBody } from "@adlab/contracts";
import type { Actor } from "@adlab/core";
import { composeHtml, getTemplate } from "@adlab/render";
import * as svc from "@adlab/services";
import { type Ctx, ServiceError } from "@adlab/services";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ZodError, z } from "zod";
import { issueSession, loginAllowed, resolveActor, SESSION_COOKIE, safeEqual } from "./auth";

type Handler = (ctx: Ctx, actor: Actor, input: Record<string, any>) => Promise<unknown>;

/** One handler per command in the registry. Adding a command without a handler fails typecheck. */
const handlers: Record<CommandKey, Handler> = {
  health: async (ctx) => ({
    ok: true,
    platform: ctx.platform.platform,
    platformMode: ctx.platform.mode,
    renderer: ctx.renderer.name,
    liveWrites: ctx.config.allowLiveWrites,
  }),
  whoami: async (_ctx, actor) => actor,
  overview: (ctx) => svc.overview(ctx),
  briefCreate: (ctx, a, i) => svc.createBrief(ctx, a, i),
  briefList: (ctx) => svc.listBriefs(ctx),
  briefGet: (ctx, _a, i) => svc.getBrief(ctx, i.briefId),
  researchAdd: (ctx, a, i) => svc.addResearch(ctx, a, i),
  hypothesesPropose: (ctx, a, i) => svc.proposeHypotheses(ctx, a, i),
  hypothesesList: (ctx, _a, i) => svc.listHypotheses(ctx, i.briefId),
  templateList: async () => svc.listTemplates(),
  variantsCreate: (ctx, a, i) => svc.createVariants(ctx, a, i),
  variantsList: (ctx, _a, i) => svc.listVariants(ctx, i),
  variantGet: (ctx, _a, i) => svc.getVariant(ctx, i.variantId),
  variantsRender: (ctx, a, i) => svc.requestRenders(ctx, a, i.variantIds),
  testCreate: (ctx, a, i) => svc.createTest(ctx, a, i),
  testList: (ctx, _a, i) => svc.listTests(ctx, i),
  testGet: (ctx, _a, i) => svc.getTestResults(ctx, i.testId),
  testPreflight: (ctx, a, i) => svc.runPreflight(ctx, a, i.testId),
  testLaunch: (ctx, a, i) => svc.requestLaunch(ctx, a, i.testId),
  testSync: (ctx, a, i) => svc.syncTest(ctx, a, i.testId),
  testDecide: (ctx, a, i) => svc.decideTest(ctx, a, i.testId),
  approvalList: (ctx, _a, i) => svc.listApprovals(ctx, i.status),
  approvalDecide: (ctx, a, i) => svc.decideApproval(ctx, a, i as svc.DecideInput),
  learningAdd: (ctx, a, i) => svc.addLearning(ctx, a, i),
  learningList: (ctx) => svc.listLearnings(ctx),
  ratingAdd: (ctx, a, i) => svc.addRating(ctx, a, i as { variantId: string; score: number }),
  killSwitchEngage: (ctx, a, i) => svc.engageKillSwitch(ctx, a, i.reason),
  killSwitchRelease: (ctx, a) => svc.releaseKillSwitch(ctx, a),
  trackingCheck: (ctx, a, i) => svc.trackingCheck(ctx, a, i.url),
  reconcile: (ctx, a) => svc.reconcile(ctx, a),
  activityList: (ctx, _a, i) => svc.listActivity(ctx, i.limit),
  digestGet: (ctx, _a, i) => svc.digest(ctx, i.hours),
  digestSend: (ctx, a) => svc.sendDigest(ctx, a),
  simAdvance: (ctx, a, i) => svc.simAdvance(ctx, a, i.hours),
};

const STATUS: Record<ErrorBody["error"]["code"], ContentfulStatusCode> = {
  invalid: 400,
  auth: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  blocked: 422,
  internal: 500,
};

function errorBody(err: unknown): { status: ContentfulStatusCode; body: ErrorBody } {
  if (err instanceof ZodError)
    return {
      status: 400,
      body: { error: { code: "invalid", message: "Input failed validation", details: err.issues } },
    };
  if (err instanceof ServiceError)
    return {
      status: STATUS[err.code],
      body: { error: { code: err.code, message: err.message, details: err.details } },
    };
  const message = (err as Error)?.message ?? String(err);
  if (/Live write blocked/.test(message))
    return { status: 422, body: { error: { code: "blocked", message } } };
  console.error(err);
  return { status: 500, body: { error: { code: "internal", message } } };
}

export interface AppOptions {
  /** Serve the built dashboard (apps/web/dist) from the same origin. */
  webDist?: string;
}

export function createApp(ctx: Ctx, opts: AppOptions = {}) {
  const app = new Hono<{ Variables: { actor: Actor } }>();
  const cfg = ctx.config;
  const secureCookie = cfg.env !== "local";

  app.onError((err, c) => {
    const { status, body } = errorBody(err);
    return c.json(body, status);
  });

  // --- auth -----------------------------------------------------------------
  app.post("/v1/auth/login", async (c) => {
    const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!loginAllowed(ip))
      return c.json({ error: { code: "auth", message: "Too many attempts; wait 15 minutes" } }, 429);
    const body = z
      .object({ password: z.string(), name: z.string().trim().min(1).max(40) })
      .parse(await c.req.json());
    if (!cfg.dashboardPassword || !safeEqual(body.password, cfg.dashboardPassword)) {
      return c.json({ error: { code: "auth", message: "Wrong password" } }, 401);
    }
    setCookie(c, SESSION_COOKIE, issueSession(cfg, body.name), {
      httpOnly: true,
      secure: secureCookie,
      sameSite: "Strict",
      path: "/",
      maxAge: 7 * 86_400,
    });
    await svc.audit(ctx, { kind: "human", name: body.name }, "auth.login", "session", null, {});
    return c.json({ kind: "human", name: body.name });
  });
  app.post("/v1/auth/logout", (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  app.use("/v1/*", async (c, next) => {
    if (c.req.path === "/v1/health" || c.req.path.startsWith("/v1/auth/")) return next();
    const actor = resolveActor(cfg, c);
    if (!actor)
      return c.json(
        {
          error: {
            code: "auth",
            message: "Missing or invalid token / session. Run `npm run setup` or log in.",
          },
        },
        401,
      );
    // CSRF: cookie-authenticated writes must carry a custom header (blocked cross-site by CORS).
    if (actor.kind === "human" && c.req.method !== "GET" && c.req.header("x-adlab-csrf") !== "1") {
      return c.json({ error: { code: "forbidden", message: "Missing x-adlab-csrf header" } }, 403);
    }
    c.set("actor", actor);
    return next();
  });

  // --- previews & files ------------------------------------------------------
  app.get("/v1/variants/:variantId/preview", async (c) => {
    const v = await svc.requireVariant(ctx, c.req.param("variantId"));
    const aspect = (c.req.query("aspect") ?? v.aspectRatios[0] ?? "9:16") as AspectRatio;
    if (!getTemplate(v.templateId)?.aspectRatios.includes(aspect))
      return c.json({ error: { code: "invalid", message: `Unsupported aspect ${aspect}` } }, 400);
    c.header(
      "content-security-policy",
      "default-src 'none'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'unsafe-inline'; img-src * data:; media-src *; font-src *",
    );
    return c.html(composeHtml(v.templateId, aspect, v.variables));
  });

  app.get("/files/*", async (c) => {
    const key = decodeURIComponent(c.req.path.replace(/^\/files\//, ""));
    const data = await ctx.storage.get(key);
    if (!data) return c.notFound();
    const type = key.endsWith(".mp4")
      ? "video/mp4"
      : key.endsWith(".svg")
        ? "image/svg+xml"
        : key.endsWith(".png")
          ? "image/png"
          : "application/octet-stream";
    return c.body(data as unknown as ArrayBuffer, 200, {
      "content-type": type,
      "cache-control": "public, max-age=31536000, immutable",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
    });
  });

  // --- every command in the registry ----------------------------------------
  for (const [key, def] of Object.entries(commands) as Array<[CommandKey, (typeof commands)[CommandKey]]>) {
    const handler = handlers[key];
    app.on(def.method, def.path, async (c) => {
      const actor = (c.get("actor") as Actor | undefined) ?? { kind: "system", name: "anonymous" };
      if ("humanOnly" in def && def.humanOnly && actor.kind !== "human") {
        return c.json(
          { error: { code: "forbidden", message: `${def.name} requires a dashboard session` } },
          403,
        );
      }
      if ("simOnly" in def && def.simOnly && !ctx.fake)
        return c.json(
          { error: { code: "forbidden", message: `${def.name} needs ADLAB_PLATFORM=fake` } },
          403,
        );
      const params = c.req.param() as Record<string, string>;
      const raw =
        def.method === "GET"
          ? { ...c.req.query(), ...params }
          : { ...((await c.req.json().catch(() => ({}))) as object), ...params };
      const input = def.input.parse(raw) as Record<string, unknown>;
      const result = await handler(ctx, actor, input);
      const pending = (result as { status?: string })?.status === "pending_approval";
      return c.json(result as object, pending ? 202 : 200);
    });
  }

  // --- dashboard (hosted single-origin mode) --------------------------------
  if (opts.webDist) {
    const dist = opts.webDist;
    app.get("*", async (c) => {
      const rel = c.req.path === "/" ? "index.html" : c.req.path.slice(1);
      const file = path.resolve(dist, rel);
      if (!file.startsWith(path.resolve(dist))) return c.notFound();
      try {
        const data = await readFile(file);
        const ext = path.extname(file);
        const type =
          {
            ".html": "text/html",
            ".js": "text/javascript",
            ".css": "text/css",
            ".svg": "image/svg+xml",
            ".woff2": "font/woff2",
          }[ext] ?? "application/octet-stream";
        return c.body(data as unknown as ArrayBuffer, 200, { "content-type": type });
      } catch {
        return c.html(await readFile(path.join(dist, "index.html"), "utf8"));
      }
    });
  }

  return app;
}
