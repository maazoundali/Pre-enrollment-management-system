// lib/notifications.ts
// Central helper to create notifications.
// Keeps all notification logic in one place — easy to swap in email/push later.

import { prisma } from "@/lib/prisma"
import { TypeNotif } from "@prisma/client"

interface CreateNotificationInput {
  destinataireId: string
  type: TypeNotif
  message: string
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      destinataireId: input.destinataireId,
      type: input.type,
      message: input.message,
    },
  })
}

/**
 * Count unread notifications for a user (used for badge counts).
 */
export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({
    where: { destinataireId: userId, lu: false },
  })
}