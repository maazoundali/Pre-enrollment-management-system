import { Skeleton, ShimmerStyles } from "@/components/Skeleton"

export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <ShimmerStyles />
      <Skeleton height={13} width="80px" radius={6} style={{ marginBottom: 20 }} />
      <Skeleton height={26} width="320px" radius={8} style={{ marginBottom: 8 }} />
      <Skeleton height={13} width="420px" radius={6} style={{ marginBottom: 32 }} />
      <div style={{ display: "flex", maxWidth: "700px", marginBottom: "32px" }}>
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} height={44} style={{ flex: 1 }} radius={0} />)}
      </div>
      <div style={{ maxWidth: "680px", padding: "36px 40px", borderRadius: "24px", background: "rgba(10,20,42,0.78)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <Skeleton height={20} width="220px" radius={7} style={{ marginBottom: 24 }} />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={64} radius={12} style={{ marginBottom: 10 }} />
        ))}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <Skeleton height={44} width="200px" radius={12} />
        </div>
      </div>
    </div>
  )
}
