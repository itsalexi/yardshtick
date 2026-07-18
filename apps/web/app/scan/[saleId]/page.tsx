"use client";

import type { SaleView, YardItem } from "@yard/contracts";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";

import { Logo } from "@/src/components/logo";
import { QrCode } from "@/src/components/qr-code";
import { SceneView } from "@/src/components/scene-view";
import { conditionLabels, conditionOrder, php } from "@/src/lib/format";
import { getYardService } from "@/src/services/yard-service";

type Phase = "scanning" | "detect" | "confirm" | "publish";

const strategies = [
  { key: "sellTodayPhp", name: "Sell today" },
  { key: "fairPhp", name: "Fair price" },
  { key: "tryYourLuckPhp", name: "Try your luck" },
] as const;

export default function ScanPage({ params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = use(params);
  const service = getYardService();

  const [sale, setSale] = useState<SaleView | null>(null);
  const [phase, setPhase] = useState<Phase>("scanning");
  const [visibleBoxes, setVisibleBoxes] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    service.getSale(saleId).then((loaded) => {
      if (cancelled) return;
      setSale(loaded);
      // Boxes pop in staggered during the ~1.9s scan treatment.
      loaded.items.forEach((_, index) => {
        setTimeout(() => setVisibleBoxes(index + 1), 500 + index * 220);
      });
      setTimeout(() => setPhase("detect"), 1900);
    });
    return () => {
      cancelled = true;
    };
  }, [saleId]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const selectedItems = useMemo(
    () => sale?.items.filter((item) => item.selected) ?? [],
    [sale],
  );

  async function toggleItem(item: YardItem) {
    if (!sale || phase !== "detect") return;
    await service.setItemSelected(item.id, !item.selected);
    setSale(await service.getSale(saleId));
  }

  async function patchItem(
    itemId: string,
    patch: Partial<Pick<YardItem, "title" | "condition" | "finalPricePhp">>,
  ) {
    await service.updateItem(itemId, patch);
    setSale(await service.getSale(saleId));
  }

  async function removeItem(itemId: string) {
    await service.setItemSelected(itemId, false);
    setSale(await service.getSale(saleId));
  }

  async function publish() {
    if (!sale) return;
    await service.publishSale(sale.id);
    setSale(await service.getSale(saleId));
    setPhase("publish");
  }

  if (!sale) {
    return (
      <main className="screen">
        <div className="content" style={{ justifyContent: "center", alignItems: "center" }}>
          <span className="muted">Loading…</span>
        </div>
      </main>
    );
  }

  const link = `yard.sh/${sale.slug}`;
  const publishable = selectedItems.every(
    (item) => item.title.trim().length > 0 && (item.finalPricePhp ?? 0) > 0,
  );

  return (
    <main className="screen">
      {phase === "scanning" && (
        <>
          <div className="topbar">
            <span className="screen-title">Scanning…</span>
            <span className="label">Yard vision</span>
          </div>
          <div className="content">
            <SceneView
              items={sale.items}
              visibleCount={visibleBoxes}
              scanning
              caption="SCENE.JPG · analyzing"
            />
            <p className="muted" style={{ textAlign: "center" }}>
              Finding sellable items in your scene…
            </p>
          </div>
        </>
      )}

      {phase === "detect" && (
        <>
          <div className="topbar">
            <span className="screen-title">Your scene</span>
            <span className="chip pill-soft">{sale.items.length} found</span>
          </div>
          <div className="content">
            <SceneView
              items={sale.items}
              caption={`SCENE.JPG · ${sale.items.length} items`}
              onTapItem={toggleItem}
            />
            <p className="muted" style={{ textAlign: "center" }}>
              Tap the items on your scene to include them.
            </p>
          </div>
          <div className="footer">
            <button
              type="button"
              className="btn"
              disabled={selectedItems.length === 0}
              onClick={() => setPhase("confirm")}
            >
              Confirm {selectedItems.length} item{selectedItems.length === 1 ? "" : "s"} →
            </button>
          </div>
        </>
      )}

      {phase === "confirm" && (
        <>
          <div className="topbar">
            <button
              type="button"
              className="chip"
              style={{ cursor: "pointer" }}
              onClick={() => setPhase("detect")}
            >
              ← Scene
            </button>
            <span className="screen-title">Confirm & price</span>
            <span className="chip pill-soft">{selectedItems.length}</span>
          </div>

          <div className="content">
            {selectedItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onPatch={(patch) => patchItem(item.id, patch)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </div>

          <div className="footer">
            <button type="button" className="btn" disabled={!publishable} onClick={publish}>
              Publish {selectedItems.length} item{selectedItems.length === 1 ? "" : "s"}
              <span className="sub">Creates your shareable storefront</span>
            </button>
          </div>
        </>
      )}

      {phase === "publish" && (
        <>
          <div className="topbar">
            <span className="screen-title">You’re live!</span>
            <span className="chip pill-soft">Published</span>
          </div>
          <div className="content" style={{ alignItems: "center", textAlign: "center" }}>
            <div className="popin" style={{ marginTop: 18 }}>
              <Logo size={80} leaves="ink" />
            </div>
            <p className="muted" style={{ maxWidth: 260 }}>
              {selectedItems.length} items are up. Share the link or let buyers scan the code.
            </p>

            <div
              className="card fadeup"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                width: "100%",
                justifyContent: "space-between",
              }}
            >
              <span className="display" style={{ fontWeight: 600 }}>
                {link}
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => {
                  navigator.clipboard?.writeText(`https://${link}`);
                  setToast("Link copied");
                }}
              >
                Copy
              </button>
            </div>

            <QrCode seed={sale.slug} />

            <div style={{ width: "100%", marginTop: 4 }}>
              <Link href="/" style={{ textDecoration: "none" }}>
                <span className="btn" style={{ display: "flex" }}>
                  Go to my listings
                </span>
              </Link>
            </div>
          </div>
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function ItemCard({
  item,
  onPatch,
  onRemove,
}: {
  item: YardItem;
  onPatch: (patch: Partial<Pick<YardItem, "title" | "condition" | "finalPricePhp">>) => void;
  onRemove: () => void;
}) {
  const lowConfidence = item.maskSource === "bbox";
  const activeStrategy = strategies.find(
    ({ key }) => item.pricing && item.pricing[key] === item.finalPricePhp,
  );

  return (
    <section className="card fadeup" style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div className="ph thumb" style={{ width: 56, height: 56, borderRadius: 12, flexShrink: 0 }}>
          <span>{item.category.slice(0, 3).toUpperCase()}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          <input
            type="text"
            value={item.title}
            onChange={(event) => onPatch({ title: event.target.value })}
            aria-label="Item title"
          />
          <span className="label">{item.category}</span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.title}`}
          style={{
            background: "none",
            border: "none",
            color: "var(--faint)",
            fontSize: 18,
            cursor: "pointer",
            minWidth: 44,
            minHeight: 44,
          }}
        >
          ✕
        </button>
      </div>

      {lowConfidence && (
        <div className="banner-warn">Low match — double-check the model before publishing.</div>
      )}

      <div className="seg" role="radiogroup" aria-label="Condition">
        {conditionOrder.map((condition) => (
          <button
            key={condition}
            type="button"
            data-on={item.condition === condition}
            onClick={() => onPatch({ condition })}
          >
            {conditionLabels[condition]}
          </button>
        ))}
      </div>

      {item.pricing && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <span className="muted" style={{ fontSize: 13 }}>
              Comparable {php(item.pricing.sellTodayPhp)}–{php(item.pricing.tryYourLuckPhp)}
            </span>
            <span className="price" style={{ fontSize: 24 }}>
              {php(item.finalPricePhp)}
            </span>
          </div>

          <div className="strategies">
            {strategies.map(({ key, name }) => (
              <button
                key={key}
                type="button"
                className="strategy"
                data-sel={activeStrategy?.key === key}
                onClick={() => onPatch({ finalPricePhp: item.pricing![key] })}
              >
                <span className="s-name">{name}</span>
                <span className="s-price">{php(item.pricing![key])}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
