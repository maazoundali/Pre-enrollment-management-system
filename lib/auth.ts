// lib/auth.ts
// JWT utilities using `jose` — edge-runtime compatible (works in middleware)

import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"
import { Role } from "@prisma/client"

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)
const COOKIE_NAME = "auth_token"

// ── Types ──────────────────────────────────────────────────────────────────────

export interface JWTPayload {
  id: string
  email: string
  role: Role
}

// ── Token operations ───────────────────────────────────────────────────────────

export async function signToken(payload: JWTPayload): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

// ── Server-side session (use inside route handlers & server components) ─────────

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

// ── Cookie helpers (returned from route handlers) ──────────────────────────────

export function buildAuthCookie(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  }
}

export function buildClearCookie() {
  return {
    name: COOKIE_NAME,
    value: "",
    maxAge: 0,
    path: "/",
  }
}