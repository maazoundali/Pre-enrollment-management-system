import { Skeleton, ShimmerStyles } from "@/components/Skeleton"

export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "40px 36px", maxWidth: "680px", margin: "0 auto" }}>
      <ShimmerStyles />
      <Skeleton height={26} width="300px" radius={8} style={{ marginBottom: 8 }} />
      <Skeleton height={13} width="380px" radius={6} style={{ marginBottom: 32 }} />
      <Skeleton height={88} radius={16} style={{ marginBottom: 20 }} />
      <div style={{ padding: "28px 30px", borderRadius: "16px", background: "rgba(10,20,42,0.65)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 20 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <Skeleton height={11} width="120px" radius={5} style={{ marginBottom: 8 }} />
            <Skeleton height={44} radius={12} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Skeleton height={44} width="100px" radius={12} />
        <Skeleton height={44} width="140px" radius={12} />
      </div>
    </div>
  )
}
