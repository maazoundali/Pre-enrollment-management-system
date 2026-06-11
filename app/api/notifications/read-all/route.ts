// app/api/notifications/read-all/route.ts
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

// ── POST /api/notifications/read-all ──────────────────────────────────────────
// Marks every unread notification for the current user as read in one query.
export async function POST() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { count } = await prisma.notification.updateMany({
    where: { destinataireId: session.id, lu: false },
    data:  { lu: true },
  })

  return NextResponse.json({ updated: count })
}