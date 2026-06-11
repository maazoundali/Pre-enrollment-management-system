/**
 * OCR model comparison — llava:7b  vs  minicpm-v
 * Usage:  node scripts/benchmark-ocr.mjs <path-to-transcript-image.png>
 *
 * No database. No Next.js. Just Ollama.
 * Runs the exact transcript prompt from lib/ocr/vl-ocr.ts against both models
 * and prints raw JSON output for report benchmarking.
 *
 * To get a transcript image from a PDF:
 *   Windows: open the PDF in Edge → Ctrl+P → Microsoft Print to PDF on A4
 *   Or:  run scripts/pdf-to-png.ps1 to auto-convert the first page.
 */

import fs from "fs"
import path from "path"

const OLLAMA_URL = "http://localhost:11434"

// ── Prompts — exact copy from lib/ocr/vl-ocr.ts ───────────────────────────────

const SYSTEM_PROMPT = `You are an OCR expert specialized in Tunisian academic transcripts (BAC, Licence, Master).
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

const USER_PROMPT = `Look at this Tunisian BAC grade transcript image (Arabic right-to-left document).

TABLE LAYOUT (3 columns, right to left):
  • Column A — RIGHTMOST  "المواد"           subject names
  • Column B — MIDDLE     "الدورة الرئيسية"  MAIN SESSION grades  ← READ ONLY THIS
  • Column C — LEFTMOST   "دورة المراقبة"    monitoring           ← IGNORE COMPLETELY

Step 1: Find the header row containing these column labels.
Step 2: For each data row, pair the subject name (column A) with its grade in column B only.
  Do NOT use any value from column C (دورة المراقبة).

Return grades as numbers. Convert comma decimals: "06,25" → 6.25, "08,00" → 8.0.

Subject names and their keys:
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
- If you CANNOT read a subject name → use "row_N" (N = row number) as name, null as key.
- Do NOT repeat the same key twice.
- Maximum 15 entries.

Respond with ONLY this JSON:
{
  "institution": null,
  "year": "YYYY",
  "diploma_type": "BAC",
  "subjects": [
    { "name": "SUBJECT_NAME", "key": "KEY", "grade": X.XX }
  ],
  "overall_average": X.XX,
  "confidence": "HIGH"
}`

// ── OCR runner ─────────────────────────────────────────────────────────────────

async function runOCR(modelName, imageBase64) {
  console.log(`\n${"═".repeat(72)}`)
  console.log(`  MODEL : ${modelName}`)
  console.log(`${"═".repeat(72)}`)
  console.log(`  Sending image to Ollama... (VL models can take 30-120s on CPU)`)

  const start = Date.now()
  let res
  try {
    res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model:   modelName,
        stream:  false,
        options: { temperature: 0.0, num_predict: 2500, repeat_penalty: 1.05 },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: USER_PROMPT, images: [imageBase64] },
        ],
      }),
      signal: AbortSignal.timeout(300_000),  // 5 min — VL on CPU is slow
    })
  } catch (err) {
    console.log(`\n  ✗ Network/timeout error: ${err.message}\n`)
    return
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  if (!res.ok) {
    const txt = await res.text().catch(() => "")
    console.log(`\n  ✗ HTTP ${res.status}: ${txt.slice(0, 120)}\n`)
    return
  }

  const data = await res.json()
  const raw  = (data.message?.content ?? "").trim()

  console.log(`\n  ┌─ RAW RESPONSE (${elapsed}s / ${raw.length} chars) ${"─".repeat(28)}`)
  raw.split("\n").forEach(line => console.log(`  │  ${line}`))
  console.log(`  └${"─".repeat(60)}`)

  // Post-process: fix Arabic comma decimals then parse
  const clean = raw.replace(/```json\n?/gi, "").replace(/```\n?/g, "").trim()
  const match = clean.match(/\{[\s\S]*\}/)
  if (!match) {
    console.log("\n  ✗ PARSE RESULT : No JSON found\n")
    return
  }

  let fixedJson = match[0]
    .replace(/\b(\d{1,2}),(\d{2})\b/g, "$1.$2")     // 08,75 → 08.75
    .replace(/:\s*0([1-9]\d*(?:\.\d+)?)/g, ": $1")  // 08.75 → 8.75

  let parsed
  try { parsed = JSON.parse(fixedJson) }
  catch (e) {
    console.log(`\n  ✗ PARSE RESULT : Invalid JSON — ${e.message}`)
    console.log(`    Attempted to parse: ${fixedJson.slice(0, 200)}\n`)
    return
  }

  const subjects = Array.isArray(parsed.subjects) ? parsed.subjects : []
  const avg      = parsed.overall_average ?? "(not found)"
  const conf     = parsed.confidence ?? "?"

  console.log(`\n  ┌─ PARSED GRADES (${subjects.length} subjects, confidence: ${conf}) ${"─".repeat(20)}`)
  subjects.forEach(s => {
    const name  = (s.name  ?? "?").padEnd(28)
    const key   = (s.key   ?? "null").padEnd(16)
    const grade = s.grade != null ? `${s.grade}/20` : "null"
    console.log(`  │  ${name} key: ${key} grade: ${grade}`)
  })
  console.log(`  │  ${"─".repeat(56)}`)
  console.log(`  │  Overall average : ${avg}/20`)
  console.log(`  └${"─".repeat(60)}\n`)
}

// ── Main ────────────────────────────────────────────────────────────────────────

const imagePath = process.argv[2]

if (!imagePath) {
  console.error(`
  Usage: node scripts/benchmark-ocr.mjs <path-to-transcript-image.png>

  To get a transcript image from the project uploads:
    PowerShell: node scripts/pdf-to-png.ps1
    Or open the PDF in Edge/Chrome and screenshot the page (Win+Shift+S).

  Example paths in this project:
    public/uploads/04c9e3e0-.../1778210181109-relevenotesbqc.pdf  ← needs conversion
    public/uploads/14ae33cb-.../1778110462039-relevenotesbqc.pdf  ← needs conversion
`)
  process.exit(1)
}

if (!fs.existsSync(imagePath)) {
  console.error(`\n  ✗ File not found: ${imagePath}\n`)
  process.exit(1)
}

const ext = path.extname(imagePath).toLowerCase()
if (![".jpg", ".jpeg", ".png"].includes(ext)) {
  console.error(`\n  ✗ File must be a JPG or PNG image (got ${ext})`)
  console.error(`    For PDF files, first run: powershell -File scripts/pdf-to-png.ps1 "${imagePath}"\n`)
  process.exit(1)
}

const imageBytes  = fs.readFileSync(imagePath)
const imageBase64 = imageBytes.toString("base64")
const fileSizeKB  = Math.round(imageBytes.length / 1024)

console.log("\n" + "╔" + "═".repeat(70) + "╗")
console.log("║   OCR BENCHMARK — llava:7b  vs  minicpm-v" + " ".repeat(27) + "║")
console.log("╚" + "═".repeat(70) + "╝")
console.log(`\n  Image : ${path.basename(imagePath)} (${fileSizeKB} KB)`)
console.log("  Task  : Extract Arabic BAC transcript grades (RTL table, 3 columns)")
console.log("  Key   : Read only the MIDDLE column (الدورة الرئيسية), ignore right/left")

await runOCR("llava:7b", imageBase64)
await runOCR("minicpm-v", imageBase64)

console.log("═".repeat(72))
console.log("  OCR benchmark complete.")
console.log("═".repeat(72) + "\n")
