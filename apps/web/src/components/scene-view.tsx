"use client";

import type { YardItem } from "@yard/contracts";

import { SCENE_HEIGHT, SCENE_WIDTH } from "@/src/lib/format";

type SceneViewProps = {
  items: YardItem[];
  visibleCount?: number;
  scanning?: boolean;
  caption?: string;
  onTapItem?: (item: YardItem) => void;
};

function pct(value: number, total: number): string {
  return `${(value / total) * 100}%`;
}

export function SceneView({ items, visibleCount, scanning, caption, onTapItem }: SceneViewProps) {
  const shown = visibleCount === undefined ? items : items.slice(0, visibleCount);

  return (
    <div
      className="scene ph"
      style={{ aspectRatio: `${SCENE_WIDTH} / ${SCENE_HEIGHT}`, width: "100%" }}
    >
      <span>{caption ?? "SCENE.JPG"}</span>

      {scanning && <div className="scanline" />}

      <svg viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`} aria-hidden="true">
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
            left: pct(item.roughBox.x1, SCENE_WIDTH),
            top: pct(item.roughBox.y1, SCENE_HEIGHT),
            width: pct(item.roughBox.x2 - item.roughBox.x1, SCENE_WIDTH),
            height: pct(item.roughBox.y2 - item.roughBox.y1, SCENE_HEIGHT),
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
