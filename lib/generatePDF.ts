// lib/generatePDF.ts — client-side PDF generation using jsPDF (dynamic import)

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DossierForPDF {
  id: string
  statut: string
  dateCreation: string
  dateMaj: string
  motifRejet?: string | null
  score?: number | null
  filiere?: { nom: string; duree?: string | null; langue?: string | null; fraisInscription?: number | null } | null
  etudiant: {
    nom?: string | null; prenom?: string | null; email: string
    dateNaissance?: string | null
    typeIdentite?: string | null; numeroIdentite?: string | null
    sexe?: string | null; pays?: string | null; telephone?: string | null; adresse?: string | null
  }
  niveauEtude?: string | null
  typeCours?: string | null
  sourceDecouverte?: string | null
  notes?: Record<string, number> | null
  diplomes?: Array<{
    intitule: string
    annee: number | null
    type: string | null
    sousType: string | null
    champs: Record<string, unknown> | null
  }>
  documents: { type: string; nom: string }[]
  analyses?: { score: number; complet: boolean; resultat: string; filiereRecommandations: { rang: number; filiere: { nom: string } }[] }[]
}

// ── Label maps ─────────────────────────────────────────────────────────────────

const STATUT_LABELS: Record<string, Record<string, string>> = {
  fr: { BROUILLON:"Brouillon", SOUMIS:"Soumis", EN_ANALYSE:"En analyse", VALIDE:"Validé", REJETE:"Rejeté", LISTE_ATTENTE:"Liste d'attente" },
  en: { BROUILLON:"Draft", SOUMIS:"Submitted", EN_ANALYSE:"Under review", VALIDE:"Accepted", REJETE:"Rejected", LISTE_ATTENTE:"Waitlist" },
}
const NIVEAU_LABELS: Record<string, Record<string, string>> = {
  fr: { BACCALAUREAT:"Baccalauréat", LICENCE_1:"Licence 1", LICENCE_2:"Licence 2", LICENCE_3:"Licence 3", MASTER_1:"Master 1", MASTER_2:"Master 2", DOCTORAT:"Doctorat", AUTRE:"Autre" },
  en: { BACCALAUREAT:"Baccalaureate", LICENCE_1:"Bachelor Year 1", LICENCE_2:"Bachelor Year 2", LICENCE_3:"Bachelor Year 3", MASTER_1:"Master 1", MASTER_2:"Master 2", DOCTORAT:"Doctorate", AUTRE:"Other" },
}
const COURS_LABELS: Record<string, Record<string, string>> = {
  fr: { COURS_JOUR:"Cours de jour", COURS_SOIR:"Cours du soir", FORMATION_CONTINUE:"Formation continue" },
  en: { COURS_JOUR:"Day classes", COURS_SOIR:"Evening classes", FORMATION_CONTINUE:"Continuing education" },
}
const DOC_LABELS: Record<string, Record<string, string>> = {
  fr: { CNI:"Carte d'identité", PASSEPORT:"Passeport", DIPLOME:"Diplôme", RELEVE_NOTES:"Relevé de notes", PHOTO:"Photo d'identité", AUTRE:"Autre" },
  en: { CNI:"ID card", PASSEPORT:"Passport", DIPLOME:"Diploma", RELEVE_NOTES:"Transcript", PHOTO:"ID photo", AUTRE:"Other" },
}
const GRADE_LABELS: Record<string, Record<string, string>> = {
  fr: {
    math:"Mathématiques", physique:"Physique", svt:"Sciences naturelles",
    francais:"Français", arabe:"Arabe", anglais:"Anglais",
    informatique:"Informatique", histoire_geo:"Histoire-Géo",
    philosophie:"Philosophie", techno:"Technologie",
    economie:"Économie", gestion:"Gestion", sport:"Sport", sciences:"Sciences",
    moyenneGenerale:"Moyenne générale", moyennegenerale:"Moyenne générale",
  },
  en: {
    math:"Mathematics", physique:"Physics", svt:"Natural sciences",
    francais:"French", arabe:"Arabic", anglais:"English",
    informatique:"Computer science", histoire_geo:"History-Geo",
    philosophie:"Philosophy", techno:"Technology",
    economie:"Economics", gestion:"Management", sport:"Sport", sciences:"Sciences",
    moyenneGenerale:"Overall average", moyennegenerale:"Overall average",
  },
}
const DIPLO_TYPE_LABELS: Record<string, string> = {
  BAC:"Baccalauréat", LICENCE:"Licence", MASTER:"Master", BTS:"BTS", DOCTORAT:"Doctorat", AUTRE:"Autre",
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// Strip Arabic/RTL characters — jsPDF Helvetica cannot render them
function sanitize(s: string | null | undefined): string {
  if (!s) return ""
  const cleaned = s.replace(/[؀-ۿݐ-ݿ‎‏‪-‮]+/g, "").replace(/\s+/g, " ").trim()
  return cleaned
}

// ── PDF builder ────────────────────────────────────────────────────────────────

export async function downloadDossierPDF(dossier: DossierForPDF, locale: string) {
  const { jsPDF } = await import("jspdf")
  const lang = locale === "en" ? "en" : "fr"
  const L = {
    title:       lang === "fr" ? "Dossier de Candidature"  : "Application File",
    ref:         lang === "fr" ? "Référence"               : "Reference",
    generated:   lang === "fr" ? "Généré le"               : "Generated on",
    identity:    lang === "fr" ? "Informations personnelles": "Personal information",
    fullName:    lang === "fr" ? "Nom complet"             : "Full name",
    email:       "Email",
    dob:         lang === "fr" ? "Date de naissance"       : "Date of birth",
    idDoc:       lang === "fr" ? "Document d'identité"     : "Identity document",
    country:     lang === "fr" ? "Pays"                    : "Country",
    phone:       lang === "fr" ? "Téléphone"               : "Phone",
    address:     lang === "fr" ? "Adresse"                 : "Address",
    academic:    lang === "fr" ? "Parcours académique"     : "Academic background",
    level:       lang === "fr" ? "Niveau d'étude"          : "Study level",
    courseType:  lang === "fr" ? "Type de cours"           : "Course type",
    diplomas:    lang === "fr" ? "Diplômes"                : "Diplomas",
    year:        lang === "fr" ? "Année"                   : "Year",
    notes:       lang === "fr" ? "Notes déclarées"         : "Declared grades",
    program:     lang === "fr" ? "Filière demandée"        : "Requested program",
    duration:    lang === "fr" ? "Durée"                   : "Duration",
    language:    lang === "fr" ? "Langue d'enseignement"   : "Language",
    fees:        lang === "fr" ? "Frais d'inscription"     : "Enrollment fees",
    documents:   lang === "fr" ? "Documents fournis"       : "Submitted documents",
    noDocuments: lang === "fr" ? "Aucun document téléversé": "No documents uploaded",
    analysis:    lang === "fr" ? "Analyse IA"              : "AI Analysis",
    complete:    lang === "fr" ? "Dossier complet"         : "Complete application",
    incomplete:  lang === "fr" ? "Dossier incomplet"       : "Incomplete application",
    recommendations: lang === "fr" ? "Recommandations de filières" : "Program recommendations",
    decision:    lang === "fr" ? "Décision"                : "Decision",
    noAnalysis:  lang === "fr" ? "Aucune analyse effectuée": "No analysis performed",
    disclaimer:  lang === "fr"
      ? "Ce document est généré automatiquement. La décision finale appartient à l'administration."
      : "This document is automatically generated. The final decision belongs to the administration.",
    na: "—",
  }

  const fmtDate = (d: string | null | undefined) =>
    d ? new Date(d).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day:"numeric", month:"long", year:"numeric" }) : L.na

  const refId    = dossier.id.slice(0, 8).toUpperCase()
  const fullName = [dossier.etudiant.prenom, dossier.etudiant.nom].filter(Boolean).join(" ") || dossier.etudiant.email

  // ── Setup ──────────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation:"portrait", unit:"mm", format:"a4" })
  const W = 210; const MARGIN = 18; const CONTENT_W = W - MARGIN * 2
  let y = MARGIN

  const NAVY  = [6,  13,  31]  as [number,number,number]
  const GOLD  = [245,200,66]   as [number,number,number]
  const LIGHT = [100,116,139]  as [number,number,number]
  const WHITE = [248,250,252]  as [number,number,number]
  const GREEN = [74, 222,128]  as [number,number,number]
  const RED   = [248,113,113]  as [number,number,number]

  const setColor = (rgb: [number,number,number]) => doc.setTextColor(...rgb)
  const setFill  = (rgb: [number,number,number]) => doc.setFillColor(...rgb)
  const setDraw  = (rgb: [number,number,number]) => doc.setDrawColor(...rgb)

  // ── Header bar ─────────────────────────────────────────────────────────────
  setFill(NAVY); doc.rect(0, 0, W, 42, "F")
  setFill(GOLD); doc.rect(0, 42, W, 2, "F")

  // Logo — no white background (sit directly on navy, new logo works without container)
  try {
    const logoRes  = await fetch("/logo.png")
    const logoBlob = await logoRes.blob()
    const logoB64  = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror   = reject
      reader.readAsDataURL(logoBlob)
    })
    doc.addImage(logoB64, "PNG", MARGIN, 5, 54, 32)
  } catch {
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); setColor(GOLD)
    doc.text("IIT", MARGIN, 20)
  }

  // Title right of logo
  const TX = MARGIN + 62
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); setColor(WHITE)
  doc.text(L.title, TX, 20)
  doc.setFontSize(9); doc.setFont("helvetica", "normal"); setColor([148,163,184])
  doc.text(`${L.ref}: DOSS-${refId}`, TX, 30)
  doc.text(`${L.generated}: ${fmtDate(new Date().toISOString())}`, TX, 37)

  // Status badge
  const statLabel  = STATUT_LABELS[lang][dossier.statut] ?? dossier.statut
  const statColor: [number,number,number] =
    dossier.statut === "VALIDE"     ? GREEN :
    dossier.statut === "REJETE"     ? RED   :
    dossier.statut === "EN_ANALYSE" ? GOLD  :
    dossier.statut === "SOUMIS"     ? [96,165,250] : [148,163,184]
  setFill(statColor)
  const badgeX = W - MARGIN - 32
  doc.roundedRect(badgeX, 30, 32, 8, 2, 2, "F")
  doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); setColor(NAVY)
  doc.text(statLabel.toUpperCase(), badgeX + 16, 35.5, { align:"center" })

  y = 54

  // ── Layout helpers ─────────────────────────────────────────────────────────
  function section(title: string) {
    if (y > 260) { doc.addPage(); y = MARGIN }
    setFill([15,32,68]); doc.rect(MARGIN, y, CONTENT_W, 8, "F")
    setFill(GOLD);       doc.rect(MARGIN, y, 3, 8, "F")
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); setColor(WHITE)
    doc.text(title.toUpperCase(), MARGIN + 6, y + 5.5)
    y += 13
  }

  function twoCol(items: { label: string; value: string }[]) {
    const colW = CONTENT_W / 2
    for (let i = 0; i < items.length; i += 2) {
      if (y > 270) { doc.addPage(); y = MARGIN }
      const left = items[i], right = items[i + 1]
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); setColor(LIGHT)
      doc.text(left.label, MARGIN, y)
      if (right) doc.text(right.label, MARGIN + colW, y)
      doc.setFont("helvetica", "bold"); doc.setFontSize(9); setColor([30,41,59])
      doc.text(doc.splitTextToSize(left.value || L.na, colW - 4),  MARGIN + 30, y)
      if (right) doc.text(doc.splitTextToSize(right.value || L.na, colW - 4), MARGIN + colW + 30, y)
      y += 7
    }
  }

  // ── 1. Personal information ────────────────────────────────────────────────
  section(L.identity)
  twoCol([
    { label: L.fullName, value: fullName },
    { label: L.email,    value: dossier.etudiant.email },
    { label: L.dob,      value: fmtDate(dossier.etudiant.dateNaissance) },
    { label: L.country,  value: dossier.etudiant.pays ?? L.na },
    { label: L.idDoc,    value: dossier.etudiant.numeroIdentite
        ? `${dossier.etudiant.typeIdentite} — ${dossier.etudiant.numeroIdentite}` : L.na },
    { label: L.phone,    value: dossier.etudiant.telephone ?? L.na },
  ])
  const addrClean = sanitize(dossier.etudiant.adresse)
  if (addrClean) {
    if (y > 270) { doc.addPage(); y = MARGIN }
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); setColor(LIGHT)
    doc.text(L.address, MARGIN, y)
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); setColor([30,41,59])
    doc.text(doc.splitTextToSize(addrClean, CONTENT_W - 34), MARGIN + 30, y)
    y += 7
  }
  y += 4

  // ── 2. Academic background ─────────────────────────────────────────────────
  section(L.academic)
  twoCol([
    { label: L.level,      value: NIVEAU_LABELS[lang][dossier.niveauEtude ?? ""] ?? (dossier.niveauEtude ?? L.na) },
    { label: L.courseType, value: COURS_LABELS[lang][dossier.typeCours ?? ""]   ?? (dossier.typeCours   ?? L.na) },
  ])

  // Diplomas list from diplomes[] array (new structure)
  const diplomas = dossier.diplomes ?? []
  if (diplomas.length > 0) {
    y += 2
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); setColor(LIGHT)
    doc.text(L.diplomas, MARGIN, y); y += 5
    diplomas.forEach((d, idx) => {
      if (y > 270) { doc.addPage(); y = MARGIN }
      setFill(idx % 2 === 0 ? [241,245,249] : [255,255,255])
      doc.rect(MARGIN, y - 1, CONTENT_W, 7, "F")
      setFill(GOLD); doc.rect(MARGIN, y - 1, 2, 7, "F")
      const typeLabel = DIPLO_TYPE_LABELS[d.type ?? ""] ?? (d.type ?? "")
      const intituleClean = sanitize(d.intitule) || typeLabel
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); setColor([30,41,59])
      doc.text(intituleClean, MARGIN + 5, y + 3.5)
      if (d.annee) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); setColor(LIGHT)
        doc.text(String(d.annee), W - MARGIN, y + 3.5, { align:"right" })
      }
      y += 8
    })
  }

  // Grades — from diplomes[].champs merged, keyed labels only
  const mergedGrades: Record<string, number> = {}
  // legacy notes fallback
  if (dossier.notes) {
    for (const [k, v] of Object.entries(dossier.notes)) {
      if (typeof v === "number" && v >= 0 && v <= 20) mergedGrades[k] = v
    }
  }
  // diplomes champs override
  for (const d of diplomas) {
    for (const [k, v] of Object.entries(d.champs ?? {})) {
      const n = typeof v === "number" ? v : parseFloat(String(v))
      if (!isNaN(n) && n >= 0 && n <= 20) mergedGrades[k] = n
    }
  }

  const gradeEntries = Object.entries(mergedGrades).filter(([k]) => k !== "__row_0" && !k.startsWith("__"))
  if (gradeEntries.length > 0) {
    y += 3
    doc.setFont("helvetica", "bold"); doc.setFontSize(8); setColor(LIGHT)
    doc.text(L.notes, MARGIN, y); y += 5
    const colW = CONTENT_W / 4
    for (let i = 0; i < gradeEntries.length; i += 4) {
      if (y > 270) { doc.addPage(); y = MARGIN }
      gradeEntries.slice(i, i + 4).forEach(([k, v], j) => {
        const gradeLabel = GRADE_LABELS[lang][k] ?? GRADE_LABELS[lang][k.toLowerCase()] ?? k.replace(/_/g, " ")
        setFill([241,245,249]); doc.roundedRect(MARGIN + j * colW, y, colW - 2, 10, 1.5, 1.5, "F")
        doc.setFont("helvetica", "normal"); doc.setFontSize(7); setColor(LIGHT)
        doc.text(gradeLabel, MARGIN + j * colW + 2, y + 4, { maxWidth: colW - 4 })
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); setColor([30,41,59])
        doc.text(`${v}/20`, MARGIN + j * colW + 2, y + 8.5)
      })
      y += 13
    }
  }
  y += 4

  // ── 3. Requested program ───────────────────────────────────────────────────
  section(L.program)
  if (dossier.filiere) {
    twoCol([
      { label: L.program,  value: dossier.filiere.nom },
      { label: L.duration, value: dossier.filiere.duree ?? L.na },
      { label: L.language, value: dossier.filiere.langue ?? L.na },
      { label: L.fees,     value: dossier.filiere.fraisInscription != null
          ? `${dossier.filiere.fraisInscription.toLocaleString()} DT/an` : L.na },
    ])
  } else {
    doc.setFontSize(9); setColor(LIGHT); doc.text(L.na, MARGIN, y); y += 6
  }
  y += 4

  // ── 4. Submitted documents ─────────────────────────────────────────────────
  section(L.documents)
  if (dossier.documents.length === 0) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(9); setColor(LIGHT)
    doc.text(L.noDocuments, MARGIN, y); y += 8
  } else {
    dossier.documents.forEach((d, i) => {
      if (y > 270) { doc.addPage(); y = MARGIN }
      setFill(i % 2 === 0 ? [248,250,252] : [255,255,255])
      doc.rect(MARGIN, y - 1, CONTENT_W, 7, "F")
      setFill(GOLD); doc.rect(MARGIN, y - 1, 2, 7, "F")
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); setColor([30,41,59])
      doc.text(DOC_LABELS[lang][d.type] ?? d.type, MARGIN + 5, y + 3.5)
      doc.setFont("helvetica", "normal"); setColor(LIGHT)
      doc.text(lang === "fr" ? "Document fourni ✓" : "Document submitted ✓", MARGIN + 50, y + 3.5)
      y += 8
    })
    y += 4
  }

  // ── 5. AI Analysis ─────────────────────────────────────────────────────────
  section(L.analysis)
  const analyse = dossier.analyses?.[0]
  if (!analyse) {
    doc.setFont("helvetica", "italic"); doc.setFontSize(9); setColor(LIGHT)
    doc.text(L.noAnalysis, MARGIN, y); y += 8
  } else {
    const barW = 80
    const scoreColor: [number,number,number] = analyse.score >= 70 ? GREEN : analyse.score >= 40 ? GOLD : RED
    setFill([226,232,240]); doc.roundedRect(MARGIN, y, barW, 5, 1, 1, "F")
    setFill(scoreColor);    doc.roundedRect(MARGIN, y, barW * analyse.score / 100, 5, 1, 1, "F")
    doc.setFont("helvetica", "bold"); doc.setFontSize(10); setColor(scoreColor)
    doc.text(`${Math.round(analyse.score)}/100`, MARGIN + barW + 4, y + 4)
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); setColor(LIGHT)
    doc.text(analyse.complet ? `✓ ${L.complete}` : `⚠ ${L.incomplete}`, W - MARGIN, y + 4, { align:"right" })
    y += 10

    if (analyse.resultat) {
      const resultatClean = sanitize(analyse.resultat) || analyse.resultat.replace(/[؀-ۿ]+/g, "").trim()
      if (resultatClean) {
        const lines = doc.splitTextToSize(resultatClean, CONTENT_W)
        doc.setFont("helvetica", "italic"); doc.setFontSize(9); setColor([30,41,59])
        doc.text(lines, MARGIN, y); y += lines.length * 5 + 4
      }
    }

    if (analyse.filiereRecommandations?.length > 0) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(8); setColor(LIGHT)
      doc.text(L.recommendations, MARGIN, y); y += 5
      analyse.filiereRecommandations.sort((a, b) => a.rang - b.rang).forEach((r) => {
        if (y > 272) { doc.addPage(); y = MARGIN }
        const isTop = r.rang === 1
        if (isTop) { setFill([254,252,232]); doc.roundedRect(MARGIN, y - 1, CONTENT_W, 7, 1.5, 1.5, "F") }
        doc.setFont("helvetica", isTop ? "bold" : "normal"); doc.setFontSize(9)
        setColor(isTop ? [180,138,0] : [30,41,59])
        doc.text(`${r.rang}. ${r.filiere.nom}`, MARGIN + 3, y + 3.5)
        y += 8
      })
    }
    y += 4
  }

  // ── 6. Rejection reason ────────────────────────────────────────────────────
  if (dossier.statut === "REJETE" && dossier.motifRejet) {
    section(L.decision)
    const reasonClean = sanitize(dossier.motifRejet) || dossier.motifRejet
    const lines = doc.splitTextToSize(reasonClean, CONTENT_W - 8)
    setFill([254,242,242]); doc.roundedRect(MARGIN, y - 2, CONTENT_W, lines.length * 5 + 8, 2, 2, "F")
    setDraw(RED);           doc.roundedRect(MARGIN, y - 2, CONTENT_W, lines.length * 5 + 8, 2, 2, "S")
    doc.setFont("helvetica", "italic"); doc.setFontSize(9); setColor([180,40,40])
    doc.text(lines, MARGIN + 4, y + 4)
    y += lines.length * 5 + 12
  }

  // ── Footer on every page ───────────────────────────────────────────────────
  const pageCount = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    setFill(NAVY); doc.rect(0, 287, W, 10, "F")
    doc.setFont("helvetica", "normal"); doc.setFontSize(7); setColor([100,116,139])
    doc.text(L.disclaimer, MARGIN, 293, { maxWidth: CONTENT_W - 20 })
    doc.text(`${i} / ${pageCount}`, W - MARGIN, 293, { align:"right" })
  }

  doc.save(`Dossier_${refId}_${fullName.replace(/\s+/g, "_")}.pdf`)
}
