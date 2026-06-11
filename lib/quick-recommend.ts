// lib/quick-recommend.ts — client-side real-time recommendation engine
// Simplified version of the server-side rule engine, runs in the browser.

export interface QuickRec {
  filiereId:  string
  nom:        string
  matchScore: number
  label:      "EXCELLENT" | "BON" | "POSSIBLE"
}

// Eligible categories per niveau (matches the `categorie` field on Filiere)
export const ELIGIBLE_CATEGORIES: Record<string, string[]> = {
  BACCALAUREAT: ["preparatoire", "licence", "architecture"],
  LICENCE_1:    ["licence"],
  LICENCE_2:    ["licence"],
  LICENCE_3:    ["licence", "ingenierie", "master"],
  MASTER_1:     ["master"],
  MASTER_2:     ["master"],
  DOCTORAT:     ["*"],
  AUTRE:        ["*"],
}

// Keyword fallback for programs without an explicit categorie
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  preparatoire: ["préparatoire", "preparatoire"],
  ingenierie:   ["génie", "genie", "ingénieur", "ingenieur"],
  licence:      ["licence"],
  master:       ["master"],
  architecture: ["architecture"],
}

// Which filière keywords are eligible per niveau (legacy keyword fallback)
const ELIGIBLE_PATTERNS: Record<string, string[]> = {
  BACCALAUREAT: ["préparatoire", "preparatoire", "licence", "architecture"],
  LICENCE_1:    ["licence"],
  LICENCE_2:    ["licence"],
  LICENCE_3:    ["licence", "master", "génie", "genie", "ingénieur", "ingenieur"],
  MASTER_1:     ["master"],
  MASTER_2:     ["master"],
  DOCTORAT:     ["*"],
  AUTRE:        ["*"],
}

export function isEligibleFiliere(
  filiereCategorie: string | null | undefined,
  filiereNom: string,
  niveauEtude: string,
): boolean {
  const allowed = ELIGIBLE_CATEGORIES[niveauEtude] ?? ["*"]
  if (allowed.includes("*")) return true

  // Use explicit categorie if set
  if (filiereCategorie && CATEGORY_KEYWORDS[filiereCategorie]) {
    return allowed.includes(filiereCategorie)
  }

  // Keyword fallback
  const patterns = ELIGIBLE_PATTERNS[niveauEtude] ?? ["*"]
  if (patterns.includes("*")) return true
  const lower = filiereNom.toLowerCase()
  return patterns.some((p) => lower.includes(p))
}

function isEligible(nom: string, niveauEtude: string): boolean {
  return isEligibleFiliere(null, nom, niveauEtude)
}

function computeBaseScore(grades: Record<string, number | string>): number {
  const parse = (v: number | string | undefined) => {
    const n = typeof v === "number" ? v : parseFloat(String(v ?? ""))
    return isNaN(n) ? null : n
  }
  const math  = parse(grades["math"])
  const phys  = parse(grades["physique"])
  const avg   = parse(grades["moyenneGenerale"] ?? grades["moyenne"])

  if (math === null && phys === null && avg === null) return 55 // no grades yet

  let score = 50
  if (math !== null && phys !== null) {
    if      (math >= 14 && phys >= 14) score = 78
    else if (math >= 12 && phys >= 11) score = 62
    else if (math < 10 || phys < 10)   score = 40
    if (math < 8 && phys < 8)          score = 25
  }
  if (avg !== null) {
    if      (avg >= 14) score += 8
    else if (avg >= 11) score += 3
    else if (avg < 10)  score -= 10
  }
  return Math.max(0, Math.min(100, score))
}

function filiereMult(nom: string): number {
  const lower = nom.toLowerCase()
  if (lower.includes("informatique"))   return 1.22
  if (lower.includes("data"))           return 1.20
  if (lower.includes("génie") || lower.includes("genie")) return 1.18
  if (lower.includes("télécom") || lower.includes("telecom")) return 1.15
  if (lower.includes("industriel"))     return 1.12
  if (lower.includes("civil"))          return 1.10
  if (lower.includes("mécanique") || lower.includes("mecanique")) return 1.08
  if (lower.includes("préparatoire") || lower.includes("preparatoire")) return 1.05
  return 1.0
}

export function quickRecommend(
  filieres: { id: string; nom: string }[],
  grades:   Record<string, number | string>,
  niveauEtude: string,
): QuickRec[] {
  if (!niveauEtude) return []
  const base = computeBaseScore(grades)

  return filieres
    .filter((f) => isEligible(f.nom, niveauEtude))
    .map((f) => {
      const score = Math.min(100, base * filiereMult(f.nom))
      const label: QuickRec["label"] =
        score >= 74 ? "EXCELLENT" : score >= 58 ? "BON" : "POSSIBLE"
      return { filiereId: f.id, nom: f.nom, matchScore: score, label }
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5)
}
