import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/auth"

const OLLAMA_URL   = process.env.OLLAMA_URL   ?? "http://localhost:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "mistral"

// ── System prompts ────────────────────────────────────────────────────────────

const SHARED_INFO = `
=== PROGRAMMES PROPOSÉS PAR L'IIT ===
• Cycle Préparatoire Intégré (2 ans) — BAC scientifique ou technique. Intensif maths/physique. Passerelle vers tous les cycles ingénieur.
• Génie Informatique — Algorithmique, développement logiciel, IA, cybersécurité, réseaux.
• Génie Télécommunications — Réseaux mobiles, systèmes embarqués, traitement du signal.
• Génie Civil — Structures, béton armé, topographie, urbanisme.
• Génie Mécanique — Mécanique des fluides, thermodynamique, conception CAO/FAO.
• Génie des Procédés — Chimie industrielle, génie chimique, environnement.
• Génie Industriel — Logistique, qualité, lean management, supply chain.
• Architecture (5 ans) — Design architectural, urbanisme, histoire de l'art. Ouvert à tous BAC.
• Licence Informatique (3 ans) — Accès direct après BAC.
• Licence Génie Industriel (3 ans) — Accès direct après BAC.
• Master (2 ans) — Pour titulaires d'une Licence dans le domaine.

=== DOCUMENTS REQUIS ===
• Carte d'identité nationale (CIN) ou passeport
• Photo d'identité récente (format passeport)
• Copie du diplôme ou attestation de réussite
• Relevé de notes (toutes les matières, notées sur 20)

=== PROCESSUS DE PRÉ-INSCRIPTION ===
1. Créer un compte sur la plateforme (e-mail + mot de passe)
2. Compléter son profil (informations personnelles, CIN)
3. Créer un dossier de pré-inscription
4. Renseigner son parcours académique et ses notes
5. Choisir la filière souhaitée
6. Soumettre le dossier — il sera examiné par l'administration

=== CRITÈRES D'ADMISSION (orientatifs) ===
• Préparatoire & cycles ingénieur : BAC scientifique ou technique recommandé, notes en maths/physique ≥ 14/20 souhaitées
• Architecture : BAC toutes séries, créativité appréciée
• Licences : BAC toutes séries acceptées
• Master : Licence dans le domaine correspondant requis`

// Guest — FAQ only, no personal data
const GUEST_SYSTEM = `Tu es l'assistant virtuel public de l'IIT (Institut International de Technologie), une école d'ingénieurs en Tunisie.

Tu réponds aux questions générales sur l'IIT : filières disponibles, documents requis, processus de pré-inscription, délais, création de compte.

Tu NE PEUX PAS accéder aux dossiers personnels, notes ou candidatures individuelles.
Pour un suivi personnalisé de candidature, l'utilisateur doit se connecter à son espace étudiant.

Si on te demande des informations personnelles (statut de dossier, notes, recommandations personnalisées), réponds : "Connectez-vous à votre espace pour ces informations."

Sois concis, bienveillant et réponds dans la langue de l'utilisateur (français, arabe ou anglais).
${SHARED_INFO}`

// Authenticated — full assistant with dossier context
const AUTH_SYSTEM = `Tu es l'assistant virtuel de l'IIT (Institut International de Technologie), une grande école d'ingénieurs en Tunisie.

Tu aides les étudiants connectés avec :
- Le suivi de leur dossier de candidature
- Les documents manquants à fournir
- Le choix de filière selon leur profil
- Les explications sur l'extraction automatique de notes (OCR)
- Les recommandations personnalisées et leur justification
- Toute question sur le processus de pré-inscription

Sois concis, bienveillant et réponds dans la langue de l'utilisateur (français, arabe ou anglais).
${SHARED_INFO}`

// ── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await getSession()

  const body = await req.json() as {
    messages:       Array<{ role: "user" | "assistant"; content: string }>
    dossierContext?: string
    isGuest?:        boolean
  }
  const { messages, dossierContext, isGuest } = body

  // Guests can use the public FAQ mode — no auth required
  // Authenticated users get the full personalised system
  const isAuthenticated = !!session && !isGuest

  const systemContent = isAuthenticated && dossierContext
    ? `${AUTH_SYSTEM}\n\n=== CONTEXTE DE L'ÉTUDIANT CONNECTÉ ===\n${dossierContext}`
    : isAuthenticated
      ? AUTH_SYSTEM
      : GUEST_SYSTEM

  try {
    const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model:   OLLAMA_MODEL,
        stream:  true,
        options: { temperature: 0.7, num_predict: 500 },
        messages: [
          { role: "system", content: systemContent },
          ...messages,
        ],
      }),
      signal: AbortSignal.timeout(60_000),
    })

    if (!ollamaRes.ok || !ollamaRes.body) {
      return NextResponse.json({ error: "LLM unavailable" }, { status: 503 })
    }

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const reader  = ollamaRes.body!.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            buffer += decoder.decode(value, { stream: true })
            const lines = buffer.split("\n")
            buffer = lines.pop() ?? ""
            for (const line of lines) {
              if (!line.trim()) continue
              try {
                const json = JSON.parse(line) as { message?: { content?: string } }
                if (json.message?.content) {
                  controller.enqueue(encoder.encode(json.message.content))
                }
              } catch { /* incomplete JSON line */ }
            }
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type":      "text/plain; charset=utf-8",
        "X-Accel-Buffering": "no",
        "Cache-Control":     "no-cache",
      },
    })
  } catch (err) {
    console.error("[chat] Ollama error:", err)
    return NextResponse.json({ error: "LLM error" }, { status: 500 })
  }
}
