"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { useI18n } from "@/lib/i18n-context"
import { DIPLOMA_TYPES, type DiplomaType } from "@/lib/diploma-types"
import { preprocessTranscript, preprocessTranscriptForVL } from "@/lib/ocr/preprocess"
import FilePreview from "@/components/FilePreview"
import { isEligibleFiliere, ELIGIBLE_CATEGORIES } from "@/lib/quick-recommend"

interface Filiere { id: string; nom: string; categorie: string | null; capacite: number | null; inscrits: number | null; estComplete: boolean; tauxRemplissage: number; description: string | null; capaciteStatut?: string }
interface Document { id: string; type: string; nom: string }
interface ExistingDiplome { id: string; intitule: string; annee: number; etablissement: string | null; type: string | null; sousType: string | null; champs: Record<string, string> | null }

interface QuickRec { filiereId: string; nom: string; score: number; riskLevel: string; confidence: string; strengths: string[]; weaknesses: string[] }

type UploadStatus = "idle" | "uploading" | "done" | "error"
type DiplomeEntry = {
  intitule: string; annee: string; etablissement: string
  type: string; sousType: string; champs: Record<string, string>
  ocrFilled: Record<string, boolean>
  certFile?: File; certStatus: "idle"|"uploading"|"done"|"error"
  releveFile?: File; releveStatus: "idle"|"uploading"|"done"|"error"
  scanning: boolean
}

export default function EditDossierPage() {
  const { id } = useParams<{ id: string }>()
  const router  = useRouter()
  const { t, locale } = useI18n()

  const REQUIRED_DOCS = [
    { type: "CNI",   label: t("student.dossierNew.step1.docs.CNI.label"),   icon: "🪪" },
    { type: "PHOTO", label: t("student.dossierNew.step1.docs.PHOTO.label"), icon: "📷" },
  ]

  const NIVEAUX = [
    { value: "BACCALAUREAT", label: t("student.dossierNew.step2.niveaux.BACCALAUREAT") },
    { value: "LICENCE_1",    label: t("student.dossierNew.step2.niveaux.LICENCE_1") },
    { value: "LICENCE_2",    label: t("student.dossierNew.step2.niveaux.LICENCE_2") },
    { value: "LICENCE_3",    label: t("student.dossierNew.step2.niveaux.LICENCE_3") },
    { value: "MASTER_1",     label: t("student.dossierNew.step2.niveaux.MASTER_1") },
    { value: "MASTER_2",     label: t("student.dossierNew.step2.niveaux.MASTER_2") },
    { value: "DOCTORAT",     label: t("student.dossierNew.step2.niveaux.DOCTORAT") },
    { value: "AUTRE",        label: t("student.dossierNew.step2.niveaux.AUTRE") },
  ]

  // ── State ────────────────────────────────────────────────────────────────────
  const [filieres, setFilieres]         = useState<Filiere[]>([])
  const [selectedFiliere, setFiliere]   = useState("")
  const [existingDocs, setExistingDocs] = useState<Document[]>([])
  const [uploads, setUploads]           = useState<Record<string, File>>({})
  const [uploadStatus, setUploadStatus] = useState<Record<string, UploadStatus>>({})
  const [loading, setLoading]           = useState(true)
  const [saving, setSaving]             = useState(false)
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]               = useState("")
  const [step, setStep]                 = useState(1)
  const [dossierStatut, setDossierStatut] = useState<string>("")

  // Academic background
  const [niveauEtude, setNiveauEtude]   = useState("")
  const emptyDiplo = (): DiplomeEntry => ({
    intitule: "", annee: "", etablissement: "", type: "", sousType: "",
    champs: {}, ocrFilled: {},
    certStatus: "idle", releveStatus: "idle", scanning: false,
  })
  const [diplomes, setDiplomes] = useState<DiplomeEntry[]>([emptyDiplo()])

  // Mirror of dossier/new logic — defines required diploma entries per niveau
  function buildRequiredDiplomes(niveau: string): DiplomeEntry[] {
    const bac = (): DiplomeEntry => ({ ...emptyDiplo(), type:"BAC", intitule:"Baccalauréat" })
    switch (niveau) {
      case "BACCALAUREAT": return [bac()]
      case "LICENCE_1":    return [bac()]
      case "LICENCE_2":    return [bac(), { ...emptyDiplo(), type:"LICENCE", intitule:"Relevé de notes — 1ère année Licence" }]
      case "LICENCE_3":    return [bac(), { ...emptyDiplo(), type:"LICENCE", intitule:"Relevé de notes — 1ère année Licence" }, { ...emptyDiplo(), type:"LICENCE", intitule:"Relevé de notes — 2ème année Licence" }]
      case "MASTER_1":     return [{ ...emptyDiplo(), type:"LICENCE", intitule:"Diplôme de Licence" }]
      case "MASTER_2":     return [{ ...emptyDiplo(), type:"LICENCE", intitule:"Diplôme de Licence" }, { ...emptyDiplo(), type:"MASTER", intitule:"Relevé de notes — 1ère année Master" }]
      case "DOCTORAT":     return [{ ...emptyDiplo(), type:"MASTER", intitule:"Diplôme de Master" }]
      default:             return [emptyDiplo()]
    }
  }

  function handleNiveauChange(val: string) {
    setNiveauEtude(val)
    if (val) {
      // Rebuild only if the current diplomas are empty/default (haven't been filled)
      const isEffectivelyEmpty = diplomes.every(d => !d.annee && !d.type && Object.keys(d.champs).length === 0)
      if (isEffectivelyEmpty) setDiplomes(buildRequiredDiplomes(val))
    }
  }

  const OCR_STAGES = ["Lecture du document…", "Identification des zones…", "Extraction des données…", "Vérification des notes…"]
  const [scanStage, setScanStage] = useState(0)
  useEffect(() => {
    const anyScanning = diplomes.some(d => d.scanning)
    if (!anyScanning) { setScanStage(0); return }
    const timer = setInterval(() => setScanStage(s => (s + 1) % OCR_STAGES.length), 5000)
    return () => clearInterval(timer)
  }, [diplomes])

  // ── Real-time recommendations ─────────────────────────────────────────────────
  const [quickRecs, setQuickRecs]   = useState<QuickRec[]>([])
  const [recLoading, setRecLoading] = useState(false)
  const [expandedRec, setExpandedRec] = useState<string|null>(null)
  const recTimer = useRef<ReturnType<typeof setTimeout>|null>(null)

  const collectAllGrades = useCallback(() => {
    const grades: Record<string, number> = {}
    for (const d of diplomes) {
      for (const [k, v] of Object.entries(d.champs)) {
        const n = parseFloat(String(v))
        if (!isNaN(n) && n >= 0 && n <= 20) grades[k] = n
      }
    }
    return grades
  }, [diplomes])

  const updateRecs = useCallback(async () => {
    if (!niveauEtude) { setQuickRecs([]); return }
    if (niveauEtude === "BACCALAUREAT") {
      const bacDip = diplomes.find(d => d.type === "BAC")
      if (!bacDip?.sousType) { setQuickRecs([]); return }
    }
    const grades = collectAllGrades()
    setRecLoading(true)
    try {
      const diplomaContext = diplomes.map(d => ({ type: d.type, sousType: d.sousType, champs: d.champs }))
      const res = await fetch("/api/recommend-preview", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ niveauEtude, grades, diplomes: diplomaContext }),
      })
      if (res.ok) setQuickRecs((await res.json()).recommendations ?? [])
    } catch { /* keep previous */ } finally { setRecLoading(false) }
  }, [niveauEtude, collectAllGrades, diplomes])

  useEffect(() => {
    if (recTimer.current) clearTimeout(recTimer.current)
    recTimer.current = setTimeout(() => { void updateRecs() }, 700)
    return () => { if (recTimer.current) clearTimeout(recTimer.current) }
  }, [updateRecs])

  // ── Load dossier + filières ──────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch(`/api/dossiers/${id}`).then((r) => r.json()),
      fetch("/api/filieres").then((r) => r.json()),
    ]).then(([dossierData, filiereData]) => {
      const d = dossierData.dossier
      setFiliere(d?.filiereId ?? "")
      setExistingDocs(d?.documents ?? [])
      setNiveauEtude(d?.niveauEtude ?? "")
      setDossierStatut(d?.statut ?? "")
      setFilieres(filiereData.filieres ?? [])

      // Pre-populate diplomas: use saved data if available, else required for niveau
      const saved: ExistingDiplome[] = d?.diplomes ?? []
      const niv = d?.niveauEtude ?? ""
      if (saved.length > 0) {
        setDiplomes(saved.map((s) => ({
          intitule:      s.intitule,
          annee:         String(s.annee),
          etablissement: s.etablissement ?? "",
          type:          s.type ?? "",
          sousType:      s.sousType ?? "",
          champs:        (s.champs as Record<string, string>) ?? {},
          ocrFilled: {},
          certStatus: "idle", releveStatus: "idle", scanning: false,
        })))
      } else if (niv && niv !== "AUTRE") {
        // No saved diplomas but niveau is known → pre-populate required entries
        const bac = (): DiplomeEntry => ({ intitule:"Baccalauréat", annee:"", etablissement:"", type:"BAC", sousType:"", champs:{}, ocrFilled:{}, certStatus:"idle", releveStatus:"idle", scanning:false })
        const lic = (title: string): DiplomeEntry => ({ intitule:title, annee:"", etablissement:"", type:"LICENCE", sousType:"", champs:{}, ocrFilled:{}, certStatus:"idle", releveStatus:"idle", scanning:false })
        const prePopulated: Record<string, DiplomeEntry[]> = {
          BACCALAUREAT: [bac()],
          LICENCE_1:    [bac()],
          LICENCE_2:    [bac(), lic("Relevé de notes — 1ère année Licence")],
          LICENCE_3:    [bac(), lic("Relevé de notes — 1ère année Licence"), lic("Relevé de notes — 2ème année Licence")],
          MASTER_1:     [lic("Diplôme de Licence")],
          MASTER_2:     [lic("Diplôme de Licence"), { intitule:"Relevé de notes — 1ère année Master", annee:"", etablissement:"", type:"MASTER", sousType:"", champs:{}, ocrFilled:{}, certStatus:"idle", releveStatus:"idle", scanning:false }],
          DOCTORAT:     [{ intitule:"Diplôme de Master", annee:"", etablissement:"", type:"MASTER", sousType:"", champs:{}, ocrFilled:{}, certStatus:"idle", releveStatus:"idle", scanning:false }],
        }
        if (prePopulated[niv]) setDiplomes(prePopulated[niv])
      }

      const doneMap: Record<string, UploadStatus> = {}
      for (const doc of d?.documents ?? []) doneMap[doc.type] = "done"
      setUploadStatus(doneMap)
    }).finally(() => setLoading(false))
  }, [id])

  // ── Helpers ───────────────────────────────────────────────────────────────────
  function updDiplome(i: number, patch: Partial<DiplomeEntry>) {
    setDiplomes((p) => { const n = [...p]; n[i] = { ...n[i], ...patch }; return n })
  }
  function addDiplome() { setDiplomes((p) => [...p, emptyDiplo()]) }

  async function fileToBase64Edit(
    file: File,
    preprocess?: (c: HTMLCanvasElement) => HTMLCanvasElement,
  ): Promise<string> {
    if (file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) {
      const pdfjsLib = await import("pdfjs-dist")
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs"
      const buf = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: buf, wasmUrl: "/wasm/" } as Parameters<typeof pdfjsLib.getDocument>[0]).promise
      console.log(`[pdfjs-edit] document loaded, numPages=${pdf.numPages}`)
      const page = await pdf.getPage(1)
      const vp = page.getViewport({ scale: 3 })
      const canvas = document.createElement("canvas")
      canvas.width = vp.width; canvas.height = vp.height
      await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vp, canvas }).promise
      console.log(`[pdfjs-edit] rendered at ${canvas.width}×${canvas.height}`)
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

  function applyGradesEdit(i: number, newChamps: Record<string, string>) {
    if (Object.keys(newChamps).length === 0) return
    const newOcr = Object.fromEntries(Object.keys(newChamps).map(k => [k, true]))
    setDiplomes(p => {
      const n = [...p]
      n[i] = { ...n[i], champs: { ...n[i].champs, ...newChamps }, ocrFilled: { ...n[i].ocrFilled, ...newOcr } }
      return n
    })
  }

  async function tesseractTranscriptEdit(imageBase64: string): Promise<Record<string, string>> {
    console.log("[tesseract:transcript-edit] starting recognition…")
    const img = new Image()
    await new Promise<void>((res) => { img.onload = () => res(); img.src = imageBase64 })
    console.log(`[tesseract:transcript-edit] canvas size: ${img.width}×${img.height}`)
    const canvas = document.createElement("canvas")
    canvas.width = img.width; canvas.height = img.height
    canvas.getContext("2d")!.drawImage(img, 0, 0)
    const { createWorker } = await import("tesseract.js")
    const worker = await createWorker("ara+fra+eng", 1, { logger: () => {} })
    const { data } = await worker.recognize(canvas)
    await worker.terminate()
    console.log("[tesseract:transcript-edit] confidence:", data.confidence)
    console.log("[tesseract:transcript-edit] raw text:\n---\n" + data.text + "\n---")
    const clean = data.text.replace(/[‎‏‪-‮⁦-⁩؜]/g,"").replace(/[٠-٩]/g,(d)=>String(d.charCodeAt(0)-0x0660))
    const lines = clean.split("\n").map(l=>l.trim()).filter(Boolean)
    console.log(`[tesseract:transcript-edit] ${lines.length} non-empty lines after cleanup`)

    const PATTERNS = [
      { key:"math",            kw:["رياضيات","الرياضيات","mathémat","math"] },
      { key:"physique",        kw:["علوم فيزيائية","فيزياء وكيمياء","الفيزياء والكيمياء","فيزياء","الفيزياء","physique","sciences physiq"] },
      { key:"svt",             kw:["علوم الحياة والأرض","علوم طبيع","العلوم الطبيعية","علوم الحياة","svt","biolog"] },
      { key:"francais",        kw:["فرنسية","الفرنسية","قرنسية","français","francais"] },
      { key:"arabe",           kw:["اللغة العربية","عربية","العربية","arabe"] },
      { key:"anglais",         kw:["انقليزية","انجليزية","الإنجليزية","إنجليزية","anglais","english"] },
      { key:"informatique",    kw:["إعلامية","الإعلامية","معلوماتية","informatique"] },
      { key:"histoire_geo",    kw:["تاريخ وجغرافيا","histoire géog","géograph"] },
      { key:"philosophie",     kw:["فلسفة","الفلسفة","قلسفة","فلسقة","philosophie"] },
      { key:"techno",          kw:["تكنول","علوم تقنية","technolog"] },
      { key:"economie",        kw:["اقتصاد","الاقتصاد","économie","econom"] },
      { key:"gestion",         kw:["تصرف","التصرف","gestion"] },
      { key:"sport",           kw:["تربية بدنية","التربية البدنية","sport","éducation physiq"] },
      { key:"moyenneGenerale", kw:["المعدل","معدل","moyenne"] },
    ]

    function isHeaderLine(line: string): boolean {
      return /\d{4}[\/\-]\d{2}[\/\-]\d{2}/.test(line) ||
             /\d{2}[\/\-]\d{2}[\/\-]\d{4}/.test(line) ||
             /ولادة|ترسيم|الشعبة|وزارة|الجمهورية|بيان|دورة|تونس في/.test(line)
    }

    function pg(line: string): number | null {
      let norm = line.replace(/(\d)[,،](\d{2})(?!\d)/g, "$1.$2")
      norm = norm.replace(/\b((?:20|1[0-9]|0[0-9])(\d{2}))\b/g, (_, full: string, dec: string) => {
        const intPart = full.slice(0, full.length - 2)
        return `${intPart}.${dec}`
      })
      const n = [...norm.matchAll(/\b((?:20|1[0-9]|0?[0-9])(?:\.\d{1,2})?)\b/g)]
        .map(m => parseFloat(m[1])).filter(n => !isNaN(n) && n >= 0 && n <= 20)
      if (!n.length) return null
      const dec = n.filter(x => !Number.isInteger(x))
      return dec.length ? dec[0] : (n.filter(x => x >= 5)[0] ?? null)
    }

    const champs: Record<string,string> = {}
    const nonHeaderLines = lines.filter(l => !isHeaderLine(l))

    // Pass 1: grade + subject on same line
    for (const line of nonHeaderLines) {
      const lower = line.toLowerCase(); const grade = pg(line)
      if (grade === null) continue
      for (const {key,kw} of PATTERNS) {
        if (kw.some(k=>lower.includes(k))) {
          console.log(`[tesseract:transcript-edit] pass1 matched "${key}" = ${grade} from: "${line}"`)
          champs[key]=String(grade); break
        }
      }
    }

    // Pass 2: grade on its own line — look ±2 lines for subject
    for (let i = 0; i < nonHeaderLines.length; i++) {
      const grade = pg(nonHeaderLines[i])
      if (grade === null) continue
      const windowLines = nonHeaderLines.slice(Math.max(0, i - 2), i + 3).join(" ").toLowerCase()
      for (const {key,kw} of PATTERNS) {
        if (champs[key]) continue
        if (kw.some(k => windowLines.includes(k))) {
          console.log(`[tesseract:transcript-edit] pass2 matched "${key}" = ${grade} via window: "${nonHeaderLines[i]}"`)
          champs[key]=String(grade); break
        }
      }
    }

    console.log("[tesseract:transcript-edit] final grades:", champs)
    return champs
  }

  async function scanReleveForDiploma(i: number, file: File) {
    updDiplome(i, { scanning: true })
    try {
      console.log(`[scan:transcript-edit] starting — file: "${file.name}" (${(file.size/1024).toFixed(1)} KB)`)
      const imageBase64ForVL = await fileToBase64Edit(file, preprocessTranscriptForVL)
      const imageBase64      = await fileToBase64Edit(file, preprocessTranscript)
      console.log("[scan:transcript-edit] images prepared — grayscale for VL, binarized for Tesseract")

      let newChamps: Record<string, string> = {}
      let usedVL = false

      // 1. minicpm-v (primary)
      try {
        const t0 = Date.now()
        const res = await fetch("/api/ocr/document", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageBase64: imageBase64ForVL, documentType: "TRANSCRIPT", sousType: diplomes[i].sousType || null }),
        })
        console.log(`[scan:transcript-edit] minicpm-v responded in ${Date.now()-t0}ms — HTTP ${res.status}`)
        if (res.ok) {
          const json = await res.json() as {
            success: boolean; fallback: boolean; confidence: string | null
            data: { subjects?: { key: string; grade: number }[]; overallAverage?: number | null } | null
          }
          console.log(`[scan:transcript-edit] minicpm-v success=${json.success} fallback=${json.fallback} confidence=${json.confidence}`)
          console.log("[scan:transcript-edit] minicpm-v subjects:", json.data?.subjects ?? [])
          console.log("[scan:transcript-edit] minicpm-v overallAverage:", json.data?.overallAverage)
          if (json.success && json.data) {
            // Positional mapping for orphan grades (same as dossier/new)
            const diploEntry    = diplomes[i]
            const dtDef         = DIPLOMA_TYPES.find(x => x.key === diploEntry.type)
            const stDef         = dtDef?.subtypes?.find(x => x.key === diploEntry.sousType)
            const fieldOrder    = (stDef?.fields ?? dtDef?.fields ?? []).filter(f => f.type === "grade").map(f => f.key)
            const orphanGrades: number[] = []

            for (const s of json.data.subjects ?? []) {
              if (s.grade < 0 || s.grade > 20) { console.log(`[scan:transcript-edit] VL skipped (out of range): ${s.key} = ${s.grade}`); continue }
              if (s.key && !s.key.startsWith("__row_")) {
                newChamps[s.key] = String(s.grade)
                console.log(`[scan:transcript-edit] VL grade: ${s.key} = ${s.grade}`)
              } else {
                orphanGrades.push(s.grade)
                console.log(`[scan:transcript-edit] VL orphan grade: ${s.grade}`)
              }
            }
            if (orphanGrades.length > 0 && fieldOrder.length > 0) {
              const missingKeys = fieldOrder.filter(k => !newChamps[k])
              orphanGrades.forEach((g, idx) => { if (idx < missingKeys.length) { newChamps[missingKeys[idx]] = String(g); console.log(`[scan:transcript-edit] positional: ${missingKeys[idx]} = ${g}`) } })
            }
            if (json.data.overallAverage != null && json.data.overallAverage >= 0 && json.data.overallAverage <= 20) {
              newChamps["moyenneGenerale"] = String(json.data.overallAverage)
              console.log(`[scan:transcript-edit] VL average: ${json.data.overallAverage}`)
            }
            usedVL = Object.keys(newChamps).length > 0
            console.log(`[scan:transcript-edit] VL extracted ${Object.keys(newChamps).length} grades after positional mapping:`, newChamps)
          } else {
            console.warn("[scan:transcript-edit] VL returned no data")
          }
        } else {
          console.warn(`[scan:transcript-edit] VL HTTP error: ${res.status}`)
        }
      } catch(vlErr) {
        console.warn("[scan:transcript-edit] VL call failed:", vlErr)
      }

      // 2. Tesseract fallback if VL returned nothing
      if (!usedVL) {
        console.log("[scan:transcript-edit] VL returned nothing → Tesseract fallback")
        newChamps = await tesseractTranscriptEdit(imageBase64)
        console.log(`[scan:transcript-edit] Tesseract extracted ${Object.keys(newChamps).length} grades:`, newChamps)
      }

      applyGradesEdit(i, newChamps)

    } catch(e) { console.warn("[OCR releve edit]", e) }
    finally { updDiplome(i, { scanning: false }) }
  }

  async function uploadDiplomaFileEdit(file: File, docType: string) {
    const fd = new FormData(); fd.append("file", file); fd.append("type", docType)
    await fetch(`/api/dossiers/${id}/documents`, { method:"POST", body:fd })
  }
  function removeDiplome(i: number) {
    setDiplomes((p) => p.filter((_, j) => j !== i))
  }

  async function uploadDoc(type: string) {
    const file = uploads[type]; if (!file) return
    setUploadStatus((p) => ({ ...p, [type]: "uploading" }))
    try {
      const fd = new FormData(); fd.append("file", file); fd.append("type", type)
      const res = await fetch(`/api/dossiers/${id}/documents`, { method: "POST", body: fd })
      if (!res.ok) throw new Error()
      setUploadStatus((p) => ({ ...p, [type]: "done" }))
    } catch { setUploadStatus((p) => ({ ...p, [type]: "error" })) }
  }

  async function saveFiliere() {
    setError("")
    if (!selectedFiliere) { setError(t("student.dossierNew.step3.noFiliere")); return }
    const res = await fetch(`/api/dossiers/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filiereId: selectedFiliere }),
    })
    if (!res.ok) { setError(t("student.dossierEdit.saveError")); return }
    setStep(4)
  }

  async function saveAcademic() {
    setSaving(true); setError("")
    try {
      // Upload any pending diploma documents
      for (let i = 0; i < diplomes.length; i++) {
        const d = diplomes[i]
        const certType  = i === 0 ? "DIPLOME"      : "AUTRE"
        const relveType = i === 0 ? "RELEVE_NOTES" : "AUTRE"
        if (d.certFile && d.certStatus !== "done") {
          updDiplome(i, { certStatus: "uploading" })
          try { await uploadDiplomaFileEdit(d.certFile, certType); updDiplome(i, { certStatus: "done" }) }
          catch { updDiplome(i, { certStatus: "error" }) }
        }
        if (d.releveFile && d.releveStatus !== "done") {
          updDiplome(i, { releveStatus: "uploading" })
          try { await uploadDiplomaFileEdit(d.releveFile, relveType); updDiplome(i, { releveStatus: "done" }) }
          catch { updDiplome(i, { releveStatus: "error" }) }
        }
      }
      // Merge grades from all diploma champs → stored in notes as reliable backup for analyser
      const mergedNotes: Record<string, number> = {}
      for (const d of diplomes) {
        for (const [k, v] of Object.entries(d.champs)) {
          const n = parseFloat(String(v)); if (!isNaN(n) && n >= 0 && n <= 20) mergedNotes[k] = n
        }
      }
      const validDiplomes = diplomes
        .filter((d) => d.type || d.annee || Object.keys(d.champs).length > 0)
        .map((d) => ({
          intitule:      d.intitule.trim() || d.type || "",
          annee:         parseInt(d.annee) || new Date().getFullYear(),
          etablissement: d.etablissement.trim() || undefined,
          type:          d.type || undefined,
          sousType:      d.sousType || undefined,
          champs:        Object.keys(d.champs).length > 0 ? d.champs : undefined,
        }))
      const res = await fetch(`/api/dossiers/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diplomes: validDiplomes,
          niveauEtude: niveauEtude || null,
          notes: Object.keys(mergedNotes).length > 0 ? mergedNotes : undefined,
        }),
      })
      if (!res.ok) throw new Error(t("common.error"))
      setStep(3)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : t("common.error")) }
    finally { setSaving(false) }
  }

  async function handleSubmit() {
    setSubmitting(true); setError("")
    try {
      fetch(`/api/dossiers/${id}/analyse`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({locale}) }).catch(() => {})
      const res = await fetch(`/api/dossiers/${id}/statut`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "SOUMIS" }),
      })
      if (!res.ok) throw new Error(t("common.error"))
      router.push(`/student/dossier/${id}?submitted=1`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("common.error"))
    } finally { setSubmitting(false) }
  }

  const doneCount   = REQUIRED_DOCS.filter((d) => uploadStatus[d.type] === "done").length
  const allRequired = doneCount === REQUIRED_DOCS.length

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#070e20", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "36px", height: "36px", borderRadius: "50%", border: "2px solid rgba(245,200,66,0.2)", borderTopColor: "#f5c842", animation: "spin 0.8s linear infinite" }}/>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

  // ── Styles ────────────────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = { maxWidth: "700px", padding: "36px 40px", borderRadius: "24px", background: "rgba(10,20,42,0.78)", border: "1px solid rgba(255,255,255,0.07)", backdropFilter: "blur(24px)", boxShadow: "0 32px 80px rgba(0,0,0,0.5)" }
  const btnP: React.CSSProperties = { padding: "12px 28px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#f5c842,#e8a820)", color: "#060d1f", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }
  const btnS: React.CSSProperties = { padding: "11px 20px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94a3b8", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }
  const inp: React.CSSProperties  = { width: "100%", padding: "10px 13px", fontSize: "13px", color: "#f8fafc", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", outline: "none", boxSizing: "border-box", fontFamily: "inherit", transition: "border-color 0.2s" }
  const sel: React.CSSProperties  = { ...inp, appearance: "none", WebkitAppearance: "none", background: "#0f1e3d", cursor: "pointer" }
  const lbl: React.CSSProperties  = { display: "block", fontSize: "9.5px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#64748b", marginBottom: "6px" }

  const RISK_STYLE: Record<string, {color:string; bg:string; label:string}> = {
    SAFE:     { color:"#4ade80", bg:"rgba(74,222,128,0.12)",  label: t("student.dossierNew.recommendations.riskSafe") },
    MODERATE: { color:"#f5c842", bg:"rgba(245,200,66,0.12)",  label: t("student.dossierNew.recommendations.riskModerate") },
    RISKY:    { color:"#f87171", bg:"rgba(248,113,113,0.12)", label: t("student.dossierNew.recommendations.riskRisky") },
  }

  const STEPS = [
    t("student.dossierEdit.steps.documents"),
    t("student.dossierEdit.steps.parcours"),
    t("student.dossierEdit.steps.filiere"),
    t("student.dossierEdit.steps.submit"),
  ]

  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} } @keyframes ocrFill { 0%{width:0%} 80%{width:85%} 100%{width:85%} } @keyframes ocrPulse { 0%,100%{opacity:1} 50%{opacity:0.5} } select option { background:#0f1e3d; color:#f8fafc; } .pf:focus { border-color:#e8b820!important; box-shadow:0 0 0 3px rgba(232,184,32,0.18)!important; } .pf::placeholder { color:#334155; }`}</style>

      <button onClick={() => router.push("/student/dashboard")} style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#64748b", fontSize: "13px", cursor: "pointer", marginBottom: "20px", padding: 0, fontFamily: "inherit" }}>
        {t("student.dossierNew.back")}
      </button>

      <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "26px", fontWeight: 600, color: "#f8fafc", margin: "0 0 6px" }}>
        {dossierStatut === "REJETE" ? t("student.dossierEdit.titleRejected") : t("student.dossierEdit.title")}
      </h1>
      <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "32px" }}>
        {dossierStatut === "REJETE" ? t("student.dossierEdit.subtitleRejected") : t("student.dossierEdit.subtitle")}
      </p>

      {/* Step indicator */}
      <div style={{ display:"flex", alignItems:"flex-start", marginBottom:"36px", maxWidth:"900px" }}>
        {STEPS.map((label, i) => {
          const s = i + 1; const done = step > s; const active = step === s
          return (
            <div key={label} style={{ display:"flex", alignItems:"center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"6px" }}>
                <div onClick={() => done && setStep(s)} style={{ width:"28px", height:"28px", borderRadius:"50%", background: done ? "linear-gradient(135deg,#f5c842,#e8a820)" : active ? "rgba(245,200,66,0.15)" : "rgba(255,255,255,0.05)", border: active ? "2px solid #f5c842" : done ? "none" : "2px solid rgba(255,255,255,0.12)", display:"flex", alignItems:"center", justifyContent:"center", cursor: done ? "pointer" : "default", transition:"all 0.2s" }}>
                  {done ? <span style={{ fontSize:"12px", color:"#060d1f", fontWeight:700 }}>✓</span> : <span style={{ fontSize:"11px", fontWeight:600, color: active ? "#f5c842" : "#334155" }}>{s}</span>}
                </div>
                <div style={{ fontSize:"10px", color: active ? "#f5c842" : done ? "#94a3b8" : "#334155", fontWeight: active ? 600 : 400, whiteSpace:"nowrap" }}>{label}</div>
              </div>
              {i < STEPS.length - 1 && <div style={{ flex:1, height:"1px", margin:"0 6px 20px", background: done ? "linear-gradient(90deg,#f5c842,rgba(245,200,66,0.3))" : "rgba(255,255,255,0.07)" }}/>}
            </div>
          )
        })}
      </div>

      {error && (
        <div style={{ maxWidth: "700px", marginBottom: "20px", padding: "12px 16px", borderRadius: "12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.28)", fontSize: "13px", color: "#fca5a5" }}>
          {error}
        </div>
      )}

      {/* ── Step 1: Documents ────────────────────────────────────────── */}
      {step === 1 && (
        <div style={cardStyle}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "19px", fontWeight: 500, color: "#f8fafc", margin: "0 0 8px" }}>
            {t("student.dossierNew.step1.title")}
          </h2>
          <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "24px" }}>
            {t("student.dossierEdit.docsCount", { done: String(doneCount), total: String(REQUIRED_DOCS.length) })}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
            {REQUIRED_DOCS.map((doc) => {
              const status = uploadStatus[doc.type] ?? "idle"
              const file   = uploads[doc.type]
              return (
                <div key={doc.type} style={{ padding: "14px 18px", borderRadius: "12px", background: status === "done" ? "rgba(74,222,128,0.06)" : "rgba(255,255,255,0.03)", border: status === "done" ? "1px solid rgba(74,222,128,0.2)" : status === "error" ? "1px solid rgba(248,113,113,0.2)" : "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "20px", flexShrink: 0 }}>{doc.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: status === "done" ? "#4ade80" : "#f8fafc" }}>{doc.label}</div>
                    {file && <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>}
                    {!file && status === "done" && <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>Document déjà fourni</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    {status === "done"      && <span style={{ fontSize: "12px", color: "#4ade80", fontWeight: 600 }}>✓</span>}
                    {status === "error"     && <span style={{ fontSize: "12px", color: "#f87171" }}>{t("student.dossierNew.step1.uploadError")}</span>}
                    {status === "uploading" && <span style={{ fontSize: "12px", color: "#f5c842" }}>{t("common.sending")}</span>}
                    <label style={{ padding: "6px 12px", borderRadius: "8px", background: status==="done" ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.06)", border: status==="done" ? "1px solid rgba(74,222,128,0.2)" : "1px solid rgba(255,255,255,0.1)", color: status==="done" ? "#4ade80" : "#94a3b8", fontSize: "12px", cursor: "pointer" }}>
                      {status === "done" ? t("student.dossierNew.step1.change") : t("student.dossierNew.step1.choose")}
                      <input type="file" accept={doc.type === "PHOTO" ? ".jpg,.jpeg,.png,.webp" : ".pdf,application/pdf"} style={{ display: "none" }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) { setUploads((p) => ({ ...p, [doc.type]: f })); setUploadStatus((p) => ({ ...p, [doc.type]: "idle" })) }}}/>
                    </label>
                    {file && status !== "done" && status !== "uploading" && (
                      <button onClick={() => uploadDoc(doc.type)} style={{ padding: "6px 12px", borderRadius: "8px", border: "none", background: "rgba(245,200,66,0.15)", color: "#f5c842", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                        {t("student.dossierNew.step1.upload")}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => setStep(2)} style={btnP}>{t("student.dossierNew.step1.continueAllDone")}</button>
          </div>
        </div>
      )}

      {/* ── Step 2: Parcours + diplomas + recommendations ─────────────── */}
      {step === 2 && (
        <div style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) 260px", gap:"20px", maxWidth:"1100px", alignItems:"flex-start", overflow:"visible" }}>
        <div style={cardStyle}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "19px", fontWeight: 500, color: "#f8fafc", margin: "0 0 8px" }}>
            {t("student.dossierNew.step2.title")}
          </h2>
          <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "24px" }}>{t("student.dossierNew.step2.subtitle")}</p>

          <div style={{ display: "flex", flexDirection: "column", gap: "18px", marginBottom: "28px" }}>

            {/* Current level */}
            <div>
              <label style={lbl}>{t("student.dossierNew.step2.niveau")}</label>
              <select value={niveauEtude} onChange={(e) => handleNiveauChange(e.target.value)} style={sel} className="pf">
                <option value="">{t("common.select")}</option>
                {NIVEAUX.map((n) => <option key={n.value} value={n.value}>{n.label}</option>)}
              </select>
            </div>

            {/* Multiple diplomas */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <label style={{ ...lbl, marginBottom: 0 }}>{t("student.dossierNew.step2.diplomes")}</label>
                <button type="button" onClick={addDiplome} style={{ fontSize: "12px", color: "#f5c842", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, padding: 0 }}>
                  + {t("student.dossierNew.step2.addDiplome")}
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {diplomes.map((d, i) => {
                  const upd = (patch: Partial<DiplomeEntry>) => updDiplome(i, patch)
                  const isRequired = !!niveauEtude && niveauEtude !== "AUTRE"
                  const dtDef: DiplomaType | undefined = DIPLOMA_TYPES.find((x) => x.key === d.type)
                  const stDef = dtDef?.subtypes?.find((x) => x.key === d.sousType)
                  const allFields   = d.type === "BAC" ? (stDef?.fields ?? []) : (dtDef?.fields ?? [])
                  const gradeFields = allFields.filter((f) => f.type === "grade")
                  const infoFields  = allFields.filter((f) => f.type !== "grade")
                  const ocrCount    = Object.values(d.ocrFilled).filter(Boolean).length

                  const renderField = (f: typeof allFields[0]) => {
                    const isOcr    = d.ocrFilled[f.key]
                    const clearOcr = () => upd({ ocrFilled: { ...d.ocrFilled, [f.key]: false } })
                    const ocrStyle = isOcr ? { ...inp, borderColor:"rgba(245,200,66,0.5)", background:"rgba(245,200,66,0.06)" } : inp
                    return (
                      <div key={f.key}>
                        <div style={{ display:"flex", alignItems:"center", gap:"5px", marginBottom:"5px" }}>
                          <label style={{ ...lbl, marginBottom:0, fontSize:"9px" }}>
                            {t(`student.dossierNew.step2.diplomaFields.${f.labelKey}`)}
                            {f.required && <span style={{ color:"#f87171", marginLeft:"2px" }}>*</span>}
                          </label>
                          {isOcr && <span style={{ fontSize:"8.5px", padding:"0 5px", borderRadius:"4px", background:"rgba(245,200,66,0.12)", color:"#f5c842", fontWeight:700 }}>{t("student.dossierNew.step2.ocrDetected")}</span>}
                        </div>
                        {f.type === "grade" ? (
                          <input type="number" min="0" max="20" step="0.25" value={d.champs[f.key] ?? ""} onChange={(e) => { upd({ champs:{ ...d.champs,[f.key]:e.target.value } }); clearOcr() }} placeholder="—" className="pf" style={{ ...ocrStyle, textAlign:"center" }}/>
                        ) : f.type === "mention" ? (
                          <select value={d.champs[f.key] ?? ""} onChange={(e) => { upd({ champs:{ ...d.champs,[f.key]:e.target.value } }); clearOcr() }} style={{ ...sel,...(isOcr?{borderColor:"rgba(245,200,66,0.5)",background:"rgba(245,200,66,0.06)"}:{}) }} className="pf">
                            <option value="">{t("common.select")}</option>
                            {["Passable","Assez Bien","Bien","Très Bien"].map((m)=><option key={m} value={m}>{m}</option>)}
                          </select>
                        ) : (
                          <input value={d.champs[f.key] ?? ""} onChange={(e) => { upd({ champs:{ ...d.champs,[f.key]:e.target.value } }); clearOcr() }} placeholder="—" className="pf" style={ocrStyle}/>
                        )}
                      </div>
                    )
                  }

                  return (
                    <div key={i} style={{ borderRadius:"16px", background:"rgba(255,255,255,0.03)", border:`1px solid ${isRequired?"rgba(245,200,66,0.18)":"rgba(255,255,255,0.09)"}`, overflow:"hidden" }}>
                      {/* Header */}
                      <div style={{ padding:"12px 16px", background:"rgba(255,255,255,0.02)", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", gap:"12px" }}>
                        {isRequired && <span style={{ fontSize:"8.5px", fontWeight:700, padding:"2px 7px", borderRadius:"20px", background:"rgba(245,200,66,0.12)", color:"#f5c842", flexShrink:0, textTransform:"uppercase", letterSpacing:"0.06em" }}>Requis</span>}
                        {isRequired ? (
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:"12.5px", fontWeight:600, color:"#f8fafc" }}>{d.intitule || (dtDef ? t(`student.dossierNew.step2.diplomaTypes.${dtDef.labelKey}`) : "")}</div>
                          </div>
                        ) : (
                          <div style={{ flex:1, minWidth:0 }}>
                            <label style={{ ...lbl, fontSize:"9px" }}>{t("student.dossierNew.step2.diplomeType")}</label>
                            <select value={d.type} onChange={(e) => upd({ type:e.target.value, sousType:"", champs:{}, ocrFilled:{}, intitule:"" })} style={sel} className="pf">
                              <option value="">{t("common.select")}</option>
                              {DIPLOMA_TYPES.map((dt)=><option key={dt.key} value={dt.key}>{t(`student.dossierNew.step2.diplomaTypes.${dt.labelKey}`)}</option>)}
                            </select>
                          </div>
                        )}
                        <div style={{ flexShrink:0 }}>
                          <label style={{ ...lbl, fontSize:"9px" }}>{t("student.dossierNew.step2.year")}</label>
                          <input type="number" min="1960" max={new Date().getFullYear()} value={d.annee} onChange={(e) => upd({ annee:e.target.value })} placeholder={String(new Date().getFullYear())} className="pf" style={{ ...inp, width:"90px" }}/>
                        </div>
                        {!isRequired && diplomes.length > 1 && (
                          <button type="button" onClick={() => removeDiplome(i)} style={{ width:"32px", height:"32px", borderRadius:"8px", border:"1px solid rgba(248,113,113,0.25)", background:"rgba(248,113,113,0.07)", color:"#f87171", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"inherit", flexShrink:0 }}>
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
                          </button>
                        )}
                      </div>

                      {d.type && (
                        <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:"14px" }}>
                          {/* Certificate — FIRST */}
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px", padding:"8px 12px", borderRadius:"8px", background:d.certFile?"rgba(245,200,66,0.06)":"rgba(255,255,255,0.02)", border:d.certFile?"1px solid rgba(245,200,66,0.25)":"1px solid rgba(255,255,255,0.06)" }}>
                            {d.certFile && <FilePreview file={d.certFile} size={48}/>}
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontSize:"11.5px", color:d.certFile?"#f5c842":"#64748b", fontWeight:d.certFile?600:400 }}>{t("student.dossierNew.step2.certLabel")}</div>
                              {d.certFile && <div style={{ fontSize:"10px", color:"#475569", marginTop:"2px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{d.certFile.name}</div>}
                            </div>
                            <div style={{ display:"flex", alignItems:"center", gap:"6px", flexShrink:0 }}>
                              {(d.certFile||d.certStatus==="done")&&<span style={{ color:"#f5c842", fontSize:"12px" }}>✓</span>}
                              <label style={{ fontSize:"11px", padding:"4px 10px", borderRadius:"6px", background:d.certFile?"rgba(245,200,66,0.1)":"rgba(255,255,255,0.05)", border:d.certFile?"1px solid rgba(245,200,66,0.25)":"1px solid rgba(255,255,255,0.1)", color:d.certFile?"#f5c842":"#64748b", cursor:"pointer" }}>
                                {d.certFile ? t("student.dossierNew.step1.change") : t("student.dossierNew.step1.choose")}
                                <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:"none" }} onChange={(e)=>{ const f=e.target.files?.[0]; if(f) upd({certFile:f,certStatus:"idle"}) }}/>
                              </label>
                            </div>
                          </div>

                          {/* Transcript upload — after cert */}
                          <div style={{ padding:"12px 14px", borderRadius:"10px", background:d.releveFile?"rgba(245,200,66,0.05)":"rgba(96,165,250,0.04)", border:d.releveFile?"1px solid rgba(245,200,66,0.22)":"1px dashed rgba(96,165,250,0.25)" }}>
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px" }}>
                              {d.releveFile && <FilePreview file={d.releveFile} size={48}/>}
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
                                  <span style={{ fontSize:"12.5px", fontWeight:600, color:d.releveFile?"#f5c842":"#60a5fa" }}>{t("student.dossierNew.step2.releveLabel")}</span>
                                  <span style={{ fontSize:"9px", padding:"1px 5px", borderRadius:"4px", background:"rgba(245,200,66,0.1)", color:"#f5c842", fontWeight:700 }}>OCR</span>
                                  {!d.releveFile && <span style={{ fontSize:"9px", color:"#475569" }}>— {t("student.dossierNew.step2.releveRecommended")}</span>}
                                </div>
                                {d.releveFile ? (
                                  <div style={{ display:"flex", alignItems:"center", gap:"6px", marginTop:"2px" }}>
                                    <div style={{ fontSize:"10px", color:"#475569", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{d.releveFile.name}</div>
                                    <a href={URL.createObjectURL(d.releveFile)} target="_blank" rel="noopener noreferrer" title="Voir le document" style={{ color:"#60a5fa", flexShrink:0 }}>
                                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"/><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>
                                    </a>
                                  </div>
                                ) : <div style={{ fontSize:"11px", color:"#334155", marginTop:"2px" }}>{t("student.dossierNew.step2.releveHint")}</div>}
                                {d.scanning && (
                                  <div style={{ marginTop:"6px" }}>
                                    <div style={{ height:"3px", borderRadius:"2px", background:"rgba(255,255,255,0.07)", overflow:"hidden" }}>
                                      <div style={{ height:"100%", borderRadius:"2px", background:"linear-gradient(90deg,#f5c842,#e8a820)", animation:"ocrFill 180s ease-out forwards" }}/>
                                    </div>
                                    <div style={{ display:"flex", alignItems:"center", gap:"5px", marginTop:"4px" }}>
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" style={{ animation:"spin 1.2s linear infinite", flexShrink:0 }}><circle cx="12" cy="12" r="10" stroke="#f5c842" strokeWidth="2" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#f5c842" strokeWidth="2" strokeLinecap="round"/></svg>
                                      <span style={{ fontSize:"10px", color:"#f5c842", animation:"fadeIn 0.4s ease both" }} key={scanStage}>{OCR_STAGES[scanStage]}</span>
                                    </div>
                                    <div style={{ fontSize:"9px", color:"#475569", marginTop:"2px", animation:"ocrPulse 2s ease-in-out infinite" }}>⏱ Analyse IA — peut prendre 1-2 min</div>
                                  </div>
                                )}
                                {ocrCount>0&&!d.scanning && <div style={{ fontSize:"10px", color:"#f5c842", marginTop:"3px" }}>✨ {t("student.dossierNew.step2.ocrPrefilledCount", { count:String(ocrCount) })}</div>}
                              </div>
                              <label style={{ fontSize:"11px", padding:"6px 12px", borderRadius:"8px", background:d.releveFile?"rgba(245,200,66,0.12)":"rgba(96,165,250,0.1)", border:d.releveFile?"1px solid rgba(245,200,66,0.3)":"1px solid rgba(96,165,250,0.25)", color:d.releveFile?"#f5c842":"#60a5fa", cursor:"pointer", fontWeight:600, flexShrink:0 }}>
                                {d.releveFile ? t("student.dossierNew.step1.change") : t("student.dossierNew.step2.importReleve")}
                                <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display:"none" }} onChange={async(e)=>{ const f=e.target.files?.[0]; if(!f) return; upd({releveFile:f,releveStatus:"idle"}); await scanReleveForDiploma(i,f) }}/>
                              </label>
                            </div>
                          </div>
                          {/* BAC subtype */}
                          {d.type==="BAC"&&dtDef?.subtypes&&(
                            <div>
                              <label style={{ ...lbl, fontSize:"9px" }}>{t("student.dossierNew.step2.diplomaSousType")}</label>
                              <select value={d.sousType} onChange={(e)=>upd({sousType:e.target.value,champs:{},ocrFilled:{}})} style={sel} className="pf">
                                <option value="">{t("common.select")}</option>
                                {dtDef.subtypes.map(st=><option key={st.key} value={st.key}>{t(`student.dossierNew.step2.diplomaTypes.${st.labelKey}`)}</option>)}
                              </select>
                            </div>
                          )}
                          {/* 📊 Notes */}
                          {gradeFields.length>0&&(
                            <div>
                              <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
                                <div style={{ width:"3px", height:"16px", borderRadius:"2px", background:"#60a5fa" }}/>
                                <span style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"#60a5fa" }}>{t("student.dossierNew.step2.sectionNotes")}</span>
                              </div>
                              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px" }}>{gradeFields.map(renderField)}</div>
                            </div>
                          )}
                          {/* 🎓 Info */}
                          {(infoFields.length>0||d.type!=="BAC")&&(
                            <div>
                              <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px" }}>
                                <div style={{ width:"3px", height:"16px", borderRadius:"2px", background:"#a78bfa" }}/>
                                <span style={{ fontSize:"11px", fontWeight:700, letterSpacing:"0.06em", textTransform:"uppercase", color:"#a78bfa" }}>{t("student.dossierNew.step2.sectionInfo")}</span>
                              </div>
                              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
                                {infoFields.map(renderField)}
                                {d.type!=="BAC"&&!infoFields.some(f=>f.key==="etablissement")&&(
                                  <div>
                                    <label style={{ ...lbl, fontSize:"9px" }}>{t("student.dossierNew.step2.etablissement")}</label>
                                    <input value={d.etablissement} onChange={(e)=>upd({etablissement:e.target.value})} placeholder={t("student.dossierNew.step2.etablissementPlaceholder")} className="pf" style={inp}/>
                                  </div>
                                )}
                                {d.type==="AUTRE"&&(
                                  <div>
                                    <label style={{ ...lbl, fontSize:"9px" }}>{t("student.dossierNew.step2.diplomeTitle")}</label>
                                    <input value={d.intitule} onChange={(e)=>upd({intitule:e.target.value})} placeholder={t("student.dossierNew.step2.lastDiplomePlaceholder")} className="pf" style={inp}/>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => setStep(1)} style={btnS}>{t("student.dossierNew.back")}</button>
            <button onClick={saveAcademic} disabled={saving} style={{ ...btnP, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
              {saving ? (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="#060d1f" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#060d1f" strokeWidth="3" strokeLinecap="round"/></svg>{t("common.saving")}</>
              ) : t("student.dossierEdit.saveAndContinue")}
            </button>
          </div>
        </div>

        {/* Recommendations sidebar */}
        <div style={{ position:"sticky", top:"88px", alignSelf:"flex-start" }}>
          <div style={{ padding:"20px", borderRadius:"18px", background:"rgba(10,20,42,0.7)", border:"1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#f5c842" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z"/></svg>
                <span style={{ fontFamily:"'Playfair Display',Georgia,serif", fontSize:"14px", fontWeight:600, color:"#f8fafc" }}>{t("student.dossierNew.recommendations.title")}</span>
              </div>
              {recLoading && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ animation:"spin 0.8s linear infinite", flexShrink:0 }}><circle cx="12" cy="12" r="10" stroke="#f5c842" strokeWidth="2" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#f5c842" strokeWidth="2" strokeLinecap="round"/></svg>}
            </div>
            {quickRecs.length === 0 ? (
              <div style={{ fontSize:"12px", color:"#334155", lineHeight:1.6 }}>
                {recLoading ? t("common.loading")
                  : (niveauEtude === "BACCALAUREAT" && !diplomes.find(d => d.type === "BAC")?.sousType)
                    ? t("student.dossierNew.recommendations.waitBacSerie")
                    : t("student.dossierNew.recommendations.empty")}
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {quickRecs.map((rec, i) => {
                  const rs = RISK_STYLE[rec.riskLevel] ?? RISK_STYLE.RISKY
                  const isOpen = expandedRec === rec.filiereId
                  return (
                    <div key={rec.filiereId} style={{ borderRadius:"12px", background:"rgba(10,20,42,0.5)", border:`1px solid ${rs.color}22`, overflow:"hidden" }}>
                      <div onClick={() => setExpandedRec(isOpen ? null : rec.filiereId)} style={{ padding:"10px 12px", cursor:"pointer", display:"flex", alignItems:"flex-start", gap:"8px" }}>
                        <div style={{ width:"18px", height:"18px", borderRadius:"50%", background:rs.bg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"9px", fontWeight:700, color:rs.color, flexShrink:0, marginTop:"1px" }}>{i+1}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:"11.5px", fontWeight:600, color:"#f8fafc", lineHeight:1.3 }}>{rec.nom}</div>
                          <div style={{ display:"flex", alignItems:"center", gap:"6px", marginTop:"3px", flexWrap:"wrap" }}>
                            <span style={{ fontSize:"12px", fontWeight:700, color:rs.color }}>{rec.score.toFixed(1)}<span style={{ fontSize:"9px", fontWeight:400, color:"#475569" }}>/20</span></span>
                            <span style={{ fontSize:"9px", fontWeight:700, padding:"1px 6px", borderRadius:"4px", background:rs.bg, color:rs.color }}>{rs.label}</span>
                          </div>
                        </div>
                        <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={2} style={{ transition:"transform 0.2s", transform:isOpen?"rotate(180deg)":"rotate(0)", flexShrink:0, marginTop:"3px" }}><path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7"/></svg>
                      </div>
                      {isOpen && (
                        <div style={{ padding:"0 12px 12px", borderTop:"1px solid rgba(255,255,255,0.05)", animation:"fadeIn 0.15s ease both" }}>
                          {rec.strengths.map((s,j) => <div key={j} style={{ display:"flex", gap:"5px", marginTop:"6px" }}><span style={{ color:"#4ade80", fontSize:"10px" }}>✅</span><span style={{ fontSize:"10.5px", color:"#94a3b8", lineHeight:1.45 }}>{s}</span></div>)}
                          {rec.weaknesses.map((w,j) => <div key={j} style={{ display:"flex", gap:"5px", marginTop:"4px" }}><span style={{ color:"#f87171", fontSize:"10px" }}>❌</span><span style={{ fontSize:"10.5px", color:"#64748b", lineHeight:1.45 }}>{w}</span></div>)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <p style={{ fontSize:"10px", color:"#1e293b", marginTop:"14px", marginBottom:0, lineHeight:1.6 }}>{t("student.dossierNew.recommendations.disclaimer")}</p>
          </div>
        </div>
        </div>
      )}

      {/* ── Step 3: Filière ───────────────────────────────────────────── */}
      {step === 3 && (
        <div style={cardStyle}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "19px", fontWeight: 500, color: "#f8fafc", margin: "0 0 24px" }}>
            {t("student.dossierNew.step3.title")}
          </h2>
          {/* Eligibility guidance */}
          {(()=>{
            const allowed = ELIGIBLE_CATEGORIES[niveauEtude]
            if (!allowed || allowed.includes("*")) return null
            const GL: Record<string,string> = { preparatoire:"Cycle Préparatoire", licence:"Licences", ingenierie:"Cycles Ingénieur", master:"Masters", architecture:"Architecture" }
            const allowedLabels = allowed.map(k=>GL[k]??k).join(", ")
            return(
              <div style={{ padding:"11px 16px", borderRadius:"12px", background:"rgba(96,165,250,0.07)", border:"1px solid rgba(96,165,250,0.2)", marginBottom:"14px", display:"flex", gap:"10px", alignItems:"flex-start" }}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="#60a5fa" strokeWidth={2} style={{ flexShrink:0, marginTop:"1px" }}><path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z"/></svg>
                <div style={{ fontSize:"11.5px", color:"#64748b", lineHeight:1.5 }}>
                  {t("student.dossierNew.step3.accessibleDesc", { niveau: t(`student.dossierNew.step2.niveaux.${niveauEtude}`), allowed: allowedLabels })}
                </div>
              </div>
            )
          })()}

          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
            {filieres.filter(f => isEligibleFiliere(f.categorie ?? null, f.nom, niveauEtude)).map((f) => {
              const isSelected = selectedFiliere === f.id
              const recMatch = quickRecs.find(r => r.filiereId === f.id)
              const rs = recMatch ? (RISK_STYLE[recMatch.riskLevel] ?? RISK_STYLE.RISKY) : null
              return (
                <div key={f.id} onClick={() => !f.estComplete && setFiliere(f.id)} style={{ padding: "16px 18px", borderRadius: "12px", border: isSelected ? "1px solid #f5c842" : "1px solid rgba(255,255,255,0.08)", background: isSelected ? "rgba(245,200,66,0.07)" : "rgba(255,255,255,0.02)", cursor: f.estComplete ? "not-allowed" : "pointer", opacity: f.estComplete ? 0.5 : 1, display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", flexShrink: 0, background: isSelected ? "#f5c842" : "rgba(255,255,255,0.15)" }}/>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 600, color: "#f8fafc" }}>{f.nom}</div>
                      {f.description && <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>{f.description}</div>}
                      {f.estComplete && <div style={{ fontSize: "10px", color: "#f87171", marginTop: "2px" }}>{t("student.dossierNew.step3.full")}</div>}
                    </div>
                  </div>
                  {rs && <span style={{ fontSize:"10px", fontWeight:700, padding:"2px 8px", borderRadius:"6px", background:rs.bg, color:rs.color, flexShrink:0 }}>{rs.label} {recMatch!.score.toFixed(1)}/20</span>}
                </div>
              )
            })}
          </div>

          {/* Ineligible programs collapsed */}
          {(()=>{
            const ineligible = filieres.filter(f => !isEligibleFiliere(f.categorie ?? null, f.nom, niveauEtude))
            if (!ineligible.length) return null
            return(
              <details style={{ marginBottom:"16px" }}>
                <summary style={{ cursor:"pointer", fontSize:"11.5px", color:"#334155", padding:"8px 12px", borderRadius:"10px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)", listStyle:"none", display:"flex", alignItems:"center", gap:"8px" }}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>
                  {t("student.dossierNew.step3.ineligibleCount", { count: String(ineligible.length) })}
                </summary>
                <div style={{ marginTop:"8px", padding:"10px 12px", borderRadius:"10px", background:"rgba(255,255,255,0.02)", border:"1px dashed rgba(255,255,255,0.07)" }}>
                  {ineligible.map(f=><div key={f.id} style={{ padding:"5px 8px", fontSize:"12px", color:"#475569", opacity:0.5 }}>{f.nom}</div>)}
                  <div style={{ marginTop:"6px", fontSize:"10.5px", color:"#1e293b" }}>{t("student.dossierNew.step3.ineligibleHint")}</div>
                </div>
              </details>
            )
          })()}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={() => setStep(2)} style={btnS}>{t("student.dossierNew.back")}</button>
            <button onClick={saveFiliere} disabled={!selectedFiliere} style={{ ...btnP, opacity: selectedFiliere ? 1 : 0.5, cursor: selectedFiliere ? "pointer" : "not-allowed" }}>
              {t("student.dossierEdit.saveAndContinue")}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Submit ───────────────────────────────────────────── */}
      {step === 4 && (
        <div style={cardStyle}>
          <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: "19px", fontWeight: 500, color: "#f8fafc", margin: "0 0 24px" }}>
            {t("student.dossierEdit.steps.submit")}
          </h2>

          <div style={{ padding: "20px 22px", borderRadius: "14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { label: t("student.dossierNew.step4.filiere"),   value: filieres.find((f) => f.id === selectedFiliere)?.nom ?? "—" },
              { label: t("student.dossierNew.step2.diplomes"),  value: diplomes.filter((d) => d.annee).length > 0 ? `${diplomes.filter((d) => d.annee).length} diplôme(s)` : "—" },
              { label: t("student.dossierNew.step4.documents"), value: t("student.dossierEdit.docsCount", { done: String(doneCount), total: String(REQUIRED_DOCS.length) }) },
            ].map(({ label, value }) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                <span style={{ color: "#64748b" }}>{label}</span>
                <span style={{ color: "#f8fafc", fontWeight: 500 }}>{value}</span>
              </div>
            ))}
          </div>

          {!allRequired && (
            <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.2)", fontSize: "13px", color: "#f5c842", marginBottom: "20px" }}>
              {t("student.dossierEdit.incompleteWarning")}
            </div>
          )}

          <p style={{ fontSize: "12px", color: "#475569", marginBottom: "28px", lineHeight: 1.6 }}>
            {t("student.dossierNew.step4.notice")}
          </p>

          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
            <button onClick={() => setStep(3)} style={btnS}>{t("student.dossierNew.back")}</button>

            <button onClick={handleSubmit} disabled={submitting} style={{ ...btnP, opacity: submitting ? 0.6 : 1, cursor: submitting ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: "8px", boxShadow: submitting ? "none" : "0 4px 20px rgba(232,184,32,0.32)" }}>
              {submitting ? (
                <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 0.8s linear infinite" }}><circle cx="12" cy="12" r="10" stroke="#060d1f" strokeWidth="3" strokeOpacity="0.3"/><path d="M12 2a10 10 0 0 1 10 10" stroke="#060d1f" strokeWidth="3" strokeLinecap="round"/></svg>{t("student.dossierEdit.submitting")}</>
              ) : t("student.dossierNew.step4.submitBtn")}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
