# Item Review Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace labeled scene detections with exclamation markers and turn item confirmation into a one-item-at-a-time review flow with simulated AI-photo generation, retry, replacement upload, and last-item-only publishing.

**Architecture:** Keep the `YardService` and shared contracts unchanged because photo generation is explicitly a frontend demo simulation. Put deterministic review navigation and photo-state transitions in a small pure model, render one selected `YardItem` at a time in a focused client component, and let the scan page own orchestration and publishing.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Vitest 4, existing Yard CSS tokens, static generated demo assets.

## Global Constraints

- `apps/web` remains usable against `MockYardService`.
- Do not import backend or AI implementation code into `apps/web`.
- Preserve the box-only fallback throughout the AI pipeline.
- The new generation behavior is a frontend-only timed simulation and does not add provider calls or shared contract fields.
- Use pnpm and add no new dependency unless the existing test stack cannot express a required assertion.
- Preserve unrelated work and do not hand-edit generated files.

---

### Task 1: Review State Model

**Files:**
- Create: `apps/web/src/features/item-review/model.ts`
- Create: `apps/web/src/features/item-review/model.test.ts`

**Interfaces:**
- Consumes: ordered selected item IDs and the current active index.
- Produces: `createPhotoStates(itemIds)`, `moveReviewIndex(index, direction, count)`, `retryPhoto(state)`, and `replacePhoto(state, previewUrl)`.

- [ ] **Step 1: Write failing tests for bounded previous/next navigation**

```ts
expect(moveReviewIndex(0, -1, 6)).toBe(0);
expect(moveReviewIndex(0, 1, 6)).toBe(1);
expect(moveReviewIndex(5, 1, 6)).toBe(5);
```

- [ ] **Step 2: Run `pnpm --filter @yard/web test -- model.test.ts` and confirm the imports fail because the model does not exist**

- [ ] **Step 3: Implement the smallest bounded navigation function**

```ts
export function moveReviewIndex(index: number, direction: -1 | 1, count: number) {
  return Math.max(0, Math.min(index + direction, count - 1));
}
```

- [ ] **Step 4: Add failing tests for initial generation, retry revision, and uploaded replacement state**

```ts
expect(createPhotoStates(["item_camera"]).item_camera.status).toBe("generating");
expect(retryPhoto({ status: "ready", source: "generated", revision: 0 }).revision).toBe(1);
expect(replacePhoto({ status: "generating", source: "generated", revision: 0 }, "blob:test")).toEqual({
  status: "ready",
  source: "upload",
  revision: 0,
  previewUrl: "blob:test",
});
```

- [ ] **Step 5: Implement typed immutable photo-state helpers and rerun the focused test until it passes**

### Task 2: Detection Marker Rendering

**Files:**
- Modify: `apps/web/src/components/scene-view.tsx`
- Create: `apps/web/src/components/scene-view.test.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: the existing `YardItem[]`, scanning state, visible count, and tap callback.
- Produces: accessible detection buttons whose visible marker is `!` while their `aria-label` still contains the item title.

- [ ] **Step 1: Write a server-render test that rejects visible item-title labels and requires one `box-marker` exclamation per rendered item**

```tsx
const html = renderToStaticMarkup(<SceneView items={[item]} />);
expect(html).toContain('class="box-marker"');
expect(html).toContain(">!</span>");
expect(html).not.toContain('class="box-label"');
```

- [ ] **Step 2: Run `pnpm --filter @yard/web test -- scene-view.test.tsx` and confirm it fails on the existing `box-label` output**

- [ ] **Step 3: Replace the visible title label with an exclamation marker, retain the accessible title, and update scene CSS for a compact centered badge**

- [ ] **Step 4: Rerun the focused scene test and confirm it passes**

### Task 3: Fullscreen Item Review and Photo Simulation

**Files:**
- Create: `apps/web/src/features/item-review/item-review.tsx`
- Create: `apps/web/src/features/item-review/item-review.test.tsx`
- Modify: `apps/web/app/globals.css`
- Create: `apps/web/public/generated/camera.png`
- Create: `apps/web/public/generated/speaker.png`
- Create: `apps/web/public/generated/shoes.png`
- Create: `apps/web/public/generated/bag.png`
- Create: `apps/web/public/generated/keyboard.png`
- Create: `apps/web/public/generated/lamp.png`

**Interfaces:**
- Consumes: `items`, `activeIndex`, `photoStates`, `onPhotoReady`, `onRetryPhoto`, `onUploadPhoto`, `onPatch`, `onRemove`, `onPrevious`, `onNext`, and `onPublish`.
- Produces: one viewport-filling item editor, generation skeleton, image controls, item counter, previous/next navigation, and a publish action only when `activeIndex === items.length - 1`.

- [ ] **Step 1: Write server-render tests requiring only the active item title, a generation skeleton for generating state, and no publish action before the last item**

```tsx
expect(html).toContain("Fujifilm Instax Mini 12");
expect(html).not.toContain("JBL Flip 6 Speaker");
expect(html).toContain('aria-label="Generating product photo"');
expect(html).not.toContain(">Publish<");
```

- [ ] **Step 2: Run `pnpm --filter @yard/web test -- item-review.test.tsx` and confirm the missing component produces the expected failure**

- [ ] **Step 3: Implement the active-item editor with the existing title, condition, and price controls plus a large photo stage**

- [ ] **Step 4: Add a `1.2s + activeIndex * 120ms` effect that calls `onPhotoReady(item.id)` while a generated photo is in the generating state**

- [ ] **Step 5: Add Retry photo and Upload your own photo controls; the hidden file input accepts `image/*` and passes `URL.createObjectURL(file)` to `onUploadPhoto`**

- [ ] **Step 6: Add previous/next controls, show Next for non-last items, and show Publish only for the last item**

- [ ] **Step 7: Generate six cohesive AI-styled studio product-photo assets, add responsive and reduced-motion CSS, then rerun the focused component test**

### Task 4: Scan Flow Integration and Verification

**Files:**
- Modify: `apps/web/app/scan/[saleId]/page.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: `ItemReview` and the review state model.
- Produces: confirmation initializes active item zero and generation states, navigation changes one fullscreen item at a time, deselection safely clamps the index, and publishing remains delegated to `YardService.publishSale`.

- [ ] **Step 1: Write a failing integration-model test proving a removed last item clamps the active index to the new last item**

```ts
expect(normalizeReviewIndex(5, 5)).toBe(4);
```

- [ ] **Step 2: Run the focused model test and confirm the missing normalization helper fails**

- [ ] **Step 3: Add confirmation-entry, photo simulation, retry/upload, previous/next, and removal state to the scan page, replacing the mapped card list with `ItemReview`**

- [ ] **Step 4: Run `pnpm --filter @yard/web test`, `pnpm --filter @yard/web lint`, `pnpm --filter @yard/web typecheck`, and `pnpm --filter @yard/web build`**

- [ ] **Step 5: Run root `pnpm lint && pnpm typecheck && pnpm test && pnpm build` because the scan page is a core demo boundary**
