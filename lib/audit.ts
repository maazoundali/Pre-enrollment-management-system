// lib/audit.ts — write immutable audit log entries

import { prisma } from "@/lib/prisma"

export type AuditAction =
  | "STATUT_CHANGE"
  | "ANALYSE_RUN"
  | "NOTE_ADDED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_VERIFIED"
  | "ADMIN_EDIT"

export async function logAudit(
  auteurId: string,
  dossierId: string,
  action: AuditAction,
  details?: Record<string, unknown>
) {
  try {
    await prisma.auditLog.create({
      data: { auteurId, dossierId, action, details: (details ?? {}) as object },
    })
  } catch (err) {
    // Audit failure must never block the main operation
    console.error("[audit]", action, err)
  }
}
