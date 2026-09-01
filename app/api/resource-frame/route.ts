import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = [
  "sitios.mendoza.gob.ar",
  "www.mendoza.gov.ar",
  "mendoza.gov.ar",
  "sia.mendoza.gov.ar",
];

function hostAllowed(url: URL) {
  return ALLOWED.some(
    (h) => url.hostname === h || url.hostname.endsWith(`.${h}`)
  );
}

/**
 * Probe whether an official URL can be embedded (X-Frame-Options / CSP).
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url")?.trim();
  if (!raw) {
    return NextResponse.json({ ok: false, error: "url required" }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid url" }, { status: 400 });
  }

  if (!/^https?:$/.test(url.protocol) || !hostAllowed(url)) {
    return NextResponse.json({
      ok: true,
      embeddable: false,
      reason: "host-not-allowed",
      url: url.toString(),
    });
  }

  try {
    const res = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent": "DemoAgriculturaMendoza/1.0",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(8000),
    });

    const xfo = (res.headers.get("x-frame-options") || "").toLowerCase();
    const csp = (res.headers.get("content-security-policy") || "").toLowerCase();
    const frameAncestors = /frame-ancestors\s+([^;]+)/.exec(csp)?.[1]?.trim() ?? "";

    let embeddable = true;
    let reason = "ok";

    if (xfo.includes("deny") || xfo.includes("sameorigin")) {
      embeddable = false;
      reason = `x-frame-options:${xfo}`;
    } else if (res.status === 401 || res.status === 403) {
      // Auth walls often break iframes even without explicit frame headers.
      embeddable = false;
      reason = `http-${res.status}`;
    } else if (frameAncestors) {
      if (frameAncestors.includes("'none'")) {
        embeddable = false;
        reason = "csp:frame-ancestors-none";
      } else if (
        !frameAncestors.includes("*") &&
        !frameAncestors.includes("localhost") &&
        !frameAncestors.includes("127.0.0.1")
      ) {
        embeddable = false;
        reason = "csp:frame-ancestors-restricted";
      }
    }

    return NextResponse.json({
      ok: true,
      embeddable,
      reason,
      status: res.status,
      url: url.toString(),
    });
  } catch (err) {
    return NextResponse.json({
      ok: true,
      embeddable: false,
      reason: "fetch-failed",
      error: err instanceof Error ? err.message : "unknown",
      url: url.toString(),
    });
  }
}
