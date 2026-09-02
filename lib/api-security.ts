import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "demo_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const buckets = new Map<string, { count: number; resetAt: number }>();

function secret() {
  const value =
    process.env.DEMO_SESSION_SECRET?.trim() ||
    process.env.DEMO_AGENT_SECRET?.trim();
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error("DEMO_SESSION_SECRET is required in production");
  }
  return value || "local-development-only";
}

function signature(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function createSessionToken(sessionId: string, now = Date.now()) {
  const expiresAt = now + SESSION_TTL_MS;
  const payload = `${sessionId}.${expiresAt}`;
  return `${payload}.${signature(payload)}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()) {
  const [sessionId, expiresRaw, sig] = String(token || "").split(".");
  const expiresAt = Number(expiresRaw);
  if (
    !/^[a-zA-Z0-9_-]{8,80}$/.test(sessionId) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now ||
    !sig
  ) {
    return null;
  }
  const payload = `${sessionId}.${expiresAt}`;
  return safeEqual(sig, signature(payload)) ? sessionId : null;
}

function requestIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "local"
  );
}

function hasExternalAgentSecret(req: NextRequest) {
  const configured = process.env.DEMO_AGENT_SECRET?.trim();
  if (!configured) return false;
  const supplied =
    req.headers.get("x-demo-secret") ||
    req.headers.get("x-demo-agent-secret") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return Boolean(supplied && safeEqual(supplied, configured));
}

function assertOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const expected = new URL(req.url).origin;
  const allowed = new Set(
    [
      expected,
      process.env.NEXT_PUBLIC_SITE_URL?.trim(),
      process.env.DEMO_ALLOWED_ORIGIN?.trim(),
    ].filter(Boolean)
  );
  const actualUrl = new URL(origin);
  const expectedUrl = new URL(expected);
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const sameLocalDevelopmentOrigin =
    process.env.NODE_ENV !== "production" &&
    loopbackHosts.has(actualUrl.hostname) &&
    loopbackHosts.has(expectedUrl.hostname) &&
    actualUrl.port === expectedUrl.port;
  if (!allowed.has(origin) && !sameLocalDevelopmentOrigin) {
    throw new ApiSecurityError(403, "Origen no permitido");
  }
}

function assertRate(req: NextRequest, limit: number, windowMs: number) {
  const now = Date.now();
  const key = `${requestIp(req)}:${new URL(req.url).pathname}`;
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
  } else if (++bucket.count > limit) {
    throw new ApiSecurityError(429, "Demasiadas solicitudes");
  }
  if (buckets.size > 2_000) {
    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
    }
  }
}

export class ApiSecurityError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function secureApiRequest(
  req: NextRequest,
  options: {
    requireSession?: boolean;
    maxBytes?: number;
    rateLimit?: number;
    windowMs?: number;
  } = {}
) {
  assertOrigin(req);
  assertRate(req, options.rateLimit ?? 60, options.windowMs ?? 60_000);

  const length = Number(req.headers.get("content-length") || 0);
  if (options.maxBytes && length > options.maxBytes) {
    throw new ApiSecurityError(413, "Solicitud demasiado grande");
  }

  if (options.requireSession && process.env.NODE_ENV !== "test") {
    const sessionId = verifySessionToken(
      req.cookies.get(COOKIE_NAME)?.value
    );
    if (!sessionId && !hasExternalAgentSecret(req)) {
      throw new ApiSecurityError(401, "Sesión inválida o vencida");
    }
    return sessionId;
  }
  return null;
}

export function sessionCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export function __resetRateLimitsForTests() {
  buckets.clear();
}
