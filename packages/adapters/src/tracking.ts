/** Pre-flight gate: broken tracking silently invalidates every decision. */
export interface UrlCheck {
  loads: boolean;
  status: number | null;
  hasPixel: boolean;
  detail: string;
}

const PIXEL_SIGNATURES = [
  /connect\.facebook\.net\/[^"']*fbevents\.js/,
  /fbq\(\s*['"]init['"]/,
  /analytics\.tiktok\.com/,
  /ttq\.load\(/,
  /googletagmanager\.com/,
];

export async function checkLandingPage(url: string, http: typeof fetch = fetch): Promise<UrlCheck> {
  try {
    const res = await http(url, {
      redirect: "follow",
      headers: { "user-agent": "adlab-preflight/0.1" },
      signal: AbortSignal.timeout(10_000),
    });
    const html = await res.text();
    const hasPixel = PIXEL_SIGNATURES.some((re) => re.test(html));
    return {
      loads: res.ok,
      status: res.status,
      hasPixel,
      detail: res.ok
        ? hasPixel
          ? "Page loads and includes a tracking tag"
          : "Page loads but no tracking tag was found"
        : `HTTP ${res.status}`,
    };
  } catch (err) {
    return { loads: false, status: null, hasPixel: false, detail: (err as Error).message };
  }
}
