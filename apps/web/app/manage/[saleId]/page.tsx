"use client";

import type { SaleView } from "@yard/contracts";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";

import { conditionLabels, php } from "@/src/lib/format";
import { getYardService } from "@/src/services/yard-service";

const DEMO_BUYER = "Carlo D.";

export default function ManagePage({ params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = use(params);
  const service = getYardService();

  const [sale, setSale] = useState<SaleView | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const simulated = useRef(false);

  async function refresh() {
    setSale(await service.getSale(saleId));
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 1500);

    // Demo realtime: a reservation arrives ~2.2s after opening the dashboard.
    const demoTimer = setTimeout(async () => {
      if (simulated.current) return;
      simulated.current = true;
      const current = await service.getSale(saleId);
      const target = current.items.find(
        (item) => item.selected && item.status === "available",
      );
      if (!target) return;
      try {
        await service.reserveItem(current.slug, target.id, DEMO_BUYER);
        setToast(`${DEMO_BUYER} reserved ${target.title}`);
        refresh();
      } catch {
        // Already reserved elsewhere — nothing to simulate.
      }
    }, 2200);

    return () => {
      clearInterval(interval);
      clearTimeout(demoTimer);
    };
  }, [saleId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!sale) {
    return (
      <main className="screen">
        <div className="content" style={{ justifyContent: "center", alignItems: "center" }}>
          <span className="muted">Loading…</span>
        </div>
      </main>
    );
  }

  const items = sale.items.filter((item) => item.selected);
  const reserved = items.filter((item) => item.status === "reserved").length;
  const available = items.filter((item) => item.status === "available").length;

  return (
    <main className="screen">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="live-dot" />
          <span className="screen-title" style={{ fontSize: 19 }}>
            {sale.title}
          </span>
        </div>
        <Link href={`/s/${sale.slug}`} className="chip" style={{ textDecoration: "none" }}>
          yard.sh/{sale.slug}
        </Link>
      </div>

      <div className="content">
        <div className="stats">
          <div className="stat">
            <span className="n">24</span>
            <span className="label">Views</span>
          </div>
          <div className="stat">
            <span className="n" style={{ color: "var(--accent)" }}>
              {reserved}
            </span>
            <span className="label">Reserved</span>
          </div>
          <div className="stat">
            <span className="n">{available}</span>
            <span className="label">Available</span>
          </div>
        </div>

        {items.map((item) => (
          <div key={item.id} className="card item-row fadeup">
            <div className="ph thumb">
              <span>{item.category.slice(0, 3).toUpperCase()}</span>
            </div>
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
      </div>

      {toast && <div className="toast popin">{toast}</div>}
    </main>
  );
}
