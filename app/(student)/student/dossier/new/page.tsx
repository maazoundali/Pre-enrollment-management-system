"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import ConfirmModal from "@/components/ConfirmModal"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"
import { parseDocumentText } from "@/lib/ocr/documentParser"
import { DIPLOMA_TYPES, type DiplomaType } from "@/lib/diploma-types"
import { preprocessCIN, preprocessTranscript, preprocessTranscriptForVL } from "@/lib/ocr/preprocess"
import FilePreview from "@/components/FilePreview"
import { isEligibleFiliere, ELIGIBLE_CATEGORIES } from "@/lib/quick-recommend"
export interface QuickRec {
  filiereId:   string
  nom:         string
  score:       number
  riskLevel:   "SAFE" | "MODERATE" | "RISKY"
  confidence:  "HIGH" | "MEDIUM" | "LOW" | "INSUFFICIENT"
  strengths:   string[]
  weaknesses:  string[]
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface Filiere { id: string; nom: string; categorie: string | null; description: string | null; capacite: number | null; inscrits: number | null; estComplete: boolean; tauxRemplissage: number; capaciteStatut?: string; duree: string | null; diplomeDelivre: string | null; langue: string | null; fraisInscription: number | null }
type UploadStatus = "idle" | "uploading" | "done" | "error"
type DiploEntry = {
  intitule: string; annee: string; etablissement: string
  type: string; sousType: string; champs: Record<string, string>
  ocrFilled: Record<string, boolean>
  certFile?: File; certStatus: UploadStatus
  releveFile?: File; releveStatus: UploadStatus
  scanning: boolean
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = { width:"100%", padding:"11px 14px", fontSize:"14px", color:"#f8fafc", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:"12px", outline:"none", boxSizing:"border-box", fontFamily:"inherit", transition:"border-color 0.2s" }
const inpGold: React.CSSProperties = { ...inp, borderColor:"rgba(245,200,66,0.45)", background:"rgba(245,200,66,0.05)" }
const lbl: React.CSSProperties = { display:"block", fontSize:"10.5px", fontWeight:700, letterSpacing:"0.1em", textTransform:"uppercase", color:"#64748b", marginBottom:"7px" }
const sel: React.CSSProperties = { ...inp, appearance:"none", WebkitAppearance:"none", background:"#0f1e3d", cursor:"pointer" }
const btnP: React.CSSProperties = { padding:"13px 28px", borderRadius:"12px", border:"none", background:"linear-gradient(135deg,#f5c842,#e8a820)", color:"#060d1f", fontSize:"14px", fontWeight:700, cursor:"pointer", fontFamily:"inherit", boxShadow:"0 4px 16px rgba(232,184,32,0.3)" }
const btnS: React.CSSProperties = { padding:"12px 20px", borderRadius:"12px", border:"1px solid rgba(255,255,255,0.12)", background:"transparent", color:"#94a3b8", fontSize:"13px", cursor:"pointer", fontFamily:"inherit" }

const emptyDiplo = (): DiploEntry => ({
  intitule:"", annee:"", etablissement:"", type:"", sousType:"", champs:{}, ocrFilled:{},
  certStatus:"idle", releveStatus:"idle", scanning:false,
})

// ── Component ──────────────────────────────────────────────────────────────────

export default function NewDossierPage() {
  const router = useRouter()
  const { user, refresh } = useAuth()
  const { t, locale } = useI18n()
  const [step, setStep]           = useState(1)
  const [dossierId, setDossierId] = useState("")
  const [filieres, setFilieres]   = useState<Filiere[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState("")
  const [showSubmitModal, setShowSubmitModal] = useState(false)

  // ── Step 1: Profile ──────────────────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    dateNaissance:  user?.dateNaissance?.split("T")[0] ?? "",
    typeIdentite:   (user?.typeIdentite ?? "CIN") as "CIN" | "PASSEPORT",
    numeroIdentite: user?.numeroIdentite ?? "",
    pays:           user?.pays ?? "",
    telephone:      user?.telephone ?? "",
    adresse:        user?.adresse ?? "",
  })
  const [profilePrefilled, setProfilePrefilled] = useState<Set<string>>(new Set())
  const [scanning, setScanning]         = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanDone, setScanDone]         = useState(!!user?.numeroIdentite)
  const [scanMsg, setScanMsg]           = useState("")
  const [previewUrl, setPreviewUrl]     = useState<string|null>(null)
  const [cinFile, setCinFile]           = useState<File|null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Step 2: Documents (Photo only) ───────────────────────────────────────────
  const [photoFile, setPhotoFile]     = useState<File|null>(null)
  const [photoStatus, setPhotoStatus] = useState<UploadStatus>("idle")
  const [profileDocPrefilled, setProfileDocPrefilled] = useState(false)

  // ── Step 3: Parcours & Diplômes + real-time recommendations ──────────────────
  const [niveauEtude, setNiveauEtude]       = useState("")
  const [niveauConfirmed, setNiveauConfirmed] = useState(false)
  const [typeCours, setTypeCours]           = useState("")
  const [sourceDecouverte, setSource]       = useState("")
  const [diplomes, setDiplomes]             = useState<DiploEntry[]>([emptyDiplo()])
  const [notes, setNotes]                   = useState<Record<string,string>>({})
  const [quickRecs, setQuickRecs]           = useState<QuickRec[]>([])
  const recTimer = useRef<ReturnType<typeof setTimeout>|null>(null)

  // ── Step 4: Filière ──────────────────────────────────────────────────────────
  const [selectedFiliere, setFiliere] = useState("")

  const steps = [
    t("student.dossierNew.steps.0"),
    t("student.dossierNew.steps.1"),
    t("student.dossierNew.steps.2"),
    t("student.dossierNew.steps.3"),
  ]

  // Block access if the student already has an active dossier
  useEffect(() => {
    fetch("/api/dossiers?limit=1").then(r => r.json()).then(d => {
      const active = (d.dossiers ?? []).find((x: { statut: string }) => x.statut !== "REJETE")
      if (active) router.replace(`/student/dossier/${active.id}`)
    })
  }, [router])

  useEffect(() => {
    fetch("/api/filieres").then((r) => r.json()).then((d) => setFilieres(d.filieres ?? []))
    // Restore CIN from profile completion session
    try {
      const b64 = sessionStorage.getItem("cin_doc_base64")
      const name = sessionStorage.getItem("cin_doc_name")
      const mime = sessionStorage.getItem("cin_doc_type")
      if (b64 && name && mime) {
        const byteStr = atob(b64.split(",")[1])
        const arr = new Uint8Array(byteStr.length)
        for (let i = 0; i < byteStr.length; i++) arr[i] = byteStr.charCodeAt(i)
        const file = new File([arr], name, { type: mime })
        setCinFile(file)
        setProfileDocPrefilled(true)
        sessionStorage.removeItem("cin_doc_base64")
        sessionStorage.removeItem("cin_doc_name")
        sessionStorage.removeItem("cin_doc_type")
      }
    } catch { /* ignore */ }
  }, [])

  // Pre-fill profile form when user loads
  useEffect(() => {
    if (user) {
      setProfileForm({
        dateNaissance:  user.dateNaissance?.split("T")[0] ?? "",
        typeIdentite:   (user.typeIdentite ?? "CIN") as "CIN"|"PASSEPORT",
        numeroIdentite: user.numeroIdentite ?? "",
        pays:           user.pays ?? "",
        telephone:      user.telephone ?? "",
        adresse:        user.adresse ?? "",
      })
      if (user.numeroIdentite) setScanDone(true)
    }
  }, [user])

  // ── Pre-populate diplomas based on niveau d'étude ────────────────────────────

  function makeEntry(type: string, intitule: string, locked = false): DiploEntry {
    return { ...emptyDiplo(), type, intitule, locked } as DiploEntry & { locked: boolean }
  }

  // Each entry: { type, intitule (locked label shown to student), hasGrades (shows releve upload) }
  function buildRequiredDiplomes(niveau: string): DiploEntry[] {
    const bac = (): DiploEntry => ({ ...emptyDiplo(), type:"BAC", intitule:"Baccalauréat" })
    switch (niveau) {
      case "BACCALAUREAT":
        // One entry: BAC diploma + its releve de notes
        return [bac()]
      case "LICENCE_1":
        // In 1st year of licence — only have their BAC
        return [bac()]
      case "LICENCE_2":
        // Completed L1 — need BAC + releve de notes de L1
        return [
          bac(),
          { ...emptyDiplo(), type:"LICENCE", intitule:"Relevé de notes — 1ère année Licence" },
        ]
      case "LICENCE_3":
        // Completed L1 + L2 — need BAC + releve L1 + releve L2
        return [
          bac(),
          { ...emptyDiplo(), type:"LICENCE", intitule:"Relevé de notes — 1ère année Licence" },
          { ...emptyDiplo(), type:"LICENCE", intitule:"Relevé de notes — 2ème année Licence" },
        ]
      case "MASTER_1":
        // Has Licence diploma + its releve
        return [
          { ...emptyDiplo(), type:"LICENCE", intitule:"Diplôme de Licence" },
        ]
      case "MASTER_2":
        // Has Licence + completed M1
        return [
          { ...emptyDiplo(), type:"LICENCE", intitule:"Diplôme de Licence" },
          { ...emptyDiplo(), type:"MASTER",  intitule:"Relevé de notes — 1ère année Master" },
        ]
      case "DOCTORAT":
        return [
          { ...emptyDiplo(), type:"MASTER", intitule:"Diplôme de Master" },
        ]
      default:
        return [emptyDiplo()]
    }
  }

  function handleNiveauChange(val: string) {
    setNiveauEtude(val)
    setNiveauConfirmed(false)
    if (val) {
      // Always rebuild the diploma list when niveau changes — required docs depend on it
      setDiplomes(buildRequiredDiplomes(val))
      setNiveauConfirmed(true)
    }
  }

  // Collect ALL grades from all diploma entries merged into one flat object
  const collectAllGrades = useCallback((): Record<string, string | number> => {
    const all: Record<string, string | number> = { ...notes }
    for (const d of diplomes) {
      for (const [k, v] of Object.entries(d.champs)) {
        if (v !== "" && v !== undefined) all[k] = v
      }
    }
    return all
  }, [notes, diplomes])

  // Real-time recommendations — call server API, debounced 700ms
  // Fires on niveauEtude OR any grade change in any diploma entry
  const updateRecs = useCallback(async () => {
    if (!niveauEtude) { setQuickRecs([]); return }
    if (niveauEtude === "BACCALAUREAT") {
      const bacDip = diplomes.find(d => d.type === "BAC")
      if (!bacDip?.sousType) { setQuickRecs([]); return }
    }
    const grades = collectAllGrades()
    setRecLoading(true)
    try {
      // Send diploma context so the engine can detect BAC series + trend
      const diplomaContext = diplomes.map((d) => ({
        type: d.type, sousType: d.sousType, champs: d.champs,
      }))
      const res = await fetch("/api/recommend-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niveauEtude, grades, diplomes: diplomaContext }),
      })
      if (res.ok) {
        const data = await res.json()
        setQuickRecs(data.recommendations ?? [])
      } else {
        console.warn("[recommend-preview] API error:", res.status, await res.text().catch(()=>""))
      }
    } catch (e) { console.warn("[recommend-preview] fetch error:", e) }
    finally { setRecLoading(false) }
  }, [niveauEtude, collectAllGrades, diplomes])

  useEffect(() => {
    if (recTimer.current) clearTimeout(recTimer.current)
    recTimer.current = setTimeout(() => { void updateRecs() }, 700)
    return () => { if (recTimer.current) clearTimeout(recTimer.current) }
  }, [updateRecs])

  // ── OCR for CIN scan ─────────────────────────────────────────────────────────

  async function handleProfileScan(file: File) {
    if (scanning) return
    setScanning(true); setScanDone(false); setScanProgress(0)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setCinFile(file)
    try {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          sessionStorage.setItem("cin_doc_base64", reader.result as string)
          sessionStorage.setItem("cin_doc_name", file.name)
          sessionStorage.setItem("cin_doc_type", file.type)
        } catch { /* ignore */ }
      }
      reader.readAsDataURL(file)
    } catch { /* ignore */ }

    try {
      const { createWorker } = await import("tesseract.js")
      const worker = await createWorker("ara+fra+eng", 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "loading tesseract core")           setScanProgress(10)
          else if (m.status === "loading language traineddata") setScanProgress(25)
          else if (m.status === "initializing api")             setScanProgress(45)
          else if (m.status === "recognizing text")             setScanProgress(Math.round(45 + m.progress * 50))
        },
      })
      let target: File | HTMLCanvasElement = file
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        setScanProgress(15)
        const pdfjsLib = await import("pdfjs-dist")
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`
        const buf = await file.arrayBuffer()
        const pdf = await pdfjsLib.getDocument({ data: buf }).promise
        const page = await pdf.getPage(1)
        const vp = page.getViewport({ scale: 2 })
        const canvas = document.createElement("canvas")
        canvas.width = vp.width; canvas.height = vp.height
        await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas }).promise
        target = preprocessCIN(canvas); setScanProgress(35)
      }
      const { data } = await worker.recognize(target)
      await worker.terminate(); setScanProgress(100)
      if (!data.text.trim()) throw new Error("Aucun texte détecté.")
      const extracted = parseDocumentText(data.text)
      const newForm = { ...profileForm }
      const prefilled = new Set<string>()
      const map: Partial<Record<keyof typeof profileForm, string | null>> = {
        dateNaissance:  extracted.dateNaissance,
        typeIdentite:   extracted.typeIdentite as "CIN"|"PASSEPORT"|null,
        numeroIdentite: extracted.numeroIdentite,
        adresse:        extracted.adresse,
        pays:           extracted.pays,
      }
      for (const [k, v] of Object.entries(map)) {
        if (v) { (newForm as Record<string,string>)[k] = v; prefilled.add(k) }
      }
      setProfileForm(newForm); setProfilePrefilled(prefilled)
      setScanDone(true)
      setScanMsg(prefilled.size > 0 ? `${prefilled.size} champ(s) rempli(s) automatiquement` : "Document analysé — vérifiez les champs")
    } catch (err) {
      setScanMsg(err instanceof Error ? err.message : "Erreur lors de l'analyse")
    } finally { setScanning(false) }
  }

  // ── Step 1 → 2: save profile ─────────────────────────────────────────────────

  async function handleSaveProfile() {
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dateNaissance:  profileForm.dateNaissance  || undefined,
          typeIdentite:   profileForm.typeIdentite   || undefined,
          numeroIdentite: profileForm.numeroIdentite || undefined,
          pays:           profileForm.pays           || undefined,
          telephone:      profileForm.telephone      || undefined,
          adresse:        profileForm.adresse        || undefined,
        }),
      })
      if (!res.ok) throw new Error(t("common.error"))
      await refresh()
      setStep(2)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : t("common.error")) }
    finally { setLoading(false) }
  }

  // ── Step 2: create dossier + upload photo + auto-upload CIN ─────────────────

  async function handleCreateDossier() {
    if (!photoFile && photoStatus !== "done") { setError(t("student.dossierNew.step1.missingDocs", { docs: t("student.dossierNew.step1.docs.PHOTO.label") })); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/dossiers", { method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ filiereId:null }) })
      if (!res.ok) throw new Error(t("common.error"))
      const { dossier } = await res.json()
      const id = dossier.id
      setDossierId(id)

      // Auto-upload CIN from profile scan
      if (cinFile) {
        const fd = new FormData(); fd.append("file", cinFile); fd.append("type", "CNI")
        await fetch(`/api/dossiers/${id}/documents`, { method:"POST", body:fd })
      }

      // Upload photo — then refresh auth so avatarUrl is immediately visible in sidebar
      if (photoFile) {
        setPhotoStatus("uploading")
        const fd = new FormData(); fd.append("file", photoFile); fd.append("type", "PHOTO")
        const r = await fetch(`/api/dossiers/${id}/documents`, { method:"POST", body:fd })
        setPhotoStatus(r.ok ? "done" : "error")
        if (r.ok) refresh()   // update avatarUrl in auth context immediately
      }

      setStep(3)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : t("common.error")) }
    finally { setLoading(false) }
  }

  // ── Step 3 helpers ────────────────────────────────────────────────────────────

  const updDiplo = (i: number, patch: Partial<DiploEntry>) =>
    setDiplomes((p) => { const n=[...p]; n[i]={...n[i],...patch}; return n })

  // ── File → base64 PNG (handles PDF → canvas) ─────────────────────────────────
  async function fileToBase64(
    file: File,
    preprocess?: (c: HTMLCanvasElement) => HTMLCanvasElement,
  ): Promise<string> {
    if (file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) {
      const pdfjsLib = await import("pdfjs-dist")
      // Use local worker (avoids CDN CORS issues for WASM fetch)
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
      const buf = await file.arrayBuffer()
      // wasmUrl points to local public/wasm/ — worker fetches jbig2.wasm from same origin
      const pdf = await pdfjsLib.getDocument({ data: buf, wasmUrl: "/wasm/" } as Parameters<typeof pdfjsLib.getDocument>[0]).promise
      console.log(`[pdfjs] document loaded, numPages=${pdf.numPages}`)
      const page = await pdf.getPage(1)
      const vp = page.getViewport({ scale: 3 })
      const canvas = document.createElement("canvas")
      canvas.width = vp.width; canvas.height = vp.height
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas }).promise
      console.log(`[pdfjs] rendered at ${canvas.width}×${canvas.height}`)
      return (preprocess ? preprocess(canvas) : canvas).toDataURL("image/png")
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (!preprocess) { resolve(reader.result as string); return }
        const img = new Image()
        img.onload = () => {
          const raw = document.createElement("canvas")
          raw.width = img.naturalWidth || img.width
          raw.height = img.naturalHeight || img.height
          raw.getContext("2d")!.drawImage(img, 0, 0)
          resolve(preprocess(raw).toDataURL("image/png"))
        }
        img.onerror = reject
        img.src = reader.result as string
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // ── Tesseract fallback for transcript ─────────────────────────────────────────
  async function tesseractTranscript(imageBase64: string): Promise<Record<string,string>> {
    console.log("[tesseract:transcript] starting recognition…")
    const img = new Image()
    await new Promise<void>((res) => { img.onload = () => res(); img.src = imageBase64 })
    console.log(`[tesseract:transcript] canvas size: ${img.width}×${img.height}`)
    const canvas = document.createElement("canvas")
    canvas.width = img.width; canvas.height = img.height
    canvas.getContext("2d")!.drawImage(img, 0, 0)
    const { createWorker } = await import("tesseract.js")
    const worker = await createWorker("ara+fra+eng", 1, { logger: () => {} })
    const { data } = await worker.recognize(canvas)
    await worker.terminate()
    console.log("[tesseract:transcript] confidence:", data.confidence)
    console.log("[tesseract:transcript] raw text:\n---\n" + data.text + "\n---")
    const clean = data.text
      .replace(/[‎‏‪-‮⁦-⁩؜]/g,"")
      .replace(/[٠-٩]/g,(d)=>String(d.charCodeAt(0)-0x0660))
    const lines = clean.split("\n").map(l=>l.trim()).filter(Boolean)
    console.log(`[tesseract:transcript] ${lines.length} non-empty lines after cleanup`)

    const PATTERNS = [
      { key:"math",            kw:["رياضيات","الرياضيات","mathémat","math"] },
      { key:"physique",        kw:["علوم فيزيائية","فيزياء وكيمياء","الفيزياء والكيمياء","فيزياء","الفيزياء","physique","sciences physiq"] },
      { key:"svt",             kw:["علوم الحياة والأرض","علوم طبيع","العلوم الطبيعية","علوم الحياة","svt","biolog"] },
      { key:"francais",        kw:["فرنسية","الفرنسية","قرنسية","français","francais"] },  // قرنسية = OCR misread
      { key:"arabe",           kw:["اللغة العربية","عربية","العربية","arabe"] },
      { key:"anglais",         kw:["انقليزية","انجليزية","الإنجليزية","إنجليزية","anglais","english"] },
      { key:"informatique",    kw:["إعلامية","الإعلامية","معلوماتية","informatique"] },
      { key:"histoire_geo",    kw:["تاريخ وجغرافيا","histoire géog","géograph"] },
      { key:"philosophie",     kw:["فلسفة","الفلسفة","قلسفة","فلسقة","philosophie"] },  // قلسفة/فلسقة = OCR misreads
      { key:"techno",          kw:["تكنول","علوم تقنية","technolog"] },
      { key:"economie",        kw:["اقتصاد","الاقتصاد","économie","econom"] },
      { key:"gestion",         kw:["تصرف","التصرف","gestion"] },
      { key:"sport",           kw:["تربية بدنية","التربية البدنية","sport","éducation physiq"] },
      { key:"moyenneGenerale", kw:["المعدل","معدل","moyenne"] },
    ]

    // Skip header / metadata lines that contain date or registration patterns
    function isHeaderLine(line: string): boolean {
      return /\d{4}[\/\-]\d{2}[\/\-]\d{2}/.test(line) ||
             /\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(line) ||
             /ولادة|ترسيم|الشعبة|وزارة|الجمهورية|بيان|دورة|تونس في/.test(line)
    }

    function pickGrade(line: string): number | null {
      // Normalise comma decimals: "17,87" → "17.87" and "05,50" → "05.50"
      let norm = line.replace(/(\d)[,،](\d{2})(?!\d)/g, "$1.$2")
      // Recover merged grades: "1787" → "17.87", "0550" → "5.50"
      norm = norm.replace(/\b((?:20|1[0-9]|0[0-9])(\d{2}))\b/g, (_, full: string, dec: string) => {
        const intPart = full.slice(0, full.length - 2)
        return `${intPart}.${dec}`
      })
      const nums = [...norm.matchAll(/\b((?:20|1[0-9]|0?[0-9])(?:\.\d{1,2})?)\b/g)]
        .map(m => parseFloat(m[1])).filter(n => !isNaN(n) && n >= 0 && n <= 20)
      if (!nums.length) return null
      const dec = nums.filter(n => !Number.isInteger(n))
      return dec.length ? dec[0] : (nums.filter(n => n >= 5)[0] ?? null)
    }

    const champs: Record<string,string> = {}
    const nonHeaderLines = lines.filter(l => !isHeaderLine(l))

    // Pass 1: grade + subject on the same line (e.g. "11,00 فرنسية A")
    for (const line of nonHeaderLines) {
      const lower = line.toLowerCase(); const grade = pickGrade(line)
      if (grade === null) continue
      for (const {key,kw} of PATTERNS) {
        if (kw.some(k => lower.includes(k))) {
          console.log(`[tesseract:transcript] pass1 matched "${key}" = ${grade} from: "${line}"`)
          champs[key] = String(grade); break
        }
      }
    }

    // Pass 2: grade on its own line — look ±2 lines for the subject keyword
    // (table columns sometimes split onto adjacent lines in RTL OCR)
    for (let i = 0; i < nonHeaderLines.length; i++) {
      const grade = pickGrade(nonHeaderLines[i])
      if (grade === null) continue
      const windowLines = nonHeaderLines.slice(Math.max(0, i - 2), i + 3).join(" ").toLowerCase()
      for (const {key,kw} of PATTERNS) {
        if (champs[key]) continue  // already found in pass 1
        if (kw.some(k => windowLines.includes(k))) {
          console.log(`[tesseract:transcript] pass2 matched "${key}" = ${grade} via window around: "${nonHeaderLines[i]}"`)
          champs[key] = String(grade); break
        }
      }
    }

    console.log("[tesseract:transcript] final grades:", champs)
    return champs
  }

  // ── Helper: apply extracted grades to diploma state (no stale closure) ─────────
  function applyGrades(idx: number, newChamps: Record<string, string>) {
    if (Object.keys(newChamps).length === 0) return
    const newOcr = Object.fromEntries(Object.keys(newChamps).map(k => [k, true]))
    setDiplomes(prev => {
      const n = [...prev]
      n[idx] = { ...n[idx], champs: { ...n[idx].champs, ...newChamps }, ocrFilled: { ...n[idx].ocrFilled, ...newOcr } }
      return n
    })
  }

  // ── Main transcript scanner: minicpm-v primary, Tesseract fallback ────────────
  async function scanReleveForDiploma(idx: number, file: File) {
    updDiplo(idx, { scanning: true })
    try {
      console.log(`[scan:transcript] starting — file: "${file.name}" (${(file.size/1024).toFixed(1)} KB)`)
      // Two separate images: VL needs grayscale (no threshold), Tesseract needs binarized
      const imageBase64ForVL  = await fileToBase64(file, preprocessTranscriptForVL)
      const imageBase64       = await fileToBase64(file, preprocessTranscript)
      console.log("[scan:transcript] images prepared — grayscale for VL, binarized for Tesseract")

      let newChamps: Record<string, string> = {}
      let usedVL = false

      // 1. minicpm-v (primary)
      try {
        const t0 = Date.now()
        const res = await fetch("/api/ocr/document", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: imageBase64ForVL, documentType: "TRANSCRIPT", sousType: diplomes[idx].sousType || null }),
        })
        console.log(`[scan:transcript] minicpm-v responded in ${Date.now()-t0}ms — HTTP ${res.status}`)
        if (res.ok) {
          const json = await res.json() as {
            success: boolean; fallback: boolean; confidence: string | null
            data: { subjects?: { key: string; grade: number }[]; overallAverage?: number | null } | null
          }
          console.log(`[scan:transcript] minicpm-v success=${json.success} fallback=${json.fallback} confidence=${json.confidence}`)
          console.log(`[scan:transcript] minicpm-v subjects:`, json.data?.subjects ?? [])
          console.log(`[scan:transcript] minicpm-v overallAverage:`, json.data?.overallAverage)
          if (json.success && json.data) {
            // Get the diploma's known field order for positional fallback
            const diploEntry    = diplomes[idx]
            const dtDef         = DIPLOMA_TYPES.find(x => x.key === diploEntry.type)
            const stDef         = dtDef?.subtypes?.find(x => x.key === diploEntry.sousType)
            const fieldOrder    = (stDef?.fields ?? dtDef?.fields ?? [])
              .filter(f => f.type === "grade").map(f => f.key)
            console.log(`[scan:transcript] diploma field order for positional mapping:`, fieldOrder)

            const orphanGrades: number[] = []  // grades whose key is __row_N
            for (const s of json.data.subjects ?? []) {
              if (s.grade < 0 || s.grade > 20) {
                console.log(`[scan:transcript] VL skipped grade out of range: ${s.key} = ${s.grade}`)
                continue
              }
              if (s.key && !s.key.startsWith("__row_")) {
                newChamps[s.key] = String(s.grade)
                console.log(`[scan:transcript] VL grade: ${s.key} = ${s.grade}`)
              } else {
                orphanGrades.push(s.grade)
                console.log(`[scan:transcript] VL orphan grade (no subject): ${s.grade}`)
              }
            }

            // Map orphan grades to field order slots not yet filled
            if (orphanGrades.length > 0 && fieldOrder.length > 0) {
              const missingKeys = fieldOrder.filter(k => !newChamps[k])
              console.log(`[scan:transcript] positional mapping: ${orphanGrades.length} orphans → ${missingKeys.length} missing fields:`, missingKeys)
              orphanGrades.forEach((g, i) => {
                if (i < missingKeys.length) {
                  newChamps[missingKeys[i]] = String(g)
                  console.log(`[scan:transcript] positional: ${missingKeys[i]} = ${g}`)
                }
              })
            }

            if (json.data.overallAverage != null && json.data.overallAverage >= 0 && json.data.overallAverage <= 20) {
              newChamps["moyenneGenerale"] = String(json.data.overallAverage)
              console.log(`[scan:transcript] VL average: ${json.data.overallAverage}`)
            }
            usedVL = Object.keys(newChamps).length > 0
            console.log(`[scan:transcript] VL extracted ${Object.keys(newChamps).length} grades after positional mapping:`, newChamps)
          } else {
            console.warn("[scan:transcript] VL returned no data")
          }
        } else {
          console.warn(`[scan:transcript] VL HTTP error: ${res.status}`)
        }
      } catch(vlErr) {
        console.warn("[scan:transcript] VL call failed:", vlErr)
      }

      // 2. Tesseract fallback if VL returned nothing
      if (!usedVL) {
        console.log("[scan:transcript] VL returned nothing → Tesseract fallback")
        newChamps = await tesseractTranscript(imageBase64)
        console.log(`[scan:transcript] Tesseract extracted ${Object.keys(newChamps).length} grades:`, newChamps)
      }

      applyGrades(idx, newChamps)

    } catch(e) { console.warn("[OCR transcript]", e) }
    finally { updDiplo(idx, { scanning: false }) }
  }

  async function uploadDiplomaFile(dossierId:string, file:File, docType:string) {
    const fd=new FormData(); fd.append("file",file); fd.append("type",docType)
    await fetch(`/api/dossiers/${dossierId}/documents`,{method:"POST",body:fd})
  }

  // ── Step 3 → 4: save academic ─────────────────────────────────────────────────

  async function handleSaveAcademic() {
    setLoading(true); setError("")
    try {
      for(let i=0;i<diplomes.length;i++){
        const d=diplomes[i]
        if(d.certFile&&d.certStatus!=="done"){ updDiplo(i,{certStatus:"uploading"}); try{await uploadDiplomaFile(dossierId,d.certFile,i===0?"DIPLOME":"AUTRE");updDiplo(i,{certStatus:"done"})}catch{updDiplo(i,{certStatus:"error"})} }
        if(d.releveFile&&d.releveStatus!=="done"){ updDiplo(i,{releveStatus:"uploading"}); try{await uploadDiplomaFile(dossierId,d.releveFile,i===0?"RELEVE_NOTES":"AUTRE");updDiplo(i,{releveStatus:"done"})}catch{updDiplo(i,{releveStatus:"error"})} }
      }
      const cleanNotes:Record<string,number>={}
      // Legacy notes state
      for(const[k,v]of Object.entries(notes)){const n=parseFloat(v);if(!isNaN(n)&&n>=0&&n<=20)cleanNotes[k]=n}
      // Merge grades from diplomas champs — ensures analyser always finds them even if annee is missing
      for(const d of diplomes){for(const[k,v]of Object.entries(d.champs)){const n=parseFloat(String(v));if(!isNaN(n)&&n>=0&&n<=20)cleanNotes[k]=n}}
      const validDiplomes=diplomes.filter(d=>d.type||d.annee||Object.keys(d.champs).length>0).map(d=>({
        intitule:d.intitule.trim()||d.type||"", annee:parseInt(d.annee)||new Date().getFullYear(),
        etablissement:d.etablissement.trim()||undefined, type:d.type||undefined,
        sousType:d.sousType||undefined, champs:Object.keys(d.champs).length>0?d.champs:undefined,
      }))
      const res=await fetch(`/api/dossiers/${dossierId}`,{
        method:"PUT", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ diplomes:validDiplomes, niveauEtude:niveauEtude||null, typeCours:typeCours||null, sourceDecouverte:sourceDecouverte||null, notes:Object.keys(cleanNotes).length>0?cleanNotes:null }),
      })
      if(!res.ok) throw new Error(t("common.error"))
      setStep(4)
    } catch(e:unknown){setError(e instanceof Error?e.message:t("common.error"))}
    finally{setLoading(false)}
  }

  // ── Step 4: save filière + submit ─────────────────────────────────────────────

  async function handleSaveFiliere() {
    if(!selectedFiliere){setError(t("student.dossierNew.step3.noFiliere"));return}
    setLoading(true);setError("")
    try{
      const res=await fetch(`/api/dossiers/${dossierId}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({filiereId:selectedFiliere})})
      if(!res.ok) throw new Error(t("common.error"))
    }catch(e:unknown){setError(e instanceof Error?e.message:t("common.error"));setLoading(false);return}
    setLoading(false); setShowSubmitModal(true)
  }

  async function handleSubmit() {
    setLoading(true);setError("")
    try{
      // Fire analysis in background — do not await so the status change (and notification) is instant
      fetch(`/api/dossiers/${dossierId}/analyse`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({locale})}).catch(()=>{})
      const res=await fetch(`/api/dossiers/${dossierId}/statut`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({statut:"SOUMIS"})})
      if(!res.ok) throw new Error(t("common.error"))
      router.push(`/student/dossier/${dossierId}?submitted=1`)
    }catch(e:unknown){setError(e instanceof Error?e.message:t("common.error"))}
    finally{setLoading(false);setShowSubmitModal(false)}
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  const isProfileFilled = profilePrefilled.size>0 || scanDone
  const selectedFiliereData = filieres.find(f=>f.id===selectedFiliere)
  const STEP_GROUPS = [
    { key:"preparatoire", label: t("student.dossierNew.groups.preparatoire"), color:"#f5c842", keywords:["préparatoire","preparatoire"] },
    { key:"ingenierie",   label: t("student.dossierNew.groups.ingenierie"),   color:"#60a5fa", keywords:["génie","genie"] },
    { key:"licence",      label: t("student.dossierNew.groups.licence"),      color:"#a78bfa", keywords:["licence"] },
    { key:"master",       label: t("student.dossierNew.groups.master"),       color:"#4ade80", keywords:["master"] },
    { key:"architecture", label: t("student.dossierNew.groups.architecture"), color:"#fb923c", keywords:["architecture"] },
  ]
  function getStepGroup(f:Filiere){ if(f.categorie&&STEP_GROUPS.some(g=>g.key===f.categorie))return f.categorie; const nom=f.nom.toLowerCase(); for(const g of STEP_GROUPS) if(g.keywords.some(kw=>nom.includes(kw))) return g.key; return "other" }

  const [recLoading, setRecLoading] = useState(false)
  const [expandedRec, setExpandedRec] = useState<string|null>(null)

  const OCR_STAGES = ["Lecture du document…", "Identification des zones…", "Extraction des données…", "Vérification des notes…"]
  const [scanStage, setScanStage] = useState(0)
  useEffect(() => {
    const anyScanning = diplomes.some(d => d.scanning)
    if (!anyScanning) { setScanStage(0); return }
    const timer = setInterval(() => setScanStage(s => (s + 1) % OCR_STAGES.length), 5000)
    return () => clearInterval(timer)
  }, [diplomes])
  const RISK_STYLE: Record<string,{color:string;bg:string;label:string}> = {
    SAFE:     { color:"#4ade80", bg:"rgba(74,222,128,0.12)",  label: t("student.dossierNew.recommendations.riskSafe") },
    MODERATE: { color:"#f5c842", bg:"rgba(245,200,66,0.12)",  label: t("student.dossierNew.recommendations.riskModerate") },
    RISKY:    { color:"#f87171", bg:"rgba(248,113,113,0.12)", label: t("student.dossierNew.recommendations.riskRisky") },
  }

  return (
    <div style={{ minHeight:"100vh", background:"#070e20", padding:"32px 36px" }}>
      <style>{`
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ocrFill { 0%{width:0%} 80%{width:85%} 100%{width:85%} }
        @keyframes ocrPulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        select option { background:#0f1e3d; color:#f8fafc; }
        .pf:focus { border-color:#e8b820!important; box-shadow:0 0 0 3px rgba(232,184,32,0.18)!important; }
        .pf::placeholder { color:#334155; }
        .dz:hover { border-color:rgba(245,200,66,0.4)!important; background:rgba(245,200,66,0.04)!important; }
        @media (max-width: 768px) {
          .dossier-step3-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <button onClick={() => router.push("/student/dashboard")} style={{ display:"flex", alignItems:"center", gap:"6px", background:"none", border:"none", color:"#64748b", fontSize:"13px", cursor:"pointer", marginBottom:"20px", padding:0, fontFamily:"inherit" }}>
        {t("student.dossierNew.back")}
      </button>

      <h1 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"26px", fontWeight:600, color:"#f8fafc", margin:"0 0 4px" }}>{t("student.dossierNew.title")}</h1>
      <p style={{ fontSize:"13px", color:"#64748b", marginBottom:"32px" }}>{t("student.dossierNew.subtitle")}</p>

      {/* Step bar */}
      <div style={{ display:"flex", alignItems:"center", marginBottom:"36px", maxWidth:"900px" }}>
        {steps.map((label, i) => {
          const s=i+1; const done=s<step; const active=s===step
          return (
            <div key={s} style={{ display:"flex", alignItems:"center", flex:i<steps.length-1?1:0 }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"6px" }}>
                <div style={{ width:"30px", height:"30px", borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"12px", fontWeight:700, flexShrink:0, background:done?"linear-gradient(135deg,#f5c842,#e8a820)":active?"rgba(245,200,66,0.12)":"rgba(255,255,255,0.04)", border:done?"none":active?"2px solid #f5c842":"1px solid rgba(255,255,255,0.1)", color:done?"#060d1f":active?"#f5c842":"#334155", boxShadow:active?"0 0 14px rgba(245,200,66,0.22)":"none" }}>
                  {done?"✓":s}
                </div>
                <span style={{ fontSize:"10px", color:done?"#f5c842":active?"#f8fafc":"#334155", fontWeight:active||done?600:400, whiteSpace:"nowrap" }}>{label}</span>
              </div>
              {i<steps.length-1&&<div style={{ flex:1, height:"1px", margin:"0 6px 20px", background:done?"linear-gradient(90deg,#f5c842,rgba(245,200,66,0.3))":"rgba(255,255,255,0.07)" }}/>}
            </div>
          )
        })}
      </div>

      {error && <div style={{ maxWidth:"900px", marginBottom:"20px", padding:"12px 16px", borderRadius:"12px", background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.28)", fontSize:"13px", color:"#fca5a5" }}>{error}</div>}

      {/* ══════════════ STEP 1 — Profil ══════════════════════════════════════════ */}
      {step===1 && (
        <div style={{ maxWidth:"640px", padding:"36px 40px", borderRadius:"24px", background:"rgba(10,20,42,0.78)", border:"1px solid rgba(255,255,255,0.07)", backdropFilter:"blur(24px)" }}>
          <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"19px", fontWeight:500, color:"#f8fafc", margin:"0 0 6px" }}>{t("student.dossierNew.profileStep.title")}</h2>
          <p style={{ fontSize:"13px", color:"#64748b", marginBottom:"24px" }}>{t("student.dossierNew.profileStep.subtitle")}</p>

          {/* CIN scanner */}
          <div style={{ marginBottom:"20px", borderRadius:"14px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", overflow:"hidden" }}>
            <label className="dz" style={{ display:"block", padding:"20px 22px", cursor:scanning?"not-allowed":"pointer", transition:"all 0.2s", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
              <input ref={fileRef} type="file" accept=".pdf,application/pdf" style={{ display:"none" }} disabled={scanning} onChange={e=>{ const f=e.target.files?.[0]; if(f) handleProfileScan(f) }}/>
              {scanning ? (
                <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ animation:"spin 0.9s linear infinite", flexShrink:0 }}><circle cx="12" cy="12" r="10" stroke="#f5c842" strokeWidth="2" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#f5c842" strokeWidth="2" strokeLinecap="round"/></svg>
                  <div style={{ flex:1 }}>
                    <div style={{ height:"3px", borderRadius:"3px", background:"rgba(255,255,255,0.08)", overflow:"hidden", marginBottom:"6px" }}>
                      <div style={{ height:"100%", width:`${scanProgress}%`, background:"linear-gradient(90deg,#f5c842,#e8a820)", borderRadius:"3px", transition:"width 0.3s" }}/>
                    </div>
                    <div style={{ fontSize:"13px", color:"#64748b" }}>Analyse en cours… {scanProgress}%</div>
                  </div>
                </div>
              ) : previewUrl && scanDone ? (
                <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                  <img src={previewUrl} alt="" style={{ width:"56px", height:"38px", objectFit:"cover", borderRadius:"6px", border:"1px solid rgba(255,255,255,0.08)", flexShrink:0 }}/>
                  <div>
                    <div style={{ fontSize:"13px", fontWeight:600, color:"#4ade80" }}>✓ {scanMsg || t("student.dossierNew.profileStep.alreadyComplete")}</div>
                    <div style={{ fontSize:"11px", color:"#475569", marginTop:"2px" }}>Cliquez pour scanner un autre document</div>
                  </div>
                </div>
              ) : user?.numeroIdentite ? (
                <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                  <div style={{ width:"36px", height:"36px", borderRadius:"8px", background:"rgba(74,222,128,0.1)", border:"1px solid rgba(74,222,128,0.2)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"16px" }}>✓</div>
                  <div>
                    <div style={{ fontSize:"13px", fontWeight:600, color:"#4ade80" }}>{t("student.dossierNew.profileStep.alreadyComplete")}</div>
                    <div style={{ fontSize:"11px", color:"#475569", marginTop:"2px" }}>Cliquez pour re-scanner et mettre à jour</div>
                  </div>
                </div>
              ) : (
                <div style={{ display:"flex", alignItems:"center", gap:"12px" }}>
                  <div style={{ width:"36px", height:"36px", borderRadius:"8px", background:"rgba(245,200,66,0.08)", border:"1px solid rgba(245,200,66,0.2)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"16px" }}>📷</div>
                  <div>
                    <div style={{ fontSize:"13px", fontWeight:600, color:"#f8fafc" }}>{t("student.dossierNew.profileStep.scanCta")}</div>
                    <div style={{ fontSize:"11px", color:"#475569", marginTop:"2px" }}>{t("student.dossierNew.profileStep.scanSub")}</div>
                  </div>
                </div>
              )}
            </label>
            {profilePrefilled.size>0&&!scanning&&(
              <div style={{ padding:"8px 18px", fontSize:"11.5px", color:"#f5c842", background:"rgba(245,200,66,0.06)", animation:"fadeIn 0.3s ease both" }}>
                ✨ {profilePrefilled.size} champ(s) rempli(s) — vérifiez avant de continuer.
              </div>
            )}
          </div>

          {/* Profile form */}
          <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
            <div>
              <label style={lbl}>Date de naissance</label>
              <input type="date" value={profileForm.dateNaissance} onChange={e=>setProfileForm(p=>({...p,dateNaissance:e.target.value}))} className="pf" style={{ ...(profilePrefilled.has("dateNaissance")?inpGold:inp), colorScheme:"dark" }}/>
            </div>
            <div>
              <label style={lbl}>Type de pièce d'identité</label>
              <div style={{ display:"flex", borderRadius:"10px", overflow:"hidden", border:"1px solid rgba(255,255,255,0.1)", marginBottom:"10px" }}>
                {(["CIN","PASSEPORT"] as const).map((type,i)=>(
                  <button key={type} onClick={()=>setProfileForm(p=>({...p,typeIdentite:type}))} style={{ flex:1, padding:"10px 8px", border:"none", borderRight:i===0?"1px solid rgba(255,255,255,0.1)":"none", fontFamily:"inherit", background:profileForm.typeIdentite===type?"rgba(245,200,66,0.12)":"rgba(255,255,255,0.03)", color:profileForm.typeIdentite===type?"#f5c842":"#64748b", fontSize:"13px", fontWeight:profileForm.typeIdentite===type?700:400, cursor:"pointer" }}>
                    {type==="CIN"?"🪪 CIN":"📘 Passeport"}
                  </button>
                ))}
              </div>
              <input value={profileForm.numeroIdentite} onChange={e=>setProfileForm(p=>({...p,numeroIdentite:e.target.value}))} placeholder={profileForm.typeIdentite==="CIN"?"Numéro CIN":"Numéro passeport"} className="pf" style={profilePrefilled.has("numeroIdentite")?inpGold:inp}/>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
              <div>
                <label style={lbl}>Pays de résidence</label>
                <input value={profileForm.pays} onChange={e=>setProfileForm(p=>({...p,pays:e.target.value}))} placeholder="Tunisie" className="pf" style={profilePrefilled.has("pays")?inpGold:inp}/>
              </div>
              <div>
                <label style={lbl}>Téléphone</label>
                <input type="tel" value={profileForm.telephone} onChange={e=>setProfileForm(p=>({...p,telephone:e.target.value}))} placeholder="+216 xx xxx xxx" className="pf" style={inp}/>
              </div>
            </div>
            <div>
              <label style={lbl}>Adresse</label>
              <textarea value={profileForm.adresse} onChange={e=>setProfileForm(p=>({...p,adresse:e.target.value}))} placeholder="Rue, ville, code postal" rows={2} className="pf" style={{ ...(profilePrefilled.has("adresse")?inpGold:inp), resize:"vertical" }}/>
            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"flex-end", marginTop:"24px" }}>
            <button onClick={handleSaveProfile} disabled={loading} style={{ ...btnP, opacity:loading?0.6:1, cursor:loading?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:"8px" }}>
              {loading?<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation:"spin 0.8s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="#060d1f" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#060d1f" strokeWidth="3" strokeLinecap="round"/></svg>{t("common.saving")}</>:t("student.dossierEdit.saveAndContinue")}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════ STEP 2 — Documents (Photo only) ══════════════════════════ */}
      {step===2 && (
        <div style={{ maxWidth:"640px", padding:"36px 40px", borderRadius:"24px", background:"rgba(10,20,42,0.78)", border:"1px solid rgba(255,255,255,0.07)", backdropFilter:"blur(24px)" }}>
          <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"19px", fontWeight:500, color:"#f8fafc", margin:"0 0 8px" }}>Documents requis</h2>
          <p style={{ fontSize:"13px", color:"#64748b", marginBottom:"24px" }}>Votre CIN sera soumis automatiquement depuis votre profil.</p>

          {/* CNI — auto-handled */}
          <div style={{ padding:"12px 16px", borderRadius:"10px", background:"rgba(74,222,128,0.06)", border:"1px solid rgba(74,222,128,0.18)", display:"flex", alignItems:"center", gap:"10px", marginBottom:"12px" }}>
            <span style={{ color:"#4ade80", fontSize:"13px" }}>✓</span>
            <div>
              <div style={{ fontSize:"12.5px", fontWeight:600, color:"#4ade80" }}>Carte d'identité / Passeport</div>
              <div style={{ fontSize:"11px", color:"#475569", marginTop:"1px" }}>
                {cinFile ? cinFile.name : (user?.typeIdentite ? `${user.typeIdentite} — ${user.numeroIdentite}` : "Fourni depuis votre profil")}
              </div>
            </div>
          </div>

          {/* Photo — required */}
          <div style={{ padding:"14px 18px", borderRadius:"12px", background:(photoStatus==="done"||!!photoFile)?"rgba(74,222,128,0.06)":"rgba(255,255,255,0.03)", border:(photoStatus==="done"||!!photoFile)?"1px solid rgba(74,222,128,0.2)":photoStatus==="error"?"1px solid rgba(248,113,113,0.2)":"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", gap:"12px", marginBottom:"24px" }}>
            {photoFile ? <FilePreview file={photoFile} size={48}/> : <span style={{ fontSize:"20px" }}>📷</span>}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:"13px", fontWeight:600, color:(photoStatus==="done"||!!photoFile)?"#4ade80":"#f8fafc" }}>{t("student.dossierNew.step1.docs.PHOTO.label")}</div>
              {photoFile ? <div style={{ fontSize:"11px", color:"#475569", marginTop:"2px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{photoFile.name}</div>
                         : <div style={{ fontSize:"11px", color:"#334155", marginTop:"2px" }}>{t("student.dossierNew.step1.docs.PHOTO.hint")}</div>}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"8px", flexShrink:0 }}>
              {(photoStatus==="done"||!!photoFile) && <span style={{ color:"#4ade80", fontSize:"13px" }}>✓</span>}
              {photoStatus==="error" && <span style={{ fontSize:"11px", color:"#f87171" }}>Erreur</span>}
              <label style={{ padding:"6px 12px", borderRadius:"8px", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#94a3b8", fontSize:"12px", cursor:"pointer" }}>
                {photoFile ? t("student.dossierNew.step1.change") : t("student.dossierNew.step1.choose")}
                <input type="file" accept=".jpg,.jpeg,.png,.webp" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(f){ setPhotoFile(f); setPhotoStatus("idle") }}}/>
              </label>
            </div>
          </div>

          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <button onClick={()=>setStep(1)} style={btnS}>{t("student.dossierNew.back")}</button>
            <button onClick={handleCreateDossier} disabled={loading||(!photoFile&&photoStatus!=="done")} style={{ ...btnP, opacity:(loading||(!photoFile&&photoStatus!=="done"))?0.5:1, cursor:(loading||(!photoFile&&photoStatus!=="done"))?"not-allowed":"pointer", display:"flex", alignItems:"center", gap:"8px" }}>
              {loading?<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation:"spin 0.8s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="#060d1f" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#060d1f" strokeWidth="3" strokeLinecap="round"/></svg>{t("common.sending")}</>:t("student.dossierNew.step1.continueAllDone")}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════ STEP 3 — Parcours & Diplômes (2-col with rec panel) ═══ */}
      {step===3 && (
        <div className="dossier-step3-grid" style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) 260px", gap:"20px", maxWidth:"1100px", alignItems:"flex-start", overflow:"visible" }}>

          {/* Left: academic form */}
          <div style={{ padding:"36px 40px", borderRadius:"24px", background:"rgba(10,20,42,0.78)", border:"1px solid rgba(255,255,255,0.07)", backdropFilter:"blur(24px)" }}>
            <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"19px", fontWeight:500, color:"#f8fafc", margin:"0 0 8px" }}>{t("student.dossierNew.step2.title")}</h2>
            <p style={{ fontSize:"13px", color:"#64748b", marginBottom:"24px" }}>{t("student.dossierNew.step2.subtitle")}</p>

            <div style={{ display:"flex", flexDirection:"column", gap:"18px" }}>
              {/* Niveau */}
              <div>
                <label style={lbl}>{t("student.dossierNew.step2.niveau")}</label>
                <select value={niveauEtude} onChange={e=>handleNiveauChange(e.target.value)} style={sel} className="pf">
                  <option value="">{t("common.select")}</option>
                  {["BACCALAUREAT","LICENCE_1","LICENCE_2","LICENCE_3","MASTER_1","MASTER_2","DOCTORAT","AUTRE"].map(v=>(
                    <option key={v} value={v}>{t(`student.dossierNew.step2.niveaux.${v}`)}</option>
                  ))}
                </select>
              </div>

              {/* Diplomas */}
              <div>
                {/* Context banner: what docs are required for this niveau */}
                {niveauEtude && (() => {
                  const msgs: Record<string, string> = {
                    BACCALAUREAT: "Ajoutez votre Baccalauréat avec votre relevé de notes.",
                    LICENCE_1:    "Ajoutez votre Baccalauréat (copie + relevé de notes).",
                    LICENCE_2:    "Ajoutez votre Bac ET votre attestation de réussite en 1ère année Licence + relevé.",
                    LICENCE_3:    "Ajoutez votre Bac et vos attestations de réussite L1 et L2 avec vos relevés.",
                    MASTER_1:     "Ajoutez votre diplôme de Licence + relevé final.",
                    MASTER_2:     "Ajoutez votre Licence et votre attestation de réussite en 1ère année Master.",
                    DOCTORAT:     "Ajoutez votre diplôme de Master.",
                  }
                  const msg = msgs[niveauEtude]
                  if (!msg) return null
                  return (
                    <div style={{ padding:"10px 14px", borderRadius:"10px", background:"rgba(96,165,250,0.07)", border:"1px solid rgba(96,165,250,0.2)", fontSize:"12px", color:"#60a5fa", marginBottom:"12px", lineHeight:1.6 }}>
                      💡 {msg}
                    </div>
                  )
                })()}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"10px" }}>
                  <div>
                    <label style={{ ...lbl, marginBottom:0 }}>{t("student.dossierNew.step2.diplomes")}</label>
                    {niveauEtude && niveauEtude !== "AUTRE" && (
                      <div style={{ fontSize:"10px", color:"#475569", marginTop:"3px" }}>
                        {t("student.dossierNew.step3.requiredForLevel")}
                      </div>
                    )}
                  </div>
                  {/* Only allow free-form adding for "AUTRE" or no niveau */}
                  {(!niveauEtude || niveauEtude === "AUTRE") && (
                    <button type="button" onClick={()=>setDiplomes(p=>[...p,emptyDiplo()])} style={{ fontSize:"12px", color:"#f5c842", background:"none", border:"none", cursor:"pointer", fontFamily:"inherit", fontWeight:600, padding:0 }}>
                      + {t("student.dossierNew.step2.addDiplome")}
                    </button>
                  )}
                </div>
                <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
                  {diplomes.map((d,i)=>{
                    const upd=(patch:Partial<DiploEntry>)=>updDiplo(i,patch)
                    const isRequired=!!niveauEtude&&niveauEtude!=="AUTRE"
                    const dtDef:DiplomaType|undefined=DIPLOMA_TYPES.find(x=>x.key===d.type)
                    const stDef=dtDef?.subtypes?.find(x=>x.key===d.sousType)
                    const allFields=d.type==="BAC"?(stDef?.fields??[]):(dtDef?.fields??[])
                    const gradeFields=allFields.filter(f=>f.type==="grade")
                    const infoFields=allFields.filter(f=>f.type!=="grade")
                    const ocrCount=Object.values(d.ocrFilled).filter(Boolean).length
                    const renderField=(f:typeof allFields[0])=>{
                      const isOcr=d.ocrFilled[f.key]
                      const clearOcr=()=>upd({ocrFilled:{...d.ocrFilled,[f.key]:false}})
                      const ocrStyle=isOcr?{...inp,borderColor:"rgba(245,200,66,0.5)",background:"rgba(245,200,66,0.06)"}:inp
                      return(
                        <div key={f.key}>
                          <div style={{ display:"flex", alignItems:"center", gap:"5px", marginBottom:"5px" }}>
                            <label style={{ ...lbl, marginBottom:0, fontSize:"9px" }}>{t(`student.dossierNew.step2.diplomaFields.${f.labelKey}`)}{f.required&&<span style={{ color:"#f87171", marginLeft:"2px" }}>*</span>}</label>
                            {isOcr&&<span style={{ fontSize:"8.5px", padding:"0 5px", borderRadius:"4px", background:"rgba(245,200,66,0.12)", color:"#f5c842", fontWeight:700 }}>{t("student.dossierNew.step2.ocrDetected")}</span>}
                          </div>
                          {f.type==="grade"?<input type="number" min="0" max="20" step="0.25" value={d.champs[f.key]??""} onChange={e=>{upd({champs:{...d.champs,[f.key]:e.target.value}});clearOcr()}} placeholder="—" className="pf" style={{ ...ocrStyle, textAlign:"center" }}/>
                          :f.type==="mention"?<select value={d.champs[f.key]??""} onChange={e=>{upd({champs:{...d.champs,[f.key]:e.target.value}});clearOcr()}} style={{ ...sel,...(isOcr?{borderColor:"rgba(245,200,66,0.5)",background:"rgba(245,200,66,0.06)"}:{}) }} className="pf"><option value="">{t("common.select")}</option>{["Passable","Assez Bien","Bien","Très Bien"].map(m=><option key={m} value={m}>{m}</option>)}</select>
                          :<input value={d.champs[f.key]??""} onChange={e=>{upd({champs:{...d.champs,[f.key]:e.target.value}});clearOcr()}} placeholder="—" className="pf" style={ocrStyle}/>}
                        </div>
                      )
                    }
                    return(
                      <div key={i} style={{ borderRadius:"16px", background:"rgba(255,255,255,0.03)", border:`1px solid ${isRequired?"rgba(245,200,66,0.18)":"rgba(255,255,255,0.09)"}`, overflow:"hidden" }}>
                        <div style={{ padding:"12px 16px", background:"rgba(255,255,255,0.02)", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", gap:"12px" }}>
                          {/* Required badge */}
                          {isRequired&&<span style={{ fontSize:"8.5px", fontWeight:700, padding:"2px 7px", borderRadius:"20px", background:"rgba(245,200,66,0.12)", color:"#f5c842", flexShrink:0, letterSpacing:"0.06em", textTransform:"uppercase" }}>Requis</span>}
                          {/* Diploma label — locked when required, editable select when free-form */}
                          {isRequired ? (
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:"12.5px", fontWeight:600, color:"#f8fafc" }}>{d.intitule || t(`student.dossierNew.step2.diplomaTypes.${dtDef?.labelKey??d.type}`)}</div>
                            </div>
                          ) : (
                            <div style={{ flex:1, minWidth:0 }}>
                              <label style={{ ...lbl, fontSize:"9px" }}>{t("student.dossierNew.step2.diplomeType")}</label>
                              <select value={d.type} onChange={e=>upd({type:e.target.value,sousType:"",champs:{},ocrFilled:{},intitule:""})} style={sel} className="pf">
                                <option value="">{t("common.select")}</option>
                                {DIPLOMA_TYPES.map(dt=><option key={dt.key} value={dt.key}>{t(`student.dossierNew.step2.diplomaTypes.${dt.labelKey}`)}</option>)}
                              </select>
                            </div>
                          )}
                          {/* Year always editable */}
                          <div style={{ flexShrink:0 }}>
                            <label style={{ ...lbl, fontSize:"9px" }}>{t("student.dossierNew.step2.year")}</label>
                            <input type="number" min="1960" max={new Date().getFullYear()} value={d.annee} onChange={e=>upd({annee:e.target.value})} placeholder={String(new Date().getFullYear())} className="pf" style={{ ...inp, width:"90px" }}/>
                          </div>
                          {/* Remove only for free-form entries */}
                          {!isRequired&&diplomes.length>1&&<button type="button" onClick={()=>setDiplomes(p=>p.filter((_,j)=>j!==i))} style={{ width:"32px", height:"32px", borderRadius:"8px", border:"1px solid rgba(248,113,113,0.25)", background:"rgba(248,113,113,0.07)", color:"#f87171", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit", flexShrink:0 }}><svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg></button>}
                        </div>
                        {d.type&&(()=>{
                          // Contextual releve label and show condition
                          const showReleve = d.type !== "BAC" || !!d.sousType
                          const stLabel = d.type==="BAC"&&d.sousType
                            ? t(`student.dossierNew.step2.diplomaTypes.${dtDef?.subtypes?.find(s=>s.key===d.sousType)?.labelKey??d.sousType}`)
                            : ""
                          const relLabel = d.type==="BAC"&&stLabel
                            ? `Relevé de notes — Baccalauréat ${stLabel}`
                            : d.type==="LICENCE" ? "Relevé de notes de Licence"
                            : d.type==="MASTER"  ? "Relevé de notes de Master"
                            : d.type==="BTS"     ? "Relevé de notes du BTS"
                            : t("student.dossierNew.step2.releveLabel")
                          return (
                          <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:"14px" }}>
                            {/* BAC subtype */}
                            {d.type==="BAC"&&dtDef?.subtypes&&(
                              <div>
                                <label style={{ ...lbl, fontSize:"9px" }}>{t("student.dossierNew.step2.diplomaSousType")}</label>
                                <select value={d.sousType} onChange={e=>upd({sousType:e.target.value,champs:{},ocrFilled:{}})} style={sel} className="pf">
                                  <option value="">{t("common.select")}</option>
                                  {dtDef.subtypes.map(st=><option key={st.key} value={st.key}>{t(`student.dossierNew.step2.diplomaTypes.${st.labelKey}`)}</option>)}
                                </select>
                              </div>
                            )}
                            {/* Certificate — FIRST (before transcript) */}
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px", padding:"10px 14px", borderRadius:"10px", background:d.certFile?"rgba(245,200,66,0.06)":"rgba(245,200,66,0.03)", border:d.certFile?"1px solid rgba(245,200,66,0.3)":"1px solid rgba(245,200,66,0.15)" }}>
                              {d.certFile && <FilePreview file={d.certFile} size={48}/>}
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                                  <span style={{ fontSize:"11.5px", fontWeight:600, color:d.certFile?"#f5c842":"#94a3b8" }}>{t("student.dossierNew.step2.certLabel")}</span>
                                  {!d.certFile&&<span style={{ fontSize:"9px", fontWeight:700, padding:"1px 6px", borderRadius:"20px", background:"rgba(245,200,66,0.12)", color:"#f5c842" }}>Requis</span>}
                                </div>
                                {d.certFile
                                  ? <div style={{ fontSize:"10px", color:"#475569", marginTop:"2px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.certFile.name}</div>
                                  : <div style={{ fontSize:"10px", color:"#475569", marginTop:"2px" }}>PDF — exigé par l'administration pour valider le dossier</div>}
                              </div>
                              <div style={{ display:"flex", alignItems:"center", gap:"6px", flexShrink:0 }}>
                                {(d.certFile||d.certStatus==="done")&&<span style={{ color:"#f5c842", fontSize:"12px" }}>✓</span>}
                                <label style={{ fontSize:"11px", padding:"5px 12px", borderRadius:"8px", background:d.certFile?"rgba(245,200,66,0.12)":"rgba(245,200,66,0.08)", border:"1px solid rgba(245,200,66,0.25)", color:"#f5c842", cursor:"pointer", fontWeight:600 }}>
                                  {d.certFile?t("student.dossierNew.step1.change"):t("student.dossierNew.step1.choose")}
                                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:"none" }} onChange={e=>{ const f=e.target.files?.[0]; if(f) upd({certFile:f,certStatus:"idle"}) }}/>
                                </label>
                              </div>
                            </div>

                            {/* Transcript upload — after cert, hidden for BAC until série is chosen */}
                            {showReleve && (
                            <div style={{ padding:"10px 14px", borderRadius:"10px", background:d.releveFile?"rgba(245,200,66,0.05)":"rgba(96,165,250,0.04)", border:d.releveFile?"1px solid rgba(245,200,66,0.22)":"1px dashed rgba(96,165,250,0.25)" }}>
                              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px" }}>
                                {d.releveFile && <FilePreview file={d.releveFile} size={48}/>}
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                                    <span style={{ fontSize:"12px", fontWeight:600, color:d.releveFile?"#f5c842":"#60a5fa" }}>{relLabel}</span>
                                    <span style={{ fontSize:"9px", padding:"1px 5px", borderRadius:"4px", background:"rgba(245,200,66,0.1)", color:"#f5c842", fontWeight:700 }}>OCR</span>
                                    {!d.releveFile&&<span style={{ fontSize:"9px", color:"#475569" }}>— {t("student.dossierNew.step2.releveRecommended")}</span>}
                                  </div>
                                  {d.releveFile?(
                                    <div style={{ fontSize:"10px", color:"#475569", marginTop:"2px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.releveFile.name}</div>
                                  ):<div style={{ fontSize:"11px", color:"#334155", marginTop:"2px" }}>{t("student.dossierNew.step2.releveHint")}</div>}
                                  {d.scanning&&(
                                    <div style={{ marginTop:"6px" }}>
                                      {/* Slow-fill progress bar */}
                                      <div style={{ height:"3px", borderRadius:"2px", background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                                        <div style={{ height:"100%", borderRadius:"2px", background:"linear-gradient(90deg,#f5c842,#e8a820)", animation:"ocrFill 180s ease-out forwards" }}/>
                                      </div>
                                      {/* Cycling stage message */}
                                      <div style={{ display:"flex", alignItems:"center", gap:"5px", marginTop:"4px" }}>
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ animation:"spin 1.2s linear infinite", flexShrink:0 }}><circle cx="12" cy="12" r="10" stroke="#f5c842" strokeWidth="2" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#f5c842" strokeWidth="2" strokeLinecap="round"/></svg>
                                        <span style={{ fontSize:"10px", color:"#f5c842", animation:"fadeIn 0.4s ease both" }} key={scanStage}>{OCR_STAGES[scanStage]}</span>
                                      </div>
                                      <div style={{ fontSize:"9px", color:"#475569", marginTop:"2px", animation:"ocrPulse 2s ease-in-out infinite" }}>⏱ Analyse IA — peut prendre 1-2 min</div>
                                    </div>
                                  )}
                                  {ocrCount>0&&!d.scanning&&<div style={{ fontSize:"10px", color:"#f5c842", marginTop:"2px" }}>✨ {t("student.dossierNew.step2.ocrPrefilledCount",{count:String(ocrCount)})}</div>}
                                </div>
                                <label style={{ fontSize:"11px", padding:"5px 10px", borderRadius:"8px", background:d.releveFile?"rgba(245,200,66,0.12)":"rgba(96,165,250,0.1)", border:d.releveFile?"1px solid rgba(245,200,66,0.3)":"1px solid rgba(96,165,250,0.25)", color:d.releveFile?"#f5c842":"#60a5fa", cursor:"pointer", fontWeight:600, flexShrink:0 }}>
                                  {d.releveFile?t("student.dossierNew.step1.change"):t("student.dossierNew.step2.importReleve")}
                                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:"none" }} onChange={async e=>{ const f=e.target.files?.[0]; if(!f) return; upd({releveFile:f,releveStatus:"idle"}); await scanReleveForDiploma(i,f) }}/>
                                </label>
                              </div>
                            </div>
                            )}
                            {/* 📊 Notes */}
                            {gradeFields.length>0&&(
                              <div>
                                <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
                                  <div style={{ width:"3px", height:"14px", borderRadius:"2px", background:"#60a5fa" }}/>
                                  <span style={{ fontSize:"10px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"#60a5fa" }}>{t("student.dossierNew.step2.sectionNotes")}</span>
                                </div>
                                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px" }}>{gradeFields.map(renderField)}</div>
                              </div>
                            )}
                            {/* 🎓 Info */}
                            {(infoFields.length>0||d.type!=="BAC")&&(
                              <div>
                                <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
                                  <div style={{ width:"3px", height:"14px", borderRadius:"2px", background:"#a78bfa" }}/>
                                  <span style={{ fontSize:"10px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"#a78bfa" }}>{t("student.dossierNew.step2.sectionInfo")}</span>
                                </div>
                                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
                                  {infoFields.map(renderField)}
                                  {d.type!=="BAC"&&!infoFields.some(f=>f.key==="etablissement")&&<div><label style={{ ...lbl, fontSize:"9px" }}>{t("student.dossierNew.step2.etablissement")}</label><input value={d.etablissement} onChange={e=>upd({etablissement:e.target.value})} placeholder={t("student.dossierNew.step2.etablissementPlaceholder")} className="pf" style={inp}/></div>}
                                  {d.type==="AUTRE"&&<div><label style={{ ...lbl, fontSize:"9px" }}>{t("student.dossierNew.step2.diplomeTitle")}</label><input value={d.intitule} onChange={e=>upd({intitule:e.target.value})} placeholder={t("student.dossierNew.step2.lastDiplomePlaceholder")} className="pf" style={inp}/></div>}
                                </div>
                              </div>
                            )}
                          </div>
                          )
                        })()}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Source de découverte */}
              <div>
                <label style={lbl}>{t("student.dossierNew.step2.source")}</label>
                <select value={sourceDecouverte} onChange={e=>setSource(e.target.value)} style={sel} className="pf">
                  <option value="">{t("common.select")}</option>
                  {[
                    { value:"AMIS", label:t("student.dossierNew.step2.sources.AMIS") },
                    { value:"RESEAUX_SOCIAUX", label:t("student.dossierNew.step2.sources.RESEAUX_SOCIAUX") },
                    { value:"SITE_WEB", label:t("student.dossierNew.step2.sources.SITE_WEB") },
                    { value:"PUBLICITE", label:t("student.dossierNew.step2.sources.PUBLICITE") },
                    { value:"SALON_ETUDIANT", label:t("student.dossierNew.step2.sources.SALON_ETUDIANT") },
                    { value:"AUTRE", label:t("student.dossierNew.step2.sources.AUTRE") },
                  ].map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              {/* Type de cours */}
              <div>
                <label style={lbl}>{t("student.dossierNew.step2.courseType")}</label>
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  {[
                    { value:"COURS_JOUR", label:t("student.dossierNew.step2.typesCours.COURS_JOUR.label"), desc:t("student.dossierNew.step2.typesCours.COURS_JOUR.desc") },
                    { value:"COURS_SOIR", label:t("student.dossierNew.step2.typesCours.COURS_SOIR.label"), desc:t("student.dossierNew.step2.typesCours.COURS_SOIR.desc") },
                    { value:"FORMATION_CONTINUE", label:t("student.dossierNew.step2.typesCours.FORMATION_CONTINUE.label"), desc:t("student.dossierNew.step2.typesCours.FORMATION_CONTINUE.desc") },
                  ].map(tc=>(
                    <div key={tc.value} onClick={()=>setTypeCours(tc.value)} style={{ padding:"10px 14px", borderRadius:"10px", border:typeCours===tc.value?"1px solid #f5c842":"1px solid rgba(255,255,255,0.08)", background:typeCours===tc.value?"rgba(245,200,66,0.07)":"rgba(255,255,255,0.02)", cursor:"pointer", display:"flex", alignItems:"center", gap:"10px", transition:"all 0.15s" }}>
                      <div style={{ width:"14px", height:"14px", borderRadius:"50%", border:typeCours===tc.value?"none":"2px solid rgba(255,255,255,0.2)", background:typeCours===tc.value?"linear-gradient(135deg,#f5c842,#e8a820)":"transparent", flexShrink:0 }}/>
                      <div><div style={{ fontSize:"13px", fontWeight:600, color:typeCours===tc.value?"#f5c842":"#f8fafc" }}>{tc.label}</div><div style={{ fontSize:"11px", color:"#475569" }}>{tc.desc}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", marginTop:"28px" }}>
              <button onClick={()=>setStep(2)} style={btnS}>{t("student.dossierNew.back")}</button>
              <button onClick={handleSaveAcademic} disabled={loading} style={{ ...btnP, opacity:loading?0.6:1, cursor:loading?"not-allowed":"pointer" }}>
                {loading?t("student.dossierNew.step2.saving"):t("student.dossierNew.step1.continueAllDone")}
              </button>
            </div>
          </div>

          {/* Right: real-time recommendations panel — sticks to viewport on scroll */}
          <div style={{ position:"sticky", top:"88px", alignSelf:"flex-start" }}>
            <div style={{ padding:"20px", borderRadius:"18px", background:"rgba(10,20,42,0.7)", border:"1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#f5c842" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/></svg>
                  <span style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"14px", fontWeight:600, color:"#f8fafc" }}>{t("student.dossierNew.recommendations.title")}</span>
                </div>
                {recLoading && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation:"spin 0.8s linear infinite", flexShrink:0 }}>
                    <circle cx="12" cy="12" r="10" stroke="#f5c842" strokeWidth="2" strokeOpacity="0.25"/>
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#f5c842" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                )}
              </div>

              {quickRecs.length===0 ? (
                <div style={{ fontSize:"12px", color:"#334155", lineHeight:1.6 }}>
                  {recLoading
                    ? t("common.loading")
                    : (niveauEtude === "BACCALAUREAT" && !diplomes.find(d => d.type === "BAC")?.sousType)
                      ? t("student.dossierNew.recommendations.waitBacSerie")
                      : t("student.dossierNew.recommendations.empty")}
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                  {quickRecs.map((rec,i)=>{
                    const rs = RISK_STYLE[rec.riskLevel] ?? RISK_STYLE.RISKY
                    const isOpen = expandedRec === rec.filiereId
                    return(
                      <div key={rec.filiereId} style={{ borderRadius:"12px", background:"rgba(10,20,42,0.5)", border:`1px solid ${rs.color}22`, overflow:"hidden" }}>
                        {/* Header row */}
                        <div onClick={()=>setExpandedRec(isOpen ? null : rec.filiereId)} style={{ padding:"10px 12px", cursor:"pointer", display:"flex", alignItems:"flex-start", gap:"8px" }}>
                          {/* Rank */}
                          <div style={{ width:"18px", height:"18px", borderRadius:"50%", background:rs.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"9px", fontWeight:700, color:rs.color, flexShrink:0, marginTop:"1px" }}>{i+1}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:"11.5px", fontWeight:600, color:"#f8fafc", lineHeight:1.3 }}>{rec.nom}</div>
                            <div style={{ display:"flex", alignItems:"center", gap:"6px", marginTop:"3px", flexWrap:"wrap" }}>
                              {/* Score badge */}
                              <span style={{ fontSize:"12px", fontWeight:700, color:rs.color }}>{rec.score.toFixed(1)}<span style={{ fontSize:"9px", fontWeight:400, color:"#475569" }}>/20</span></span>
                              {/* Risk badge */}
                              <span style={{ fontSize:"9px", fontWeight:700, padding:"1px 6px", borderRadius:"4px", background:rs.bg, color:rs.color }}>{rs.label}</span>
                              {/* Confidence indicator */}
                              {rec.confidence === "INSUFFICIENT" && <span style={{ fontSize:"9px", color:"#475569", fontStyle:"italic" }}>données insuffisantes</span>}
                              {rec.confidence === "LOW"          && <span style={{ fontSize:"9px", color:"#334155" }}>estimation partielle</span>}
                            </div>
                          </div>
                          {/* Chevron */}
                          <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={2} style={{ transition:"transform 0.2s", transform:isOpen?"rotate(180deg)":"rotate(0)", flexShrink:0, marginTop:"3px" }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7"/>
                          </svg>
                        </div>
                        {/* Expanded details */}
                        {isOpen && (
                          <div style={{ padding:"0 12px 12px", borderTop:"1px solid rgba(255,255,255,0.05)", animation:"fadeIn 0.15s ease both" }}>
                            {rec.strengths.length>0 && (
                              <div style={{ marginTop:"8px" }}>
                                {rec.strengths.map((s,j)=>(
                                  <div key={j} style={{ display:"flex", alignItems:"flex-start", gap:"5px", marginBottom:"3px" }}>
                                    <span style={{ color:"#4ade80", flexShrink:0, fontSize:"10px", marginTop:"1px" }}>✅</span>
                                    <span style={{ fontSize:"10.5px", color:"#94a3b8", lineHeight:1.45 }}>{s}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {rec.weaknesses.length>0 && (
                              <div style={{ marginTop: rec.strengths.length>0 ? "6px" : "8px" }}>
                                {rec.weaknesses.map((w,j)=>(
                                  <div key={j} style={{ display:"flex", alignItems:"flex-start", gap:"5px", marginBottom:"3px" }}>
                                    <span style={{ color:"#f87171", flexShrink:0, fontSize:"10px", marginTop:"1px" }}>❌</span>
                                    <span style={{ fontSize:"10.5px", color:"#64748b", lineHeight:1.45 }}>{w}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              <p style={{ fontSize:"10px", color:"#1e293b", marginTop:"14px", marginBottom:0, lineHeight:1.6 }}>
                {t("student.dossierNew.recommendations.disclaimer")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ STEP 4 — Filière + Submit ═══════════════════════════════ */}
      {step===4 && (
        <div style={{ maxWidth:"720px", padding:"36px 40px", borderRadius:"24px", background:"rgba(10,20,42,0.78)", border:"1px solid rgba(255,255,255,0.07)", backdropFilter:"blur(24px)" }}>
          <h2 style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"19px", fontWeight:500, color:"#f8fafc", margin:"0 0 6px" }}>{t("student.dossierNew.step3.title")}</h2>
          <p style={{ fontSize:"12.5px", color:"#64748b", marginBottom:"20px" }}>{t("student.dossierNew.step3.subtitle")}</p>

          {/* Recommendations summary if any */}
          {quickRecs.length>0&&(
            <div style={{ padding:"12px 14px", borderRadius:"10px", background:"rgba(245,200,66,0.05)", border:"1px solid rgba(245,200,66,0.15)", marginBottom:"16px" }}>
              <div style={{ fontSize:"10px", fontWeight:700, letterSpacing:"0.08em", textTransform:"uppercase", color:"#f5c842", marginBottom:"8px" }}>{t("student.dossierNew.step3.recommendedForYou")}</div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:"6px" }}>
                {quickRecs.slice(0,3).map(r=>{
                  const rs=RISK_STYLE[r.riskLevel]??RISK_STYLE.RISKY
                  return(
                    <button key={r.filiereId} onClick={()=>setFiliere(r.filiereId)} style={{ fontSize:"11px", padding:"3px 10px", borderRadius:"20px", border:selectedFiliere===r.filiereId?`1px solid ${rs.color}`:`1px solid ${rs.color}40`, background:selectedFiliere===r.filiereId?rs.bg:"transparent", color:selectedFiliere===r.filiereId?rs.color:"#64748b", cursor:"pointer", fontFamily:"inherit" }}>
                      {r.nom} <span style={{ opacity:0.7 }}>{r.score.toFixed(1)}/20</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Eligibility guidance banner */}
          {niveauEtude && (()=>{
            const allowed = ELIGIBLE_CATEGORIES[niveauEtude]
            if(!allowed||allowed.includes("*")) return null
            const groupLabels: Record<string,string> = {
              preparatoire: "Cycle Préparatoire",
              licence:      "Licences",
              ingenierie:   "Cycles Ingénieur",
              master:       "Masters",
              architecture: "Architecture",
            }
            const allowedLabels = allowed.map(k=>groupLabels[k]??k).join(", ")
            return(
              <div style={{ padding:"11px 16px", borderRadius:"12px", background:"rgba(96,165,250,0.07)", border:"1px solid rgba(96,165,250,0.2)", marginBottom:"14px", display:"flex", alignItems:"flex-start", gap:"10px" }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#60a5fa" strokeWidth={2} style={{ flexShrink:0, marginTop:"1px" }}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/></svg>
                <div>
                  <div style={{ fontSize:"12px", fontWeight:600, color:"#60a5fa", marginBottom:"2px" }}>{t("student.dossierNew.step3.accessibleTitle")}</div>
                  <div style={{ fontSize:"11.5px", color:"#64748b", lineHeight:1.5 }}>
                    {t("student.dossierNew.step3.accessibleDesc", { niveau: t(`student.dossierNew.step2.niveaux.${niveauEtude}`), allowed: allowedLabels })}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Full filière list grouped — eligible programs only */}
          <div style={{ display:"flex", flexDirection:"column", gap:"10px", marginBottom:"16px" }}>
            {STEP_GROUPS.map(group=>{
              const groupFilieres=filieres.filter(f=>getStepGroup(f)===group.key&&isEligibleFiliere(f.categorie,f.nom,niveauEtude))
              if(groupFilieres.length===0) return null
              return(
                <div key={group.key} style={{ borderRadius:"14px", background:"rgba(10,20,42,0.6)", border:"1px solid rgba(255,255,255,0.07)", overflow:"hidden" }}>
                  <div style={{ padding:"10px 16px", borderBottom:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:"10px", background:"rgba(255,255,255,0.02)" }}>
                    <div style={{ width:"3px", height:"18px", borderRadius:"3px", background:group.color, flexShrink:0 }}/>
                    <span style={{ fontSize:"12px", fontWeight:700, color:group.color }}>{group.label}</span>
                  </div>
                  <div style={{ padding:"8px", display:"flex", flexDirection:"column", gap:"6px" }}>
                    {groupFilieres.map(f=>{
                      const selected=selectedFiliere===f.id
                      return(
                        <div key={f.id} onClick={()=>!f.estComplete&&setFiliere(f.id)} style={{ padding:"10px 14px", borderRadius:"10px", border:selected?`1px solid ${group.color}`:"1px solid rgba(255,255,255,0.06)", background:selected?`${group.color}0d`:"rgba(255,255,255,0.02)", cursor:f.estComplete?"not-allowed":"pointer", opacity:f.estComplete?0.5:1, transition:"all 0.15s", display:"flex", justifyContent:"space-between", alignItems:"center", gap:"10px" }}>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                              <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:selected?group.color:"rgba(255,255,255,0.2)", flexShrink:0 }}/>
                              <span style={{ fontSize:"13px", fontWeight:selected?700:500, color:selected?"#f8fafc":"#e2e8f0" }}>{f.nom}</span>
                              {f.estComplete&&<span style={{ fontSize:"10px", padding:"1px 6px", borderRadius:"20px", background:"rgba(248,113,113,0.1)", color:"#f87171" }}>{t("student.dossierNew.step3.full")}</span>}
                              {/* Highlight if recommended */}
                              {quickRecs.slice(0,3).some(r=>r.filiereId===f.id)&&(()=>{
                                const rec=quickRecs.find(r=>r.filiereId===f.id)!
                                const rs=RISK_STYLE[rec.riskLevel]??RISK_STYLE.RISKY
                                return <span style={{ fontSize:"9px", padding:"1px 6px", borderRadius:"20px", background:rs.bg, color:rs.color, fontWeight:700 }}>★ {rec.score.toFixed(1)}/20 — {rs.label}</span>
                              })()}
                            </div>
                            {f.duree&&<div style={{ marginLeft:"14px", fontSize:"11px", color:"#475569", marginTop:"2px" }}>{f.duree}</div>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Ineligible programs — collapsed, informational only */}
          {(()=>{
            const ineligible=filieres.filter(f=>!isEligibleFiliere(f.categorie,f.nom,niveauEtude))
            if(ineligible.length===0) return null
            return(
              <details style={{ marginBottom:"16px" }}>
                <summary style={{ cursor:"pointer", fontSize:"11.5px", color:"#334155", padding:"8px 12px", borderRadius:"10px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)", listStyle:"none", display:"flex", alignItems:"center", gap:"8px" }}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>
                  {t("student.dossierNew.step3.ineligibleCount", { count: String(ineligible.length) })}
                </summary>
                <div style={{ marginTop:"8px", padding:"10px 12px", borderRadius:"10px", background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(255,255,255,0.07)" }}>
                  {ineligible.map(f=>(
                    <div key={f.id} style={{ padding:"7px 10px", borderRadius:"8px", display:"flex", alignItems:"center", gap:"8px", opacity:0.4 }}>
                      <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="#64748b" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75"/></svg>
                      <span style={{ fontSize:"12px", color:"#64748b" }}>{f.nom}</span>
                    </div>
                  ))}
                  <div style={{ marginTop:"8px", fontSize:"10.5px", color:"#1e293b", lineHeight:1.5 }}>
                    {t("student.dossierNew.step3.ineligibleHint")}
                  </div>
                </div>
              </details>
            )
          })()}

          <div style={{ display:"flex", justifyContent:"space-between" }}>
            <button onClick={()=>setStep(3)} style={btnS}>{t("student.dossierNew.back")}</button>
            <button onClick={handleSaveFiliere} disabled={!selectedFiliere||loading} style={{ ...btnP, opacity:(!selectedFiliere||loading)?0.5:1, cursor:(!selectedFiliere||loading)?"not-allowed":"pointer" }}>
              {loading?t("student.dossierNew.step3.saving"):t("student.dossierNew.step4.submitBtn")}
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={showSubmitModal}
        title={t("student.dossierNew.submitModal.title")}
        message={t("student.dossierNew.submitModal.message")}
        confirmLabel={t("student.dossierNew.submitModal.confirm")}
        cancelLabel={t("common.cancel")}
        variant="warning"
        loading={loading}
        onConfirm={handleSubmit}
        onCancel={()=>setShowSubmitModal(false)}
      />
    </div>
  )
}
