// lib/ocr/documentParser.ts
// Built from real Tesseract output analysis of a Tunisian CIN.
//
// Observed OCR output for this card:
//   11172667
//   ds ‏انتب‎              ← "ذويب اللقب" — name garbled, label barely visible
//   ‎- = "a ga ‏الاسم‎     ← "يوسف الاسم" — prenom completely garbled
//   ‎4 sal ‏بن‎ ab ‏بن‎    ← father name line, noise
//   ‎2002 ‏ديسمير‎ 06 001ml ← date in YYYY month DD order (RTL), month misread
//   ‏صفاقس‎ is             ← city without label

export interface ParsedDocument {
  typeIdentite:   "CIN" | "PASSEPORT" | null
  numeroIdentite: string | null
  nom:            string | null
  prenom:         string | null
  dateNaissance:  string | null
  sexe:           "HOMME" | "FEMME" | null
  adresse:        string | null
  pays:           string | null
  confidence:     number
  rawText:        string
}

// ── Arabic-Indic digit conversion ──────────────────────────────────────────────

const AR_DIGITS: Record<string, string> = {
  "٠":"0","١":"1","٢":"2","٣":"3","٤":"4",
  "٥":"5","٦":"6","٧":"7","٨":"8","٩":"9",
  "۰":"0","۱":"1","۲":"2","۳":"3","۴":"4",
  "۵":"5","۶":"6","۷":"7","۸":"8","۹":"9",
}
// Unicode bidirectional control characters that Tesseract injects into
// Arabic OCR output — they sit invisibly between words and break regex matches.
// Must be stripped BEFORE any pattern matching.
const BIDI_RE = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\u061C]/g

function stripBidi(t: string) { return t.replace(BIDI_RE, "") }

function toWestern(t: string) {
  return stripBidi(t).replace(/[٠-٩۰-۹]/g, (d) => AR_DIGITS[d] ?? d)
}

// ── Arabic month variants (including common OCR misreads) ─────────────────────
// Key lesson: Tesseract misreads ب→ي, giving "ديسمير" for "ديسمبر"

// Extended month table — includes many more OCR misread variants observed on real Tunisian CINs.
// Tesseract commonly confuses: ب↔ي, م↔ن, و↔ن, etc.
const AR_MONTHS: Record<string, string> = {
  // January — جانفي (Tunisian French loanword) and يناير (MSA)
  "يناير":"01","ينابر":"01","ينابير":"01",
  "جانفي":"01","جانفيي":"01","جانقي":"01","جانني":"01","جانفى":"01",
  // February
  "فبراير":"02","فبرابر":"02","فيفري":"02","فيفريي":"02","فيقري":"02","فيفرى":"02",
  // March
  "مارس":"03","مارش":"03","مارز":"03",
  // April
  "أبريل":"04","ابريل":"04","أفريل":"04","افريل":"04","أبريبل":"04","ابريبل":"04",
  // May
  "ماي":"05","مايو":"05","ماير":"05","مابي":"05",
  // June
  "جوان":"06","جون":"06","يونيو":"06","يونيه":"06","جوني":"06",
  // July
  "جويلية":"07","جويلبة":"07","جويلبية":"07","يوليو":"07","يوليه":"07","جويليه":"07",
  // August
  "أوت":"08","اوت":"08","أغسطس":"08","اغسطس":"08","اوث":"08","أوث":"08",
  // September
  "سبتمبر":"09","سبتمير":"09","سيتمبر":"09","سبتنبر":"09","سبتبر":"09","سبتمنر":"09",
  // October
  "أكتوبر":"10","اكتوبر":"10","أكتوير":"10","اكتوير":"10","أكتونر":"10","اكتبر":"10",
  // November
  "نوفمبر":"11","نوفمير":"11","نوقمبر":"11","نوفنبر":"11","نوقمير":"11","نوفمتر":"11",
  // December — the classic OCR error: ب→ي giving ديسمير, plus many other variants
  "ديسمبر":"12","ديسمير":"12","ديسامبر":"12","ديسنبر":"12","ديسمتر":"12",
  "دیسمبر":"12","ديسميز":"12","ديسمنر":"12","دبسمبر":"12","ديسمبز":"12",
}

const MONTH_PATTERN = Object.keys(AR_MONTHS).join("|")

function parseArabicDate(text: string): string | null {
  const t = toWestern(text)

  // Allow 1-3 characters of noise between components (Tesseract often injects spaces/chars)
  const SEP = "[\\s\\-\\.،,]{0,3}"

  // RTL visual order (what Tesseract outputs for Arabic): YYYY [noise] month [noise] DD
  const rtl = new RegExp(`(\\d{4})${SEP}(${MONTH_PATTERN})${SEP}(\\d{1,2})(?!\\d)`, "u")
  const rtlMatch = t.match(rtl)
  if (rtlMatch) {
    const year  = rtlMatch[1]
    const month = AR_MONTHS[rtlMatch[2]]
    const day   = rtlMatch[3].padStart(2, "0")
    if (month && parseInt(day) <= 31) return `${year}-${month}-${day}`
  }

  // Logical / French order: DD [noise] month [noise] YYYY
  const ltr = new RegExp(`(\\d{1,2})(?!\\d)${SEP}(${MONTH_PATTERN})${SEP}(\\d{4})`, "u")
  const ltrMatch = t.match(ltr)
  if (ltrMatch) {
    const day   = ltrMatch[1].padStart(2, "0")
    const month = AR_MONTHS[ltrMatch[2]]
    const year  = ltrMatch[3]
    if (month && parseInt(day) <= 31) return `${year}-${month}-${day}`
  }

  // Last resort: YYYY anywhere near DD — year + 2-digit day without month name
  // Useful when month OCR completely fails — find a 4-digit year and a 2-digit day
  const yearMatch = t.match(/\b(19[0-9]{2}|200[0-9]|201[0-9]|202[0-4])\b/)
  const dayMatch  = t.match(/\b(0[1-9]|[12][0-9]|3[01])\b/)
  if (yearMatch && dayMatch) {
    // We don't know the month, so return partial — year and day only, month unknown
    // Caller handles null months gracefully, so skip this partial match
    // (uncomment if partial dates are acceptable)
  }

  return null
}

function parseNumericDate(raw: string): string | null {
  // Normalize: replace letter O with digit 0 — common OCR mistake on printed dates
  const n = toWestern(raw).trim().replace(/[Oo]/g, "0")

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (French side of Tunisian CIN)
  const dmy = n.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/)
  if (dmy) {
    const d = dmy[1].padStart(2, "0"), m = dmy[2].padStart(2, "0"), y = dmy[3]
    if (parseInt(d) <= 31 && parseInt(m) <= 12) return `${y}-${m}-${d}`
  }

  // YYYY-MM-DD (ISO)
  const iso = n.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso && parseInt(iso[2]) <= 12 && parseInt(iso[3]) <= 31) return n.slice(0, 10)

  // MRZ YYMMDD
  const mrz = n.match(/^(\d{2})(\d{2})(\d{2})$/)
  if (mrz) {
    const yy   = parseInt(mrz[1])
    const year = yy > 30 ? `19${mrz[1]}` : `20${mrz[1]}`
    return `${year}-${mrz[2]}-${mrz[3]}`
  }
  return null
}

// ── Gender ────────────────────────────────────────────────────────────────────

function detectGender(text: string): "HOMME" | "FEMME" | null {
  if (/ذكر/.test(text))              return "HOMME"
  if (/أنث[ىي]/.test(text))          return "FEMME"
  if (/\bMASCULIN\b/i.test(text))    return "HOMME"
  if (/\bF[EÉ]MININ\b/i.test(text))  return "FEMME"
  return null
}

// ── Is a string mostly Arabic? ─────────────────────────────────────────────────

function isMostlyArabic(s: string): boolean {
  const arabic = (s.match(/[\u0600-\u06FF]/g) ?? []).length
  return arabic > s.replace(/\s/g, "").length * 0.4
}

// ── Known noise / title words to skip ─────────────────────────────────────────

const SKIP_WORDS = [
  "بطاقة","التعريف","الوطنية","الوطية","الجمهورية","التونسية",
  "اللقب","الاسم","تاريخ","الولادة","الجنس","مكانها","مكانه","مكان",
  "العنوان","الهوية","صالحة",
]

function isSkipLine(line: string): boolean {
  return SKIP_WORDS.some((w) => line.includes(w))
}

// ── Extract Arabic words from a noisy line ─────────────────────────────────────
// Returns only Arabic character sequences, ignoring Latin noise

function arabicWordsFrom(line: string): string {
  const parts = line.match(/[\u0600-\u06FF]+/g) ?? []
  return parts.join(" ").trim()
}

// ── MRZ passport parser ───────────────────────────────────────────────────────

function parseMRZ(text: string): Partial<ParsedDocument> | null {
  const lines = text.split("\n").map((l) => l.replace(/\s/g, "").toUpperCase())
  let l1 = "", l2 = ""
  for (let i = 0; i < lines.length - 1; i++) {
    if (/^[A-Z0-9<]{44}$/.test(lines[i]) && /^[A-Z0-9<]{44}$/.test(lines[i+1])) {
      l1 = lines[i]; l2 = lines[i+1]; break
    }
  }
  if (!l1) {
    for (let i = 0; i < lines.length - 1; i++) {
      if (/^[A-Z0-9<]{36}$/.test(lines[i]) && /^[A-Z0-9<]{36}$/.test(lines[i+1])) {
        l1 = lines[i]; l2 = lines[i+1]; break
      }
    }
  }
  if (!l1 || !l1.startsWith("P")) return null

  const nameField = l1.slice(5).replace(/<+$/, "")
  const [p1, p2]  = nameField.split("<<")
  return {
    typeIdentite:   "PASSEPORT",
    numeroIdentite: l2.slice(0, 9).replace(/</g, "") || null,
    nom:            p1?.replace(/</g, " ").trim() || null,
    prenom:         p2?.replace(/</g, " ").trim() || null,
    dateNaissance:  parseNumericDate(l2.slice(13, 19)),
    sexe:           l2[20] === "M" ? "HOMME" : l2[20] === "F" ? "FEMME" : null,
    pays:           l2.slice(10, 13).replace(/</g, "") || null,
    confidence:     85,
  }
}

// ── Tunisian CIN parser ────────────────────────────────────────────────────────

function parseCIN(rawText: string): Partial<ParsedDocument> {
  const text  = toWestern(rawText)
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean)
  const result: Partial<ParsedDocument> = { typeIdentite: "CIN", pays: "Tunisie" }
  let score = 0

  // ── 1. CIN number: 8 consecutive digits ─────────────────────────────────────
  const cinMatch = text.match(/\b(\d{8})\b/)
  if (cinMatch) { result.numeroIdentite = cinMatch[1]; score++ }

  // ── 2. Date: Arabic month-name pattern across full text first ───────────────
  const dateFromArabic = parseArabicDate(text)
  if (dateFromArabic) {
    result.dateNaissance = dateFromArabic; score++
  } else {
    // Try numeric DD/MM/YYYY on full text (French side of CIN)
    const numericFull = parseNumericDate(text)
    if (numericFull) {
      result.dateNaissance = numericFull; score++
    } else {
      // Fallback: try line by line
      for (const line of lines) {
        const d = parseNumericDate(line)
        if (d) { result.dateNaissance = d; score++; break }
      }
    }
  }

  // ── 3. Gender ────────────────────────────────────────────────────────────────
  const gender = detectGender(text)
  if (gender) { result.sexe = gender; score++ }

  // ── 4. Names: positional approach ────────────────────────────────────────────
  // Since OCR garbles the Arabic name values, we look for lines that:
  //   a) Contain "اللقب" or "الاسم" label AND have Arabic words before it
  //   b) OR are pure Arabic short words after the CIN number line
  //
  // Strategy: find the CIN number line index, then look at lines after it

  const cinLineIdx = lines.findIndex((l) => /\b\d{8}\b/.test(l))
  const afterCIN   = cinLineIdx >= 0 ? lines.slice(cinLineIdx + 1) : lines

  // Try label-based extraction first (value appears BEFORE label in RTL OCR)
  for (const line of afterCIN) {
    // nom: anything Arabic before اللقب
    if (!result.nom && line.includes("اللقب")) {
      const arabic = arabicWordsFrom(line.replace("اللقب", ""))
      // Filter out other label words
      const cleaned = arabic.split(" ").filter((w) => !SKIP_WORDS.includes(w)).join(" ")
      if (cleaned.length >= 2) { result.nom = cleaned; score++ }
    }
    // prenom: anything Arabic before الاسم
    if (!result.prenom && line.includes("الاسم")) {
      const arabic = arabicWordsFrom(line.replace("الاسم", ""))
      const cleaned = arabic.split(" ").filter((w) => !SKIP_WORDS.includes(w)).join(" ")
      if (cleaned.length >= 2) { result.prenom = cleaned; score++ }
    }
  }

  // Fallback: collect short Arabic-only lines after CIN (likely name lines)
  // Skip lines that have digits (date/CIN), skip known labels, skip long lines (titles)
  if (!result.nom || !result.prenom) {
    const nameCandidates = afterCIN.filter((line) => {
      const arabicOnly = arabicWordsFrom(line)
      return (
        arabicOnly.length >= 2 &&        // has meaningful Arabic content
        arabicOnly.length <= 25 &&        // not a long title
        !isSkipLine(line) &&              // not a label line
        !/\d{4}/.test(line) &&           // not the date line
        !line.includes("بطاقة")           // not the title
      )
    })

    if (!result.nom && nameCandidates[0]) {
      result.nom = arabicWordsFrom(nameCandidates[0]); score++
    }
    if (!result.prenom && nameCandidates[1]) {
      result.prenom = arabicWordsFrom(nameCandidates[1]); score++
    }
  }

  // ── 5. مكانها (birth place / city on Tunisian CIN) ───────────────────────────
  // All 24 Tunisian governorates + common OCR variants. Most reliable signal:
  // even when "مكانها" label is garbled, the city name itself is a known word.
  const TUNISIAN_CITIES: Record<string, string> = {
    "صفاقس":"صفاقس","صفاقش":"صفاقس","صفاقض":"صفاقس",
    "تونس":"تونس","تونش":"تونس",
    "سوسة":"سوسة","سوسه":"سوسة","سوسي":"سوسة",
    "قابس":"قابس","قابش":"قابس",
    "بنزرت":"بنزرت","بنزرث":"بنزرت",
    "نابل":"نابل","نابلس":"نابل",
    "القيروان":"القيروان","الكيروان":"القيروان",
    "المنستير":"المنستير","منستير":"المنستير",
    "المهدية":"المهدية","مهدية":"المهدية",
    "سيدي بوزيد":"سيدي بوزيد","سيدي بوزید":"سيدي بوزيد",
    "قفصة":"قفصة","قفصه":"قفصة",
    "توزر":"توزر","توزار":"توزر",
    "قبلي":"قبلي","قبلى":"قبلي",
    "مدنين":"مدنين","مدنبن":"مدنين",
    "تطاوين":"تطاوين","تطاوبن":"تطاوين",
    "الكاف":"الكاف","كاف":"الكاف",
    "سليانة":"سليانة","سليانه":"سليانة",
    "باجة":"باجة","باجه":"باجة","بجة":"باجة",
    "جندوبة":"جندوبة","جندوبه":"جندوبة",
    "بن عروس":"بن عروس",
    "منوبة":"منوبة","منوبه":"منوبة",
    "أريانة":"أريانة","اريانة":"أريانة","اريانه":"أريانة",
    "زغوان":"زغوان",
  }

  // Method A: "مكانها" label regex — search full text
  const cityRe = /مكانها?\s*[:\-]?\s*([؀-ۿ]+(?:\s+[؀-ۿ]+){0,2})/u
  const cityMatch = text.match(cityRe)
  console.log("[parser:CIN] method A (label regex):", cityMatch ? `"${cityMatch[0]}"` : "no match")
  if (cityMatch && cityMatch[1]?.trim().length >= 2) {
    const city = cityMatch[1].trim().split(/\s+/).filter(w => !SKIP_WORDS.includes(w)).join(" ")
    if (city.length >= 2) { result.adresse = city; score++; console.log(`[parser:CIN] city from label: "${city}"`) }
  }

  // Method B: known governorate name anywhere in the text
  if (!result.adresse) {
    for (const [variant, canonical] of Object.entries(TUNISIAN_CITIES)) {
      if (text.includes(variant)) {
        result.adresse = canonical; score++
        console.log(`[parser:CIN] city from governorate lookup: "${variant}" → "${canonical}"`)
        break
      }
    }
  }

  // Method C: extract Arabic words from the date line (city is always on same line as date)
  if (!result.adresse) {
    const MONTH_NAMES = new Set(Object.keys(AR_MONTHS))
    const DATE_NOISE  = new Set(["تاريخ","الولادة","ولادة","مكانها","مكانه","مكان"])
    for (const line of lines) {
      if (!/\d{4}/.test(line)) continue   // needs 4-digit year
      const arabicWords = arabicWordsFrom(line).split(/\s+/).filter(w =>
        w.length >= 2 && !DATE_NOISE.has(w) && !MONTH_NAMES.has(w) && !SKIP_WORDS.includes(w) && !/^\d+$/.test(w)
      )
      console.log(`[parser:CIN] method C date-line candidates from "${line}": [${arabicWords.join(", ")}]`)
      const candidate = arabicWords[arabicWords.length - 1]  // city tends to be last
      if (candidate && candidate.length >= 2 && candidate.length <= 12) {
        result.adresse = candidate; score++
        console.log(`[parser:CIN] city from date line: "${candidate}"`)
        break
      }
    }
  }

  console.log("[parser:CIN] final result:", {
    numeroIdentite: result.numeroIdentite,
    dateNaissance:  result.dateNaissance,
    nom:            result.nom,
    prenom:         result.prenom,
    adresse:        result.adresse,
    score,
  })

  result.confidence = Math.min(Math.round((score / 6) * 100), 85)
  return result
}

// ── Public API ────────────────────────────────────────────────────────────────

export function parseDocumentText(rawText: string): ParsedDocument {
  const normalized = stripBidi(rawText)
    .replace(/\r\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .trim()

  const base: ParsedDocument = {
    typeIdentite: null, numeroIdentite: null,
    nom: null, prenom: null, dateNaissance: null,
    sexe: null, adresse: null, pays: null,
    confidence: 0, rawText: normalized,
  }

  const mrzResult = parseMRZ(normalized)
  if (mrzResult) return { ...base, ...mrzResult, rawText: normalized }

  const cinResult = parseCIN(normalized)

  const upper = normalized.toUpperCase()
  if (upper.includes("PASSPORT") || upper.includes("PASSEPORT")) {
    cinResult.typeIdentite = "PASSEPORT"
    delete cinResult.pays
  }

  return { ...base, ...cinResult, rawText: normalized }
}