"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { useI18n } from "@/lib/i18n-context"

interface Message {
  role: "user" | "assistant"
  content: string
}

const GUEST_SUGGESTIONS = [
  "Quels documents sont requis ?",
  "Quelles filières sont disponibles ?",
  "Comment créer mon compte ?",
  "Comment fonctionne la pré-inscription ?",
]

export default function ChatWidget() {
  const { user } = useAuth()
  const { dir }  = useI18n()
  const isGuest = !user

  const [open, setOpen]             = useState(false)
  const [messages, setMessages]     = useState<Message[]>([])
  const [input, setInput]           = useState("")
  const [streaming, setStreaming]   = useState(false)
  const [dossierCtx, setDossierCtx] = useState("")
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)
  const ctxLoaded  = useRef(false)

  // Load dossier context once — authenticated students only
  useEffect(() => {
    if (!open || ctxLoaded.current || !user || user.role !== "ETUDIANT") return
    ctxLoaded.current = true
    fetch("/api/dossiers")
      .then(r => r.json())
      .then((data: { dossiers?: Array<{ niveauEtude?: string; statut?: string; filiere?: { nom?: string } }> }) => {
        const list = data.dossiers ?? []
        if (!list.length) return
        const d = list[0]
        const parts = [
          `Nom: ${user.prenom ?? ""} ${user.nom ?? ""}`.trim(),
          d.niveauEtude ? `Niveau: ${d.niveauEtude}` : null,
          d.statut      ? `Statut dossier: ${d.statut}` : null,
          d.filiere?.nom ? `Filière choisie: ${d.filiere.nom}` : null,
        ].filter(Boolean)
        setDossierCtx(parts.join(". "))
      })
      .catch(() => {})
  }, [open, user])

  // Welcome message on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: isGuest
          ? "Bonjour ! Je suis l'assistant de l'IIT. Posez-moi vos questions sur les filières, les documents requis ou le processus d'inscription."
          : `Bonjour${user?.prenom ? ` ${user.prenom}` : ""} ! Je suis votre assistant IIT. Comment puis-je vous aider ?`,
      }])
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 120) }, [open])

  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || streaming) return
    const userMsg: Message    = { role: "user",      content }
    const pending:  Message   = { role: "assistant", content: "" }
    setMessages(prev => [...prev, userMsg, pending])
    setInput("")
    setStreaming(true)

    try {
      const res = await fetch("/api/chat", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages:       [...messages, userMsg],
          dossierContext: dossierCtx || undefined,
          isGuest,
        }),
      })
      if (!res.ok || !res.body) throw new Error("no stream")

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const token = decoder.decode(value, { stream: true })
        setMessages(prev => {
          const last = prev[prev.length - 1]
          return [...prev.slice(0, -1), { ...last, content: last.content + token }]
        })
      }
    } catch {
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "Désolé, une erreur s'est produite. Veuillez réessayer." },
      ])
    } finally {
      setStreaming(false)
    }
  }, [input, streaming, messages, dossierCtx, isGuest])

  const showSuggestions = isGuest && messages.length <= 1 && !streaming

  return (
    <div style={{ position:"fixed", bottom:"24px", [dir === "rtl" ? "left" : "right"]:"24px", zIndex:9999, display:"flex", flexDirection:"column", alignItems: dir === "rtl" ? "flex-start" : "flex-end" }}>

      {/* Chat panel */}
      {open && (
        <div style={{
          width:"360px", borderRadius:"20px",
          background:"rgba(6,13,31,0.97)", border:"1px solid rgba(255,255,255,0.09)",
          backdropFilter:"blur(28px)", display:"flex", flexDirection:"column",
          marginBottom:"12px", boxShadow:"0 32px 80px rgba(0,0,0,0.7)",
          animation:"chatIn 0.2s cubic-bezier(0.34,1.56,0.64,1) both",
          maxHeight:"580px",
        }}>
          <style>{`
            @keyframes chatIn { from{opacity:0;transform:scale(0.92) translateY(12px)} to{opacity:1;transform:scale(1) translateY(0)} }
            @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0.2} }
            .chat-scroll::-webkit-scrollbar { width:4px }
            .chat-scroll::-webkit-scrollbar-track { background:transparent }
            .chat-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:4px }
            .chat-input::placeholder { color:#334155 }
            .chat-input:focus { border-color:rgba(232,184,32,0.4)!important; outline:none }
            .chat-suggest { background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:20px; padding:5px 11px; font-size:11.5px; color:#94a3b8; cursor:pointer; transition:all 0.15s; white-space:nowrap; }
            .chat-suggest:hover { background:rgba(232,184,32,0.1); border-color:rgba(232,184,32,0.35); color:#f5c842; }
          `}</style>

          {/* Header */}
          <div style={{ padding:"14px 18px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", gap:"10px", flexShrink:0 }}>
            <div style={{ width:"34px", height:"34px", borderRadius:"50%", background:"linear-gradient(135deg,rgba(232,184,32,0.2),rgba(232,184,32,0.05))", border:"1px solid rgba(232,184,32,0.25)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"17px", flexShrink:0 }}>
              🎓
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:"13px", fontWeight:600, color:"#f1f5f9" }}>Assistant IIT</div>
              <div style={{ fontSize:"10px", color: streaming ? "#f5c842" : "#4ade80", display:"flex", alignItems:"center", gap:"4px" }}>
                <span style={{ width:"5px", height:"5px", borderRadius:"50%", background:"currentColor", display:"inline-block", animation: streaming ? "blink 1s infinite" : "none" }}/>
                {streaming ? "En train d'écrire…" : "En ligne"}
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background:"none", border:"none", color:"#475569", cursor:"pointer", padding:"4px", fontSize:"16px", lineHeight:1 }}>✕</button>
          </div>

          {/* Guest login nudge */}
          {isGuest && (
            <div style={{ padding:"8px 14px", background:"rgba(232,184,32,0.05)", borderBottom:"1px solid rgba(232,184,32,0.12)", display:"flex", alignItems:"center", gap:"8px" }}>
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#f5c842" strokeWidth={2} style={{ flexShrink:0 }}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 0 1 21.75 8.25Z"/></svg>
              <span style={{ fontSize:"10.5px", color:"#94a3b8", lineHeight:1.4 }}>
                <a href="/register" style={{ color:"#f5c842", textDecoration:"none", fontWeight:600 }}>Connectez-vous</a> pour un accompagnement personnalisé.
              </span>
            </div>
          )}

          {/* Messages */}
          <div className="chat-scroll" style={{ flex:1, overflowY:"auto", padding:"14px 16px", display:"flex", flexDirection:"column", gap:"10px" }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display:"flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth:"82%", padding:"9px 13px",
                  borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background:   m.role === "user" ? "rgba(232,184,32,0.18)" : "rgba(255,255,255,0.05)",
                  border:       m.role === "user" ? "1px solid rgba(232,184,32,0.28)" : "1px solid rgba(255,255,255,0.07)",
                  fontSize:"12.5px", color:"#e2e8f0", lineHeight:1.65, whiteSpace:"pre-wrap", wordBreak:"break-word",
                }}>
                  {m.content || (streaming && i === messages.length - 1
                    ? <span style={{ opacity:0.5, fontStyle:"italic", fontSize:"11px" }}>…</span>
                    : null)}
                </div>
              </div>
            ))}

            {/* Guest quick-question chips */}
            {showSuggestions && (
              <div style={{ display:"flex", flexWrap:"wrap", gap:"6px", marginTop:"4px" }}>
                {GUEST_SUGGESTIONS.map(q => (
                  <button key={q} className="chat-suggest" onClick={() => { void send(q) }}>{q}</button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div style={{ padding:"10px 14px 14px", borderTop:"1px solid rgba(255,255,255,0.07)", display:"flex", gap:"8px", flexShrink:0 }}>
            <input
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send() } }}
              placeholder={isGuest ? "Une question générale…" : "Posez votre question…"}
              disabled={streaming}
              style={{ flex:1, background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"10px", padding:"8px 12px", color:"#f1f5f9", fontSize:"12.5px", transition:"border-color 0.2s" }}
            />
            <button
              onClick={() => { void send() }}
              disabled={streaming || !input.trim()}
              style={{
                width:"36px", height:"36px", borderRadius:"10px", flexShrink:0,
                background: streaming || !input.trim() ? "rgba(232,184,32,0.15)" : "rgba(232,184,32,0.9)",
                border:"1px solid rgba(232,184,32,0.3)", cursor: streaming || !input.trim() ? "not-allowed" : "pointer",
                display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.2s",
              }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke={streaming || !input.trim() ? "#f5c842" : "#060d1f"} strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Label + bubble */}
      <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"6px" }}>
        {/* Label — only for guests when panel is closed */}
        {isGuest && !open && (
          <div style={{
            padding:"5px 12px", borderRadius:"20px",
            background:"rgba(6,13,31,0.88)", border:"1px solid rgba(232,184,32,0.2)",
            backdropFilter:"blur(12px)", whiteSpace:"nowrap",
          }}>
            <span style={{ fontSize:"10.5px", color:"#94a3b8" }}>
              Assistant IA —{" "}
              <a href="/register" style={{ color:"#f5c842", textDecoration:"none", fontWeight:600 }}>
                connectez-vous
              </a>
              {" "}pour un accompagnement personnalisé.
            </span>
          </div>
        )}

        <button
          onClick={() => setOpen(o => !o)}
          title="Assistant IIT"
          style={{
            width:"54px", height:"54px", borderRadius:"50%",
            background: open ? "rgba(232,184,32,0.15)" : "linear-gradient(135deg,#e8b820,#f5c842)",
            border: open ? "1px solid rgba(232,184,32,0.4)" : "none",
            cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow: open ? "none" : "0 4px 24px rgba(232,184,32,0.45)",
            transition:"all 0.2s",
          }}
        >
          {open
            ? <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#f5c842" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
            : <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="#060d1f" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"/></svg>
          }
        </button>
      </div>
    </div>
  )
}
