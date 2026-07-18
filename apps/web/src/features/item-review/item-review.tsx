"use client";

import type { YardItem } from "@yard/contracts";
import Image from "next/image";
import { useRef } from "react";

import { conditionLabels, conditionOrder } from "@/src/lib/format";

import type { ItemPhotoStates } from "./model";

type ItemPatch = Partial<Pick<YardItem, "title" | "condition" | "finalPricePhp">>;

export type ItemReviewProps = {
  items: YardItem[];
  activeIndex: number;
  photoStates: ItemPhotoStates;
  publishable: boolean;
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
  const photoState = item ? photoStates[item.id] : undefined;
  const isLast = activeIndex === items.length - 1;

  if (!item || !photoState) return null;

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
                src={photoState.previewUrl ?? item.imageUrl ?? generatedPhotoPath(item)}
                alt={`${item.title} product photo`}
                fill
                priority
                sizes="(max-width: 430px) 100vw, 430px"
                className="generated-photo"
                unoptimized={
                  photoState.source === "upload" ||
                  Boolean(photoState.previewUrl?.startsWith("http"))
                }
              />
            )}
            <span className="generation-badge">
              {photoState.status === "generating"
                ? "Creating studio photo…"
                : photoState.status === "failed"
                  ? "Real crop fallback"
                : photoState.source === "upload"
                  ? "Your photo"
                  : "AI studio photo"}
            </span>
            <div className="photo-overlay-actions">
              {photoState.status === "failed" ? (
                <button
                  type="button"
                  className="photo-pill"
                  aria-label="Retry photo"
                  onClick={() => onRetryPhoto(item.id)}
                >
                  ↻ Retry
                </button>
              ) : null}
              <button
                type="button"
                className="photo-pill"
                aria-label="Upload your own"
                onClick={() => fileInputRef.current?.click()}
              >
                ↑ Upload
              </button>
            </div>
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

          <div className="review-price-row">
            <label className="label" htmlFor={`price-${item.id}`}>
              Asking price
            </label>
            <div className="price-input">
              <span className="price-currency">₱</span>
              <input
                id={`price-${item.id}`}
                type="text"
                inputMode="numeric"
                value={item.finalPricePhp ?? ""}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "");
                  onPatch(item.id, {
                    finalPricePhp: digits ? Number(digits) : undefined,
                  });
                }}
              />
            </div>
          </div>
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
