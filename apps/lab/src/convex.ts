import type {
  AttachCropInput,
  CreateDraftInput,
  SampleSale,
  ScanSellerView,
} from "@yard/contracts";
import { makeFunctionReference } from "convex/server";

export const functions = {
  listSamples: makeFunctionReference<"query", Record<string, never>, SampleSale[]>(
    "samples:list",
  ),
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
};
