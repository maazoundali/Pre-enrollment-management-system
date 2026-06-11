"use client"

import { useEffect, useState } from "react"
import ConfirmModal from "@/components/ConfirmModal"
import { useI18n } from "@/lib/i18n-context"

interface Filiere {
  id: string; nom: string; categorie: string | null
  capacite: number | null; objectif: number | null; inscrits: number
  estComplete: boolean; tauxRemplissage: number
  description: string | null; programme: string | null
  duree: string | null; diplomeDelivre: string | null
  langue: string | null; fraisInscription: number | null
}
interface FormState { nom: string; categorie: string; description: string; programme: string; duree: string; diplomeDelivre: string; langue: string; fraisInscription: string }

const EMPTY_FORM: FormState = { nom: "", categorie: "", description: "", programme: "", duree: "", diplomeDelivre: "", langue: "", fraisInscription: "" }

const inp: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f8fafc", fontSize: "13px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }
const lbl: React.CSSProperties = { display: "block", fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as never, color: "#64748b", marginBottom: "8px" }

export default function AdminFilieresPage() {
  const { t } = useI18n()

  const GROUPS = [
    { key: "preparatoire", label: t("student.filieres.groups.preparatoire.label"), subtitle: t("student.filieres.groups.preparatoire.subtitle"), color: "#f5c842", keywords: ["préparatoire", "preparatoire"] },
    { key: "ingenierie",   label: t("student.filieres.groups.ingenierie.label"),   subtitle: t("student.filieres.groups.ingenierie.subtitle"),   color: "#60a5fa", keywords: ["génie", "genie"] },
    { key: "licence",      label: t("student.filieres.groups.licence.label"),      subtitle: t("student.filieres.groups.licence.subtitle"),      color: "#a78bfa", keywords: ["licence"] },
    { key: "master",       label: t("student.filieres.groups.master.label"),       subtitle: t("student.filieres.groups.master.subtitle"),       color: "#4ade80", keywords: ["master"] },
    { key: "architecture", label: t("student.filieres.groups.architecture.label"), subtitle: t("student.filieres.groups.architecture.subtitle"), color: "#fb923c", keywords: ["architecture"] },
  ]

  function getGroup(f: Filiere): string {
    if (f.categorie && GROUPS.some((g) => g.key === f.categorie)) return f.categorie
    const nom = f.nom.toLowerCase()
    for (const g of GROUPS) if (g.keywords.some((kw) => nom.includes(kw))) return g.key
    return "other"
  }

  const [filieres,     setFilieres]     = useState<Filiere[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [editId,       setEditId]       = useState<string | null>(null)
  const [form,         setForm]         = useState<FormState>(EMPTY_FORM)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState("")
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; nom: string } | null>(null)
  const [deleting,     setDeleting]     = useState(false)
  const [openGroups,   setOpenGroups]   = useState<Set<string>>(new Set())
  const [capaciteOpen, setCapaciteOpen] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    fetch("/api/filieres").then((r) => r.json()).then((d) => setFilieres(d.filieres ?? [])).finally(() => setLoading(false))
  }

  function openNew()  { setForm(EMPTY_FORM); setEditId(null); setShowForm(true); setError("") }
  function openEdit(f: Filiere) {
    setForm({ nom: f.nom, categorie: f.categorie ?? "", description: f.description ?? "", programme: f.programme ?? "", duree: f.duree ?? "", diplomeDelivre: f.diplomeDelivre ?? "", langue: f.langue ?? "", fraisInscription: f.fraisInscription != null ? String(f.fraisInscription) : "" })
    setEditId(f.id); setShowForm(true); setError("")
  }
  function upd(k: keyof FormState, v: string) { setForm((p) => ({ ...p, [k]: v })) }

  async function handleSave() {
    if (!form.nom) { setError(t("admin.filieres.form.required")); return }
    setSaving(true); setError("")
    try {
      const res = await fetch(editId ? `/api/filieres/${editId}` : "/api/filieres", {
        method: editId ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nom: form.nom, categorie: form.categorie || null, description: form.description || null, programme: form.programme || null, duree: form.duree || null, diplomeDelivre: form.diplomeDelivre || null, langue: form.langue || null, fraisInscription: form.fraisInscription ? parseFloat(form.fraisInscription) : null }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? t("common.error")) }
      setShowForm(false); load()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : t("common.error")) }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    await fetch(`/api/filieres/${deleteTarget.id}`, { method: "DELETE" })
    setFilieres((p) => p.filter((f) => f.id !== deleteTarget.id))
    setDeleting(false); setDeleteTarget(null)
  }

  function toggleGroup(key: string) {
    setOpenGroups((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n })
  }

  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <style>{`@keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} } @keyframes pulse { 0%,100%{opacity:0.6} 50%{opacity:0.3} }`}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
        <div>
          <h1 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "28px", fontWeight: 600, color: "#f8fafc", margin: "0 0 6px" }}>{t("admin.filieres.title")}</h1>
          <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>
            {loading ? t("common.loading") : t("admin.filieres.total", { count: String(filieres.length), places: String(filieres.reduce((a, f) => a + (f.capacite ? f.capacite - f.inscrits : 0), 0)) })}
          </p>
        </div>
        <button onClick={openNew} style={{ padding: "11px 22px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#f5c842,#e8a820)", color: "#060d1f", fontSize: "13px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 16px rgba(232,184,32,0.3)" }}>
          {t("admin.filieres.addBtn")}
        </button>
      </div>

      {/* Form modal — no capacity field; capacity is set per year below */}
      {showForm && (
        <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", overflowY: "auto" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: "580px", padding: "36px 32px", borderRadius: "20px", background: "rgba(10,20,42,0.98)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 32px 80px rgba(0,0,0,0.7)", margin: "auto", animation: "fadeIn 0.2s ease both" }}>
            <h2 style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "20px", fontWeight: 500, color: "#f8fafc", margin: "0 0 8px" }}>
              {editId ? t("admin.filieres.form.editTitle") : t("admin.filieres.form.newTitle")}
            </h2>
            {!editId && <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "20px" }}>{t("admin.filieres.form.capacityNote")}</p>}
            {error && <div style={{ marginBottom: "16px", padding: "10px 14px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", fontSize: "13px", color: "#fca5a5" }}>{error}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "24px" }}>
              <div>
                <label style={lbl}>{t("admin.filieres.form.name")} *</label>
                <input value={form.nom} onChange={(e) => upd("nom", e.target.value)} placeholder={t("admin.filieres.form.namePlaceholder")} style={inp}/>
              </div>
              <div>
                <label style={lbl}>Catégorie</label>
                <select value={form.categorie} onChange={(e) => upd("categorie", e.target.value)} style={{ ...inp, appearance: "none", WebkitAppearance: "none", background: "#0f1e3d", cursor: "pointer" }}>
                  <option value="">— Sélectionner —</option>
                  {GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div><label style={lbl}>{t("admin.filieres.form.diplome")}</label><input value={form.diplomeDelivre} onChange={(e) => upd("diplomeDelivre", e.target.value)} placeholder={t("admin.filieres.form.diplomePlaceholder")} style={inp}/></div>
                <div><label style={lbl}>{t("admin.filieres.form.duree")}</label><input value={form.duree} onChange={(e) => upd("duree", e.target.value)} placeholder={t("admin.filieres.form.dureePlaceholder")} style={inp}/></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div><label style={lbl}>{t("admin.filieres.form.langue")}</label><input value={form.langue} onChange={(e) => upd("langue", e.target.value)} placeholder={t("admin.filieres.form.languePlaceholder")} style={inp}/></div>
                <div><label style={lbl}>{t("admin.filieres.form.frais")}</label><input type="number" min="0" value={form.fraisInscription} onChange={(e) => upd("fraisInscription", e.target.value)} placeholder={t("admin.filieres.form.fraisPlaceholder")} style={inp}/></div>
              </div>
              <div><label style={lbl}>{t("admin.filieres.form.description")}</label><textarea value={form.description} onChange={(e) => upd("description", e.target.value)} placeholder={t("admin.filieres.form.descPlaceholder")} rows={2} style={{ ...inp, resize: "vertical" }}/></div>
              <div><label style={lbl}>{t("admin.filieres.form.programme")}</label><textarea value={form.programme} onChange={(e) => upd("programme", e.target.value)} placeholder={t("admin.filieres.form.programmePlaceholder")} rows={4} style={{ ...inp, resize: "vertical" }}/></div>
            </div>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)} style={{ padding: "11px 20px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "#94a3b8", fontSize: "13px", cursor: "pointer", fontFamily: "inherit" }}>{t("common.cancel")}</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: "11px 24px", borderRadius: "10px", border: "none", background: saving ? "rgba(245,200,66,0.4)" : "linear-gradient(135deg,#f5c842,#e8a820)", color: "#060d1f", fontSize: "13px", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                {saving ? t("admin.filieres.form.saving") : editId ? t("admin.filieres.form.update") : t("admin.filieres.form.create")}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1,2,3].map((i) => <div key={i} style={{ height: "80px", borderRadius: "16px", background: "rgba(10,20,42,0.4)", animation: "pulse 1.5s ease-in-out infinite" }}/>)}
        </div>
      ) : filieres.length === 0 ? (
        <div style={{ padding: "60px", borderRadius: "20px", background: "rgba(10,20,42,0.4)", border: "1px dashed rgba(255,255,255,0.1)", textAlign: "center" }}>
          <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "18px", color: "#64748b", marginBottom: "20px" }}>{t("admin.filieres.empty.title")}</div>
          <button onClick={openNew} style={{ padding: "12px 24px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#f5c842,#e8a820)", color: "#060d1f", fontSize: "14px", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{t("admin.filieres.empty.cta")}</button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {GROUPS.map((group) => {
            const groupFilieres = filieres.filter((f) => getGroup(f) === group.key)
            if (groupFilieres.length === 0) return null
            const isOpen    = openGroups.has(group.key)
            const totalCap  = groupFilieres.reduce((a, f) => a + (f.capacite ?? 0), 0)
            const totalIns  = groupFilieres.reduce((a, f) => a + f.inscrits, 0)
            const groupPct  = totalCap > 0 ? Math.round((totalIns / totalCap) * 100) : 0
            const available = groupFilieres.filter((f) => !f.estComplete).length

            return (
              <div key={group.key} style={{ borderRadius: "20px", background: "rgba(10,20,42,0.55)", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
                <div onClick={() => toggleGroup(group.key)} style={{ padding: "16px 22px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", borderBottom: isOpen ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, minWidth: 0 }}>
                    <div style={{ width: "3px", height: "36px", borderRadius: "3px", background: group.color, flexShrink: 0 }}/>
                    <div>
                      <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "16px", fontWeight: 600, color: "#f8fafc" }}>{group.label}</div>
                      <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px" }}>{group.subtitle}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
                    {totalCap > 0 && (
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "3px" }}>{t("admin.filieres.enrolled", { enrolled: String(totalIns), total: String(totalCap) })}</div>
                        <div style={{ width: "80px", height: "3px", borderRadius: "3px", background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(groupPct, 100)}%`, height: "100%", background: groupPct > 80 ? "#f87171" : group.color, borderRadius: "3px" }}/>
                        </div>
                      </div>
                    )}
                    <span style={{ fontSize: "11px", padding: "3px 10px", borderRadius: "20px", background: `${group.color}12`, color: group.color, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {t("admin.filieres.available", { avail: String(available), total: String(groupFilieres.length) })}
                    </span>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#475569" strokeWidth={2} style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7"/>
                    </svg>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ padding: "10px 14px", display: "flex", flexDirection: "column", gap: "10px", animation: "fadeIn 0.2s ease both" }}>
                    {groupFilieres.map((f) => {
                      const pct = Math.min(f.tauxRemplissage, 100)
                      return (
                        <div key={f.id} style={{ borderRadius: "12px", background: "rgba(255,255,255,0.02)", border: f.estComplete ? "1px solid rgba(248,113,113,0.12)" : "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
                          <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", flexWrap: "wrap" }}>
                                <span style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: "14px", fontWeight: 600, color: "#f8fafc" }}>{f.nom}</span>
                                {f.estComplete && <span style={{ fontSize: "10px", padding: "1px 7px", borderRadius: "20px", background: "rgba(248,113,113,0.1)", color: "#f87171", fontWeight: 600 }}>{t("admin.filieres.full")}</span>}
                                {f.capacite === null && <span style={{ fontSize: "10px", padding: "1px 7px", borderRadius: "20px", background: "rgba(100,116,139,0.12)", color: "#64748b", fontWeight: 600 }}>{t("admin.filieres.noQuota")}</span>}
                              </div>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                                {f.diplomeDelivre  && <Chip label={f.diplomeDelivre} color={group.color}/>}
                                {f.duree           && <Chip label={f.duree} color="#60a5fa"/>}
                                {f.langue          && <Chip label={f.langue} color="#a78bfa"/>}
                                {f.fraisInscription != null && <Chip label={`${f.fraisInscription.toLocaleString()} DT/an`} color="#4ade80"/>}
                              </div>
                              {f.description && <p style={{ fontSize: "11.5px", color: "#475569", margin: "6px 0 0", lineHeight: 1.5 }}>{f.description}</p>}
                            </div>
                            <div style={{ flexShrink: 0, textAlign: "right", minWidth: "90px" }}>
                              {f.capacite !== null ? (
                                <>
                                  <div style={{ fontSize: "12px", fontWeight: 600, color: f.estComplete ? "#f87171" : group.color, marginBottom: "5px" }}>{f.inscrits}/{f.capacite}</div>
                                  <div style={{ width: "80px", height: "4px", borderRadius: "4px", background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: "4px", background: pct > 80 ? "#f87171" : group.color }}/>
                                  </div>
                                  <div style={{ fontSize: "10px", color: "#334155", marginTop: "4px" }}>
                                    {f.estComplete ? t("admin.filieres.full") : t("admin.filieres.places", { n: String(f.capacite - f.inscrits) })}
                                  </div>
                                </>
                              ) : (
                                <div style={{ fontSize: "11px", color: "#475569" }}>{f.inscrits} validés</div>
                              )}
                            </div>
                            <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                              <button
                                onClick={() => setCapaciteOpen(capaciteOpen === f.id ? null : f.id)}
                                style={{ padding: "7px 10px", borderRadius: "8px", border: "1px solid rgba(245,200,66,0.25)", background: capaciteOpen === f.id ? "rgba(245,200,66,0.12)" : "rgba(245,200,66,0.06)", color: "#f5c842", fontSize: "12px", cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: "4px" }}
                                title={t("admin.filieres.quotaBtn")}
                              >
                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5"/></svg>
                                {t("admin.filieres.quotaBtn")}
                              </button>
                              <button onClick={() => openEdit(f)} style={{ padding: "7px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", color: "#94a3b8", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>
                                {t("common.edit")}
                              </button>
                              <button onClick={() => setDeleteTarget({ id: f.id, nom: f.nom })} style={{ padding: "7px 10px", borderRadius: "8px", border: "1px solid rgba(248,113,113,0.2)", background: "rgba(248,113,113,0.06)", color: "#f87171", fontSize: "12px", cursor: "pointer", fontFamily: "inherit" }}>
                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"/></svg>
                              </button>
                            </div>
                          </div>

                          {/* Per-year capacity panel */}
                          {capaciteOpen === f.id && (
                            <CapacitePanel
                              filiereId={f.id}
                              currentCapacite={f.capacite}
                              currentObjectif={f.objectif}
                              enrolled={f.inscrits}
                              t={t}
                              onSaved={(cap, obj) => {
                                setFilieres(prev => prev.map(x => x.id === f.id
                                  ? { ...x, capacite: cap, objectif: obj, estComplete: x.inscrits >= cap, tauxRemplissage: cap > 0 ? Math.round((x.inscrits / cap) * 100) : 0 }
                                  : x
                                ))
                              }}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title={t("admin.filieres.deleteModal.title")}
        message={t("admin.filieres.deleteModal.message", { name: deleteTarget?.nom ?? "" })}
        confirmLabel={t("admin.filieres.deleteModal.confirm")}
        cancelLabel={t("common.cancel")}
        variant="danger"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

// ── Per-year capacity inline panel ────────────────────────────────────────────

function CapacitePanel({ filiereId, currentCapacite, currentObjectif, enrolled, t, onSaved }: {
  filiereId:       string
  currentCapacite: number | null
  currentObjectif: number | null
  enrolled:        number
  t:               (k: string, v?: Record<string, string | number>) => string
  onSaved:         (capacite: number, objectif: number | null) => void
}) {
  const [capacite, setCapacite] = useState(String(currentCapacite ?? ""))
  const [objectif, setObjectif] = useState(String(currentObjectif ?? ""))
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState("")
  const [done,     setDone]     = useState(false)

  const capNum = parseInt(capacite)
  const objNum = objectif ? parseInt(objectif) : null
  const isValid = !isNaN(capNum) && capNum >= 0 &&
    (objNum === null || (!isNaN(objNum) && objNum >= 0 && objNum <= capNum)) &&
    (currentCapacite === null || capNum >= currentCapacite)

  async function save() {
    if (!isValid) return
    setSaving(true); setError("")
    try {
      const res = await fetch(`/api/filieres/${filiereId}/capacite`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ capacite: capNum, objectif: objNum }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      onSaved(capNum, objNum)
      setDone(true); setTimeout(() => setDone(false), 3000)
    } catch (e: unknown) { setError(e instanceof Error ? e.message : t("common.error")) }
    finally { setSaving(false) }
  }

  const nInp: React.CSSProperties = { width: "100%", padding: "8px 11px", borderRadius: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#f8fafc", fontSize: "12px", outline: "none", fontFamily: "inherit", textAlign: "center" }
  const nLbl: React.CSSProperties = { display: "block", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as never, color: "#475569", marginBottom: "5px" }

  return (
    <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(245,200,66,0.15)", background: "rgba(245,200,66,0.03)" }}>
      <div style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as never, color: "#f5c842", marginBottom: "12px" }}>
        {t("admin.filieres.quotaTitle")}
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
        <div style={{ fontSize: "12px", color: "#64748b" }}>{t("admin.filieres.quotaEnrolled")} <span style={{ color: "#f8fafc", fontWeight: 600 }}>{enrolled}</span></div>
        {currentCapacite !== null && (
          <div style={{ fontSize: "12px", color: "#64748b" }}>{t("admin.filieres.quotaCurrent")} <span style={{ color: "#f5c842", fontWeight: 600 }}>{currentCapacite}</span></div>
        )}
        {currentObjectif !== null && (
          <div style={{ fontSize: "12px", color: "#64748b" }}>{t("admin.filieres.quotaObjectif")} <span style={{ color: "#a78bfa", fontWeight: 600 }}>{currentObjectif}</span></div>
        )}
      </div>

      {/* Input row */}
      <div style={{ display: "flex", gap: "10px", alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ minWidth: "100px" }}>
          <label style={nLbl}>{t("admin.filieres.quotaCapacite")} *</label>
          <input type="number" min={currentCapacite ?? 0} value={capacite} onChange={e => setCapacite(e.target.value)} placeholder="60" style={nInp}/>
          {currentCapacite !== null && <div style={{ fontSize: "9px", color: "#334155", marginTop: "3px" }}>≥ {currentCapacite}</div>}
        </div>
        <div style={{ minWidth: "100px" }}>
          <label style={nLbl}>{t("admin.filieres.quotaObjectifLabel")}</label>
          <input type="number" min="0" max={capacite || undefined} value={objectif} onChange={e => setObjectif(e.target.value)} placeholder="50" style={nInp}/>
          <div style={{ fontSize: "9px", color: "#334155", marginTop: "3px" }}>≤ {t("admin.filieres.quotaCapacite").toLowerCase()}</div>
        </div>
        <button onClick={save} disabled={!isValid || saving} style={{ padding: "8px 18px", borderRadius: "8px", border: "none", background: !isValid || saving ? "rgba(245,200,66,0.2)" : "linear-gradient(135deg,#f5c842,#e8a820)", color: !isValid || saving ? "#64748b" : "#060d1f", fontSize: "12px", fontWeight: 700, cursor: !isValid || saving ? "not-allowed" : "pointer", fontFamily: "inherit", flexShrink: 0 }}>
          {saving ? "…" : t("common.save")}
        </button>
        {done  && <span style={{ fontSize: "12px", color: "#4ade80" }}>✓ {t("common.saved")}</span>}
      </div>
      {error && <div style={{ marginTop: "8px", fontSize: "11px", color: "#fca5a5" }}>{error}</div>}
    </div>
  )
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: "10.5px", padding: "2px 7px", borderRadius: "5px", background: `${color}10`, color, border: `1px solid ${color}20` }}>
      {label}
    </span>
  )
}
