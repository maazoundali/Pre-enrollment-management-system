/**
 * Analyser model comparison — Mistral vs phi:2.7b
 * Usage:  node scripts/benchmark-analyser.mjs
 *
 * No database. No Next.js. Just Ollama.
 * Runs the exact same prompt used in lib/ai/analyser.ts against both models
 * and prints raw + parsed output for report benchmarking.
 */

const OLLAMA_URL = "http://localhost:11434"

// ── Sample dossier ─────────────────────────────────────────────────────────────
// Matches the screenshot scenario: BAC student, no notes → score should cap at 55
const SAMPLE_DOSSIER = {
  niveau:       "Baccalauréat (terminale)",
  diplome:      "Baccalauréat (2024)",
  typeCours:    "Cours de jour (temps plein)",
  docs:         "Oui — dossier complet",
  notesStr:     "  • Aucune note fournie — plafonner le score à 55",
}

// Representative programs (same names as the real DB)
const PROGRAMS = [
  { nom: "Cycle Préparatoire",                      diplome: "Prépa 2 ans",     desc: "Préparation aux grandes écoles d'ingénieurs, maths+physique intensifs" },
  { nom: "Licence Informatique",                     diplome: "Licence (L3)",    desc: "Algorithmique, bases de données, développement logiciel" },
  { nom: "Licence Génie Industriel — Management SI", diplome: "Licence (L3)",    desc: "Gestion industrielle, ERP, supply chain, systèmes d'information" },
  { nom: "Licence Intelligence Artificielle",        diplome: "Licence (L3)",    desc: "Machine learning, deep learning, traitement de données" },
  { nom: "Génie Informatique",                       diplome: "Ingénieur (5 ans)",desc: "Formation ingénieur en informatique et systèmes embarqués" },
  { nom: "Génie Civil",                              diplome: "Ingénieur (5 ans)",desc: "Structures, béton armé, urbanisme et travaux publics" },
  { nom: "Génie Mécanique",                          diplome: "Ingénieur (5 ans)",desc: "Conception mécanique, CAO, fabrication industrielle" },
  { nom: "Master Intelligence Artificielle",         diplome: "Master (M2)",     desc: "IA avancée, NLP, vision, robotique" },
  { nom: "Architecture",                             diplome: "Ingénieur (5 ans)",desc: "Conception architecturale, urbanisme, patrimoine" },
]

// ── Exact prompts from lib/ai/analyser.ts ──────────────────────────────────────

function buildSystemPrompt() {
  return `Tu es un système d'aide à la décision d'admission dans une université tunisienne. Tu appliques des règles strictes et non négociables pour évaluer les dossiers de candidature.

LANGUE : Réponds UNIQUEMENT en français.


ÉTAPE 1 — ÉLIGIBILITÉ (filtre disqualifiant, applique avant tout scoring) :
• Baccalauréat → UNIQUEMENT : Cycle Préparatoire, Licences (ex. Licence Informatique, Licence Génie Industriel), Architecture.
  INTERDIT pour Bac : Génie Informatique, Génie Civil, Génie Mécanique, Génie Télécommunications, Génie des Procédés, Génie Industriel (cycle), tout Master.
• Licence 1 ou 2 → UNIQUEMENT : Licences. Interdit : Cycles Ingénieur, Master, Préparatoire.
• Licence 3 (diplômé) → Éligible : Cycles Ingénieur, Master, Licences.
• Master → Éligible : programmes Master uniquement.
Tout programme non éligible doit être EXCLU de la liste, sans exception ni justification.

ÉTAPE 2 — SCORING DES NOTES (si notes fournies) :
Calcule la moyenne pondérée maths+physique (si disponibles) :
• math ≥ 14 ET physique ≥ 14 → Profil sciences fort. Score de base : 78.
• math ≥ 12 ET physique ≥ 11 → Profil sciences moyen. Score de base : 62.
• math < 10 OU physique < 10 → Profil sciences faible. Score de base : 40.
• math < 8 ET physique < 8 → Profil très faible. Score de base : 25.
• Moyenne générale ≥ 14 → bonus +8.
• Moyenne générale entre 11 et 13 → bonus +3.
• Moyenne générale < 10 → malus -10.

ÉTAPE 3 — SCORING SANS NOTES :
• Si aucune note fournie → Score plafonné à 55. Recommander le Cycle Préparatoire (si Bac) ou les Licences les plus générales.

ÉTAPE 4 — AJUSTEMENTS :
• Documents incomplets → malus -15.
• Cours du soir → préférer Licences et Cycle Préparatoire.
• Score final : clamp entre 0 et 100.

ÉTAPE 5 — RECOMMANDATIONS :
• Recommander exactement 3 programmes, dans l'ordre de pertinence décroissante.
• Tous les programmes recommandés doivent être éligibles (étape 1).
• Les noms des programmes doivent être copiés mot pour mot depuis la liste fournie.

FORMAT : Retourner UNIQUEMENT ce JSON valide, sans texte avant ou après :
{"score": <entier 0-100>, "programs": ["<nom exact 1>", "<nom exact 2>", "<nom exact 3>"], "justification": "<2 phrases précises en français>"}`
}

function buildUserPrompt() {
  const programList = PROGRAMS
    .map((f, i) => `  ${i + 1}. "${f.nom}" | Diplôme: ${f.diplome} | ${f.desc}`)
    .join("\n")

  return `Voici le dossier à évaluer :

NIVEAU ACADÉMIQUE : ${SAMPLE_DOSSIER.niveau}
DERNIER DIPLÔME : ${SAMPLE_DOSSIER.diplome}
TYPE DE COURS SOUHAITÉ : ${SAMPLE_DOSSIER.typeCours}
DOCUMENTS COMPLETS : ${SAMPLE_DOSSIER.docs}

NOTES DÉCLARÉES :
${SAMPLE_DOSSIER.notesStr}

PROGRAMMES DISPONIBLES :
${programList}

FORMAT DE LA JUSTIFICATION :
2 à 3 phrases naturelles et convaincantes, comme un conseiller d'orientation s'adressant directement à l'étudiant.
- Ne mentionne PAS le score ni les notes chiffrées.
- Explique POURQUOI ces programmes ont été choisis.
- Ton encourageant, direct, personnalisé.

Retourne UNIQUEMENT le JSON.`
}

// ── Model runner ───────────────────────────────────────────────────────────────

async function runModel(modelName, { temperature = 0.05, num_predict = 800 } = {}) {
  const systemPrompt = buildSystemPrompt()
  const userPrompt   = buildUserPrompt()

  console.log(`\n${"═".repeat(72)}`)
  console.log(`  MODEL : ${modelName}`)
  console.log(`${"═".repeat(72)}`)
  console.log(`  Calling Ollama... (this may take up to 60s for phi)`)

  const start = Date.now()
  let res
  try {
    res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model:   modelName,
        stream:  false,
        options: { temperature, num_predict, repeat_penalty: 1.1 },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
      }),
      signal: AbortSignal.timeout(120_000),
    })
  } catch (err) {
    console.log(`  ✗ Network error: ${err.message}`)
    return
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  if (!res.ok) {
    console.log(`  ✗ HTTP ${res.status} — model "${modelName}" might not be installed.`)
    console.log(`    Run: ollama pull ${modelName}`)
    return
  }

  const data = await res.json()
  const raw  = (data.message?.content ?? "").trim()

  console.log(`\n  ┌─ RAW RESPONSE (${elapsed}s / ${raw.length} chars) ${"─".repeat(30)}`)
  // Print each line indented for readability
  raw.split("\n").forEach(line => console.log(`  │  ${line}`))
  console.log(`  └${"─".repeat(60)}`)

  // Try to parse JSON
  const clean = raw.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) {
    console.log("\n  ✗ PARSE RESULT : No JSON found in response\n")
    return
  }

  let parsed
  try { parsed = JSON.parse(match[0]) }
  catch (e) {
    console.log(`\n  ✗ PARSE RESULT : Invalid JSON — ${e.message}\n`)
    return
  }

  const score   = parsed.score
  const progs   = Array.isArray(parsed.programs) ? parsed.programs : []
  const justif  = parsed.justification ?? "(none)"

  console.log("\n  ┌─ PARSED RESULT " + "─".repeat(44))
  console.log(`  │  Score          : ${score}/100`)
  progs.forEach((p, i) => console.log(`  │  Program #${i+1}     : ${p}`))
  console.log(`  │  Justification : ${justif.slice(0, 120)}${justif.length > 120 ? "..." : ""}`)
  console.log(`  └${"─".repeat(60)}\n`)
}

// ── Main ────────────────────────────────────────────────────────────────────────

console.log("\n" + "╔" + "═".repeat(70) + "╗")
console.log("║   ANALYSER BENCHMARK — Mistral 7B  vs  phi:2.7b" + " ".repeat(20) + "║")
console.log("╚" + "═".repeat(70) + "╝")
console.log("\n  Test case : BAC student, no notes supplied (score should cap at 55)")
console.log("  Eligible  : Cycle Préparatoire, Licences, Architecture")
console.log("  Forbidden : Génie* (engineering cycles), Masters")

await runModel("mistral")
await runModel("phi:2.7b", { temperature: 0.1, num_predict: 600 })

console.log("\n" + "═".repeat(72))
console.log("  Benchmark complete.")
console.log("═".repeat(72) + "\n")
