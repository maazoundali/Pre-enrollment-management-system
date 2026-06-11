// lib/ai/analyser.ts
// AI-powered dossier analysis using Ollama (local, free, no API key).
// Uses Mistral via the /api/chat endpoint (instruction-tuned, better results).
// Falls back to rule engine if Ollama is unreachable.
//
// Setup:
//   ollama pull mistral
//   OLLAMA_URL=http://localhost:11434
//   OLLAMA_MODEL=mistral

import { prisma } from "@/lib/prisma"
import { TypeDoc } from "@prisma/client"
import { isEligibleFiliere } from "@/lib/quick-recommend"

// PHOTO is always required; identity = CNI or PASSEPORT (student may have either)
const OLLAMA_URL   = process.env.OLLAMA_URL   ?? "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "mistral"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AnalyseResult {
  score:    number
  complet:  boolean
  manquants: TypeDoc[]
  resultat: string
  filiereRecommandations: { filiereId: string; rang: number }[]
}

// ── Human-readable label maps ─────────────────────────────────────────────────

const NIVEAU_LABELS: Record<string, string> = {
  BACCALAUREAT: "Baccalauréat (terminale)",
  LICENCE_1:    "Licence — 1ère année",
  LICENCE_2:    "Licence — 2ème année",
  LICENCE_3:    "Licence — 3ème année (diplômé)",
  MASTER_1:     "Master — 1ère année",
  MASTER_2:     "Master — 2ème année (diplômé)",
  DOCTORAT:     "Doctorat",
  AUTRE:        "Autre niveau",
}
const COURS_LABELS: Record<string, string> = {
  COURS_JOUR:         "Cours de jour (temps plein)",
  COURS_SOIR:         "Cours du soir (étudiant salarié)",
  FORMATION_CONTINUE: "Formation continue",
}

// ── Rule-based fallback ───────────────────────────────────────────────────────

function ruleBasedScore(
  manquants: TypeDoc[],
  filieres: { id: string; nom: string; _count: { dossiers: number }; capacites?: { capacite: number }[] }[]
): Omit<AnalyseResult, "manquants" | "complet"> {
  const score = Math.max(0, Math.min(100, 100 - manquants.length * 20))
  const available = filieres.filter((f) => {
    const cap = f.capacites?.[0]?.capacite ?? null
    return cap === null || f._count.dossiers < cap
  })
  const KEYWORDS: { kw: string; m: number }[] = [
    { kw: "informatique", m: 1.2 }, { kw: "génie",    m: 1.2 },
    { kw: "intelligence", m: 1.2 }, { kw: "licence",  m: 1.1 },
    { kw: "industriel",   m: 1.1 }, { kw: "civil",    m: 1.1 },
    { kw: "préparatoire", m: 1.0 }, { kw: "master",   m: 1.0 },
  ]
  const ranked = available
    .map((f) => ({ filiereId: f.id, matchScore: score * (KEYWORDS.find((k) => f.nom.toLowerCase().includes(k.kw))?.m ?? 1.0) }))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3)
    .map((f, i) => ({ filiereId: f.filiereId, rang: i + 1 }))
  return {
    score,
    resultat: manquants.length === 0
      ? `Score ${score}/100. Dossier complet.`
      : `Score ${score}/100. Documents manquants : ${manquants.join(", ")}.`,
    filiereRecommandations: ranked,
  }
}

// ── Ollama chat analysis ──────────────────────────────────────────────────────

async function ollamaAnalyse(
  dossier: {
    niveauEtude:    string | null
    typeCours:      string | null
    dernierDiplome: string | null
    anneeDiplome:   number | null
    complet:        boolean
    notes:          Record<string, number> | null
  },
  filieres: { id: string; nom: string; description: string | null; diplomeDelivre: string | null }[],
  locale: "fr" | "en" | "ar" = "fr"
): Promise<{ score: number; resultIds: string[]; resultat: string } | null> {

  const LANG_INSTRUCTION: Record<string, string> = {
    fr: "Réponds UNIQUEMENT en français.",
    en: "Respond ONLY in English. Write the justification in English.",
    ar: "أجب باللغة العربية الفصحى فقط.",
  }

  // ── Build readable context ──────────────────────────────────────────────────

  const niveau   = dossier.niveauEtude   ? (NIVEAU_LABELS[dossier.niveauEtude]  ?? dossier.niveauEtude) : "Non renseigné"
  const cours    = dossier.typeCours     ? (COURS_LABELS[dossier.typeCours]     ?? dossier.typeCours)    : "Non renseigné"
  const diplome  = dossier.dernierDiplome ? `${dossier.dernierDiplome}${dossier.anneeDiplome ? ` (${dossier.anneeDiplome})` : ""}` : "Non renseigné"
  const docs     = dossier.complet ? "Oui — dossier complet" : "Non — documents manquants (pénalité de 15 points)"

  const notesStr = dossier.notes && Object.keys(dossier.notes).length > 0
    ? Object.entries(dossier.notes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `  • ${k.replace(/_/g, " ")}: ${v}/20`)
        .join("\n")
    : "  • Aucune note fournie — plafonner le score à 55"

  const programList = filieres
    .map((f, i) => `  ${i + 1}. "${f.nom}" | Diplôme: ${f.diplomeDelivre ?? "N/A"} | ${f.description ?? ""}`)
    .join("\n")

  // ── System prompt — persona + strict rules ──────────────────────────────────

  const systemPrompt = `Tu es un système d'aide à la décision d'admission dans une université tunisienne. Tu appliques des règles strictes et non négociables pour évaluer les dossiers de candidature.

LANGUE : ${LANG_INSTRUCTION[locale] ?? LANG_INSTRUCTION.fr}


ÉTAPE 1 — ÉLIGIBILITÉ (filtre disqualifiant, applique avant tout scoring) :
• Baccalauréat → UNIQUEMENT : Cycle Préparatoire, Licences (ex. Licence Informatique, Licence Génie Industriel), Architecture.
  INTERDIT pour Bac : Génie Informatique, Génie Civil, Génie Mécanique, Génie Télécommunications, Génie des Procédés, Génie Industriel (cycle), tout Master.
• Licence 1 ou 2 → UNIQUEMENT : Licences. Interdit : Cycles Ingénieur, Master, Préparatoire.
• Licence 3 (diplômé) → Éligible : Cycles Ingénieur, Master, Licences.
• Master → Éligible : programmes Master uniquement.
Tout programme non éligible doit être EXCLU de la liste, sans exception ni justification.

ÉTAPE 2 — SCORING DES NOTES (si notes fournies) :
Calcule la moyenne pondérée maths+physique (si disponibles) :
• math ≥ 14 ET physique ≥ 14 → Profil sciences fort. Score de base : 78. Recommander prioritairement les formations scientifiques et d'ingénierie (si niveau éligible).
• math ≥ 12 ET physique ≥ 11 → Profil sciences moyen. Score de base : 62. Recommander Génie Civil, Procédés, Licences techniques.
• math < 10 OU physique < 10 → Profil sciences faible. Score de base : 40. Ne PAS recommander Cycle Préparatoire ni aucune formation d'ingénierie. Recommander Licences professionnelles uniquement.
• math < 8 ET physique < 8 → Profil très faible en sciences. Score de base : 25. Uniquement les Licences les moins exigeantes scientifiquement.
• Moyenne générale ≥ 14 → bonus +8.
• Moyenne générale entre 11 et 13 → bonus +3.
• Moyenne générale < 10 → malus -10.

ÉTAPE 3 — SCORING SANS NOTES :
• Si aucune note fournie → Score plafonné à 50. Recommander le Cycle Préparatoire (si Bac) ou les Licences les plus générales.

ÉTAPE 4 — AJUSTEMENTS :
• Documents incomplets → malus -15.
• Cours du soir → préférer Licences et Cycle Préparatoire (charge de travail réduite). Déconseiller fortement les formations Ingénierie.
• Score final : clamp entre 0 et 100.

ÉTAPE 5 — RECOMMANDATIONS :
• Recommander exactement 3 programmes, dans l'ordre de pertinence décroissante.
• Tous les programmes recommandés doivent être éligibles (étape 1).
• Les noms des programmes doivent être copiés mot pour mot depuis la liste fournie.

FORMAT : Retourner UNIQUEMENT ce JSON valide, sans texte avant ou après :
{"score": <entier 0-100>, "programs": ["<nom exact 1>", "<nom exact 2>", "<nom exact 3>"], "justification": "<2 phrases précises en français>"}`

  // ── User prompt — the actual dossier data ───────────────────────────────────

  const userPrompt = `Voici le dossier à évaluer :

NIVEAU ACADÉMIQUE : ${niveau}
DERNIER DIPLÔME : ${diplome}
TYPE DE COURS SOUHAITÉ : ${cours}
DOCUMENTS COMPLETS : ${docs}

NOTES DÉCLARÉES :
${notesStr}

PROGRAMMES DISPONIBLES :
${programList}

FORMAT DE LA JUSTIFICATION :
2 à 3 phrases naturelles et convaincantes, comme un conseiller d'orientation s'adressant directement à l'étudiant.
- Ne mentionne PAS le score ni les notes chiffrées.
- Explique POURQUOI ces programmes ont été choisis : points forts du candidat, adéquation avec le parcours, débouchés.
- Commence par les points forts du candidat, puis enchaîne sur les programmes naturellement.
- Ton encourageant, direct, personnalisé. Pas de listes, pas de puces, pas de numérotation.
- Exemple de style : "Vos résultats solides en informatique et en gestion font de la Licence Informatique un choix naturel, où vous pourrez exploiter ces atouts dès la première année. Le Cycle Préparatoire constitue une base scientifique idéale pour ceux qui visent les grandes écoles à terme. L'Architecture complète le tableau pour un profil souhaitant allier dimension technique et créativité."

Retourne UNIQUEMENT le JSON.`

  // ── Call Ollama /api/chat ───────────────────────────────────────────────────

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model:    OLLAMA_MODEL,
      stream:   false,
      options:  { temperature: 0.05, num_predict: 800, repeat_penalty: 1.1 },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt   },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  })

  if (!res.ok) {
    console.warn("[analyser] Ollama HTTP error:", res.status, res.statusText)
    return null
  }

  const data = await res.json()
  // /api/chat response is nested under message.content
  const raw = (data.message?.content as string ?? "").trim()
  console.log("[analyser] Mistral raw response:", raw.slice(0, 400))

  // Strip markdown fences
  const clean = raw.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) {
    console.warn("[analyser] No JSON found in response")
    return null
  }

  let parsed: Record<string, unknown>
  try { parsed = JSON.parse(match[0]) }
  catch { console.warn("[analyser] JSON parse failed"); return null }

  const score: number       = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 50)))
  const justification       = typeof parsed.justification === "string" ? parsed.justification.trim() : ""
  const names: unknown[]    = Array.isArray(parsed.programs) ? parsed.programs.slice(0, 3) : []

  // Resolve names → IDs with tiered matching: exact → includes → partial
  const filteredIds = names
    .map((name) => {
      if (typeof name !== "string") return null
      const n = name.toLowerCase().trim()
      return (
        filieres.find((f) => f.nom.toLowerCase().trim() === n) ??
        filieres.find((f) => f.nom.toLowerCase().includes(n) || n.includes(f.nom.toLowerCase())) ??
        filieres.find((f) => {
          const words = n.split(" ").filter((w) => w.length > 4)
          return words.some((w) => f.nom.toLowerCase().includes(w))
        })
      )?.id ?? null
    })
    .filter((id): id is string => id !== null)
    .filter((id, i, arr) => arr.indexOf(id) === i)

  // ── Server-side eligibility guard ──────────────────────────────────────────
  // Even if the model ignored the rules, enforce them here.
  const LICENCE_ONLY   = ["LICENCE_1", "LICENCE_2"]
  const niveauEtude    = dossier.niveauEtude ?? ""
  const INGENIERIE_KW  = ["génie", "ingénierie", "ingenierie"]
  const MASTER_KW      = ["master", "industrie v4"]
  const PREPA_KW       = ["préparatoire", "preparatoire"]

  // Extract key grade values for guard logic
  // dossier.notes here IS the mergedNotes passed from analyserDossier
  const guardNotes   = (dossier.notes ?? {}) as Record<string, number>
  const mathScore    = guardNotes["math"]    ?? guardNotes["mathématiques"] ?? null
  const physiqueScore= guardNotes["physique"] ?? null
  const scienceWeak  = (mathScore !== null && mathScore < 10) || (physiqueScore !== null && physiqueScore < 10)

  function isEligible(filiereId: string): boolean {
    const f = filieres.find((x) => x.id === filiereId)
    if (!f) return false
    const nom = f.nom.toLowerCase()

    // "Licence Génie Industriel" contains "génie" but is a bachelor's degree, not a Cycle Ingénieur.
    // Only flag as engineering if the name starts with "génie" or is not prefixed by "licence".
    const isLicence     = nom.startsWith("licence") || nom.includes("licence ")
    const isEngineering = !isLicence && INGENIERIE_KW.some((kw) => nom.includes(kw))
    const isMaster      = MASTER_KW.some((kw) => nom.includes(kw))
    const isPrepa       = PREPA_KW.some((kw) => nom.includes(kw))

    // Level-based hard blocks
    if (LICENCE_ONLY.includes(niveauEtude) && (isEngineering || isMaster || isPrepa)) return false
    if (niveauEtude === "BACCALAUREAT"     && (isEngineering || isMaster)) return false

    // Grade-based hard blocks — enforce what the prompt asks but model often ignores
    if (scienceWeak && (isEngineering || isPrepa)) return false

    return true
  }

  // Filter out ineligible programs — model may have hallucinated them
  const eligibleIds = filteredIds.filter(isEligible)

  // If filtering removed everything, fall back to all (better than empty)
  const finalIds = eligibleIds.length > 0 ? eligibleIds : filteredIds

  console.log("[analyser] Resolved IDs:", finalIds)
  return { score, resultIds: finalIds, resultat: justification }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function analyserDossier(dossierId: string, locale: "fr" | "en" | "ar" = "fr"): Promise<AnalyseResult> {
  const { getActiveAnnee } = await import("@/lib/annee")
  const activeAnnee = await getActiveAnnee()

  const [dossier, filieres] = await Promise.all([
    prisma.dossier.findUnique({
      where: { id: dossierId },
      include: {
        documents: true,
        diplomes:  { orderBy: { annee: "desc" } },
      },
    }),
    prisma.filiere.findMany({
      include: {
        capacites: activeAnnee ? { where: { anneeId: activeAnnee.id } } : false,
        _count: {
          select: {
            dossiers: activeAnnee
              ? { where: { anneeId: activeAnnee.id, statut: "VALIDE" } }
              : true,
          },
        },
      },
    }),
  ])

  if (!dossier) throw new Error(`Dossier ${dossierId} not found`)

  // ── Merge grades: dossier.notes (base) + diplomes[].champs (overlay, newest wins) ──
  // Using both ensures partial champs never silently drops grades that are in notes.
  const legacyNotes = (dossier.notes ?? {}) as Record<string, number>
  const gradesFromDiplomas: Record<string, number> = {}
  for (const diplo of [...dossier.diplomes].reverse()) {   // oldest first so newest wins
    const champs = diplo.champs as Record<string, unknown> | null ?? {}
    for (const [k, v] of Object.entries(champs)) {
      const n = typeof v === "number" ? v : parseFloat(String(v))
      if (!isNaN(n) && n >= 0 && n <= 20) gradesFromDiplomas[k] = n
    }
  }
  // Merge: legacy notes as base, diplomas overlay on top
  const rawMerged: Record<string, number> = { ...legacyNotes, ...gradesFromDiplomas }

  // Strip keys that are not recognised grade fields (e.g. column-header ghosts like "الدورة الرئيسية")
  const KNOWN_GRADE_KEYS = new Set([
    "math","physique","svt","sciences","francais","arabe","anglais","informatique",
    "histoire_geo","philosophie","techno","economie","gestion","sport",
    "moyenneGenerale","moyennegenerale",
  ])
  const mergedNotes: Record<string, number> = {}
  for (const [k, v] of Object.entries(rawMerged)) {
    if (KNOWN_GRADE_KEYS.has(k) || KNOWN_GRADE_KEYS.has(k.toLowerCase())) {
      mergedNotes[k] = v
    } else {
      console.log(`[analyser] stripped unknown grade key: "${k}" (value ${v})`)
    }
  }

  // Extract dernierDiplome / anneeDiplome from the most recent diploma entry
  const latestDiplo       = dossier.diplomes[0] ?? null
  const dernierDiplome    = latestDiplo?.intitule ?? dossier.dernierDiplome
  const anneeDiplome      = latestDiplo?.annee    ?? dossier.anneeDiplome

  // ── Document completeness: PHOTO + at least one identity doc (CNI or PASSEPORT) ──
  const uploadedTypes = new Set(dossier.documents.map((d) => d.type))
  const hasIdentity   = uploadedTypes.has("CNI") || uploadedTypes.has("PASSEPORT")
  const hasPhoto      = uploadedTypes.has("PHOTO")
  const manquants: TypeDoc[] = [
    ...(!hasIdentity ? ["CNI" as TypeDoc] : []),
    ...(!hasPhoto    ? ["PHOTO" as TypeDoc] : []),
  ]
  const complet = manquants.length === 0
  // Filter to programs that still have capacity (or have no quota = unlimited)
  const available = filieres.filter((f) => {
    const cap = (f as unknown as { capacites?: { capacite: number }[] }).capacites?.[0]?.capacite ?? null
    return cap === null || f._count.dossiers < cap
  })

  let aiResult: { score: number; resultIds: string[]; resultat: string } | null = null
  try {
    console.log("[analyser] Calling Ollama:", OLLAMA_URL, "| model:", OLLAMA_MODEL,
      "| grades:", JSON.stringify(mergedNotes))
    aiResult = await ollamaAnalyse(
      {
        niveauEtude:    dossier.niveauEtude,
        typeCours:      dossier.typeCours,
        dernierDiplome,
        anneeDiplome,
        complet,
        notes: Object.keys(mergedNotes).length > 0 ? mergedNotes : null,
      },
      available.map((f) => ({ id: f.id, nom: f.nom, description: f.description, diplomeDelivre: f.diplomeDelivre })),
      locale
    )
    console.log("[analyser] AI result:", JSON.stringify(aiResult))
  } catch (err) {
    console.warn("[analyser] Ollama unavailable — rule-based fallback:", (err as Error).message)
  }

  if (aiResult && aiResult.resultIds.length > 0) {
    const adjustedScore = complet ? aiResult.score : Math.max(0, aiResult.score - 15)

    // If Mistral returned fewer than 3 eligible programs (e.g. because one was filtered),
    // supplement with rule-based picks — but only eligible ones
    const niveau = dossier.niveauEtude ?? ""
    const eligFn = (f: { nom: string; categorie?: string | null }) =>
      isEligibleFiliere(f.categorie ?? null, f.nom, niveau)

    let resultIds = aiResult.resultIds
    if (resultIds.length < 3) {
      const eligibleAvailable = available.filter((f) => eligFn(f as { nom: string; categorie?: string | null }))
      const fallbackExtra = ruleBasedScore(manquants, eligibleAvailable)
      const extraIds = fallbackExtra.filiereRecommandations
        .map((r) => r.filiereId)
        .filter((id) => {
          if (resultIds.includes(id)) return false
          const f = available.find((x) => x.id === id)
          return f ? eligFn(f as { nom: string; categorie?: string | null }) : false
        })
      resultIds = [...resultIds, ...extraIds].slice(0, 3)
      console.log(`[analyser] supplemented with ${extraIds.length} eligible rule-based pick(s)`)
    }

    return {
      score:   adjustedScore,
      complet,
      manquants,
      resultat: aiResult.resultat || `Score ${adjustedScore}/100.`,
      filiereRecommandations: resultIds.map((id, i) => ({ filiereId: id, rang: i + 1 })),
    }
  }

  // Full rule-based fallback
  const fallback = ruleBasedScore(manquants, filieres)
  return { complet, manquants, ...fallback }
}

export async function detecterIncomplet(dossierId: string): Promise<TypeDoc[]> {
  const docs     = await prisma.document.findMany({ where: { dossierId }, select: { type: true } })
  const uploaded = new Set(docs.map((d) => d.type))
  const missing: TypeDoc[] = []
  if (!uploaded.has("CNI") && !uploaded.has("PASSEPORT")) missing.push("CNI")
  if (!uploaded.has("PHOTO")) missing.push("PHOTO")
  return missing
}