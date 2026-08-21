import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/index.js";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_BUCKET_CAP = 10_000;

const rateLimitHits = new Map<string, { count: number; resetAt: number }>();

function clientKey(req: Request): string {
  return req.socket.remoteAddress ?? "unknown";
}

function secretsEqual(presented: string, expected: string): boolean {
  const presentedBuf = Buffer.from(presented);
  const expectedBuf = Buffer.from(expected);

  if (presentedBuf.length !== expectedBuf.length) {
    timingSafeEqual(expectedBuf, expectedBuf);
    return false;
  }

  return timingSafeEqual(presentedBuf, expectedBuf);
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const allowAny = env.CORS_ORIGIN === "*";
  const allowed = env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const requestOrigin = req.headers.origin;

  if (allowAny) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (requestOrigin && allowed.includes(requestOrigin)) {
    res.setHeader("Access-Control-Allow-Origin", requestOrigin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-API-Key"
  );

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
}

export function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const now = Date.now();
  const key = clientKey(req);
  let bucket = rateLimitHits.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitHits.set(key, bucket);
  }

  bucket.count += 1;

  if (rateLimitHits.size > RATE_LIMIT_BUCKET_CAP) {
    for (const [ip, entry] of rateLimitHits) {
      if (now >= entry.resetAt) {
        rateLimitHits.delete(ip);
      }
    }
  }

  if (bucket.count > RATE_LIMIT_MAX) {
    res.status(429).json({ error: "Too many requests" });
    return;
  }

  next();
}

export function apiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!env.apiKey || req.path === "/health" || req.path === "/") {
    next();
    return;
  }

  const headerKey = req.header("x-api-key");
  const bearer = req.header("authorization");
  const bearerKey = bearer?.toLowerCase().startsWith("bearer ")
    ? bearer.slice(7).trim()
    : undefined;
  const queryKey =
    req.path === "/trades/stream" && typeof req.query.apiKey === "string"
      ? req.query.apiKey
      : undefined;
  const presented = headerKey?.trim() || bearerKey || queryKey?.trim();

  if (!presented || !secretsEqual(presented, env.apiKey)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}
