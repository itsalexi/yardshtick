"use client";

import type { SaleView } from "@yard/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Logo } from "@/src/components/logo";
import { conditionLabels, php } from "@/src/lib/format";
import { getYardService } from "@/src/services/yard-service";

export default function ListingsPage() {
  const router = useRouter();
  const service = getYardService();
  const [sale, setSale] = useState<SaleView | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      const latest = await service.getLatestSale();
      if (!cancelled) {
        setSale(latest);
        setLoaded(true);
      }
    };
    void refresh();
    const interval = setInterval(refresh, 1500);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [service]);

  const items = sale?.items.filter((item) => item.selected) ?? [];
  const reserved = items.filter((item) => item.status === "reserved").length;

  return (
    <main className="screen">
      <div className="topbar">
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Logo size={26} leaves="ink" />
          <span className="wordmark">Yard</span>
        </span>
        {sale && (
          <span className="chip pill-soft">
            {items.length} listed{reserved > 0 ? ` · ${reserved} reserved` : ""}
          </span>
        )}
      </div>

      <div className="content">
        <span className="screen-title">My listings</span>

        {!loaded && <span className="muted">Loading…</span>}

        {loaded && items.length === 0 && (
          <div
            className="card"
            style={{
              padding: 28,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              textAlign: "center",
            }}
          >
            <Logo size={56} leaves="ink" />
            <span className="screen-title" style={{ fontSize: 18 }}>
              Nothing listed yet
            </span>
            <p className="muted" style={{ maxWidth: 240 }}>
              Point your camera at a pile and Yard turns it into listings.
            </p>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => router.push("/capture")}
            >
              Scan your first pile
            </button>
          </div>
        )}

        {items.map((item) => (
          <div key={item.id} className="card item-row fadeup">
            {item.imageUrl ? (
              <img className="thumb listing-thumb" src={item.imageUrl} alt="" />
            ) : (
              <div className="ph thumb">
                <span>{item.category.slice(0, 3).toUpperCase()}</span>
              </div>
            )}
            <div className="grow">
              <div className="title">{item.title}</div>
              <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
                {conditionLabels[item.condition]} ·{" "}
                <span className="price" style={{ fontSize: 13.5 }}>
                  {php(item.finalPricePhp)}
                </span>
              </div>
            </div>
            {item.status === "reserved" ? (
              <span className="chip pill-soft">
                Reserved{item.reservedByName ? ` · ${item.reservedByName}` : ""}
              </span>
            ) : item.status === "sold" ? (
              <span className="chip">Sold</span>
            ) : (
              <span className="chip">Available</span>
            )}
          </div>
        ))}

        {items.length > 0 && (
          <p className="muted" style={{ textAlign: "center", fontSize: 13, padding: "4px 20px" }}>
            Share your QR code so buyers can browse and reserve.
          </p>
        )}
      </div>
    </main>
  );
}
