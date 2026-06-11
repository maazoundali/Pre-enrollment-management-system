// lib/annee.ts — academic year utilities (server-side only)

import { prisma } from "@/lib/prisma"
import type { AnneeAcademique } from "@prisma/client"

/**
 * Returns the currently active academic year, or null if none exists.
 * Always read from DB — never cache; year changes are rare admin actions.
 */
export async function getActiveAnnee(): Promise<AnneeAcademique | null> {
  return prisma.anneeAcademique.findFirst({ where: { active: true } })
}

/**
 * Returns true if enrollment is open for the given year.
 * Rules:
 *   - Archived years are always closed.
 *   - If dateOuverture is set and today is before it → not yet open.
 *   - If dateFermeture is set and today is after it  → closed.
 *   - If both are null → always open (while the year is active).
 */
export function isYearOpen(annee: AnneeAcademique): boolean {
  if (annee.archivee) return false
  const now = new Date()
  if (annee.dateOuverture && now < annee.dateOuverture) return false
  if (annee.dateFermeture && now > annee.dateFermeture) return false
  return true
}

/**
 * How many days remain until enrollment closes for the given year.
 * Returns null if no closing date is set.
 */
export function daysUntilClose(annee: AnneeAcademique): number | null {
  if (!annee.dateFermeture) return null
  const diff = annee.dateFermeture.getTime() - Date.now()
  return Math.ceil(diff / 86_400_000)
}
