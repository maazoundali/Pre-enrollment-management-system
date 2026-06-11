// middleware.ts  (root of project)
// Runs on the Edge — uses jose directly (no prisma, no node APIs).
// Protects route groups by role and redirects unauthenticated users.

import { NextRequest, NextResponse } from "next/server"
import { jwtVerify } from "jose"

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!)

// Map route prefixes → allowed roles
const PROTECTED_ROUTES: Record<string, string[]> = {
  "/student":    ["ETUDIANT"],
  "/admin":      ["ADMINISTRATEUR"],
  "/supervisor": ["SUPERVISEUR"],
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Find if this path falls under a protected route group
  const match = Object.entries(PROTECTED_ROUTES).find(([prefix]) =>
    pathname.startsWith(prefix)
  )

  // Not a protected route — allow through
  if (!match) return NextResponse.next()

  const [, allowedRoles] = match
  const token = request.cookies.get("auth_token")?.value

  // No token → redirect to login
  if (!token) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Verify token
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const role = payload.role as string

    if (!allowedRoles.includes(role)) {
      // Authenticated but wrong role
      return NextResponse.redirect(new URL("/unauthorized", request.url))
    }

    // Inject user info into request headers (available in route handlers)
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("x-user-id", payload.id as string)
    requestHeaders.set("x-user-role", role)

    return NextResponse.next({ request: { headers: requestHeaders } })
  } catch {
    // Invalid / expired token — clear the cookie so the loop can't repeat
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    const response = NextResponse.redirect(loginUrl)
    response.cookies.delete("auth_token")
    return response
  }
}

export const config = {
  matcher: [
    "/student/:path*",
    "/admin/:path*",
    "/supervisor/:path*",
  ],
}