import type { YardItem } from "@yard/contracts";

export type ItemPhotoState = {
  status: "generating" | "ready" | "failed";
  source: "generated" | "upload";
  revision: number;
  previewUrl?: string;
};

export type ItemPhotoStates = Record<string, ItemPhotoState>;

export function moveReviewIndex(index: number, direction: -1 | 1, count: number): number {
  return Math.max(0, Math.min(index + direction, Math.max(0, count - 1)));
}

export function normalizeReviewIndex(index: number, count: number): number {
  return Math.max(0, Math.min(index, Math.max(0, count - 1)));
}

function fromItem(item: YardItem): ItemPhotoState {
  const marketplace = item.marketplaceImage;
  return {
    status:
      marketplace?.status === "ready"
        ? "ready"
        : marketplace?.status === "failed"
          ? "failed"
          : "generating",
    source: "generated",
    revision: marketplace?.revision ?? 0,
    ...(item.imageUrl ? { previewUrl: item.imageUrl } : {}),
  };
}

export function createPhotoStates(items: Array<string | YardItem>): ItemPhotoStates {
  return Object.fromEntries(
    items.map((item) => [
      typeof item === "string" ? item : item.id,
      typeof item === "string"
        ? ({
            status: "generating",
            source: "generated",
            revision: 0,
          } satisfies ItemPhotoState)
        : fromItem(item),
    ]),
  );
}

export function syncPhotoStates(
  current: ItemPhotoStates,
  items: YardItem[],
): ItemPhotoStates {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      current[item.id]?.source === "upload" ? current[item.id] : fromItem(item),
    ]),
  );
}

export function markPhotoReady(state: ItemPhotoState): ItemPhotoState {
  return { ...state, status: "ready" };
}

export function retryPhoto(state: ItemPhotoState): ItemPhotoState {
  return {
    status: "generating",
    source: "generated",
    revision: state.revision + 1,
  };
}

export function replacePhoto(state: ItemPhotoState, previewUrl: string): ItemPhotoState {
  return {
    status: "ready",
    source: "upload",
    revision: state.revision,
    previewUrl,
  };
}
