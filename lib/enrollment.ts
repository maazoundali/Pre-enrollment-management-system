// lib/enrollment.ts — enrollment period helpers (now driven by AnneeAcademique)

import type { AnneeAcademique } from "@prisma/client"

export interface EnrollmentStatus {
  isOpen:     boolean
  notYetOpen: boolean
  closed:     boolean
  daysLeft:   number | null   // null = no closing date
  debut:      Date | null
  fin:        Date | null
}

/**
 * Compute enrollment state from an AnneeAcademique record.
 * Rules:
 *   - Archived → always closed.
 *   - dateOuverture null → no "not yet open" check.
 *   - dateFermeture null → no closing date (open indefinitely while active).
 */
export function computeEnrollment(annee: AnneeAcademique): EnrollmentStatus {
  const now = new Date()
  const debut = annee.dateOuverture ?? null
  const fin   = annee.dateFermeture ?? null

  if (annee.archivee) {
    return { isOpen: false, notYetOpen: false, closed: true, daysLeft: null, debut, fin }
  }

  const notYetOpen = debut !== null && now < debut
  const closed     = fin   !== null && now > fin
  const isOpen     = !notYetOpen && !closed

  const daysLeft = (fin && isOpen)
    ? Math.ceil((fin.getTime() - now.getTime()) / 86_400_000)
    : null

  return { isOpen, notYetOpen, closed, daysLeft, debut, fin }
}
