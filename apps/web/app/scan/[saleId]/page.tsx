"use client";

import type { SaleView, YardItem } from "@yard/contracts";
import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";

import { Logo } from "@/src/components/logo";
import { QrCode } from "@/src/components/qr-code";
import { SceneView } from "@/src/components/scene-view";
import { ItemReview } from "@/src/features/item-review/item-review";
import {
  createPhotoStates,
  moveReviewIndex,
  normalizeReviewIndex,
  replacePhoto,
  retryPhoto,
  syncPhotoStates,
  type ItemPhotoStates,
} from "@/src/features/item-review/model";
import { getYardService } from "@/src/services/yard-service";

type Phase = "scanning" | "detect" | "confirm" | "publish";

export default function ScanPage({ params }: { params: Promise<{ saleId: string }> }) {
  const { saleId } = use(params);
  const service = getYardService();

  const [sale, setSale] = useState<SaleView | null>(null);
  const [phase, setPhase] = useState<Phase>("scanning");
  const [visibleBoxes, setVisibleBoxes] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [activeReviewIndex, setActiveReviewIndex] = useState(0);
  const [photoStates, setPhotoStates] = useState<ItemPhotoStates>({});
  const [shareOrigin, setShareOrigin] = useState("https://yard.sh");

  useEffect(() => setShareOrigin(window.location.origin), []);

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      try {
        const loaded = await service.getSale(saleId);
        if (cancelled) return;
        setSale(loaded);
        setVisibleBoxes(loaded.items.length);
        if (loaded.status === "published") {
          setPhase("publish");
        } else if (loaded.processingStage === "complete") {
          setPhase((current) => (current === "scanning" ? "detect" : current));
        }
      } catch (error) {
        if (!cancelled) {
          setToast(error instanceof Error ? error.message : "Could not load this sale.");
        }
      } finally {
        if (!cancelled) timeout = setTimeout(refresh, 600);
      }
    };
    void refresh();
    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [saleId, service]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(timer);
  }, [toast]);

  const selectedItems = useMemo(
    () => sale?.items.filter((item) => item.selected) ?? [],
    [sale],
  );

  useEffect(() => {
    setActiveReviewIndex((current) => normalizeReviewIndex(current, selectedItems.length));
  }, [selectedItems.length]);

  useEffect(() => {
    if (phase !== "confirm") return;
    setPhotoStates((current) => syncPhotoStates(current, selectedItems));
  }, [phase, selectedItems]);

  async function toggleItem(item: YardItem) {
    if (!sale || phase !== "detect") return;
    setSale({
      ...sale,
      items: sale.items.map((candidate) =>
        candidate.id === item.id ? { ...candidate, selected: !item.selected } : candidate,
      ),
    });
    await service.setItemSelected(item.id, !item.selected);
  }

  async function patchItem(
    itemId: string,
    patch: Partial<Pick<YardItem, "title" | "condition" | "finalPricePhp">>,
  ) {
    setSale((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.id === itemId ? { ...item, ...patch } : item,
            ),
          }
        : current,
    );
    await service.updateItem(itemId, patch);
  }

  async function removeItem(itemId: string) {
    await service.setItemSelected(itemId, false);
    setSale((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.id === itemId ? { ...item, selected: false } : item,
            ),
          }
        : current,
    );
    if (selectedItems.length <= 1) setPhase("detect");
  }

  function beginReview() {
    setActiveReviewIndex(0);
    setPhotoStates(createPhotoStates(selectedItems));
    setPhase("confirm");
    for (const item of selectedItems) {
      void service.prepareItemPhoto(saleId, item.id).catch((error: unknown) => {
        setToast(error instanceof Error ? error.message : "Could not prepare item photo.");
      });
    }
  }

  const retryItemPhoto = useCallback((itemId: string) => {
    setPhotoStates((current) =>
      current[itemId] ? { ...current, [itemId]: retryPhoto(current[itemId]) } : current,
    );
    void service.retryItemPhoto(itemId).catch((error: unknown) => {
      setToast(error instanceof Error ? error.message : "Could not retry item photo.");
    });
  }, [service]);

  const uploadItemPhoto = useCallback((itemId: string, previewUrl: string) => {
    setPhotoStates((current) =>
      current[itemId]
        ? { ...current, [itemId]: replacePhoto(current[itemId], previewUrl) }
        : current,
    );
  }, []);

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

  const link = `yard.sh/s/${sale.slug}`;
  const shareUrl = `${shareOrigin}/s/${sale.slug}`;
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
              image={sale.image}
              visibleCount={visibleBoxes}
              scanning
              caption="SCENE.JPG · analyzing"
            />
            <p className="muted" style={{ textAlign: "center" }}>
              {sale.error?.message ?? `Finding sellable items… ${Math.round(sale.progress)}%`}
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
              image={sale.image}
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
              onClick={beginReview}
            >
              Confirm {selectedItems.length} item{selectedItems.length === 1 ? "" : "s"} →
            </button>
          </div>
        </>
      )}

      {phase === "confirm" && (
        <ItemReview
          items={selectedItems}
          activeIndex={activeReviewIndex}
          photoStates={photoStates}
          publishable={publishable}
          onRetryPhoto={retryItemPhoto}
          onUploadPhoto={uploadItemPhoto}
          onPatch={patchItem}
          onRemove={removeItem}
          onPrevious={() =>
            setActiveReviewIndex((current) =>
              moveReviewIndex(current, -1, selectedItems.length),
            )
          }
          onNext={() =>
            setActiveReviewIndex((current) =>
              moveReviewIndex(current, 1, selectedItems.length),
            )
          }
          onPublish={publish}
          onBackToScene={() => setPhase("detect")}
        />
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
                  navigator.clipboard?.writeText(shareUrl);
                  setToast("Link copied");
                }}
              >
                Copy
              </button>
            </div>

            <QrCode seed={shareUrl} />

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
