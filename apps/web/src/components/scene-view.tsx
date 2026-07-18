"use client";

import type { SaleView, YardItem } from "@yard/contracts";

type SceneViewProps = {
  items: YardItem[];
  visibleCount?: number;
  scanning?: boolean;
  caption?: string;
  image?: SaleView["image"];
  onTapItem?: (item: YardItem) => void;
};

function pct(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

export function SceneView({
  items,
  visibleCount,
  scanning,
  caption,
  image,
  onTapItem,
}: SceneViewProps) {
  const shown = visibleCount === undefined ? items : items.slice(0, visibleCount);
  const width = image?.width ?? 2048;
  const height = image?.height ?? 1536;

  return (
    <div
      className={`scene${image ? "" : " ph"}`}
      style={{ aspectRatio: `${width} / ${height}`, width: "100%" }}
    >
      {image ? <img className="scene-image" src={image.url} alt="Sale scene" /> : null}
      <span className="scene-caption">{caption ?? "SCENE.JPG"}</span>

      {scanning && <div className="scanline" />}

      <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
        {shown.map(
          (item) =>
            item.selected &&
            item.polygons?.map((polygon, index) => (
              <polygon
                key={`${item.id}_${index}`}
                points={polygon.map(([x, y]) => `${x},${y}`).join(" ")}
                fill="oklch(0.63 0.1 45 / 0.22)"
                stroke="#fff"
                strokeWidth={4}
              />
            )),
        )}
      </svg>

      {shown.map((item) => (
        <button
          key={item.id}
          type="button"
          className="box popin"
          data-tag={item.selected}
          style={{
            left: pct(item.roughBox.x1, width),
            top: pct(item.roughBox.y1, height),
            width: pct(item.roughBox.x2 - item.roughBox.x1, width),
            height: pct(item.roughBox.y2 - item.roughBox.y1, height),
          }}
          onClick={() => onTapItem?.(item)}
          aria-pressed={item.selected}
          aria-label={item.title}
        >
          <span className="box-marker" aria-hidden="true">
            !
          </span>
        </button>
      ))}
    </div>
  );
}
