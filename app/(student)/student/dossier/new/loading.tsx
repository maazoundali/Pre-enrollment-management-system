import { Skeleton, ShimmerStyles } from "@/components/Skeleton"

export default function Loading() {
  return (
    <div style={{ minHeight: "100vh", background: "#070e20", padding: "32px 36px" }}>
      <ShimmerStyles />
      <Skeleton height={13} width="80px" radius={6} style={{ marginBottom: 20 }} />
      <Skeleton height={26} width="260px" radius={8} style={{ marginBottom: 8 }} />
      <Skeleton height={13} width="320px" radius={6} style={{ marginBottom: 32 }} />

      <div style={{ maxWidth: "720px", padding: "36px 40px", borderRadius: "24px", background: "rgba(10,20,42,0.78)", border: "1px solid rgba(255,255,255,0.07)" }}>
        {/* Step bar */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "36px" }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: i < 3 ? 1 : 0 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <Skeleton width={30} height={30} radius={15} />
                <Skeleton width={60} height={10} radius={5} />
              </div>
              {i < 3 && <Skeleton height={1} style={{ flex: 1, margin: "0 6px 20px" }} />}
            </div>
          ))}
        </div>

        <Skeleton height={20} width="200px" radius={7} style={{ marginBottom: 8 }} />
        <Skeleton height={13} width="90%" radius={6} style={{ marginBottom: 24 }} />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={54} radius={12} style={{ marginBottom: 10 }} />
        ))}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <Skeleton height={44} width="180px" radius={12} />
        </div>
      </div>
    </div>
  )
}
