export type ItemPhotoState = {
  status: "generating" | "ready";
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

export function createPhotoStates(itemIds: string[]): ItemPhotoStates {
  return Object.fromEntries(
    itemIds.map((itemId) => [
      itemId,
      { status: "generating", source: "generated", revision: 0 } satisfies ItemPhotoState,
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
