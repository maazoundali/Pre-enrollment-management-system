import { Skeleton, ShimmerStyles } from "@/components/Skeleton"

export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <ShimmerStyles />
      <div style={{ marginBottom: "36px" }}>
        <Skeleton height={28} width="180px" radius={8} style={{ marginBottom: 10 }} />
        <Skeleton height={13} width="300px" radius={6} />
      </div>
      <div style={{ maxWidth: "640px", padding: "28px 32px", borderRadius: "20px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Skeleton height={20} width="220px" radius={7} style={{ marginBottom: 8 }} />
        <Skeleton height={13} width="380px" radius={6} style={{ marginBottom: 24 }} />
        <Skeleton height={56} radius={12} style={{ marginBottom: 16 }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: 16 }}>
          <div><Skeleton height={11} width="100px" radius={5} style={{ marginBottom: 8 }} /><Skeleton height={44} radius={10} /></div>
          <div><Skeleton height={11} width="100px" radius={5} style={{ marginBottom: 8 }} /><Skeleton height={44} radius={10} /></div>
        </div>
        <Skeleton height={48} radius={12} />
      </div>
    </div>
  )
}
