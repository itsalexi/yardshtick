# Marketplace Image Enrichment Implementation Plan

> **For agentic workers:** Implement task-by-task with test-driven development. Routine tests never call paid providers.

**Goal:** Let the lab attach a real, revisioned crop for any segmented item, enqueue a non-blocking GPT Image 2 edit, and reactively compare the permanent real crop with a stored marketplace-style photo.

**Architecture:** The browser derives a crop from the canonical image and current mask revision. Convex validates and stores that crop, creates an immutable generation job, and uses a durable dispatcher to keep at most two jobs in `generating`. A Node action calls GPT Image 2, stores the returned JPEG, and attaches it only if the item still references the same job, crop storage ID, and revision. Each claim has a watchdog lease so a stranded scheduled action cannot block the queue. The real crop remains the fallback for every pending, stale, or failed generation.

**Tech Stack:** TypeScript 6, React 19, browser canvas, Convex storage/scheduler, Zod 4, Vitest, GPT Image 2 Image API edits, sharp for the local smoke runner.

## Constraints

- Keep marketplace generation outside `scan.start`; scans never wait on image edits.
- Send provider keys only from Convex actions.
- Use `gpt-image-2`, one input image, `1024x1024`, low quality, opaque JPEG output, and no `input_fidelity` field.
- Preserve product identity, color, proportions, visible branding/text, accessories, and wear; add no props or repairs.
- Enforce a global maximum of two generating jobs with a transactional dispatcher.
- Reject crop attachments whose `maskRevision` is not exactly current.
- A stale result never replaces the current crop or marketplace image.
- Routine tests mock provider calls; only `pnpm smoke:product-images` spends provider credits.

## Task 1: Expand Shared Contracts

**Files:** `packages/contracts/src/pipeline.ts`, `packages/contracts/src/pipeline.test.ts`

- Add `attachCropInputSchema` and inferred type.
- Extend every scan item with required nested `crop` and `marketplaceImage` state.
- Cover missing, pending, ready, and failed states; verify safe errors and that a real crop remains present on generation failure.

Run: `pnpm --filter @yard/contracts test && pnpm --filter @yard/contracts typecheck`

## Task 2: Add the GPT Image 2 Client

**Files:** `packages/ai/src/marketplace-image.ts`, `packages/ai/src/marketplace-image.test.ts`, `packages/ai/src/index.ts`

- Build multipart `POST /v1/images/edits` with `model=gpt-image-2`, one `image[]` Blob, identity-preserving prompt, `n=1`, `size=1024x1024`, `quality=low`, `background=opaque`, and `output_format=jpeg`.
- Do not manually set multipart `Content-Type` and do not send `input_fidelity`.
- Decode `data[0].b64_json` into a JPEG byte array.
- Normalize network, 429, 5xx, rejection, and malformed response failures without reading provider bodies into errors.

Run: `pnpm --filter @yard/ai test && pnpm --filter @yard/ai typecheck`

## Task 3: Add Browser Crop Geometry

**Files:** `apps/lab/src/crop.ts`, `apps/lab/src/crop.test.ts`

- Compute a polygon bounding box, falling back to refined then rough box.
- Add 6% padding, clamp to canonical image bounds, and scale output to at most 640×640.
- Draw the canonical image from a fetched Blob; apply polygon paths with `destination-in`; encode transparent WebP with PNG fallback, or an opaque WebP/JPEG box crop.
- Unit-test padding, clamping, scaling, and coordinate transformation independently of the DOM encoder.

Run: `pnpm --filter @yard/lab test && pnpm --filter @yard/lab typecheck`

## Task 4: Persist Crops and Durable Jobs in Convex

**Files:** `apps/backend/convex/lib/validators.ts`, `apps/backend/convex/schema.ts`, `apps/backend/convex/files.ts`, `apps/backend/convex/items.ts`, `apps/backend/convex/items.test.ts`

- Add optional crop/generated metadata fields to existing items and a `marketplaceImageJobs` table with indexes by status/time and item/revision.
- `files.generateCropUploadUrl({ itemId })` verifies an item with a completed mask exists.
- `items.attachCrop(...)` verifies storage metadata and exact mask revision, replaces the real crop, clears generated state, marks obsolete pending jobs stale, creates an immutable pending job, and schedules dispatch.
- `items.retryMarketplaceImage({ itemId })` queues only a current ready crop after a failed generation.
- Test current attachment, stale rejection, state reset, and permanent crop fallback.

Run: `pnpm --filter @yard/backend test -- items.test.ts && pnpm --filter @yard/backend typecheck`

## Task 5: Dispatch and Generate at Most Two Images

**Files:** `apps/backend/convex/marketplaceModel.ts`, `apps/backend/convex/marketplaceModel.test.ts`, `apps/backend/convex/marketplace.ts`, `apps/backend/convex/scanModel.ts`

- A transactional internal dispatcher counts `generating` jobs and claims FIFO pending jobs up to `2 - running`.
- Store the current job ID on the item so repeated attempts for the same crop cannot overwrite one another.
- Schedule a delayed watchdog for each claim; expire a job that remains `generating` after the action timeout and refill the queue.
- Immutable job input captures crop storage ID, revision, and MIME type.
- The internal Node action loads the crop, calls the AI client with a 120-second timeout, stores the JPEG, and completes or safely fails only that job.
- Completion attaches the JPEG only when the item job ID, crop ID, crop revision, and mask revision still match; otherwise mark stale and delete the unused output.
- Completion/failure reschedules dispatch to refill available slots.
- Rescans mark pending jobs stale and clean old crop/generated storage while running jobs remain counted until they exit.
- Test two-slot claims, stale completion, current completion, failure fallback, and queue refill.

Run: `pnpm --filter @yard/backend test -- marketplaceModel.test.ts && pnpm --filter @yard/backend typecheck`

## Task 6: Expose State and Controls in the Lab

**Files:** `apps/backend/convex/sales.ts`, `apps/lab/src/convex.ts`, `apps/lab/src/App.tsx`, `apps/lab/src/App.test.tsx`, `apps/lab/src/styles.css`, `apps/lab/e2e/lab.spec.ts`

- Resolve crop and generated storage URLs in `sales.getSellerView`; generated URLs are current only when revisions match.
- Add named crop-upload, attach, and retry references without importing backend generated code.
- Add a selected-item enrichment panel with `Create crop & enrich`, real-crop preview, pending/generating status, marketplace preview, failure fallback, and retry.
- Disable crop attachment until `maskRevision > 0`.
- Component tests cover attach, ready comparison, and failure fallback; browser smoke confirms responsive layout and no console/request failures.

Run: `pnpm --filter @yard/lab test && pnpm --filter @yard/lab test:e2e && pnpm --filter @yard/lab build`

## Task 7: Prove One Live Stored Marketplace Image

**Files:** `apps/backend/scripts/smoke-product-images.ts`, `apps/backend/scripts/smoke-product-images.test.ts`, `apps/backend/package.json`, `package.json`, `.gitignore`

- Pick a ready fixture item, make a padded local rectangular crop with sharp, upload it through the same public crop API, and poll the seller view.
- Write an ignored report with only fixture/item labels, status, duration, revision, dimensions, and safe error code.
- Exit nonzero on timeout, missing real crop fallback, or failed live generation.

Run:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @yard/backend exec convex dev --once
pnpm smoke:product-images
```

**Acceptance:** At least one real crop and one GPT Image 2 JPEG are stored in Convex for the same current revision; the lab displays them side-by-side; failed/stale jobs preserve the real crop; routine and browser gates pass.
