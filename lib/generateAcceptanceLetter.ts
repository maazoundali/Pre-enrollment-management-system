// lib/generateAcceptanceLetter.ts
// Generates an official acceptance letter PDF (distinct from the dossier export).
// Only called when dossier.statut === "VALIDE".

export interface AcceptanceLetterData {
  dossierId: string
  dateMaj:   string   // date of validation decision
  etudiant: {
    nom:          string | null
    prenom:       string | null
    email:        string
    sexe?:        string | null
    adresse?:     string | null
    pays?:        string | null
  }
  filiere: {
    nom:              string
    duree?:           string | null
    diplomeDelivre?:  string | null
    langue?:          string | null
    fraisInscription?: number | null
  }
}

export async function downloadAcceptanceLetter(
  data: AcceptanceLetterData,
  locale: string = "fr"
): Promise<void> {
  const { jsPDF } = await import("jspdf")
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })

  const W = 210
  const MARGIN = 22
  const LINE   = 6.5
  let   y      = MARGIN

  const serif = "times"
  const sans  = "helvetica"

  const isFemale = data.etudiant.sexe === "FEMME"
  const fullName = [data.etudiant.prenom, data.etudiant.nom].filter(Boolean).join(" ") || data.etudiant.email
  const ref      = `ACCEPT-${data.dossierId.slice(0, 8).toUpperCase()}`
  const dateStr  = new Date(data.dateMaj).toLocaleDateString(
    locale === "ar" ? "fr-FR" : locale === "en" ? "en-GB" : "fr-FR",
    { day: "numeric", month: "long", year: "numeric" }
  )

  // ── Colour palette ────────────────────────────────────────────────────────
  const GOLD    = [245, 200, 66]  as [number, number, number]
  const NAVY    = [6,   13,  31]  as [number, number, number]
  const DARK    = [15,  30,  61]  as [number, number, number]
  const MID     = [71,  85, 105]  as [number, number, number]
  const LIGHT   = [248, 250, 252] as [number, number, number]

  // ── Header band ───────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY)
  doc.rect(0, 0, W, 38, "F")

  // Gold accent line
  doc.setFillColor(...GOLD)
  doc.rect(0, 38, W, 1.5, "F")

  // Institution name
  doc.setFont(serif, "bold")
  doc.setFontSize(15)
  doc.setTextColor(...LIGHT)
  doc.text("INSTITUT INTERNATIONAL DE TECHNOLOGIE", MARGIN, 16)

  doc.setFont(sans, "normal")
  doc.setFontSize(8.5)
  doc.setTextColor(...GOLD)
  doc.text("Université Nord Américaine Privée  ·  Tunis, Tunisie", MARGIN, 22.5)

  // Document type label (right side)
  doc.setFont(serif, "italic")
  doc.setFontSize(10)
  doc.setTextColor(...LIGHT)
  doc.text(
    locale === "en" ? "OFFICIAL ACCEPTANCE LETTER" : "LETTRE D'ACCEPTATION OFFICIELLE",
    W - MARGIN, 16, { align: "right" }
  )
  doc.setFont(sans, "normal")
  doc.setFontSize(8)
  doc.setTextColor(...GOLD)
  doc.text(`Réf. ${ref}`, W - MARGIN, 22.5, { align: "right" })

  y = 52

  // ── Date & place ─────────────────────────────────────────────────────────
  doc.setFont(sans, "normal")
  doc.setFontSize(10)
  doc.setTextColor(...MID)
  doc.text(`Tunis, le ${dateStr}`, W - MARGIN, y, { align: "right" })
  y += 14

  // ── Recipient block ───────────────────────────────────────────────────────
  doc.setFont(sans, "bold")
  doc.setFontSize(11)
  doc.setTextColor(...DARK)
  doc.text(
    (isFemale ? "Madame " : "Monsieur ") + fullName,
    MARGIN, y
  )
  y += LINE
  if (data.etudiant.email) {
    doc.setFont(sans, "normal")
    doc.setFontSize(9.5)
    doc.setTextColor(...MID)
    doc.text(data.etudiant.email, MARGIN, y)
    y += LINE * 0.9
  }
  if (data.etudiant.adresse) {
    doc.setFont(sans, "normal")
    doc.setFontSize(9.5)
    doc.setTextColor(...MID)
    doc.text(data.etudiant.adresse.slice(0, 70), MARGIN, y)
    y += LINE * 0.9
  }
  if (data.etudiant.pays) {
    doc.setFont(sans, "normal")
    doc.setFontSize(9.5)
    doc.setTextColor(...MID)
    doc.text(data.etudiant.pays, MARGIN, y)
    y += LINE * 0.9
  }
  y += 10

  // ── Subject line ──────────────────────────────────────────────────────────
  doc.setFillColor(245, 200, 66, 18)
  doc.setDrawColor(...GOLD)
  doc.roundedRect(MARGIN, y - 5, W - MARGIN * 2, 12, 2, 2, "FD")

  doc.setFont(sans, "bold")
  doc.setFontSize(10)
  doc.setTextColor(...DARK)
  const subject = locale === "en"
    ? `Subject: Admission to ${data.filiere.nom}`
    : `Objet : Admission en ${data.filiere.nom}`
  doc.text(subject, MARGIN + 4, y + 3)
  y += 20

  // ── Salutation ────────────────────────────────────────────────────────────
  doc.setFont(sans, "normal")
  doc.setFontSize(11)
  doc.setTextColor(...DARK)
  doc.text(isFemale ? "Madame," : "Monsieur,", MARGIN, y)
  y += LINE * 1.8

  // ── Body ─────────────────────────────────────────────────────────────────
  const bodyLines = locale === "en" ? [
    `We are pleased to inform you that your application to the Institut International de`,
    `Technologie (IIT) has been reviewed and that you have been ACCEPTED to the`,
    `following programme:`,
  ] : [
    `Nous avons le plaisir de vous informer que votre dossier de candidature à l'Institut`,
    `International de Technologie (IIT) a été examiné par notre commission d'admission et`,
    `que vous avez été ACCEPTÉ${isFemale ? "E" : ""} dans la filière suivante :`,
  ]

  doc.setFont(sans, "normal")
  doc.setFontSize(10.5)
  doc.setTextColor(30, 41, 59)
  for (const line of bodyLines) { doc.text(line, MARGIN, y); y += LINE }
  y += 8

  // ── Programme box ─────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY)
  doc.roundedRect(MARGIN, y, W - MARGIN * 2, data.filiere.duree ? 44 : 36, 3, 3, "F")

  doc.setFillColor(...GOLD)
  doc.rect(MARGIN, y, 3, data.filiere.duree ? 44 : 36, "F")

  const boxY = y + 10
  doc.setFont(serif, "bold")
  doc.setFontSize(14)
  doc.setTextColor(...LIGHT)
  doc.text(data.filiere.nom, MARGIN + 10, boxY)

  doc.setFont(sans, "normal")
  doc.setFontSize(9.5)
  doc.setTextColor(...GOLD)
  let bY = boxY + 9

  const details: [string, string | null | undefined][] = [
    [locale === "en" ? "Degree awarded" : "Diplôme délivré", data.filiere.diplomeDelivre],
    [locale === "en" ? "Duration" : "Durée", data.filiere.duree],
    [locale === "en" ? "Language" : "Langue", data.filiere.langue],
  ]
  for (const [label, val] of details) {
    if (val) {
      doc.setTextColor(...GOLD)
      doc.text(`${label} : `, MARGIN + 10, bY)
      doc.setTextColor(...LIGHT)
      doc.text(val, MARGIN + 10 + doc.getTextWidth(`${label} : `), bY)
      bY += LINE * 0.9
    }
  }

  y += (data.filiere.duree ? 44 : 36) + 12

  // ── Continuation ──────────────────────────────────────────────────────────
  const continuation = locale === "en" ? [
    `This letter constitutes your official admission notice. You are invited to connect`,
    `to your student portal to complete the enrolment formalities and consult the`,
    `next steps of your registration.`,
  ] : [
    `La présente lettre constitue votre notification officielle d'admission. Vous êtes`,
    `invité${isFemale ? "e" : ""} à vous connecter à votre espace étudiant pour accomplir les formalités`,
    `d'inscription et consulter les prochaines étapes de votre parcours à l'IIT.`,
  ]

  doc.setFont(sans, "normal")
  doc.setFontSize(10.5)
  doc.setTextColor(30, 41, 59)
  for (const line of continuation) { doc.text(line, MARGIN, y); y += LINE }
  y += 10

  if (data.filiere.fraisInscription) {
    const feesNote = locale === "en"
      ? `Please note that the annual tuition fees for this programme amount to ${data.filiere.fraisInscription.toLocaleString("fr-FR")} DT.`
      : `Veuillez noter que les frais d'inscription annuels pour cette filière s'élèvent à ${data.filiere.fraisInscription.toLocaleString("fr-FR")} DT.`
    doc.setFont(sans, "italic")
    doc.setFontSize(9.5)
    doc.setTextColor(...MID)
    doc.text(feesNote, MARGIN, y)
    y += LINE * 1.4
  }

  y += 10

  // ── Closing ───────────────────────────────────────────────────────────────
  const closing = locale === "en"
    ? ["We look forward to welcoming you to IIT and wish you every success in your",
       "academic journey."]
    : ["Nous nous réjouissons de vous accueillir au sein de notre établissement et vous",
       "souhaitons plein succès dans votre parcours académique à l'IIT."]

  doc.setFont(sans, "normal")
  doc.setFontSize(10.5)
  doc.setTextColor(30, 41, 59)
  for (const line of closing) { doc.text(line, MARGIN, y); y += LINE }
  y += 14

  // ── Signature block ───────────────────────────────────────────────────────
  doc.setFont(sans, "normal")
  doc.setFontSize(10)
  doc.setTextColor(30, 41, 59)
  doc.text(locale === "en" ? "Yours sincerely," : "Veuillez agréer, l'expression de nos salutations distinguées,", MARGIN, y)
  y += LINE * 1.8

  doc.setFont(sans, "bold")
  doc.setFontSize(10.5)
  doc.setTextColor(...DARK)
  doc.text("Le Directeur des Études", MARGIN, y)
  y += LINE * 0.9
  doc.setFont(sans, "normal")
  doc.setFontSize(9.5)
  doc.setTextColor(...MID)
  doc.text("Institut International de Technologie — IIT", MARGIN, y)
  y += LINE * 0.9
  doc.text("service.admission@iit.edu.tn", MARGIN, y)

  // ── Signature line ────────────────────────────────────────────────────────
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.3)
  doc.line(MARGIN, y + 12, MARGIN + 60, y + 12)

  // ── Footer ────────────────────────────────────────────────────────────────
  const footerY = 282
  doc.setFillColor(...NAVY)
  doc.rect(0, footerY - 4, W, 18, "F")

  doc.setFont(sans, "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(...GOLD)
  doc.text("Institut International de Technologie · Tunis, Tunisie · www.iit.edu.tn", W / 2, footerY + 2, { align: "center" })
  doc.setTextColor(100, 116, 139)
  doc.text(`Réf. ${ref}  ·  Émis le ${dateStr}  ·  Ce document est officiel et peut être utilisé à des fins administratives.`, W / 2, footerY + 7, { align: "center" })

  // ── Save ─────────────────────────────────────────────────────────────────
  doc.save(`lettre-acceptation-IIT-${ref}.pdf`)
}
