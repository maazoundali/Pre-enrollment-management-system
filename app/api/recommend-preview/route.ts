// app/api/recommend-preview/route.ts
// Real-time recommendation engine — rule-based, /20 scoring.
//
// Design principles:
//   • Hard eligibility filter (ineligible programs never shown)
//   • Never block within eligible set — only penalise
//   • Weighted subject scoring with confidence tracking
//   • Per-program thresholds (not one-size-fits-all)
//   • BAC series alignment matrix
//   • Niveau d'étude soft adjustments
//   • Trend analysis across multiple diplomas
//   • "Insufficient data" state when fewer than 2 key grades are present

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/auth"
import { isEligibleFiliere } from "@/lib/quick-recommend"

// ── Public types ───────────────────────────────────────────────────────────────

export interface PreviewRec {
  filiereId:   string
  nom:         string
  score:       number                                    // /20, 1 decimal
  riskLevel:   "SAFE" | "MODERATE" | "RISKY"
  confidence:  "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT"
  strengths:   string[]
  weaknesses:  string[]
}

interface DiploInput {
  type:     string
  sousType: string
  champs:   Record<string, unknown>
}

// ── Grade helpers ──────────────────────────────────────────────────────────────

function pg(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""))
  return isNaN(n) ? null : Math.max(0, Math.min(20, n))
}
function g(grades: Record<string, unknown>, key: string): number | null {
  return pg(grades[key])
}

const SL: Record<string, string> = {
  math: "Mathématiques", physique: "Physique", informatique: "Informatique",
  svt: "SVT / Sciences naturelles", francais: "Français", arabe: "Arabe",
  anglais: "Anglais", histoire_geo: "Histoire-Géographie",
  techno: "Technologie", economie: "Économie", gestion: "Gestion",
  philosophie: "Philosophie", moyenneGenerale: "Moyenne générale",
}
const BL: Record<string, string> = {
  SCIENTIFIQUE: "Bac Sciences", MATHS_INFO: "Bac Maths-Info",
  TECHNIQUE: "Bac Technique", LETTRES: "Bac Lettres",
  ECONOMIE: "Bac Économie & Gestion", SPORT: "Bac Sport",
}

// ── Program profiles ───────────────────────────────────────────────────────────
//
// weights:        subject → share of final score (sum = 1.0)
// keySubjects:    subjects that trigger threshold-based adjustments
// minCoverage:    fraction of weights that must have grades for HIGH confidence
// thresholds:     grade bands per key subject → adjustment value (applied to base)
// bacMatrix:      BAC series → adjustment (positive = boost, negative = penalty)
// niveauMatrix:   niveau d'étude → adjustment

interface Profile {
  id:           string
  keywords:     string[]
  weights:      Record<string, number>
  keySubjects:  string[]
  minCoverage:  number
  thresholds:   Record<string, [number, number][]>  // [[grade_min, adj], …] ordered high→low
  bacMatrix:    Record<string, number>
  niveauMatrix: Record<string, number>
}

const PROFILES: Profile[] = [

  // ── Cycle Préparatoire ────────────────────────────────────────────────────
  // Most selective: Maths + Physique are eliminatory. Needs ≥14 in both to be competitive.
  {
    id: "preparatoire",
    keywords: ["préparatoire", "preparatoire"],
    weights: { math: 0.50, physique: 0.35, informatique: 0.08, anglais: 0.07 },
    keySubjects: ["math", "physique"],
    minCoverage: 0.50,
    thresholds: {
      math:     [[18,+2.0],[16,+1.2],[14,+0.5],[12,0],[10,-1.5],[8,-3.5],[0,-6.0]],
      physique: [[17,+1.5],[15,+0.8],[13,+0.3],[11,0],[9,-1.8],[7,-4.0],[0,-6.5]],
    },
    bacMatrix: {
      SCIENTIFIQUE: +0.8, MATHS_INFO: +1.2, TECHNIQUE: -1.5,
      LETTRES: -6.0, ECONOMIE: -5.0, SPORT: -6.0,
    },
    niveauMatrix: {
      BACCALAUREAT: 0, LICENCE_1: -3, LICENCE_2: -4, LICENCE_3: -5,
      MASTER_1: -6, MASTER_2: -6, DOCTORAT: -6,
    },
  },

  // ── Génie Informatique ────────────────────────────────────────────────────
  // Info is primary; Math is essential; Physique secondary but still matters.
  {
    id: "genie_info",
    keywords: ["génie informatique", "génie info"],
    weights: { informatique: 0.38, math: 0.35, physique: 0.17, anglais: 0.10 },
    keySubjects: ["informatique", "math", "physique"],
    minCoverage: 0.45,
    thresholds: {
      informatique: [[17,+1.8],[15,+1.0],[13,+0.3],[11,0],[9,-1.5],[7,-3.5],[0,-5.5]],
      math:         [[16,+1.2],[14,+0.6],[12,+0.1],[10,0],[8,-1.2],[6,-3.0],[0,-5.0]],
      physique:     [[15,+0.6],[13,+0.2],[10,0],[8,-0.8],[6,-1.8],[0,-3.0]],
    },
    bacMatrix: {
      SCIENTIFIQUE: +0.5, MATHS_INFO: +1.5, TECHNIQUE: -0.5,
      LETTRES: -4.5, ECONOMIE: -3.0, SPORT: -4.0,
    },
    niveauMatrix: {
      BACCALAUREAT: +0.3, LICENCE_1: -0.5, LICENCE_2: -1.0, LICENCE_3: -1.5,
      MASTER_1: -3, MASTER_2: -4,
    },
  },

  // ── Génie des Télécommunications ─────────────────────────────────────────
  // Maths and Physique equally important. Info also significant.
  {
    id: "genie_telecom",
    keywords: ["télécommunication", "telecom", "télécoms"],
    weights: { math: 0.38, physique: 0.38, informatique: 0.14, anglais: 0.10 },
    keySubjects: ["math", "physique"],
    minCoverage: 0.50,
    thresholds: {
      math:     [[16,+1.4],[14,+0.7],[12,+0.1],[10,0],[8,-1.5],[6,-3.5],[0,-5.5]],
      physique: [[16,+1.4],[14,+0.7],[12,+0.1],[10,0],[8,-1.8],[6,-3.8],[0,-6.0]],
    },
    bacMatrix: {
      SCIENTIFIQUE: +0.6, MATHS_INFO: +1.0, TECHNIQUE: -0.3,
      LETTRES: -5.0, ECONOMIE: -3.5, SPORT: -4.5,
    },
    niveauMatrix: {
      BACCALAUREAT: +0.2, LICENCE_1: -0.5, LICENCE_2: -1.0, LICENCE_3: -1.5,
      MASTER_1: -3, MASTER_2: -4,
    },
  },

  // ── Génie Civil ──────────────────────────────────────────────────────────
  // Maths + Physique dominate. SVT/Sciences is relevant for materials.
  {
    id: "genie_civil",
    keywords: ["génie civil"],
    weights: { math: 0.44, physique: 0.40, svt: 0.08, anglais: 0.08 },
    keySubjects: ["math", "physique"],
    minCoverage: 0.50,
    thresholds: {
      math:     [[16,+1.5],[14,+0.7],[12,+0.1],[10,0],[8,-1.5],[6,-3.5],[0,-5.5]],
      physique: [[16,+1.5],[14,+0.7],[12,+0.1],[10,0],[8,-1.8],[6,-4.0],[0,-6.0]],
    },
    bacMatrix: {
      SCIENTIFIQUE: +0.8, MATHS_INFO: +0.3, TECHNIQUE: +0.5,
      LETTRES: -5.0, ECONOMIE: -3.5, SPORT: -4.0,
    },
    niveauMatrix: {
      BACCALAUREAT: +0.2, LICENCE_1: -0.5, LICENCE_2: -1.0, LICENCE_3: -1.5,
      MASTER_1: -3, MASTER_2: -4,
    },
  },

  // ── Génie Mécanique ──────────────────────────────────────────────────────
  // Math + Physique dominant. Bac Technique is an asset.
  {
    id: "genie_mecanique",
    keywords: ["génie mécanique", "mecanique"],
    weights: { math: 0.44, physique: 0.40, techno: 0.08, anglais: 0.08 },
    keySubjects: ["math", "physique"],
    minCoverage: 0.50,
    thresholds: {
      math:     [[16,+1.4],[14,+0.6],[12,+0.1],[10,0],[8,-1.5],[6,-3.5],[0,-5.5]],
      physique: [[16,+1.6],[14,+0.8],[12,+0.1],[10,0],[8,-1.8],[6,-4.0],[0,-6.0]],
    },
    bacMatrix: {
      SCIENTIFIQUE: +0.5, MATHS_INFO: +0.2, TECHNIQUE: +1.2,
      LETTRES: -5.0, ECONOMIE: -3.5, SPORT: -4.0,
    },
    niveauMatrix: {
      BACCALAUREAT: +0.2, LICENCE_1: -0.5, LICENCE_2: -1.0, LICENCE_3: -1.5,
      MASTER_1: -3, MASTER_2: -4,
    },
  },

  // ── Génie des Procédés ───────────────────────────────────────────────────
  // Math + Physique + SVT all matter. Closest to chemistry/life sciences.
  {
    id: "genie_procedes",
    keywords: ["procédés", "procedes"],
    weights: { math: 0.34, physique: 0.30, svt: 0.26, anglais: 0.10 },
    keySubjects: ["math", "physique", "svt"],
    minCoverage: 0.40,
    thresholds: {
      math:     [[15,+1.2],[13,+0.5],[11,0],[9,-1.2],[7,-3.0],[0,-5.0]],
      physique: [[15,+1.2],[13,+0.5],[11,0],[9,-1.5],[7,-3.5],[0,-5.5]],
      svt:      [[15,+1.5],[13,+0.7],[11,+0.1],[9,-0.8],[7,-2.0],[0,-4.0]],
    },
    bacMatrix: {
      SCIENTIFIQUE: +1.0, MATHS_INFO: -0.5, TECHNIQUE: -0.5,
      LETTRES: -4.5, ECONOMIE: -3.5, SPORT: -3.5,
    },
    niveauMatrix: {
      BACCALAUREAT: +0.3, LICENCE_1: -0.5, LICENCE_2: -1.0, LICENCE_3: -1.5,
      MASTER_1: -3, MASTER_2: -4,
    },
  },

  // ── Génie Industriel — Management des Systèmes ───────────────────────────
  // Most accessible engineering. Mix of technical + management skills.
  {
    id: "genie_industriel",
    keywords: ["génie industriel", "industriel", "management des systèmes"],
    weights: { math: 0.25, physique: 0.20, informatique: 0.15, gestion: 0.25, anglais: 0.15 },
    keySubjects: ["math", "gestion"],
    minCoverage: 0.30,
    thresholds: {
      math:    [[15,+1.0],[13,+0.4],[11,0],[9,-0.8],[7,-2.0],[0,-3.5]],
      gestion: [[15,+1.2],[13,+0.6],[11,0.1],[9,-0.5],[7,-1.5],[0,-3.0]],
    },
    bacMatrix: {
      SCIENTIFIQUE: +0.3, MATHS_INFO: +0.2, TECHNIQUE: +0.5,
      LETTRES: -2.0, ECONOMIE: +1.0, SPORT: -1.5,
    },
    niveauMatrix: {
      BACCALAUREAT: +0.5, LICENCE_1: -0.3, LICENCE_2: -0.8, LICENCE_3: -1.5,
      MASTER_1: -3, MASTER_2: -4,
    },
  },

  // ── Architecture ─────────────────────────────────────────────────────────
  // Balanced: spatial/creative, history of art, French important. Math moderate.
  {
    id: "architecture",
    keywords: ["architecture"],
    weights: { math: 0.22, physique: 0.15, francais: 0.22, histoire_geo: 0.18, moyenneGenerale: 0.23 },
    keySubjects: ["math", "francais"],
    minCoverage: 0.30,
    thresholds: {
      math:    [[15,+0.8],[13,+0.3],[11,0],[9,-0.7],[7,-1.8],[0,-3.0]],
      francais:[[15,+1.2],[13,+0.5],[11,0],[9,-0.6],[7,-1.5],[0,-2.5]],
    },
    bacMatrix: {
      SCIENTIFIQUE: +0.3, MATHS_INFO: -0.5, TECHNIQUE: 0,
      LETTRES: +1.2, ECONOMIE: -0.5, SPORT: -1.0,
    },
    niveauMatrix: {
      BACCALAUREAT: +0.5, LICENCE_1: -0.3, LICENCE_2: -0.8, LICENCE_3: -1.5,
      MASTER_1: -3, MASTER_2: -4,
    },
  },

  // ── Licence Informatique — Génie Logiciel et SI ──────────────────────────
  // More accessible than Génie Informatique but same subject mix.
  {
    id: "licence_info",
    keywords: ["licence informatique", "licence en informatique", "génie logiciel", "systèmes d'information"],
    weights: { informatique: 0.36, math: 0.32, physique: 0.18, anglais: 0.14 },
    keySubjects: ["informatique", "math"],
    minCoverage: 0.40,
    thresholds: {
      informatique: [[16,+1.5],[14,+0.7],[12,+0.1],[10,0],[8,-1.0],[6,-2.5],[0,-4.0]],
      math:         [[15,+1.0],[13,+0.4],[11,0],[9,-0.8],[7,-2.0],[0,-3.5]],
    },
    bacMatrix: {
      SCIENTIFIQUE: +0.4, MATHS_INFO: +1.2, TECHNIQUE: -0.3,
      LETTRES: -3.5, ECONOMIE: -2.0, SPORT: -3.0,
    },
    niveauMatrix: {
      BACCALAUREAT: +0.5, LICENCE_1: -0.3, LICENCE_2: -0.8, LICENCE_3: -1.5,
      MASTER_1: -3, MASTER_2: -4,
    },
  },

  // ── Licence Génie Industriel — Management des SI ─────────────────────────
  // Most management-oriented. Bac Économie can be an advantage.
  {
    id: "licence_industriel",
    keywords: ["licence génie industriel", "management des systèmes industriels", "systèmes industriels"],
    weights: { math: 0.20, physique: 0.15, gestion: 0.30, economie: 0.20, anglais: 0.15 },
    keySubjects: ["gestion", "math"],
    minCoverage: 0.25,
    thresholds: {
      gestion: [[16,+1.5],[14,+0.8],[12,+0.2],[10,0],[8,-0.5],[6,-1.5],[0,-2.5]],
      math:    [[14,+0.7],[12,+0.2],[10,0],[8,-0.5],[6,-1.2],[0,-2.0]],
    },
    bacMatrix: {
      SCIENTIFIQUE: +0.2, MATHS_INFO: 0, TECHNIQUE: +0.3,
      LETTRES: -1.5, ECONOMIE: +1.5, SPORT: -1.0,
    },
    niveauMatrix: {
      BACCALAUREAT: +0.5, LICENCE_1: -0.2, LICENCE_2: -0.5, LICENCE_3: -1.0,
      MASTER_1: -3, MASTER_2: -4,
    },
  },

  // ── Master Industrie V4.0 ─────────────────────────────────────────────────
  // Post-Licence only. Average performance + industry knowledge.
  {
    id: "master",
    keywords: ["master", "industrie v4", "industrie 4.0"],
    weights: { moyenneGenerale: 0.55, math: 0.22, informatique: 0.13, anglais: 0.10 },
    keySubjects: ["moyenneGenerale"],
    minCoverage: 0.30,
    thresholds: {
      moyenneGenerale: [[16,+1.8],[14,+0.8],[12,+0.1],[10,0],[8,-1.5],[0,-3.5]],
    },
    bacMatrix: {
      SCIENTIFIQUE: 0, MATHS_INFO: +0.2, TECHNIQUE: -0.3,
      LETTRES: -2.0, ECONOMIE: -0.5, SPORT: -1.5,
    },
    niveauMatrix: {
      BACCALAUREAT: -6, LICENCE_1: -5, LICENCE_2: -4, LICENCE_3: +1.0,
      MASTER_1: +0.5, MASTER_2: 0, DOCTORAT: -1,
    },
  },
]

// Fallback for unmatched programs
const DEFAULT_PROFILE: Profile = {
  id: "default", keywords: [],
  weights: { moyenneGenerale: 0.55, math: 0.28, francais: 0.10, arabe: 0.07 },
  keySubjects: ["moyenneGenerale"],
  minCoverage: 0.30,
  thresholds: {
    moyenneGenerale: [[16,+1.2],[14,+0.5],[12,0],[10,-0.5],[8,-1.5],[0,-3.0]],
  },
  bacMatrix: {},
  niveauMatrix: {
    BACCALAUREAT: +0.2, LICENCE_1: 0, LICENCE_2: -0.3, LICENCE_3: -0.8,
    MASTER_1: -2, MASTER_2: -3,
  },
}

function getProfile(nom: string): Profile {
  const lower = nom.toLowerCase()
  // Match most specific first (longer keywords win)
  const sorted = [...PROFILES].sort((a, b) =>
    Math.max(...b.keywords.map((k) => k.length)) - Math.max(...a.keywords.map((k) => k.length))
  )
  for (const p of sorted) {
    if (p.keywords.some((kw) => lower.includes(kw))) return p
  }
  return DEFAULT_PROFILE
}

// ── Threshold lookup ───────────────────────────────────────────────────────────
// thresholds: [[grade_min, adj], …] ordered highest-grade first
function getThresholdAdj(value: number, bands: [number, number][]): number {
  for (const [min, adj] of bands) {
    if (value >= min) return adj
  }
  return bands[bands.length - 1]?.[1] ?? 0
}

// ── Core scoring ───────────────────────────────────────────────────────────────

function computeScore(
  profile: Profile,
  grades: Record<string, unknown>,
  bacSousType: string | null,
  diplomes: DiploInput[],
  niveau: string,
): { score: number; confidence: PreviewRec["confidence"]; strengths: string[]; weaknesses: string[] } {

  const strengths:  string[] = []
  const weaknesses: string[] = []

  // ── 1. Weighted base score + coverage ──────────────────────────────────────

  let weightedSum  = 0
  let coveredWeight = 0
  for (const [subj, weight] of Object.entries(profile.weights)) {
    const grade = g(grades, subj)
    if (grade !== null) {
      weightedSum   += grade * weight
      coveredWeight += weight
    }
  }

  const coverage = coveredWeight  // fraction of total weight (0–1)
  const confidence: PreviewRec["confidence"] =
    coverage >= 0.70 ? "HIGH"
    : coverage >= 0.40 ? "MEDIUM"
    : coverage >= 0.20 ? "LOW"
    : "INSUFFICIENT"

  // Normalised base: weighted average of available grades
  let base = coveredWeight > 0 ? weightedSum / coveredWeight : 10.0

  // ── 2. Per-subject threshold adjustments ──────────────────────────────────

  for (const subj of profile.keySubjects) {
    const grade = g(grades, subj)
    if (grade === null) continue
    const label = SL[subj] ?? subj
    const bands = profile.thresholds[subj]
    if (!bands) continue

    const adj = getThresholdAdj(grade, bands)
    base += adj

    if (adj >= 1.0)       strengths.push(`Excellente note en ${label} (${grade}/20)`)
    else if (adj >= 0.3)  strengths.push(`Bonne note en ${label} (${grade}/20)`)
    else if (adj <= -3.0) weaknesses.push(`Note très insuffisante en ${label} (${grade}/20) — matière éliminatoire`)
    else if (adj <= -1.2) weaknesses.push(`Note faible en ${label} (${grade}/20) — matière clé pour ce programme`)
    else if (adj <= -0.5) weaknesses.push(`${label} en-dessous du niveau attendu (${grade}/20)`)
  }

  // ── 3. BAC series alignment ───────────────────────────────────────────────

  if (bacSousType) {
    const bacAdj = profile.bacMatrix[bacSousType] ?? 0
    base += bacAdj
    const bacLabel = BL[bacSousType] ?? bacSousType
    if (bacAdj >= 1.0)       strengths.push(`${bacLabel} particulièrement adapté à ce programme`)
    else if (bacAdj >= 0.3)  strengths.push(`${bacLabel} bien aligné avec ce programme`)
    else if (bacAdj <= -4.0) weaknesses.push(`${bacLabel} très peu aligné — pénalité significative (${Math.abs(bacAdj).toFixed(1)} pts)`)
    else if (bacAdj <= -2.0) weaknesses.push(`${bacLabel} moins adapté à ce programme (${Math.abs(bacAdj).toFixed(1)} pts)`)
    else if (bacAdj <= -0.5) weaknesses.push(`${bacLabel} légèrement désaligné avec ce programme`)
  }

  // ── 4. Niveau d'étude adjustment ──────────────────────────────────────────

  const niveauAdj = profile.niveauMatrix[niveau] ?? 0
  base += niveauAdj
  if (niveauAdj <= -4) {
    weaknesses.push("Niveau académique insuffisant pour ce programme — fort déclassement")
  } else if (niveauAdj <= -2) {
    weaknesses.push("Ce programme est généralement accessible à un niveau supérieur")
  } else if (niveauAdj >= 1.0) {
    strengths.push("Niveau académique bien adapté à ce programme")
  }

  // ── 5. Overall average bonus/penalty ─────────────────────────────────────

  const avg = g(grades, "moyenneGenerale") ?? g(grades, "moyenne")
  if (avg !== null) {
    if      (avg >= 17) { base += 1.2; strengths.push(`Moyenne générale exceptionnelle (${avg}/20)`) }
    else if (avg >= 15) { base += 0.7; strengths.push(`Excellente moyenne générale (${avg}/20)`) }
    else if (avg >= 13) { base += 0.3; strengths.push(`Bonne moyenne générale (${avg}/20)`) }
    else if (avg < 10)  { base -= 1.5; weaknesses.push(`Moyenne générale faible (${avg}/20) — impacte l'ensemble des recommandations`) }
    else if (avg < 12)  { base -= 0.5 }
  }

  // ── 6. Best-subject alignment bonus ──────────────────────────────────────

  const allEntries = Object.entries(grades)
    .map(([k, v]) => ({ k, v: pg(v) }))
    .filter((e): e is { k: string; v: number } => e.v !== null)
    .sort((a, b) => b.v - a.v)

  if (allEntries.length > 0) {
    const best = allEntries[0]
    if (profile.keySubjects.includes(best.k) && best.v >= 15) {
      base += 0.6
      strengths.push(`Meilleure matière = ${SL[best.k] ?? best.k} (${best.v}/20) — point fort aligné`)
    }
    // Worst subject check: if the worst grade is a key subject with a terrible score
    const worst = allEntries[allEntries.length - 1]
    if (profile.keySubjects.includes(worst.k) && worst.v < 7 && allEntries.length >= 3) {
      weaknesses.push(`${SL[worst.k] ?? worst.k} est la matière la plus faible (${worst.v}/20) — critique pour ce programme`)
    }
  }

  // ── 7. Synergy check: for programs needing 2 key subjects to both be strong ─

  if (["preparatoire","genie_info","genie_telecom","genie_civil","genie_mecanique"].includes(profile.id)) {
    const k1 = profile.keySubjects[0], k2 = profile.keySubjects[1]
    if (k1 && k2) {
      const g1 = g(grades, k1), g2 = g(grades, k2)
      if (g1 !== null && g2 !== null && g1 >= 14 && g2 >= 14) {
        base += 0.8
        strengths.push(`Double excellence en ${SL[k1]?.split(" ")[0] ?? k1} et ${SL[k2]?.split(" ")[0] ?? k2} — profil scientifique fort`)
      }
      if (g1 !== null && g2 !== null && g1 < 9 && g2 < 9) {
        base -= 1.5
        weaknesses.push(`Les deux matières fondamentales sont en-dessous du seuil minimum`)
      }
    }
  }

  // ── 8. Trend analysis (multiple diplomas) ─────────────────────────────────

  if (diplomes.length >= 2) {
    const recent = diplomes[0].champs
    const prev   = diplomes[diplomes.length - 1].champs
    const improving: string[] = []
    const declining: string[] = []
    for (const subj of profile.keySubjects) {
      const r = pg(recent[subj]), p = pg(prev[subj])
      if (r !== null && p !== null) {
        const delta = r - p
        if (delta >= 2)       improving.push(`${SL[subj] ?? subj} (+${delta.toFixed(1)})`)
        else if (delta <= -2) declining.push(`${SL[subj] ?? subj} (${delta.toFixed(1)})`)
      }
    }
    if (improving.length > 0) { base += 0.5; strengths.push(`Progression sur ${improving.join(", ")}`) }
    if (declining.length > 0) { base -= 0.5; weaknesses.push(`Régression sur ${declining.join(", ")}`) }
  }

  // ── 9. Clamp and finalise ─────────────────────────────────────────────────

  const score = parseFloat(Math.max(0, Math.min(20, base)).toFixed(1))

  // Generic messages when nothing specific was generated
  if (strengths.length === 0) {
    if (score >= 13)     strengths.push("Profil globalement adapté aux exigences du programme")
    else if (score >= 10) strengths.push("Profil acceptable, des lacunes pourraient être comblées")
  }
  if (weaknesses.length === 0 && score < 9) {
    weaknesses.push("Profil peu aligné avec les exigences de ce programme")
  }
  if (confidence === "INSUFFICIENT") {
    weaknesses.unshift("Données insuffisantes — renseignez au moins 2 matières clés pour une estimation fiable")
  }

  return { score, confidence, strengths, weaknesses }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await req.json() as {
      niveauEtude: string
      grades:      Record<string, unknown>
      diplomes?:   DiploInput[]
    }
    const { niveauEtude, grades, diplomes = [] } = body

    if (!niveauEtude) return NextResponse.json({ recommendations: [] })

    const bacEntry    = diplomes.find((d) => d.type === "BAC")
    const bacSousType = bacEntry?.sousType ?? null

    // Capacity is now per-year — fetch without capacite field
    const allFilieres = await prisma.filiere.findMany({
      select: { id: true, nom: true, categorie: true },
      orderBy: { nom: "asc" },
    })

    // Hard eligibility filter — ineligible programs are never recommended
    const filieres = allFilieres.filter((f) =>
      isEligibleFiliere(f.categorie, f.nom, niveauEtude)
    )

    const recs: PreviewRec[] = filieres.map((f) => {
      const profile = getProfile(f.nom)
      const { score, confidence, strengths, weaknesses } = computeScore(
        profile, grades, bacSousType, diplomes, niveauEtude
      )

      const riskLevel: PreviewRec["riskLevel"] =
        score >= 14 ? "SAFE" : score >= 10 ? "MODERATE" : "RISKY"

      return { filiereId: f.id, nom: f.nom, score, riskLevel, confidence, strengths, weaknesses }
    })

    recs.sort((a, b) => b.score - a.score)
    return NextResponse.json({ recommendations: recs.slice(0, 5) })

  } catch (err) {
    console.error("[POST /api/recommend-preview]", (err as Error).message)
    return NextResponse.json({ recommendations: [] })
  }
}
