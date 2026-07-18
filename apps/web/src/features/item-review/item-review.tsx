"use client";

import type { YardItem } from "@yard/contracts";
import Image from "next/image";
import { useEffect, useRef } from "react";

import { conditionLabels, conditionOrder, php } from "@/src/lib/format";

import type { ItemPhotoStates } from "./model";

const strategies = [
  { key: "sellTodayPhp", name: "Sell today" },
  { key: "fairPhp", name: "Fair price" },
  { key: "tryYourLuckPhp", name: "Try your luck" },
] as const;

type ItemPatch = Partial<Pick<YardItem, "title" | "condition" | "finalPricePhp">>;

export type ItemReviewProps = {
  items: YardItem[];
  activeIndex: number;
  photoStates: ItemPhotoStates;
  publishable: boolean;
  onPhotoReady: (itemId: string) => void;
  onRetryPhoto: (itemId: string) => void;
  onUploadPhoto: (itemId: string, previewUrl: string) => void;
  onPatch: (itemId: string, patch: ItemPatch) => void;
  onRemove: (itemId: string) => void;
  onPrevious: () => void;
  onNext: () => void;
  onPublish: () => void;
  onBackToScene: () => void;
};

function generatedPhotoPath(item: YardItem): string {
  const assetName = item.id.replace(/^item_/, "").replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  return `/generated/${assetName}.png`;
}

export function ItemReview({
  items,
  activeIndex,
  photoStates,
  publishable,
  onPhotoReady,
  onRetryPhoto,
  onUploadPhoto,
  onPatch,
  onRemove,
  onPrevious,
  onNext,
  onPublish,
  onBackToScene,
}: ItemReviewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const item = items[activeIndex];
  const itemId = item?.id;
  const photoState = item ? photoStates[item.id] : undefined;
  const isLast = activeIndex === items.length - 1;

  useEffect(() => {
    if (!itemId || photoState?.status !== "generating") return;

    const timer = window.setTimeout(
      () => onPhotoReady(itemId),
      1200 + activeIndex * 120,
    );
    return () => window.clearTimeout(timer);
  }, [activeIndex, itemId, onPhotoReady, photoState?.revision, photoState?.status]);

  if (!item || !photoState) return null;

  const activeStrategy = strategies.find(
    ({ key }) => item.pricing && item.pricing[key] === item.finalPricePhp,
  );

  function uploadSelectedPhoto(file: File | undefined) {
    if (!file) return;
    onUploadPhoto(item.id, URL.createObjectURL(file));
  }

  return (
    <>
      <div className="topbar item-review-topbar">
        <button type="button" className="chip review-back" onClick={onBackToScene}>
          ← Scene
        </button>
        <span className="screen-title">Review item</span>
        <span className="chip pill-soft">
          {activeIndex + 1} / {items.length}
        </span>
      </div>

      <div className="item-review-content" key={item.id}>
        <section className="generated-photo-card fadeup">
          <div className="generated-photo-stage">
            {photoState.status === "generating" ? (
              <div className="photo-skeleton" aria-label="Generating product photo" role="status">
                <span className="skeleton-product" />
                <span className="skeleton-shadow" />
                <span className="skeleton-spark spark-one" />
                <span className="skeleton-spark spark-two" />
              </div>
            ) : (
              <Image
                key={`${item.id}-${photoState.revision}-${photoState.previewUrl ?? "generated"}`}
                src={photoState.previewUrl ?? generatedPhotoPath(item)}
                alt={`${item.title} product photo`}
                fill
                priority
                sizes="(max-width: 430px) 100vw, 430px"
                className="generated-photo"
                unoptimized={photoState.source === "upload"}
              />
            )}
            <span className="generation-badge">
              {photoState.status === "generating"
                ? "Creating studio photo…"
                : photoState.source === "upload"
                  ? "Your photo"
                  : "AI studio photo"}
            </span>
          </div>

          <div className="photo-actions">
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => onRetryPhoto(item.id)}
              disabled={photoState.status === "generating"}
            >
              Retry photo
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-small"
              onClick={() => fileInputRef.current?.click()}
            >
              Upload your own
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => uploadSelectedPhoto(event.target.files?.[0])}
            />
          </div>
        </section>

        <section className="review-fields fadeup">
          <div className="review-title-row">
            <div className="review-title-field">
              <label className="label" htmlFor={`title-${item.id}`}>
                Listing title
              </label>
              <input
                id={`title-${item.id}`}
                type="text"
                value={item.title}
                onChange={(event) => onPatch(item.id, { title: event.target.value })}
              />
            </div>
            <button
              type="button"
              className="remove-item"
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.title}`}
            >
              ✕
            </button>
          </div>

          {item.maskSource === "bbox" && (
            <div className="banner-warn">Low match — double-check this item before publishing.</div>
          )}

          <div>
            <span className="label review-field-label">Condition</span>
            <div className="seg" role="radiogroup" aria-label="Condition">
              {conditionOrder.map((condition) => (
                <button
                  key={condition}
                  type="button"
                  data-on={item.condition === condition}
                  onClick={() => onPatch(item.id, { condition })}
                >
                  {conditionLabels[condition]}
                </button>
              ))}
            </div>
          </div>

          {item.pricing && (
            <div className="review-pricing">
              <div className="review-price-heading">
                <span>
                  <span className="label">Asking price</span>
                  <span className="muted">
                    Comparable {php(item.pricing.sellTodayPhp)}–
                    {php(item.pricing.tryYourLuckPhp)}
                  </span>
                </span>
                <span className="price">{php(item.finalPricePhp)}</span>
              </div>

              <div className="strategies">
                {strategies.map(({ key, name }) => (
                  <button
                    key={key}
                    type="button"
                    className="strategy"
                    data-sel={activeStrategy?.key === key}
                    onClick={() => onPatch(item.id, { finalPricePhp: item.pricing![key] })}
                  >
                    <span className="s-name">{name}</span>
                    <span className="s-price">{php(item.pricing![key])}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="footer review-footer">
        <button
          type="button"
          className="btn btn-secondary review-previous"
          disabled={activeIndex === 0}
          onClick={onPrevious}
        >
          Previous
        </button>
        {isLast ? (
          <button type="button" className="btn" disabled={!publishable} onClick={onPublish}>
            Publish
          </button>
        ) : (
          <button type="button" className="btn" onClick={onNext}>
            Next
          </button>
        )}
      </div>
    </>
  );
}
