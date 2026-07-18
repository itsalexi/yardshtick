"use client";

const SIZE = 25;

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function inFinder(x: number, y: number): boolean {
  const corners: Array<[number, number]> = [
    [0, 0],
    [SIZE - 7, 0],
    [0, SIZE - 7],
  ];
  return corners.some(([cx, cy]) => x >= cx && x < cx + 7 && y >= cy && y < cy + 7);
}

function finderCell(x: number, y: number): boolean {
  const corners: Array<[number, number]> = [
    [0, 0],
    [SIZE - 7, 0],
    [0, SIZE - 7],
  ];
  for (const [cx, cy] of corners) {
    if (x >= cx && x < cx + 7 && y >= cy && y < cy + 7) {
      const dx = x - cx;
      const dy = y - cy;
      const ring = dx === 0 || dx === 6 || dy === 0 || dy === 6;
      const core = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
      return ring || core;
    }
  }
  return false;
}

export function QrCode({ seed }: { seed: string }) {
  const cells: boolean[] = [];
  let state = hashString(seed);

  for (let i = 0; i < SIZE * SIZE; i += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    cells.push((state & 0b111) < 3);
  }

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      width={148}
      height={148}
      role="img"
      aria-label="Storefront QR code"
      style={{ background: "#fff", borderRadius: 12, padding: 8 }}
    >
      {Array.from({ length: SIZE * SIZE }, (_, i) => {
        const x = i % SIZE;
        const y = Math.floor(i / SIZE);
        const dark = inFinder(x, y) ? finderCell(x, y) : cells[i];
        if (!dark) return null;
        return <rect key={i} x={x} y={y} width={1} height={1} fill="#141416" />;
      })}
    </svg>
  );
}
