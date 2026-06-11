// lib/ocr/vl-ocr.ts
// Vision-language OCR using Qwen2.5-VL via Ollama.
// Handles two document types:
//   • "CIN_PASSPORT" — Tunisian identity card or international passport
//   • "TRANSCRIPT"   — Academic grade transcript (relevé de notes)
//
// Falls back gracefully: returns null so the caller can use Tesseract instead.

const OLLAMA_URL      = process.env.OLLAMA_URL      ?? "http://localhost:11434"
const OLLAMA_VL_MODEL = process.env.OLLAMA_VL_MODEL ?? "minicpm-v"

// Cached resolved model name: undefined = not yet checked, null = no VL model found
let _resolvedModel: string | null | undefined = undefined

async function resolveVLModel(): Promise<string | null> {
  if (_resolvedModel !== undefined) return _resolvedModel

  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) {
      console.warn("[vl-ocr] Cannot list Ollama models (HTTP", res.status, ") — using configured:", OLLAMA_VL_MODEL)
      _resolvedModel = OLLAMA_VL_MODEL
      return _resolvedModel
    }
    const data = await res.json() as { models?: Array<{ name: string }> }
    const names = (data.models ?? []).map((m) => m.name)
    console.log("[vl-ocr] Available Ollama models:", names.join(", ") || "(none)")

    if (names.includes(OLLAMA_VL_MODEL)) {
      _resolvedModel = OLLAMA_VL_MODEL
    } else {
      // Auto-detect known vision models (priority order)
      const VISION_PATTERNS = [/minicpm.v/, /qwen.*vl/, /qwen.*vision/, /moondream/]
      const found = names.find((n) => VISION_PATTERNS.some((p) => p.test(n.toLowerCase())))
      if (found) {
        console.log(`[vl-ocr] Auto-detected VL model: "${found}" (env OLLAMA_VL_MODEL="${OLLAMA_VL_MODEL}")`)
        _resolvedModel = found
      } else {
        console.warn(`[vl-ocr] No VL model found. Set OLLAMA_VL_MODEL to one of: ${names.join(", ") || "(no models installed)"}`)
        _resolvedModel = null
      }
    }
  } catch (err) {
    console.warn("[vl-ocr] Cannot reach Ollama for model discovery:", (err as Error).message)
    _resolvedModel = OLLAMA_VL_MODEL  // try anyway; callVLModel will handle failure
  }

  return _resolvedModel
}

// ── Shared grades key map ──────────────────────────────────────────────────────
// These internal keys must match what the rest of the app uses in diplomes[].champs.
const GRADE_KEY_ALIASES: Record<string, string> = {
  // Maths — رياضيات
  "mathématiques": "math", "mathématique": "math", "maths": "math",
  "رياضيات": "math", "الرياضيات": "math",
  // Physics — علوم فيزيائية (BAC Maths) / فيزياء
  "physique": "physique", "sciences physiques": "physique",
  "physique-chimie": "physique", "الفيزياء": "physique",
  "علوم فيزيائية": "physique", "الفيزياء والكيمياء": "physique",
  "فيزياء وكيمياء": "physique", "فيزياء": "physique",
  // Biology / SVT — علوم الحياة والأرض (BAC Maths full name)
  "sciences naturelles": "svt", "svt": "svt", "biologie": "svt",
  "sciences de la vie": "svt", "علوم الحياة": "svt",
  "علوم الحياة والأرض": "svt", "العلوم الطبيعية": "svt",
  "علوم طبيعية": "svt", "العلوم": "svt",
  // French — فرنسية (also OCR misread قرنسية)
  "français": "francais", "langue française": "francais", "الفرنسية": "francais",
  "فرنسية": "francais", "قرنسية": "francais",  // قرنسية = OCR misread of فرنسية
  // Arabic — عربية
  "arabe": "arabe", "langue arabe": "arabe", "اللغة العربية": "arabe",
  "العربية": "arabe", "عربية": "arabe",
  // English — انقليزية / إنجليزية
  "anglais": "anglais", "langue anglaise": "anglais", "الإنجليزية": "anglais",
  "انقليزية": "anglais", "الانجليزية": "anglais", "إنجليزية": "anglais",
  // Computer science — إعلامية / معلوماتية
  "informatique": "informatique", "sciences informatiques": "informatique",
  "معلوماتية": "informatique", "الإعلامية": "informatique",
  "إعلامية": "informatique", "إعلامية ": "informatique",
  // History / Geo
  "histoire-géographie": "histoire_geo", "histoire géographie": "histoire_geo",
  "histoire et géo": "histoire_geo", "تاريخ وجغرافيا": "histoire_geo",
  // Philosophy — فلسفة (also OCR misreads قلسفة / فلسقة)
  "philosophie": "philosophie", "الفلسفة": "philosophie",
  "فلسفة": "philosophie", "قلسفة": "philosophie", "فلسقة": "philosophie",
  // Technology
  "technologie": "techno", "sciences techniques": "techno",
  "génie technique": "techno", "التكنولوجيا": "techno",
  // Economics / Management
  "économie": "economie", "économie et gestion": "gestion",
  "gestion": "gestion", "الاقتصاد": "economie", "اقتصاد": "economie",
  "تصرف": "gestion", "التصرف": "gestion",
  // Sport — تربية بدنية
  "éducation physique": "sport", "sport": "sport", "eps": "sport",
  "التربية البدنية": "sport", "تربية بدنية": "sport",
  // Sciences (generic BAC Sport field)
  "sciences": "sciences",
  // Overall average
  "moyenne générale": "moyenneGenerale", "moyenne": "moyenneGenerale",
  "note globale": "moyenneGenerale", "المعدل العام": "moyenneGenerale",
  "المعدل": "moyenneGenerale", "معدل": "moyenneGenerale",
  "moyennegenerale": "moyenneGenerale", "moyennegénérale": "moyenneGenerale",
  "المعدل النهائي": "moyenneGenerale", "معدل نهائي": "moyenneGenerale",
}

function normaliseKey(raw: string): string {
  const lower = raw.toLowerCase().trim()
  return GRADE_KEY_ALIASES[lower] ?? lower.replace(/\s+/g, "_")
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CINResult {
  documentType:   "CIN" | "PASSEPORT" | null
  idNumber:       string | null     // 8-digit CIN or passport number
  fullName:       string | null     // full name (Latin script preferred)
  dateOfBirth:    string | null     // DD/MM/YYYY
  address:        string | null
  nationality:    string | null
  confidence:     "HIGH" | "MEDIUM" | "LOW"
}

export interface SubjectGrade {
  key:   string        // internal key (math, physique, …)
  name:  string        // human-readable name from document
  grade: number        // /20
}

export interface TranscriptResult {
  institution:    string | null
  year:           string | null
  diplomaType:    string | null    // BAC, LICENCE, MASTER …
  subjects:       SubjectGrade[]
  overallAverage: number | null
  confidence:     "HIGH" | "MEDIUM" | "LOW"
}

// ── Ollama vision call ─────────────────────────────────────────────────────────

async function callVLModel(
  systemPrompt: string,
  userPrompt:   string,
  imageBase64:  string,   // pure base64, no data URI prefix
): Promise<string | null> {
  const model = await resolveVLModel()
  if (!model) return null

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream:  false,
        options: { temperature: 0.0, num_predict: 2500, repeat_penalty: 1.05 },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt, images: [imageBase64] },
        ],
      }),
      signal: AbortSignal.timeout(180_000),  // VLMs can be slow on CPU
    })

    if (!res.ok) {
      console.warn(`[vl-ocr] Ollama HTTP ${res.status} for model "${model}" — falling back to Tesseract`)
      if (res.status === 404) _resolvedModel = undefined  // force re-detection on next call
      return null
    }

    const data = await res.json()
    const raw  = (data.message?.content as string ?? "").trim()
    console.log(`[vl-ocr] raw response (${raw.length} chars):\n${raw}`)

    // Strip markdown code fences if present
    const clean = raw.replace(/```(?:json)?\n?/gi, "").replace(/```\n?/g, "").trim()
    // Try to find the widest JSON object in the response
    const match = clean.match(/\{[\s\S]*\}/)
    if (!match) {
      console.warn("[vl-ocr] no JSON object found in response — model returned prose or empty")
      return null
    }
    // Step 1 — Convert Arabic/French comma decimals to period decimals BEFORE parsing.
    // Tunisian grade sheets use "08,00" and "06,25" — both are invalid JSON as-is.
    // Pattern: 1–2 digit integer, comma, exactly 2 decimal digits (covers 0,00 – 20,00).
    // The word-boundary guards prevent touching JSON array commas like `}, {`.
    let fixedJson = match[0]
      .replace(/\b(\d{1,2}),(\d{2})\b/g, "$1.$2")
    // Step 2 — Remove invalid leading zeros now that commas are gone ("08.00" → "8.0").
      .replace(/:\s*0([1-9]\d*(?:\.\d+)?)/g, ": $1")
    return fixedJson
  } catch (err) {
    console.warn("[vl-ocr] Ollama unavailable:", (err as Error).message)
    return null
  }
}

// ── CIN / Passport parsing ─────────────────────────────────────────────────────

const CIN_SYSTEM = `Tu es un expert en lecture de documents d'identité tunisiens et internationaux.
Tu lis les cartes d'identité nationale (CIN) tunisiennes et les passeports.
Tu extrais les champs demandés avec une précision absolue.
La CIN tunisienne est bilingue (arabe + français). Préfère les données en script latin quand disponibles.
Les numéros de CIN tunisienne ont exactement 8 chiffres.
Retourne UNIQUEMENT un objet JSON valide, sans texte avant ou après.`

const CIN_USER = `Examine ce document d'identité et extrait les informations suivantes.
Retourne UNIQUEMENT ce JSON valide (null pour les champs introuvables) :

{
  "document_type": "CIN" ou "PASSEPORT",
  "id_number": "numéro à 8 chiffres (CIN) ou numéro de passeport",
  "full_name": "nom complet en caractères latins (ou translit si uniquement en arabe)",
  "date_of_birth": "JJ/MM/AAAA",
  "address": "adresse complète si visible",
  "nationality": "Tunisienne ou autre nationalité",
  "confidence": "HIGH si toutes données claires, MEDIUM si quelques doutes, LOW si document illisible"
}`

export async function parseCINWithVL(imageBase64: string): Promise<CINResult | null> {
  const jsonStr = await callVLModel(CIN_SYSTEM, CIN_USER, imageBase64)
  if (!jsonStr) return null

  try {
    const raw = JSON.parse(jsonStr)
    const result: CINResult = {
      documentType:
        (raw.document_type ?? "").toUpperCase().includes("PASSEPORT") ? "PASSEPORT"
        : (raw.document_type ?? "").toUpperCase().includes("CIN") ? "CIN"
        : null,
      idNumber:    raw.id_number    ?? null,
      fullName:    raw.full_name    ?? null,
      dateOfBirth: normaliseDateStr(raw.date_of_birth ?? null),
      address:     raw.address      ?? null,
      nationality: raw.nationality  ?? null,
      confidence:  (["HIGH","MEDIUM","LOW"].includes(raw.confidence) ? raw.confidence : "MEDIUM") as CINResult["confidence"],
    }

    // Validate CIN number format (8 digits)
    if (result.idNumber && !/^\d{8}$/.test(result.idNumber.replace(/\s/g, ""))) {
      const digits = (result.idNumber ?? "").replace(/\D/g, "")
      result.idNumber = digits.length === 8 ? digits : null
    }

    return result
  } catch {
    console.warn("[vl-ocr] JSON parse failed for CIN result")
    return null
  }
}

// ── BAC series → targeted subject list ────────────────────────────────────────
// Only extract grades for subjects that actually appear in each series.
// Fewer targets = model less confused, lower chance of column/row mistakes.

const BAC_SUBJECTS: Record<string, { arabic: string; key: string }[]> = {
  // Sciences, Maths, Technique share the same 6 targets in the same row order
  SCIENTIFIQUE: [
    { arabic: "رياضيات / الرياضيات",      key: "math" },
    { arabic: "علوم فيزيائية / الفيزياء", key: "physique" },
    { arabic: "فرنسية / قرنسية",           key: "francais" },
    { arabic: "انقليزية / الإنجليزية",     key: "anglais" },
    { arabic: "إعلامية / الإعلامية",       key: "informatique" },
    { arabic: "المعدل النهائي",             key: "moyenneGenerale" },
  ],
  MATHS_INFO: [
    { arabic: "رياضيات / الرياضيات",      key: "math" },
    { arabic: "علوم فيزيائية / الفيزياء", key: "physique" },
    { arabic: "إعلامية / الإعلامية",       key: "informatique" },
    { arabic: "فرنسية / قرنسية",           key: "francais" },
    { arabic: "انقليزية / الإنجليزية",     key: "anglais" },
    { arabic: "المعدل النهائي",             key: "moyenneGenerale" },
  ],
  TECHNIQUE: [
    { arabic: "رياضيات / الرياضيات",      key: "math" },
    { arabic: "علوم فيزيائية / الفيزياء", key: "physique" },
    { arabic: "فرنسية / قرنسية",           key: "francais" },
    { arabic: "انقليزية / الإنجليزية",     key: "anglais" },
    { arabic: "إعلامية / الإعلامية",       key: "informatique" },
    { arabic: "المعدل النهائي",             key: "moyenneGenerale" },
  ],
  LETTRES: [
    { arabic: "فرنسية / قرنسية",            key: "francais" },
    { arabic: "فلسفة / قلسفة",              key: "philosophie" },
    { arabic: "تاريخ وجغرافيا",              key: "histoire_geo" },
    { arabic: "انقليزية / الإنجليزية",      key: "anglais" },
    { arabic: "المعدل النهائي",              key: "moyenneGenerale" },
  ],
  ECONOMIE: [
    // اقتصاد is row 1 — must be listed first so the model doesn't drift.
    // It won't appear in the grade form (not in diploma-types ECONOMIE fields).
    { arabic: "اقتصاد / الاقتصاد",        key: "economie" },
    { arabic: "تصرف / التصرف",             key: "gestion" },
    { arabic: "رياضيات / الرياضيات",      key: "math" },
    { arabic: "انقليزية / الإنجليزية",     key: "anglais" },
    { arabic: "فرنسية / قرنسية",           key: "francais" },
    { arabic: "إعلامية / الإعلامية",       key: "informatique" },
    { arabic: "المعدل النهائي",             key: "moyenneGenerale" },
  ],
  SPORT: [
    { arabic: "تربية بدنية",                key: "sport" },
    { arabic: "المعدل النهائي",              key: "moyenneGenerale" },
  ],
}

// ── Transcript / Relevé de notes parsing ──────────────────────────────────────

const TRANSCRIPT_SYSTEM = `You are an OCR expert specialized in Tunisian academic transcripts (BAC, Licence, Master).
You MUST respond with ONLY a valid JSON object. No explanation, no prose, no markdown. Just the JSON.
The document is a Tunisian BAC result sheet ("بيان أعداد امتحان البكالوريا") written in Arabic (right-to-left).

TABLE COLUMN ORDER (right to left in the image):
  Column A (rightmost)  "المواد"           — subject names
  Column B (middle)     "الدورة الرئيسية" — MAIN SESSION grades → EXTRACT FROM HERE ONLY
  Column C (leftmost)   "دورة المراقبة"   — monitoring session  → COMPLETELY IGNORE

For each subject row: read the subject name from column A and the grade from column B of THAT SAME ROW.
Never read a grade from column C.
Grades use Arabic comma as decimal: "06,25" → 6.25, "08,00" → 8.0. Return as plain decimal numbers. Skip values > 20.
Extract المعدل النهائي as overall_average. Ignore المعدل السنوي completely.`

const TRANSCRIPT_USER = `Look at this Tunisian BAC grade transcript image (Arabic right-to-left document).

TABLE LAYOUT (3 columns, right to left):
  • Column A — RIGHTMOST  "المواد"           subject names
  • Column B — MIDDLE     "الدورة الرئيسية"  MAIN SESSION grades  ← READ ONLY THIS
  • Column C — LEFTMOST   "دورة المراقبة"    monitoring           ← IGNORE COMPLETELY

Step 1: Find the header row containing these column labels.
Step 2: For each data row, pair the subject name (column A) with its grade in column B only.
  Do NOT use any value from column C (دورة المراقبة).

Return grades as numbers. Convert comma decimals: "06,25" → 6.25, "08,00" → 8.0.
Skip any grade > 20.

Subject names and their keys — covers ALL BAC series (Maths, Sciences, Technique, Lettres, Économie):
  رياضيات / الرياضيات                    → "math"
  علوم فيزيائية / الفيزياء / فيزياء     → "physique"
  علوم الحياة والأرض / علوم طبيعية      → "svt"
  فرنسية / قرنسية (OCR variant)         → "francais"
  عربية / العربية / اللغة العربية        → "arabe"
  انقليزية / إنجليزية / الإنجليزية      → "anglais"
  إعلامية / معلوماتية / الإعلامية       → "informatique"
  فلسفة / قلسفة (OCR variant)           → "philosophie"
  تاريخ وجغرافيا                         → "histoire_geo"
  تكنولوجيا / علوم تقنية                → "techno"
  اقتصاد / الاقتصاد                      → "economie"
  تصرف / التصرف                          → "gestion"
  تربية بدنية                            → "sport"
  المعدل النهائي                          → "moyenneGenerale"

CRITICAL RULES:
- Read the ACTUAL grades from THIS document — do NOT use any example values.
- List rows TOP to BOTTOM as they appear in the table.
- If you can clearly read a subject → use the key from the list above.
- If you CANNOT read a subject name → use "row_N" (N = row number) as name, null as key, still include the grade.
- Only include rows with a grade you can actually see in the CENTER column between 0 and 20.
- Do NOT repeat the same key twice (if anglais appears twice, keep only the first).
- Do NOT include column header labels as subjects.
- Maximum 15 entries.

Respond with ONLY this JSON (replace ALL values with what you actually read from the image):

{
  "institution": null,
  "year": "YYYY",
  "diploma_type": "BAC",
  "subjects": [
    { "name": "SUBJECT_NAME_1", "key": "KEY_1", "grade": X.XX },
    { "name": "SUBJECT_NAME_2", "key": "KEY_2", "grade": X.XX },
    { "name": "row_3",          "key": null,    "grade": X.XX },
    { "name": "المعدل النهائي", "key": "moyenneGenerale", "grade": X.XX }
  ],
  "overall_average": X.XX,
  "confidence": "HIGH"
}

Replace ALL example grades with the ACTUAL values from the image. Keep the row_N entries only for rows you cannot read.`

export async function parseTranscriptWithVL(
  imageBase64: string,
  sousType: string | null = null,
): Promise<TranscriptResult | null> {
  // Build a targeted user prompt when we know the BAC series
  const targetedSubjects = sousType ? BAC_SUBJECTS[sousType] ?? null : null
  let userPrompt = TRANSCRIPT_USER

  if (targetedSubjects) {
    const subjectList = targetedSubjects
      .map((s, i) => `  ${i + 1}. Look for row containing: ${s.arabic}  →  write its grade as key "${s.key}"`)
      .join("\n")

    // Build the JSON template using null placeholders (valid JSON, clearly not a real grade)
    const jsonRows = targetedSubjects.map(s => {
      const name = s.arabic.split(" / ")[1] ?? s.arabic
      return `    { "name": "${name}", "key": "${s.key}", "grade": null }`
    }).join(",\n")

    userPrompt = `This is a Tunisian BAC ${sousType} grade sheet — an Arabic right-to-left document.

TABLE LAYOUT (3 columns, right to left):
  • Column A — RIGHTMOST  "المواد"           subject names
  • Column B — MIDDLE     "الدورة الرئيسية"  MAIN SESSION grades  ← READ ONLY THIS
  • Column C — LEFTMOST   "دورة المراقبة"    monitoring session   ← COMPLETELY IGNORE

For each numbered subject below:
  1. Scan column A (rightmost) from top to bottom to find the row whose subject name matches.
  2. In THAT SAME ROW, read the value in column B (middle — الدورة الرئيسية).
  3. Write that value as the grade. Do NOT use column C.

${subjectList}

DECIMAL FORMAT: The document uses comma as decimal. Before writing, convert:
  "06,25" → 6.25   "08,00" → 8.0   "13,25" → 13.25   "09,23" → 9.23
Return all grades as plain decimal numbers (never as strings, never with a comma).

RULES:
• If the الدورة الرئيسية cell for a row is blank, use null.
• "المعدل السنوي" = annual average — skip it entirely.
• "المعدل النهائي" = final average — use its column B value for overall_average.
• Never copy a value from column C (دورة المراقبة). If you did, correct it.

Respond with ONLY this JSON. Replace every null grade with the decimal number you read from column B:
{
  "institution": null,
  "year": "YYYY",
  "diploma_type": "BAC",
  "subjects": [
${jsonRows}
  ],
  "overall_average": null,
  "confidence": "HIGH"
}`
    console.log(`[vl-ocr:transcript] using targeted prompt for BAC ${sousType} (${targetedSubjects.length} subjects)`)
  }

  const jsonStr = await callVLModel(TRANSCRIPT_SYSTEM, userPrompt, imageBase64)
  if (!jsonStr) return null

  try {
    const raw = JSON.parse(jsonStr)
    console.log("[vl-ocr:transcript] parsed JSON — diploma_type:", raw.diploma_type, "institution:", raw.institution, "year:", raw.year, "confidence:", raw.confidence)
    console.log("[vl-ocr:transcript] raw subjects from model:", raw.subjects)
    console.log("[vl-ocr:transcript] raw overall_average from model:", raw.overall_average)

    // Normalise subjects array
    const subjects: SubjectGrade[] = []
    if (Array.isArray(raw.subjects)) {
      for (const s of raw.subjects) {
        // Normalise comma decimal separator before parsing: "08,00" → 8.0, "06,25" → 6.25
        const gradeStr = String(s.grade ?? "").replace(/,/g, ".")
        const grade = typeof s.grade === "number" ? s.grade : parseFloat(gradeStr)
        if (isNaN(grade) || grade < 0 || grade > 20) {
          console.log(`[vl-ocr:transcript] skipped subject (grade out of range): ${s.name} = ${s.grade}`)
          continue
        }

        // Resolve key: prefer explicit key, fall back to name lookup, allow null for row_N entries
        let resolvedKey: string | null = null
        if (s.key && typeof s.key === "string") {
          const nk = normaliseKey(s.key)
          // Accept known keys; reject garbage like "n/a", "-cn"
          const isGarbage = nk.startsWith("-") || nk.length <= 2 || ["na","cn","nul","null","unknown","n/a"].includes(nk)
          if (!isGarbage) resolvedKey = nk
        }
        // If key was null/garbage, try to look up by subject name
        if (!resolvedKey && s.name && !String(s.name).startsWith("row_")) {
          const nk = normaliseKey(s.name as string)
          if (nk && nk.length > 2 && !nk.startsWith("-")) resolvedKey = nk
        }
        // row_N entries: keep with null key so caller can positional-map them
        const isRowPlaceholder = String(s.name ?? "").startsWith("row_")

        if (!resolvedKey && !isRowPlaceholder) {
          console.log(`[vl-ocr:transcript] skipped (unresolvable key): name="${s.name}"`)
          continue
        }

        const finalKey = resolvedKey ?? `__row_${subjects.length}`

        // Deduplication: if this key already has a grade (first occurrence wins), skip
        if (subjects.some(existing => existing.key === finalKey)) {
          console.log(`[vl-ocr:transcript] skipped duplicate key "${finalKey}" (grade=${grade}) — keeping first occurrence`)
          continue
        }

        console.log(`[vl-ocr:transcript] accepted: "${s.name}" → key="${finalKey}" grade=${grade}`)
        subjects.push({ key: finalKey, name: s.name ?? finalKey, grade: parseFloat(grade.toFixed(2)) })
      }
    }

    // If overall_average came as a subject, also expose it at top level
    // Note: after normaliseKey fix, moyenneGenerale is always camelCase
    const avgFromSubjects = subjects.find((s) => s.key === "moyenneGenerale")
    const overallAverage = (() => {
      if (typeof raw.overall_average === "number") return raw.overall_average
      if (typeof raw.overall_average === "string") {
        const n = parseFloat(String(raw.overall_average).replace(/,/g, "."))
        if (!isNaN(n) && n >= 0 && n <= 20) return n
      }
      return avgFromSubjects ? avgFromSubjects.grade : null
    })()

    // Known column-header strings that the model sometimes reads as subject rows
    const HEADER_NAMES = new Set([
      "الدورة الرئيسية", "دورة المراقبة", "المواد", "الدورة", "رئيسية",
      "المعدل السنوي",   // annual average row — not a subject
      "main session", "monitoring", "subjects", "matières",
    ])

    const cleanSubjects = subjects.filter((s) => {
      if (s.key === "moyenneGenerale") return false            // handled separately
      if (HEADER_NAMES.has((s.name ?? "").trim())) {
        console.log(`[vl-ocr:transcript] dropped column-header entry: "${s.name}" key="${s.key}" grade=${s.grade}`)
        return false
      }
      return true
    })

    return {
      institution:    raw.institution  ?? null,
      year:           raw.year         ?? null,
      diplomaType:    raw.diploma_type ?? null,
      subjects:       cleanSubjects,
      overallAverage: overallAverage !== null ? parseFloat(overallAverage.toFixed(2)) : null,
      confidence:     (["HIGH","MEDIUM","LOW"].includes(raw.confidence) ? raw.confidence : "MEDIUM") as TranscriptResult["confidence"],
    }
  } catch {
    console.warn("[vl-ocr] JSON parse failed for transcript result")
    return null
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function normaliseDateStr(raw: string | null): string | null {
  if (!raw) return null
  // Accept DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
  const dmy = raw.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
  if (dmy) return `${dmy[1].padStart(2,"0")}/${dmy[2].padStart(2,"0")}/${dmy[3]}`
  const ymd = raw.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/)
  if (ymd) return `${ymd[3].padStart(2,"0")}/${ymd[2].padStart(2,"0")}/${ymd[1]}`
  return raw   // return as-is, let the UI validate
}

/** Strip the data URI prefix from a base64 string if present */
export function stripDataUri(dataUri: string): string {
  const idx = dataUri.indexOf("base64,")
  return idx !== -1 ? dataUri.slice(idx + 7) : dataUri
}
