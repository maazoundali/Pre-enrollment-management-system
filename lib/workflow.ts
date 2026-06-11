// lib/workflow.ts
// State machine for dossier status transitions.
// Only allowed transitions are defined — everything else throws.

import { Statut, Role } from "@prisma/client"

// ── Transition table ───────────────────────────────────────────────────────────

const TRANSITIONS: Record<Statut, Statut[]> = {
  BROUILLON:     ["SOUMIS"],
  SOUMIS:        ["EN_ANALYSE", "REJETE"],
  EN_ANALYSE:    ["VALIDE", "REJETE"],
  VALIDE:        ["BROUILLON", "REJETE"],              // admin can revoke (frees a spot)
  REJETE:        ["SOUMIS"],                           // student can fix and resubmit
  LISTE_ATTENTE: ["EN_ANALYSE", "SOUMIS", "BROUILLON"], // promoted or withdrawn
}

// ── Role-based permission on transitions ───────────────────────────────────────

const ROLE_ALLOWED_TRANSITIONS: Record<Role, Statut[]> = {
  ETUDIANT:       ["SOUMIS"],                                          // students can only submit
  ADMINISTRATEUR: ["EN_ANALYSE", "VALIDE", "REJETE", "BROUILLON", "LISTE_ATTENTE"], // admins drive the review
  SUPERVISEUR:    [],                                                  // supervisors are read-only
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function canTransition(from: Statut, to: Statut): boolean {
  return TRANSITIONS[from].includes(to)
}

export function canRoleTransition(role: Role, to: Statut): boolean {
  return ROLE_ALLOWED_TRANSITIONS[role].includes(to)
}

export function getNextStatuts(current: Statut): Statut[] {
  return TRANSITIONS[current]
}

/**
 * Validates both the state machine transition and the actor's role.
 * Throws a descriptive error if either check fails.
 */
export function validateTransition(
  from: Statut,
  to: Statut,
  role: Role
): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid transition: ${from} → ${to}. Allowed next states: [${TRANSITIONS[from].join(", ") || "none"}]`
    )
  }
  if (!canRoleTransition(role, to)) {
    throw new Error(
      `Role ${role} is not allowed to set status to ${to}`
    )
  }
}