// lib/email.ts
// Transactional email service — nodemailer with configurable SMTP.
//
// Development (no SMTP_HOST set):
//   Uses Ethereal.email fake SMTP — emails are captured, NOT delivered.
//   A preview URL is logged to the server console so you can inspect the email.
//
// Production (SMTP_HOST set):
//   Uses the configured SMTP server. Swap in university credentials:
//     SMTP_HOST=smtp.university.tn
//     SMTP_PORT=587
//     SMTP_USER=noreply@university.tn
//     SMTP_PASS=yourpassword
//     EMAIL_FROM="IIT <noreply@university.tn>"

import nodemailer, { type Transporter } from "nodemailer"

let _transport: Transporter | null = null

async function getTransport(): Promise<Transporter> {
  if (_transport) return _transport

  if (process.env.SMTP_HOST) {
    // ── Production SMTP ──────────────────────────────────────────────────────
    _transport = nodemailer.createTransport({
      host:   process.env.SMTP_HOST,
      port:   parseInt(process.env.SMTP_PORT ?? "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
    console.log("[email] Using SMTP:", process.env.SMTP_HOST)
  } else {
    // ── Development: Ethereal fake SMTP ─────────────────────────────────────
    const testAccount = await nodemailer.createTestAccount()
    _transport = nodemailer.createTransport({
      host:   "smtp.ethereal.email",
      port:   587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    })
    console.log("[email] No SMTP_HOST set → using Ethereal fake SMTP (emails are NOT delivered)")
    console.log("[email] Ethereal inbox:", `https://ethereal.email/messages`)
  }

  return _transport
}

// ── Email templates ────────────────────────────────────────────────────────────

const APP_URL  = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
const APP_NAME = "IIT — Pré-Inscription"

function baseHtml(body: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body { margin:0; padding:0; background:#f1f5f9; font-family:Helvetica,Arial,sans-serif; }
  .wrap { max-width:600px; margin:32px auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.08); }
  .header { background:#060d1f; padding:24px 32px; display:flex; align-items:center; gap:16px; }
  .header-title { color:#f8fafc; font-size:18px; font-weight:700; }
  .header-sub { color:#94a3b8; font-size:12px; margin-top:2px; }
  .body { padding:32px; color:#1e293b; font-size:15px; line-height:1.7; }
  .cta { display:inline-block; margin:20px 0; padding:12px 28px; background:linear-gradient(135deg,#f5c842,#e8a820); color:#060d1f; font-weight:700; text-decoration:none; border-radius:10px; font-size:14px; }
  .footer { background:#f8fafc; padding:16px 32px; font-size:11px; color:#94a3b8; text-align:center; border-top:1px solid #e2e8f0; }
  .badge { display:inline-block; padding:4px 12px; border-radius:20px; font-size:12px; font-weight:700; }
  .badge-green  { background:#dcfce7; color:#166534; }
  .badge-red    { background:#fee2e2; color:#991b1b; }
  .badge-blue   { background:#dbeafe; color:#1e40af; }
  .badge-yellow { background:#fef9c3; color:#854d0e; }
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div>
      <div class="header-title">${APP_NAME}</div>
      <div class="header-sub">Institut International de Technologie</div>
    </div>
  </div>
  <div class="body">${body}</div>
  <div class="footer">
    Ce message est envoyé automatiquement. Ne pas répondre à cet email.<br>
    © ${new Date().getFullYear()} Institut International de Technologie
  </div>
</div>
</body>
</html>`
}

// ── Password reset email ────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(opts: { to: string; prenom: string | null; resetUrl: string }): Promise<void> {
  const { to, prenom, resetUrl } = opts
  const greeting = prenom ? `Bonjour ${prenom},` : "Bonjour,"
  const subject  = "🔑 Réinitialisation de votre mot de passe"
  const body = `
    <p>${greeting}</p>
    <p>Vous avez demandé la réinitialisation de votre mot de passe sur <strong>${APP_NAME}</strong>.</p>
    <p>Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de passe. Ce lien est valable <strong>1 heure</strong>.</p>
    <a class="cta" href="${resetUrl}">Réinitialiser mon mot de passe</a>
    <p style="font-size:12px;color:#94a3b8;margin-top:16px">
      Si vous n'avez pas effectué cette demande, ignorez simplement cet email — votre mot de passe reste inchangé.<br>
      Lien : <a href="${resetUrl}" style="color:#60a5fa">${resetUrl}</a>
    </p>`

  try {
    const transport = await getTransport()
    const info = await transport.sendMail({
      from:    process.env.EMAIL_FROM ?? `"${APP_NAME}" <noreply@iit.edu.tn>`,
      to,
      subject,
      html:    baseHtml(body),
    })
    if (!process.env.SMTP_HOST) {
      console.log(`[email] Password reset preview (Ethereal): ${nodemailer.getTestMessageUrl(info)}`)
    } else {
      console.log(`[email] Password reset sent to ${to}`)
    }
  } catch (err) {
    console.error("[email] Failed to send password reset:", (err as Error).message)
  }
}

// ── Email confirmation (signup) ─────────────────────────────────────────────────

export async function sendEmailVerificationEmail(opts: { to: string; prenom: string | null; verifyUrl: string }): Promise<void> {
  const { to, prenom, verifyUrl } = opts
  const greeting = prenom ? `Bonjour ${prenom},` : "Bonjour,"
  const subject  = "✉️ Confirmez votre adresse email"
  const body = `
    <p>${greeting}</p>
    <p>Bienvenue sur <strong>${APP_NAME}</strong> ! Pour activer votre compte et sécuriser votre espace étudiant, veuillez confirmer votre adresse email.</p>
    <p>Cliquez sur le bouton ci-dessous. Ce lien est valable <strong>24 heures</strong>.</p>
    <a class="cta" href="${verifyUrl}">Confirmer mon email</a>
    <p style="font-size:12px;color:#94a3b8;margin-top:16px">
      Si vous n'avez pas créé de compte sur ${APP_NAME}, ignorez simplement cet email.<br>
      Lien : <a href="${verifyUrl}" style="color:#60a5fa">${verifyUrl}</a>
    </p>`

  try {
    const transport = await getTransport()
    const info = await transport.sendMail({
      from:    process.env.EMAIL_FROM ?? `"${APP_NAME}" <noreply@iit.edu.tn>`,
      to,
      subject,
      html:    baseHtml(body),
    })
    if (!process.env.SMTP_HOST) {
      console.log(`[email] Email verification preview (Ethereal): ${nodemailer.getTestMessageUrl(info)}`)
    } else {
      console.log(`[email] Email verification sent to ${to}`)
    }
  } catch (err) {
    console.error("[email] Failed to send email verification:", (err as Error).message)
  }
}

// ── Document verification email ────────────────────────────────────────────────

export async function sendDocumentVerificationEmail(opts: {
  to: string; prenom: string | null; dossierId: string
  docType: string; verification: "VERIFIED" | "REJECTED" | "NEEDS_REUPLOAD"; note?: string | null
}): Promise<void> {
  const { to, prenom, dossierId, docType, verification, note } = opts
  const greeting = prenom ? `Bonjour ${prenom},` : "Bonjour,"
  const dossierUrl = `${APP_URL}/student/dossier/${dossierId}`

  const configs = {
    VERIFIED: {
      subject: `✓ Document accepté — ${docType}`,
      badge: `<span class="badge badge-green">Accepté</span>`,
      body: `Votre document <strong>${docType}</strong> a été examiné et <strong>accepté</strong> par notre équipe administrative.`,
    },
    REJECTED: {
      subject: `✗ Document refusé — ${docType}`,
      badge: `<span class="badge badge-red">Refusé</span>`,
      body: `Votre document <strong>${docType}</strong> a été examiné et <strong>refusé</strong>. Veuillez le corriger et le resoumettre depuis votre espace étudiant.`,
    },
    NEEDS_REUPLOAD: {
      subject: `⚠ Nouveau téléversement requis — ${docType}`,
      badge: `<span class="badge badge-yellow">Qualité insuffisante</span>`,
      body: `Votre document <strong>${docType}</strong> a été reçu mais sa qualité est insuffisante. Merci d'en téléverser une version plus lisible.`,
    },
  }
  const cfg = configs[verification]
  const body = `
    <p>${greeting}</p>
    <p>${cfg.body}</p>
    <p>${cfg.badge}</p>
    ${note ? `<p><strong>Note de l'administration :</strong><br><em>${note}</em></p>` : ""}
    <a class="cta" href="${dossierUrl}">Accéder à mon dossier</a>`

  try {
    const transport = await getTransport()
    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM ?? `"${APP_NAME}" <noreply@iit.edu.tn>`,
      to, subject: cfg.subject, html: baseHtml(body),
    })
    if (!process.env.SMTP_HOST) console.log(`[email] Doc verification preview: ${nodemailer.getTestMessageUrl(info)}`)
  } catch (err) {
    console.error("[email] Failed to send doc verification:", (err as Error).message)
  }
}

// ── Deadline reminder email ────────────────────────────────────────────────────

export async function sendDeadlineReminderEmail(opts: {
  to: string; prenom: string | null; dossierId: string
  closingDate: Date; filiere: string | null
}): Promise<void> {
  const { to, prenom, dossierId, closingDate, filiere } = opts
  const greeting   = prenom ? `Bonjour ${prenom},` : "Bonjour,"
  const dossierUrl = `${APP_URL}/student/dossier/${dossierId}`
  const subject    = "⏰ Rappel — Clôture des inscriptions dans 48 h"
  const dateLabel  = closingDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
  const body = `
    <p>${greeting}</p>
    <p>Ceci est un <strong>rappel important</strong> : les inscriptions à l'<strong>IIT</strong> ferment dans moins de <strong>48 heures</strong>.</p>
    <p><span class="badge badge-yellow">⏰ Clôture le ${dateLabel}</span></p>
    <p>Votre dossier de pré-inscription${filiere ? ` pour la filière <strong>${filiere}</strong>` : ""} est actuellement en <strong>brouillon</strong> et n'a pas encore été soumis. N'oubliez pas de le finaliser et de le soumettre avant la date limite.</p>
    <a class="cta" href="${dossierUrl}">Compléter et soumettre mon dossier</a>
    <p style="font-size:12px;color:#94a3b8;margin-top:16px">Si vous avez déjà soumis votre dossier et recevez ce message par erreur, veuillez l'ignorer.</p>`

  try {
    const transport = await getTransport()
    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM ?? `"${APP_NAME}" <noreply@iit.edu.tn>`,
      to, subject, html: baseHtml(body),
    })
    if (!process.env.SMTP_HOST) console.log(`[email] Deadline reminder preview: ${nodemailer.getTestMessageUrl(info)}`)
    else console.log(`[email] Deadline reminder sent to ${to}`)
  } catch (err) {
    console.error("[email] Failed to send deadline reminder:", (err as Error).message)
  }
}

// ── Admin message email ────────────────────────────────────────────────────────

export async function sendAdminMessageEmail(opts: {
  to: string; prenom: string | null; dossierId: string; message: string
}): Promise<void> {
  const { to, prenom, dossierId, message } = opts
  const greeting   = prenom ? `Bonjour ${prenom},` : "Bonjour,"
  const dossierUrl = `${APP_URL}/student/dossier/${dossierId}`
  const subject    = "📩 Message de l'administration — IIT Pré-inscription"
  const body = `
    <p>${greeting}</p>
    <p>L'administration de l'<strong>IIT</strong> vous a envoyé un message concernant votre dossier de pré-inscription.</p>
    <div style="margin:20px 0;padding:16px 20px;border-radius:10px;background:#f8fafc;border-left:4px solid #f5c842;font-size:14px;color:#1e293b;line-height:1.7;white-space:pre-wrap">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
    <a class="cta" href="${dossierUrl}">Accéder à mon dossier</a>
    <p style="font-size:12px;color:#94a3b8;margin-top:16px">Vous pouvez répondre à ce message en vous connectant à votre espace étudiant.</p>`

  try {
    const transport = await getTransport()
    const info = await transport.sendMail({
      from: process.env.EMAIL_FROM ?? `"${APP_NAME}" <noreply@iit.edu.tn>`,
      to, subject, html: baseHtml(body),
    })
    if (!process.env.SMTP_HOST) console.log(`[email] Admin message preview: ${nodemailer.getTestMessageUrl(info)}`)
    else console.log(`[email] Admin message sent to ${to}`)
  } catch (err) {
    console.error("[email] Failed to send admin message:", (err as Error).message)
  }
}

interface StatusEmailOptions {
  to:         string
  prenom:     string | null
  dossierId:  string
  statut:     string
  motifRejet?: string | null
}

export async function sendStatusEmail(opts: StatusEmailOptions): Promise<void> {
  const { to, prenom, dossierId, statut, motifRejet } = opts
  const greeting = prenom ? `Bonjour ${prenom},` : "Bonjour,"
  const dossierUrl = `${APP_URL}/student/dossier/${dossierId}`

  let subject = ""
  let body    = ""

  switch (statut) {
    case "SOUMIS":
      subject = "✅ Votre pré-inscription a bien été reçue"
      body = `
        <p>${greeting}</p>
        <p>Nous avons bien reçu votre dossier de pré-inscription à l'<strong>IIT</strong>. Il est maintenant en attente d'examen par notre équipe administrative.</p>
        <p><span class="badge badge-blue">Soumis</span></p>
        <p>Vous serez notifié(e) par email dès qu'une décision sera prise. Vous pouvez suivre l'avancement de votre candidature en vous connectant à votre espace étudiant.</p>
        <a class="cta" href="${dossierUrl}">Suivre mon dossier</a>
        <p style="font-size:13px;color:#64748b">Référence : DOSS-${dossierId.slice(0,8).toUpperCase()}</p>`
      break

    case "EN_ANALYSE":
      subject = "🔍 Votre dossier est en cours d'analyse"
      body = `
        <p>${greeting}</p>
        <p>Bonne nouvelle — votre dossier de pré-inscription est actuellement <strong>en cours d'analyse</strong> par notre équipe.</p>
        <p><span class="badge badge-yellow">En analyse</span></p>
        <p>Nous vous informerons du résultat dans les meilleurs délais. Aucune action de votre part n'est requise pour le moment.</p>
        <a class="cta" href="${dossierUrl}">Voir mon dossier</a>`
      break

    case "VALIDE":
      subject = "🎉 Félicitations — Votre pré-inscription a été acceptée !"
      body = `
        <p>${greeting}</p>
        <p>Nous avons le plaisir de vous informer que votre dossier de pré-inscription à l'<strong>IIT</strong> a été <strong>accepté</strong>.</p>
        <p><span class="badge badge-green">Accepté</span></p>
        <p>Veuillez vous connecter à votre espace étudiant pour consulter les prochaines étapes de votre inscription définitive.</p>
        <a class="cta" href="${dossierUrl}">Accéder à mon espace</a>
        <p style="font-size:13px;color:#64748b">Référence : DOSS-${dossierId.slice(0,8).toUpperCase()}</p>`
      break

    case "REJETE":
      subject = "❌ Décision concernant votre pré-inscription"
      body = `
        <p>${greeting}</p>
        <p>Nous avons examiné votre dossier de pré-inscription à l'<strong>IIT</strong> et sommes au regret de vous informer qu'il n'a pas pu être retenu à ce stade.</p>
        <p><span class="badge badge-red">Non retenu</span></p>
        ${motifRejet ? `<p><strong>Motif :</strong><br><em>${motifRejet}</em></p>` : ""}
        <p>Vous pouvez corriger votre dossier et le resoumettre depuis votre espace étudiant.</p>
        <a class="cta" href="${dossierUrl}/edit">Corriger mon dossier</a>`
      break

    case "LISTE_ATTENTE":
      subject = "⏳ Vous êtes sur liste d'attente"
      body = `
        <p>${greeting}</p>
        <p>Votre dossier de pré-inscription à l'<strong>IIT</strong> a bien été examiné. La filière choisie affiche actuellement complet — vous avez été placé(e) sur la <strong>liste d'attente</strong>.</p>
        <p><span class="badge badge-yellow">Liste d'attente</span></p>
        <p>Vous serez contacté(e) en priorité si une place se libère. Consultez votre espace pour voir votre position.</p>
        <a class="cta" href="${dossierUrl}">Voir ma position</a>`
      break

    default:
      return  // Unknown status — don't send
  }

  try {
    const transport = await getTransport()
    const info = await transport.sendMail({
      from:    process.env.EMAIL_FROM ?? `"${APP_NAME}" <noreply@iit.edu.tn>`,
      to,
      subject,
      html:    baseHtml(body),
    })

    if (!process.env.SMTP_HOST) {
      // Show Ethereal preview URL in dev
      console.log(`[email] Preview (Ethereal): ${nodemailer.getTestMessageUrl(info)}`)
    } else {
      console.log(`[email] Sent to ${to} | status: ${statut} | msgId: ${info.messageId}`)
    }
  } catch (err) {
    // Never throw — email failure should not block the API response
    console.error("[email] Failed to send:", (err as Error).message)
  }
}
