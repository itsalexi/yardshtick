# Scene Scan and Backend Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working upload-to-segmentation vertical slice that seeds the six sample scenes, discovers sellable objects with GPT-5.6 Sol, segments them with Roboflow SAM 2, persists progressive Convex state, and exposes the results in a standalone React lab.

**Architecture:** Framework-independent provider and geometry code lives in `packages/ai`; transport-neutral runtime shapes live in `packages/contracts`; Convex owns storage, idempotent run orchestration, and seller-view mapping; `apps/lab` talks directly to the development deployment using named function references. Candidate boxes persist before masks, every segmentation failure degrades to a box, and routine tests use recorded data rather than paid providers.

**Tech Stack:** pnpm 10, Turborepo 2, TypeScript 6, Zod 4, Vitest 4, Convex 1.42, React 19, Vite, SVG overlays, OpenAI Responses API, Roboflow SAM 2 serverless API.

## Global Constraints

> **Product-intent update (2026-07-18):** Discovery now optimizes for whole-scene recall. Every visible,
> identifiable physical item can be inventory, including furniture and background objects. The checked-in
> manifest is authoritative and supersedes the original focal-item examples embedded below.

- Keep `apps/web` on its existing mock `YardService`; this plan does not connect the product frontend.
- Store `OPENAI_API_KEY` and `ROBOFLOW_API_KEY` only in Convex environment variables; never commit or expose them to the lab.
- Use `gpt-5.6-sol`, low reasoning effort, strict Structured Outputs, normalized 0–1000 boxes, and at most 12 candidates.
- Reject discovery confidence below `0.45`, box area below `0.15%`, and box area above `85%`.
- Use Roboflow `hiera_tiny`, `/sam2/embed_image`, `/sam2/segment_image`, JSON polygons, center-based pixel boxes, and `multimask_output: false`.
- Accept masks only at confidence `>= 0.50`; cap each item at 350 polygon vertices; preserve a box fallback for every accepted candidate.
- Every Convex function defines argument and return validators; queries use indexes; every stage write rejects stale `runId` values.
- Routine tests make no paid provider calls. Live provider checks are explicit opt-in commands.
- Implement only scene discovery, segmentation, persistence, seeding, and the lab in this plan. Revision-safe crop attachment and GPT Image 2 enrichment remain the next plan.

---

## File Map

- `packages/ai/test/fixtures/scenes/*`: checked-in canonical sample scenes and their immutable evaluation manifest.
- `packages/contracts/src/geometry.ts`: shared pixel box, point, and polygon primitives without index-module cycles.
- `packages/ai/src/discovery.ts`: OpenAI request construction, response parsing, candidate validation, and duplicate suppression.
- `packages/ai/src/roboflow.ts`: SAM 2 request construction, prediction mapping, polygon normalization, and fallbacks.
- `packages/ai/src/provider-error.ts`: safe provider error and timeout normalization.
- `packages/contracts/src/pipeline.ts`: shared sale, run, item, mask, upload, and seller-view schemas.
- `apps/backend/convex/schema.ts`: full persistence schema and indexes.
- `apps/backend/convex/files.ts`: upload URLs and stored-file metadata lookup.
- `apps/backend/convex/sales.ts`: draft creation and reactive seller-view query.
- `apps/backend/convex/samples.ts`: idempotent fixture sale creation and fixture listing.
- `apps/backend/convex/scanModel.ts`: internal run transitions and progressive persistence.
- `apps/backend/convex/scan.ts`: Node action that coordinates discovery and segmentation.
- `apps/backend/scripts/seed-dataset.ts`: local-only fixture uploader using the public Convex functions.
- `apps/lab/src/convex.ts`: named function references without generated backend imports.
- `apps/lab/src/geometry.ts`: canonical/display scaling and SVG path helpers.
- `apps/lab/src/App.tsx`: fixture/custom upload, scan controls, reactive diagnostics, and overlays.

### Task 1: Check In and Validate the Six-Scene Dataset

**Files:**
- Create: `packages/ai/test/fixtures/scenes/phone-single.jpeg`
- Create: `packages/ai/test/fixtures/scenes/laptop-table-multi.jpeg`
- Create: `packages/ai/test/fixtures/scenes/charger-cable.jpeg`
- Create: `packages/ai/test/fixtures/scenes/overlapping-caps.jpeg`
- Create: `packages/ai/test/fixtures/scenes/empty-table-room.jpeg`
- Create: `packages/ai/test/fixtures/scenes/pa-speaker-room.jpeg`
- Create: `packages/ai/test/fixtures/scenes/manifest.ts`
- Create: `packages/ai/test/fixtures/scenes/manifest.test.ts`
- Modify: `packages/ai/package.json`
- Modify: `packages/ai/tsconfig.json`

**Interfaces:**
- Consumes: the six exact JPEGs supplied by the user in `/Users/alexi/Downloads`.
- Produces: `sceneManifest: readonly SceneExpectation[]` keyed by stable `fixtureKey` values used by the seed script and evaluation runner.

- [ ] **Step 1: Write the failing manifest validation test**

```ts
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { sceneManifest } from "./manifest";

describe("sceneManifest", () => {
  it("has six unique 2048x1536 fixtures with disjoint labels", async () => {
    expect(sceneManifest).toHaveLength(6);
    expect(new Set(sceneManifest.map(({ fixtureKey }) => fixtureKey)).size).toBe(6);
    for (const scene of sceneManifest) {
      await expect(access(fileURLToPath(new URL(scene.fileName, import.meta.url)))).resolves.toBeUndefined();
      const metadata = await sharp(fileURLToPath(new URL(scene.fileName, import.meta.url))).metadata();
      expect([metadata.width, metadata.height]).toEqual([scene.width, scene.height]);
      expect(scene.expectedCandidateRange[0]).toBeLessThanOrEqual(scene.expectedCandidateRange[1]);
      const included = [...scene.required, ...scene.optional].flatMap(({ aliases }) => aliases);
      expect(included.filter((label) => scene.excluded.includes(label))).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails because the manifest is absent**

Run: `pnpm --filter @yard/ai test -- manifest.test.ts`

Expected: FAIL with a module resolution error for `./manifest`.

- [ ] **Step 3: Copy the six immutable binary assets and add the typed manifest**

```ts
export type SceneExpectation = {
  fixtureKey: string;
  fileName: string;
  width: 2048;
  height: 1536;
  expectedCandidateRange: readonly [number, number];
  required: ReadonlyArray<{ label: string; aliases: readonly string[] }>;
  optional: ReadonlyArray<{ label: string; aliases: readonly string[] }>;
  excluded: readonly string[];
  notes: readonly string[];
};

export const sceneManifest = [
  {
    fixtureKey: "phone-single",
    fileName: "phone-single.jpeg",
    width: 2048,
    height: 1536,
    expectedCandidateRange: [1, 1],
    required: [{ label: "smartphone", aliases: ["phone", "iphone", "smartphone"] }],
    optional: [],
    excluded: ["table", "hand", "laptop"],
    notes: ["Ignore partial laptops at the frame edges."],
  },
  {
    fixtureKey: "laptop-table-multi",
    fileName: "laptop-table-multi.jpeg",
    width: 2048,
    height: 1536,
    expectedCandidateRange: [4, 8],
    required: [
      { label: "central laptop", aliases: ["laptop", "macbook", "notebook computer"] },
      { label: "smartphone", aliases: ["phone", "iphone", "smartphone"] },
      { label: "power adapter", aliases: ["charger", "power adapter", "laptop charger"] },
      { label: "wallet", aliases: ["wallet", "case", "black pouch"] },
    ],
    optional: [{ label: "secondary laptop", aliases: ["laptop", "computer"] }],
    excluded: ["table", "person", "hand", "chair"],
    notes: ["Distinct visible tabletop products may be returned separately."],
  },
  {
    fixtureKey: "charger-cable",
    fileName: "charger-cable.jpeg",
    width: 2048,
    height: 1536,
    expectedCandidateRange: [1, 1],
    required: [{ label: "charger bundle", aliases: ["charger", "power adapter and cable", "adapter cable"] }],
    optional: [],
    excluded: ["table", "arm", "wallet", "laptop"],
    notes: ["Treat the attached adapter and cable as one product bundle."],
  },
  {
    fixtureKey: "overlapping-caps",
    fileName: "overlapping-caps.jpeg",
    width: 2048,
    height: 1536,
    expectedCandidateRange: [2, 2],
    required: [
      { label: "blue cap", aliases: ["blue cap", "oracle racing cap", "baseball cap"] },
      { label: "black cap", aliases: ["black cap", "alphatauri cap", "baseball cap"] },
    ],
    optional: [],
    excluded: ["table", "person", "phone", "laptop", "bottle"],
    notes: ["The caps overlap but must remain separate candidates."],
  },
  {
    fixtureKey: "empty-table-room",
    fileName: "empty-table-room.jpeg",
    width: 2048,
    height: 1536,
    expectedCandidateRange: [0, 0],
    required: [],
    optional: [],
    excluded: ["table", "chair", "floor", "room"],
    notes: ["Negative control: staging furniture is not merchandise."],
  },
  {
    fixtureKey: "pa-speaker-room",
    fileName: "pa-speaker-room.jpeg",
    width: 2048,
    height: 1536,
    expectedCandidateRange: [1, 1],
    required: [{ label: "PA speaker bundle", aliases: ["pa speaker", "speaker and stand", "jbl speaker"] }],
    optional: [],
    excluded: ["whiteboard", "table", "chair", "window", "cable"],
    notes: ["Treat the speaker and tripod stand as one product."],
  },
] as const satisfies readonly SceneExpectation[];
```

Copy each source JPEG to the exact destination named above, add `sharp` as a direct development dependency, then expand `packages/ai/tsconfig.json` to include `test/**/*.ts`.

- [ ] **Step 4: Run dataset and package verification**

Run: `pnpm --filter @yard/ai test && pnpm --filter @yard/ai typecheck`

Expected: all manifest and coordinate tests PASS and TypeScript exits 0.

- [ ] **Step 5: Commit the dataset**

```sh
git add packages/ai/test packages/ai/package.json packages/ai/tsconfig.json pnpm-lock.yaml
git commit -m "test: add scene evaluation dataset"
```

### Task 2: Expand Shared Pipeline Contracts

**Files:**
- Create: `packages/contracts/src/geometry.ts`
- Create: `packages/contracts/src/pipeline.ts`
- Create: `packages/contracts/src/pipeline.test.ts`
- Modify: `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: existing `pixelBoxSchema`, `polygonSchema`, and product-facing contracts.
- Produces: `scanSellerViewSchema`, `scanItemSchema`, `scanRunSummarySchema`, `createDraftInputSchema`, `sampleSaleSchema`, and their inferred types.

- [ ] **Step 1: Write failing contract tests for progressive boxes, mask fallbacks, zero candidates, and safe failures**

```ts
import { describe, expect, it } from "vitest";
import { scanSellerViewSchema } from "./pipeline";

const baseSale = {
  id: "sale_1",
  slug: "sale-1",
  status: "processing",
  processingStage: "segmenting",
  progress: 60,
  image: { url: "https://example.test/scene.jpeg", width: 2048, height: 1536, mimeType: "image/jpeg" },
  activeRunId: "run_1",
  error: null,
  run: { status: "running", stage: "segmenting", candidateCount: 1, polygonCount: 0, fallbackCount: 0 },
};

describe("scanSellerViewSchema", () => {
  it("accepts a candidate before its polygon is ready", () => {
    const parsed = scanSellerViewSchema.parse({
      ...baseSale,
      items: [{ id: "item_1", tempId: "candidate-1", sortOrder: 0, selected: true, title: "Phone", category: "Electronics", confidence: 0.91, roughBox: { x1: 100, y1: 100, x2: 900, y2: 1300 }, refinedBox: null, maskSource: "pending", maskRevision: 0, polygons: [], segmentationConfidence: null }],
    });
    expect(parsed.items[0]?.maskSource).toBe("pending");
  });

  it("accepts a completed zero-candidate scan", () => {
    expect(scanSellerViewSchema.parse({ ...baseSale, status: "ready", processingStage: "complete", progress: 100, run: { ...baseSale.run, status: "complete", stage: "complete", candidateCount: 0 }, items: [] }).items).toEqual([]);
  });

  it("rejects provider secrets in safe errors", () => {
    expect(() => scanSellerViewSchema.parse({ ...baseSale, status: "failed", processingStage: "failed", error: { code: "OPENAI_FAILED", message: "Bearer sk-secret" }, items: [] })).toThrow();
  });
});
```

- [ ] **Step 2: Run the focused contract test and confirm the missing module failure**

Run: `pnpm --filter @yard/contracts test -- pipeline.test.ts`

Expected: FAIL resolving `./pipeline`.

- [ ] **Step 3: Add the schemas with explicit nullable progressive fields**

```ts
import { z } from "zod";
import { pixelBoxSchema, polygonSchema } from "./geometry";

export const safeErrorSchema = z.object({
  code: z.string().regex(/^[A-Z0-9_]+$/),
  message: z.string().max(240).refine((value) => !/(sk-[A-Za-z0-9_-]+|api[_-]?key|bearer\s+)/i.test(value)),
});
export const scanItemSchema = z.object({
  id: z.string().min(1), tempId: z.string().min(1), sortOrder: z.number().int().nonnegative(), selected: z.boolean(),
  title: z.string().min(1), category: z.string().min(1), confidence: z.number().min(0).max(1), roughBox: pixelBoxSchema,
  refinedBox: pixelBoxSchema.nullable(), maskSource: z.enum(["pending", "roboflow_sam2", "bbox"]), maskRevision: z.number().int().nonnegative(),
  polygons: z.array(polygonSchema), segmentationConfidence: z.number().min(0).max(1).nullable(),
});
export const scanRunSummarySchema = z.object({
  status: z.enum(["running", "complete", "failed"]), stage: z.enum(["discovering", "segmenting", "complete", "failed"]),
  candidateCount: z.number().int().nonnegative(), polygonCount: z.number().int().nonnegative().default(0), fallbackCount: z.number().int().nonnegative().default(0),
  discoveryMs: z.number().nonnegative().optional(), embeddingMs: z.number().nonnegative().optional(), segmentationMs: z.number().nonnegative().optional(), totalMs: z.number().nonnegative().optional(),
});
export const scanSellerViewSchema = z.object({
  id: z.string().min(1), slug: z.string().min(1), status: z.enum(["draft", "processing", "ready", "failed"]),
  processingStage: z.enum(["uploaded", "discovering", "segmenting", "complete", "failed"]), progress: z.number().min(0).max(100), activeRunId: z.string().nullable(),
  image: z.object({ url: z.string().url(), width: z.number().int().positive(), height: z.number().int().positive(), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]) }),
  error: safeErrorSchema.nullable(), run: scanRunSummarySchema.nullable(), items: z.array(scanItemSchema),
});
export type ScanSellerView = z.infer<typeof scanSellerViewSchema>;
export type ScanItem = z.infer<typeof scanItemSchema>;
```

Move the existing pixel box, point, and polygon schemas and their inferred types into `geometry.ts`, import those primitives into both `index.ts` and `pipeline.ts`, and re-export both new modules from `index.ts`. Keep the existing web-facing schemas intact.

- [ ] **Step 4: Run all contract and mock-data tests**

Run: `pnpm --filter @yard/contracts test && pnpm --filter @yard/mock-data test && pnpm --filter @yard/contracts typecheck`

Expected: all tests PASS and existing mock fixtures remain valid.

- [ ] **Step 5: Commit the contracts**

```sh
git add packages/contracts/src
git commit -m "feat: add scene scan contracts"
```

### Task 3: Implement and Record-Test the AI Provider Adapters

**Files:**
- Create: `packages/ai/src/provider-error.ts`
- Create: `packages/ai/src/discovery.ts`
- Create: `packages/ai/src/discovery.test.ts`
- Create: `packages/ai/src/roboflow.ts`
- Create: `packages/ai/src/roboflow.test.ts`
- Create: `packages/ai/test/fixtures/providers/openai-discovery-success.json`
- Create: `packages/ai/test/fixtures/providers/roboflow-segmentation-partial.json`
- Modify: `packages/ai/src/index.ts`

**Interfaces:**
- Consumes: canonical image bytes, dimensions, provider keys, stable image IDs, and injectable `fetch`.
- Produces: `discoverProducts(input): Promise<DiscoveryResult>`, `embedScene(input): Promise<EmbedResult>`, and `segmentCandidates(input): Promise<SegmentationResult>` with only validated application shapes.

- [ ] **Step 1: Write failing discovery tests for filtering and duplicate suppression**

```ts
import { describe, expect, it, vi } from "vitest";
import { discoverProducts } from "./discovery";

describe("discoverProducts", () => {
  it("converts valid normalized boxes and removes low-confidence and duplicate candidates", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ id: "resp_1", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify({ candidates: [
      { tempId: "phone", displayName: "Smartphone", category: "Electronics", sellabilityConfidence: 0.92, box: { xMin: 100, yMin: 100, xMax: 500, yMax: 900 } },
      { tempId: "phone-copy", displayName: "Phone", category: "Electronics", sellabilityConfidence: 0.70, box: { xMin: 105, yMin: 105, xMax: 498, yMax: 895 } },
      { tempId: "table", displayName: "Table", category: "Furniture", sellabilityConfidence: 0.20, box: { xMin: 0, yMin: 500, xMax: 1000, yMax: 1000 } },
    ] }) }] }] }), { status: 200 }));
    const result = await discoverProducts({ apiKey: "test-key", image: new Uint8Array([1, 2, 3]), mimeType: "image/jpeg", width: 2000, height: 1000, fetcher });
    expect(result.responseId).toBe("resp_1");
    expect(result.candidates).toEqual([{ tempId: "phone", displayName: "Smartphone", category: "Electronics", sellabilityConfidence: 0.92, roughBox: { x1: 200, y1: 100, x2: 1000, y2: 900 } }]);
  });
});
```

- [ ] **Step 2: Write failing Roboflow tests for request shape and per-candidate box fallback**

```ts
import { describe, expect, it, vi } from "vitest";
import { segmentCandidates } from "./roboflow";

describe("segmentCandidates", () => {
  it("maps a valid first prediction and falls back the missing second prediction", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ predictions: [{ confidence: 0.91, masks: [[[100, 100], [400, 100], [400, 400], [100, 400]]], format: "json" }] }), { status: 200 }));
    const candidates = [
      { tempId: "one", displayName: "One", category: "Other", sellabilityConfidence: 0.9, roughBox: { x1: 100, y1: 100, x2: 400, y2: 400 } },
      { tempId: "two", displayName: "Two", category: "Other", sellabilityConfidence: 0.8, roughBox: { x1: 500, y1: 100, x2: 800, y2: 400 } },
    ];
    const result = await segmentCandidates({ apiKey: "test-key", baseUrl: "https://serverless.roboflow.com", image: new Uint8Array([1]), mimeType: "image/jpeg", imageId: "stable", width: 1000, height: 800, candidates, fetcher });
    expect(result.items.map(({ maskSource }) => maskSource)).toEqual(["roboflow_sam2", "bbox"]);
    expect(result.fallbackCount).toBe(1);
  });
});
```

- [ ] **Step 3: Run both focused tests and confirm missing-export failures**

Run: `pnpm --filter @yard/ai test -- discovery.test.ts roboflow.test.ts`

Expected: FAIL resolving `discoverProducts` and `segmentCandidates`.

- [ ] **Step 4: Add timeout/error normalization and the provider implementations**

Use this public surface:

```ts
export type ProviderFetcher = typeof fetch;
export type DiscoveryInput = { apiKey: string; image: Uint8Array; mimeType: "image/jpeg" | "image/png" | "image/webp"; width: number; height: number; fetcher?: ProviderFetcher; signal?: AbortSignal };
export type DiscoveryResult = { responseId?: string; candidates: SceneCandidate[] };
export type SegmentationItem = { tempId: string; maskSource: "roboflow_sam2" | "bbox"; polygons: PixelPoint[][]; refinedBox: PixelBox; confidence?: number };
export type SegmentationResult = { items: SegmentationItem[]; polygonCount: number; fallbackCount: number };
```

`discoverProducts` posts the canonical image as a base64 data URL to `https://api.openai.com/v1/responses`, sends `model: "gpt-5.6-sol"`, `reasoning: { effort: "low" }`, and `text.format.type: "json_schema"`. Parse both `output_text` and nested `output[].content[].text`, validate the strict candidate object, then apply confidence, area, coordinate, and intersection-over-union filtering.

`segmentCandidates` posts this application payload shape:

```ts
const body = {
  image: { type: "base64", value: toBase64DataUrl(input.image, input.mimeType) },
  image_id: input.imageId,
  prompts: {
    prompts: input.candidates.map(({ roughBox }) => ({ box: pixelBoxToRoboflowBox(roughBox) })),
  },
  sam2_version_id: "hiera_tiny",
  format: "json",
  multimask_output: false,
};
```

Normalize polygons by clamping points, dropping consecutive duplicates and invalid contours, validating prompt intersection and centroid containment, and using the candidate box when a prediction is missing or invalid. Export all public functions from `packages/ai/src/index.ts`.

- [ ] **Step 5: Run AI tests, type checking, and lint**

Run: `pnpm --filter @yard/ai test && pnpm --filter @yard/ai typecheck && pnpm --filter @yard/ai lint`

Expected: all provider and geometry tests PASS with no network calls.

- [ ] **Step 6: Commit the adapters**

```sh
git add packages/ai/src packages/ai/test/fixtures/providers
git commit -m "feat: add discovery and segmentation adapters"
```

### Task 4: Build the Convex Schema and Progressive Persistence Layer

**Files:**
- Modify: `apps/backend/convex/schema.ts`
- Create: `apps/backend/convex/files.ts`
- Create: `apps/backend/convex/sales.ts`
- Create: `apps/backend/convex/samples.ts`
- Create: `apps/backend/convex/scanModel.ts`
- Create: `apps/backend/convex/scanModel.test.ts`
- Modify: `apps/backend/package.json`

**Interfaces:**
- Consumes: Convex storage IDs and validated provider results.
- Produces: public `files.generateUploadUrl`, `sales.createDraft`, `sales.getSellerView`, `samples.createSale`, `samples.list`; internal run lifecycle mutations used only by the action.

- [ ] **Step 1: Add `convex-test` and write failing progressive-state tests**

```ts
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";

const modules = import.meta.glob("./**/!(*.*.*)*.*s");

describe("scan persistence", () => {
  it("persists candidates before masks and ignores a stale run", async () => {
    const t = convexTest(schema, modules);
    const storageId = await t.run(async (ctx) => ctx.storage.store(new Blob(["image"], { type: "image/jpeg" })));
    const saleId = await t.mutation(api.sales.createDraft, { storageId, metadata: { width: 2048, height: 1536, mimeType: "image/jpeg" } });
    const first = await t.mutation(internal.scanModel.beginRun, { saleId });
    const second = await t.mutation(internal.scanModel.beginRun, { saleId });
    expect(await t.mutation(internal.scanModel.persistCandidates, { saleId, runId: first.runId, candidates: [] })).toBe(false);
    expect(await t.mutation(internal.scanModel.persistCandidates, { saleId, runId: second.runId, candidates: [{ tempId: "phone", displayName: "Phone", category: "Electronics", sellabilityConfidence: 0.9, roughBox: { x1: 10, y1: 10, x2: 500, y2: 700 } }] })).toBe(true);
    const view = await t.query(api.sales.getSellerView, { saleId });
    expect(view?.items[0]?.maskSource).toBe("pending");
  });
});
```

- [ ] **Step 2: Run the backend test and confirm missing function failures**

Run: `pnpm --filter @yard/backend test -- scanModel.test.ts`

Expected: FAIL because the new functions and generated references do not exist.

- [ ] **Step 3: Replace the starter schema with the locked four-table schema**

Define `sales`, `items`, `itemMasks`, and `scanRuns` with exactly the fields from the approved design. Add indexes `sales.by_slug`, `sales.by_fixtureKey`, `sales.by_createdAt`, `items.by_saleId`, `items.by_saleId_and_selected`, `itemMasks.by_itemId`, `itemMasks.by_itemId_and_revision`, `scanRuns.by_saleId`, and `scanRuns.by_saleId_and_runId`.

Use reusable validators for pixel boxes, points, provider-safe errors, status literals, and image metadata. Do not retain the starter pricing or reservation columns in this scan-specific persistence model.

- [ ] **Step 4: Implement public storage, draft, fixture, and seller-view functions**

```ts
export const generateUploadUrl = mutation({ args: {}, returns: v.string(), handler: (ctx) => ctx.storage.generateUploadUrl() });

export const createDraft = mutation({
  args: { storageId: v.id("_storage"), metadata: imageMetadataValidator },
  returns: v.id("sales"),
  handler: async (ctx, { storageId, metadata }) => createSaleDocument(ctx, { storageId, metadata }),
});

export const getSellerView = query({
  args: { saleId: v.id("sales") },
  returns: v.union(v.null(), sellerViewValidator),
  handler: async (ctx, { saleId }) => mapSellerView(ctx, saleId),
});
```

`samples.createSale` queries `sales.by_fixtureKey` first and returns the existing ID without creating duplicates. `samples.list` uses `sales.by_createdAt`, returns only documents with a fixture key, and includes a resolved canonical image URL.

- [ ] **Step 5: Implement stale-safe internal run transitions**

`beginRun` creates a collision-resistant run ID, marks the sale `processing/discovering`, and inserts `scanRuns`. `persistCandidates` first checks `sale.activeRunId === runId`, replaces prior items for that sale, stores each candidate as `maskSource: "pending"`, then moves the sale/run to segmentation. `persistSegmentation` updates the matching items, inserts one mask revision per item, and records polygon/fallback counts. `completeRun` and `failRun` only patch active runs.

- [ ] **Step 6: Generate Convex types and run persistence tests**

Run: `pnpm --filter @yard/backend exec convex dev --once`

Expected: Convex code generation and schema push complete against `determined-mule-611`.

Run: `pnpm --filter @yard/backend test && pnpm --filter @yard/backend typecheck && pnpm --filter @yard/backend lint`

Expected: progressive persistence and stale-run tests PASS.

- [ ] **Step 7: Commit the persistence layer**

```sh
git add apps/backend/package.json apps/backend/convex pnpm-lock.yaml
git commit -m "feat: add Convex scan persistence"
```

### Task 5: Orchestrate Live Discovery and Segmentation

**Files:**
- Create: `apps/backend/convex/scan.ts`
- Create: `apps/backend/convex/scan.test.ts`
- Modify: `apps/backend/convex/scanModel.ts`

**Interfaces:**
- Consumes: `OPENAI_API_KEY`, `ROBOFLOW_API_KEY`, canonical storage bytes, and internal run mutations.
- Produces: public `scan.start({ saleId }) -> { runId }` and progressive sale state ending in `complete` or a safe failure.

- [ ] **Step 1: Write a deterministic orchestration test with injected providers**

Test the exported framework-free `runScanPipeline` helper with fakes that record call order. Assert that discovery and embedding start before either settles, candidates persist before segmentation starts, embedding rejection does not block segmentation, and segmentation rejection persists box fallbacks.

```ts
expect(events.slice(0, 2).sort()).toEqual(["discovery:start", "embed:start"]);
expect(events.indexOf("candidates:persisted")).toBeLessThan(events.indexOf("segment:start"));
expect(result.fallbackCount).toBe(1);
```

- [ ] **Step 2: Run the focused test and confirm the helper is missing**

Run: `pnpm --filter @yard/backend test -- scan.test.ts`

Expected: FAIL resolving `runScanPipeline`.

- [ ] **Step 3: Implement the Node action and injectable orchestration helper**

`scan.ts` begins with `"use node"`. The public action validates `saleId`, calls `internal.scanModel.beginRun`, loads storage bytes through an internal query plus `ctx.storage.getUrl`, then starts discovery and embedding promises concurrently. Once discovery returns, it calls `persistCandidates`, waits for the non-fatal embedding attempt, segments candidates, calls `persistSegmentation`, and completes the run with timings.

Use `OPENAI_API_KEY` and `ROBOFLOW_API_KEY` from `process.env`. Throw a safe configuration error if either is absent. Provider errors pass through `toSafeProviderError`; never include response bodies, URLs containing query keys, or authorization headers.

For zero candidates, skip segmentation and complete with zero counts. For total Roboflow failure, map every persisted candidate to a box fallback and complete successfully.

- [ ] **Step 4: Run orchestration tests and push functions to development**

Run: `pnpm --filter @yard/backend test && pnpm --filter @yard/backend typecheck`

Expected: orchestration, persistence, and stale-run tests PASS.

Run: `pnpm --filter @yard/backend exec convex dev --once`

Expected: functions synchronize successfully with the development deployment.

- [ ] **Step 5: Commit orchestration**

```sh
git add apps/backend/convex/scan.ts apps/backend/convex/scan.test.ts apps/backend/convex/scanModel.ts
git commit -m "feat: orchestrate progressive scene scans"
```

### Task 6: Add Idempotent Dataset Seeding

**Files:**
- Create: `apps/backend/scripts/seed-dataset.ts`
- Create: `apps/backend/scripts/seed-dataset.test.ts`
- Modify: `package.json`
- Modify: `apps/backend/package.json`
- Modify: `apps/backend/tsconfig.json`

**Interfaces:**
- Consumes: `CONVEX_URL`, the six manifest entries, and the public upload/sample functions.
- Produces: `pnpm dataset:seed`, which uploads missing fixtures and prints stable fixture keys and sale IDs without printing credentials.

- [ ] **Step 1: Add a pure seed decision test**

```ts
import { describe, expect, it } from "vitest";
import { missingFixtureKeys } from "./seed-dataset";

it("uploads only missing fixture keys", () => {
  expect(missingFixtureKeys(["phone-single", "charger-cable"], ["phone-single", "empty-table-room"])).toEqual(["charger-cable"]);
});
```

- [ ] **Step 2: Run the test and confirm the helper is missing**

Run: `pnpm --filter @yard/backend test -- seed-dataset.test.ts`

Expected: FAIL resolving `./seed-dataset`.

- [ ] **Step 3: Implement the uploader with `ConvexHttpClient` and named references**

The script reads `CONVEX_URL` from `apps/backend/.env.local` only when it is absent from the process environment, calls `samples.list`, and uploads only missing files. For each file it calls `files.generateUploadUrl`, performs a `POST` with the fixture MIME type, parses `{ storageId }`, and calls `samples.createSale` with the manifest dimensions and stable key.

Add backend script `"dataset:seed": "tsx scripts/seed-dataset.ts"`, root wrapper `"dataset:seed": "pnpm --filter @yard/backend dataset:seed"`, install `tsx` in `@yard/backend`, and include `scripts/**/*.ts` in its TypeScript project.

- [ ] **Step 4: Seed twice and prove idempotency**

Run: `pnpm dataset:seed && pnpm dataset:seed`

Expected: first run creates any missing fixtures; second run reports all six as already present and creates no duplicate sales.

- [ ] **Step 5: Commit the seed command**

```sh
git add package.json apps/backend/package.json apps/backend/tsconfig.json apps/backend/scripts pnpm-lock.yaml
git commit -m "feat: seed sample scenes into Convex"
```

### Task 7: Build the Standalone React Backend Lab

**Files:**
- Create: `apps/lab/package.json`
- Create: `apps/lab/index.html`
- Create: `apps/lab/tsconfig.json`
- Create: `apps/lab/vite.config.ts`
- Create: `apps/lab/eslint.config.mjs`
- Create: `apps/lab/src/main.tsx`
- Create: `apps/lab/src/convex.ts`
- Create: `apps/lab/src/geometry.ts`
- Create: `apps/lab/src/geometry.test.ts`
- Create: `apps/lab/src/App.tsx`
- Create: `apps/lab/src/App.test.tsx`
- Create: `apps/lab/src/styles.css`
- Create: `apps/lab/.env.example`
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `turbo.json`

**Interfaces:**
- Consumes: `VITE_CONVEX_URL`, `@yard/contracts`, and named Convex calls for fixture listing, uploads, sale creation, scan start, and seller-view subscription.
- Produces: `pnpm --filter @yard/lab dev` with a fixture/custom-image workflow, reactive stages, canonical overlays, metrics, and safe errors.

- [ ] **Step 1: Write geometry tests for display scaling and SVG polygons**

```ts
import { describe, expect, it } from "vitest";
import { canonicalBoxToDisplay, polygonToSvgPoints } from "./geometry";

describe("lab geometry", () => {
  it("scales canonical coordinates into a fitted display", () => {
    expect(canonicalBoxToDisplay({ x1: 100, y1: 200, x2: 500, y2: 600 }, { width: 1000, height: 800 }, { width: 500, height: 400 })).toEqual({ x1: 50, y1: 100, x2: 250, y2: 300 });
  });
  it("serializes a polygon without changing point order", () => {
    expect(polygonToSvgPoints([[1, 2], [3, 4], [5, 6]])).toBe("1,2 3,4 5,6");
  });
});
```

- [ ] **Step 2: Write a component test for fixture selection and progressive state**

Render `App` with a small injectable `LabDataSource` fake. Assert fixture buttons appear, selecting one subscribes to its seller view, clicking `Run scan` calls `startScan`, a `segmenting` view shows boxes, and a completed view shows polygons plus latency metrics.

- [ ] **Step 3: Run lab tests and confirm the package is absent**

Run: `pnpm --filter @yard/lab test`

Expected: pnpm reports no matching project.

- [ ] **Step 4: Scaffold Vite and named Convex references**

Use React 19, `convex`, `@yard/contracts`, Vite, Vitest, Testing Library, and JSDOM. Add `VITE_CONVEX_URL` to Turbo's build environment inputs. Document filtered lab/backend startup in `README.md`, and add the lab ownership/dependency boundary to both agent guides. Create references like:

```ts
export const functions = {
  listSamples: makeFunctionReference<"query", Record<string, never>, SampleSale[]>("samples:list"),
  createDraft: makeFunctionReference<"mutation", CreateDraftInput, string>("sales:createDraft"),
  startScan: makeFunctionReference<"action", { saleId: string }, { runId: string }>("scan:start"),
  getSellerView: makeFunctionReference<"query", { saleId: string }, ScanSellerView | null>("sales:getSellerView"),
};
```

`apps/lab` must not import `apps/backend/convex/_generated` or `@yard/ai`.

- [ ] **Step 5: Build the lab workflow**

`App.tsx` displays two columns: compact controls/diagnostics on the left and the canonical image viewer on the right. It loads seeded fixtures, supports JPEG/PNG/WebP upload via a generated upload URL, creates drafts, starts scans, subscribes to seller state, renders rough boxes immediately, replaces them with polygon outlines when available, and lists per-item confidence/source/revision.

Use a single responsive CSS file with strong contrast and no product-brand abstractions. Show explicit empty, discovering, segmenting, complete-zero, failed, and complete-with-items states. Disable `Run scan` only while a run is active.

- [ ] **Step 6: Run package and workspace verification**

Run: `pnpm --filter @yard/lab test && pnpm --filter @yard/lab lint && pnpm --filter @yard/lab typecheck && pnpm --filter @yard/lab build`

Expected: component/geometry tests PASS and Vite emits `apps/lab/dist`.

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

Expected: the full monorepo exits 0 and `apps/web` remains unchanged and buildable.

- [ ] **Step 7: Commit the lab**

```sh
git add apps/lab AGENTS.md CLAUDE.md README.md turbo.json pnpm-lock.yaml
git commit -m "feat: add AI pipeline testing lab"
```

### Task 8: Run the First Live Six-Scene Evaluation

**Files:**
- Create: `apps/backend/scripts/evaluate-scenes.ts`
- Create: `apps/backend/scripts/evaluate-scenes.test.ts`
- Create: `artifacts/evaluations/.gitkeep`
- Modify: `apps/backend/package.json`
- Modify: `package.json`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: seeded fixture sales and the public scan/seller-view functions.
- Produces: opt-in `pnpm smoke:scenes` and an ignored timestamped JSON/Markdown report containing only safe counts, timings, required-object recall, and error codes.

- [ ] **Step 1: Write matching tests for semantic aliases**

```ts
import { expect, it } from "vitest";
import { matchesRequiredLabel } from "./evaluate-scenes";

it("matches aliases case-insensitively without requiring exact generated titles", () => {
  expect(matchesRequiredLabel("Apple Smartphone", ["phone", "smartphone"])).toBe(true);
  expect(matchesRequiredLabel("Wooden Table", ["phone", "smartphone"])).toBe(false);
});
```

- [ ] **Step 2: Implement the polling evaluator**

The evaluator calls `samples.list`, runs each sale sequentially to limit provider bursts, polls `sales.getSellerView` until `ready`/`failed` or 90 seconds, computes candidate count, polygon count, fallback count, required-object recall, unexpected count, and recorded stage timings, then writes a timestamped local report. It never updates the manifest.

- [ ] **Step 3: Run recorded tests and one live pass**

Run: `pnpm --filter @yard/backend test -- evaluate-scenes.test.ts`

Expected: semantic matching tests PASS.

Run: `pnpm smoke:scenes`

Expected: all six sales reach a terminal state and a safe report is written. Provider-quality misses are recorded honestly; application crashes, missing fallbacks, or stale overwrites must be fixed before completion.

- [ ] **Step 4: Verify the lab manually against the live deployment**

Run: `pnpm --filter @yard/lab dev`

Expected: the fixture picker shows all six scenes; multi-object scans visibly progress from boxes to polygons; the room scene returns visible furniture; failed predictions remain usable as boxes.

- [ ] **Step 5: Commit the evaluator and final slice fixes**

```sh
git add package.json apps/backend/package.json apps/backend/scripts/evaluate-scenes.ts apps/backend/scripts/evaluate-scenes.test.ts artifacts/evaluations/.gitkeep .gitignore docs/superpowers/plans/2026-07-18-scene-scan-and-lab.md
git commit -m "test: add live scene evaluation runner"
```

## Final Verification

Run:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm dataset:seed
pnpm smoke:scenes
```

Expected: all static and recorded checks pass; seeding is idempotent; all six fixture runs terminate; every accepted candidate has either a validated polygon or a box fallback; the standalone lab displays the live results without starting `apps/web`.

After this plan is complete, write and execute `docs/superpowers/plans/2026-07-18-marketplace-image-enrichment.md` for revision-safe browser crops, GPT Image 2 edits, two-at-a-time dispatching, and lab comparison.
