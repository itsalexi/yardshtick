import type {
  AttachCropInput,
  CreateDraftInput,
  ScanSellerView,
  Storefront,
  YardItem,
} from "@yard/contracts";
import { makeFunctionReference } from "convex/server";

export const convexFunctions = {
  generateUploadUrl: makeFunctionReference<
    "mutation",
    Record<string, never>,
    string
  >("files:generateUploadUrl"),
  generateCropUploadUrl: makeFunctionReference<
    "mutation",
    { itemId: string },
    string
  >("files:generateCropUploadUrl"),
  createDraft: makeFunctionReference<"mutation", CreateDraftInput, string>(
    "sales:createDraft",
  ),
  startScan: makeFunctionReference<
    "action",
    { saleId: string },
    { runId: string }
  >("scan:start"),
  getSellerView: makeFunctionReference<
    "query",
    { saleId: string },
    ScanSellerView | null
  >("sales:getSellerView"),
  setSelected: makeFunctionReference<
    "mutation",
    { itemId: string; selected: boolean },
    null
  >("items:setSelected"),
  updateListing: makeFunctionReference<
    "mutation",
    {
      itemId: string;
      title?: string;
      condition?: YardItem["condition"];
      finalPricePhp?: number;
    },
    null
  >("items:updateListing"),
  attachCrop: makeFunctionReference<
    "mutation",
    AttachCropInput,
    { jobId: string; cropRevision: number }
  >("items:attachCrop"),
  retryMarketplaceImage: makeFunctionReference<
    "mutation",
    { itemId: string },
    { jobId: string }
  >("items:retryMarketplaceImage"),
  publish: makeFunctionReference<
    "mutation",
    { saleId: string },
    string
  >("sales:publish"),
  getStorefront: makeFunctionReference<
    "query",
    { slug: string },
    Storefront | null
  >("sales:getStorefront"),
  reserve: makeFunctionReference<
    "mutation",
    { slug: string; itemId: string; buyerName: string },
    null
  >("items:reserve"),
};
