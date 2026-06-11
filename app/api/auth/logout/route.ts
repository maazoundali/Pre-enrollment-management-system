// app/api/auth/logout/route.ts
import { NextResponse } from "next/server"
import { buildClearCookie } from "@/lib/auth"

export async function POST() {
  const response = NextResponse.json({ message: "Logged out" })
  response.cookies.set(buildClearCookie())
  return response
}