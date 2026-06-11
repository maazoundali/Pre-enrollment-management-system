// app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// ── GET /api/notifications ─────────────────────────────────────────────────────
// Returns the current user's notifications. ?unread=true to filter unread only.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const unreadOnly = new URL(req.url).searchParams.get("unread") === "true"

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        destinataireId: session.id,
        ...(unreadOnly ? { lu: false } : {}),
      },
      orderBy: { dateEnvoi: "desc" },
      take: 50,
    }),
    prisma.notification.count({
      where: { destinataireId: session.id, lu: false },
    }),
  ])

  return NextResponse.json({ notifications, unreadCount })
}