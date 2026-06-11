import { Skeleton, ShimmerStyles } from "@/components/Skeleton"

export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <ShimmerStyles />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
        <div>
          <Skeleton height={28} width="160px" radius={8} style={{ marginBottom: 10 }} />
          <Skeleton height={13} width="240px" radius={6} />
        </div>
        <Skeleton height={40} width="160px" radius={12} />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ marginBottom: "14px", borderRadius: "20px", background: "rgba(10,20,42,0.55)", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "16px 22px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <Skeleton width={3} height={36} radius={3} />
              <div>
                <Skeleton height={16} width="160px" radius={6} style={{ marginBottom: 6 }} />
                <Skeleton height={11} width="240px" radius={5} />
              </div>
            </div>
            <Skeleton height={24} width="80px" radius={20} />
          </div>
        </div>
      ))}
    </div>
  )
}
