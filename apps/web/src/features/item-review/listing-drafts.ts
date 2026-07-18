import type { SaleView, YardItem } from "@yard/contracts";

export type ListingPatch = Partial<
  Pick<YardItem, "title" | "condition" | "finalPricePhp" | "selected">
>;

export type ListingDrafts = Record<string, ListingPatch>;

export function rememberListingDraft(
  drafts: ListingDrafts,
  itemId: string,
  patch: ListingPatch,
): ListingDrafts {
  return {
    ...drafts,
    [itemId]: { ...drafts[itemId], ...patch },
  };
}

export function rememberSelectionDraft(
  drafts: ListingDrafts,
  itemId: string,
  selected: boolean,
): ListingDrafts {
  return rememberListingDraft(drafts, itemId, { selected });
}

export function applyListingDrafts(sale: SaleView, drafts: ListingDrafts): SaleView {
  return {
    ...sale,
    items: sale.items.map((item) =>
      drafts[item.id] ? { ...item, ...drafts[item.id] } : item,
    ),
  };
}
