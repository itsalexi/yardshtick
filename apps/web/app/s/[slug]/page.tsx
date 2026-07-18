"use client";

import type { Storefront, YardItem } from "@yard/contracts";
import { use, useEffect, useState } from "react";

import { Logo } from "@/src/components/logo";
import { conditionLabels, php } from "@/src/lib/format";
import { getYardService } from "@/src/services/yard-service";

export default function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const service = getYardService();

  const [storefront, setStorefront] = useState<Storefront | null>(null);
  const [reserving, setReserving] = useState<YardItem | null>(null);
  const [buyerName, setBuyerName] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  async function refresh() {
    setStorefront(await service.getStorefront(slug));
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1500);
    return () => clearInterval(interval);
  }, [slug]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  async function confirmReserve() {
    if (!reserving || buyerName.trim().length === 0) return;
    try {
      await service.reserveItem(slug, reserving.id, buyerName.trim());
      setToast("Reserved! See you at pickup.");
    } catch {
      setToast("Someone reserved this just before you.");
    }
    setReserving(null);
    setBuyerName("");
    refresh();
  }

  if (!storefront) {
    return (
      <main className="screen">
        <div className="content" style={{ justifyContent: "center", alignItems: "center" }}>
          <span className="muted">Loading…</span>
        </div>
      </main>
    );
  }

  const availableCount = storefront.items.filter((item) => item.status === "available").length;

  return (
    <main className="screen">
      <div className="banner-soft">Buyer view</div>

      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--accent-soft)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Logo size={28} leaves="ink" />
          </div>
          <div>
            <div className="screen-title" style={{ fontSize: 18 }}>
              {storefront.title}
            </div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              Quezon City · {storefront.items.length} items · {availableCount} available
            </div>
          </div>
        </div>
      </div>

      <div className="content">
        {storefront.items.map((item) => (
          <div key={item.id} className="card item-row fadeup">
            <div className="ph thumb">
              <span>{item.category.slice(0, 3).toUpperCase()}</span>
            </div>
            <div className="grow">
              <div className="title">{item.title}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3 }}>
                <span className="chip">{conditionLabels[item.condition]}</span>
                <span className="price" style={{ fontSize: 17 }}>
                  {php(item.finalPricePhp)}
                </span>
              </div>
            </div>
            {item.status === "available" ? (
              <button
                type="button"
                className="btn btn-small"
                onClick={() => setReserving(item)}
              >
                Reserve
              </button>
            ) : (
              <span className="chip pill-soft">Reserved</span>
            )}
          </div>
        ))}

        <p className="muted" style={{ textAlign: "center", fontSize: 13, padding: "6px 20px" }}>
          Reserving is a promise, not a payment. Bring cash on pickup.
        </p>
      </div>

      {reserving && (
        <div className="overlay" onClick={() => setReserving(null)}>
          <div className="sheet" onClick={(event) => event.stopPropagation()}>
            <span className="screen-title" style={{ fontSize: 19 }}>
              Reserve {reserving.title}
            </span>
            <span className="muted">
              {php(reserving.finalPricePhp)} · {conditionLabels[reserving.condition]}
            </span>
            <input
              type="text"
              placeholder="Your name"
              value={buyerName}
              autoFocus
              onChange={(event) => setBuyerName(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && confirmReserve()}
            />
            <button
              type="button"
              className="btn"
              disabled={buyerName.trim().length === 0}
              onClick={confirmReserve}
            >
              Reserve it
              <span className="sub">A promise, not a payment</span>
            </button>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}
