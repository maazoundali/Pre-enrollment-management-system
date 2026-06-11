// app/api/notifications/[id]/read/route.ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"

type Params = { params: Promise<{ id: string }> }

// ── PATCH /api/notifications/:id/read ─────────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const notification = await prisma.notification.findUnique({ where: { id } })

  if (!notification || notification.destinataireId !== session.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const updated = await prisma.notification.update({
    where: { id },
    data:  { lu: true },
  })

  return NextResponse.json({ notification: updated })
}

// ── DELETE /api/notifications/:id/read  (mark all read shortcut) ──────────────
// POST to /api/notifications/read-all  to mark everything read at once