/** Outbound webhook for alerts and the digest, so any messaging tool can consume them. */
export interface Notifier {
  send(event: {
    type: "alert" | "digest";
    title: string;
    text: string;
    data?: unknown;
  }): Promise<{ delivered: boolean; detail: string }>;
}

export class WebhookNotifier implements Notifier {
  constructor(
    private readonly url: string | undefined,
    private readonly http: typeof fetch = fetch,
  ) {}

  async send(event: { type: "alert" | "digest"; title: string; text: string; data?: unknown }) {
    if (!this.url) return { delivered: false, detail: "ADLAB_WEBHOOK_URL not set" };
    try {
      const res = await this.http(this.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // `text` doubles as Slack-compatible payload.
        body: JSON.stringify({ source: "adlab", ...event, sentAt: new Date().toISOString() }),
        signal: AbortSignal.timeout(10_000),
      });
      return { delivered: res.ok, detail: `HTTP ${res.status}` };
    } catch (err) {
      return { delivered: false, detail: (err as Error).message };
    }
  }
}
