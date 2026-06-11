import { Skeleton, ShimmerStyles } from "@/components/Skeleton"

export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <ShimmerStyles />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
        <div>
          <Skeleton height={26} width="180px" radius={8} style={{ marginBottom: 8 }} />
          <Skeleton height={13} width="120px" radius={6} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "14px", padding: "18px 20px", borderRadius: "14px", background: "rgba(10,20,42,0.4)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <Skeleton width={38} height={38} radius={10} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Skeleton height={13} width="90%" radius={6} style={{ marginBottom: 8 }} />
              <Skeleton height={13} width="60%" radius={6} style={{ marginBottom: 8 }} />
              <Skeleton height={11} width="100px" radius={5} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
