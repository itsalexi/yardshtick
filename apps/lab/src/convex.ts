import type {
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
