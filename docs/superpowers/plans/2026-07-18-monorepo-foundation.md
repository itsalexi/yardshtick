# Yard Monorepo Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a runnable pnpm and Turborepo foundation with independent web and Convex backend apps, shared contracts, AI utilities, validated mock data, and repository agent instructions.

**Architecture:** The Next.js app consumes shared Zod contracts and mock fixtures without importing backend code. The Convex app consumes the contracts and framework-independent AI package. Root Turborepo tasks coordinate builds, linting, type checks, and tests.

**Tech Stack:** pnpm 10, Turborepo, TypeScript, Next.js App Router, React, Convex, Zod, Vitest, ESLint.

## Global Constraints

- Keep `apps/web` independent from `apps/backend` and `packages/ai`.
- Keep provider credentials server-side; do not add real secrets.
- Optimize for a hackathon demo and avoid production infrastructure.
- Preserve the existing technical specification and design document.
- Use workspace package names under the `@yard` scope.

---

### Task 1: Root Workspace and Shared Tooling

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `.gitignore`
- Create: `.npmrc`
- Create: `packages/typescript-config/package.json`
- Create: `packages/typescript-config/base.json`
- Create: `packages/typescript-config/nextjs.json`
- Create: `packages/eslint-config/package.json`
- Create: `packages/eslint-config/base.mjs`

**Interfaces:**
- Produces root `dev`, `build`, `lint`, `typecheck`, and `test` commands.
- Produces reusable `@yard/typescript-config` and `@yard/eslint-config` packages.

- [ ] **Step 1: Add root workspace manifests and ignore rules**

Set `packageManager` to the installed pnpm 10 release, declare Turborepo as a root development dependency, include `apps/*` and `packages/*`, and define the root task scripts.

- [ ] **Step 2: Add shared TypeScript and ESLint presets**

Use strict TypeScript defaults with `noEmit`, and an ESLint flat configuration based on `@eslint/js` and `typescript-eslint`.

- [ ] **Step 3: Install dependencies and verify the task graph**

Run: `pnpm install && pnpm turbo ls`

Expected: pnpm generates a lockfile and Turborepo lists every created workspace.

### Task 2: Shared Contracts, AI Utilities, and Mock Fixtures

**Files:**
- Create: `packages/contracts/package.json`
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/src/contracts.test.ts`
- Create: `packages/ai/package.json`
- Create: `packages/ai/tsconfig.json`
- Create: `packages/ai/src/index.ts`
- Create: `packages/ai/src/coordinates.ts`
- Create: `packages/ai/src/coordinates.test.ts`
- Create: `packages/mock-data/package.json`
- Create: `packages/mock-data/tsconfig.json`
- Create: `packages/mock-data/src/index.ts`

**Interfaces:**
- Produces `PixelBox`, `SceneCandidate`, `YardItem`, `SaleView`, `Storefront`, and `YardService` from `@yard/contracts`.
- Produces `normalizedBoxToPixels` and `pixelBoxToRoboflowBox` from `@yard/ai`.
- Produces validated `demoSale` and `demoStorefront` from `@yard/mock-data`.

- [ ] **Step 1: Write contract and coordinate tests**

Assert that the demo-oriented sale shape parses, invalid prices fail, and normalized coordinates convert to the expected canonical pixels.

- [ ] **Step 2: Run the tests to establish the initial failure**

Run: `pnpm --filter @yard/contracts test && pnpm --filter @yard/ai test`

Expected: commands fail because the implementations do not yet exist.

- [ ] **Step 3: Implement focused shared contracts and coordinate utilities**

Use Zod schemas as the runtime source of truth and inferred TypeScript types as the compile-time API. Keep service methods transport-neutral and asynchronous.

- [ ] **Step 4: Add fixtures validated at module load**

Create one six-item demo sale with progressive-ready boxes, optional polygons, three prices, and public storefront data.

- [ ] **Step 5: Run package tests and type checks**

Run: `pnpm --filter @yard/contracts test && pnpm --filter @yard/ai test && pnpm typecheck`

Expected: all commands pass.

### Task 3: Independent Web and Convex Applications

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.ts`
- Create: `apps/web/eslint.config.mjs`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/src/services/yard-service.ts`
- Create: `apps/web/src/services/mock-yard-service.ts`
- Create: `apps/backend/package.json`
- Create: `apps/backend/tsconfig.json`
- Create: `apps/backend/convex.json`
- Create: `apps/backend/convex/schema.ts`
- Create: `apps/backend/convex/README.md`

**Interfaces:**
- Web consumes `YardService` through `getYardService()` and defaults to `MockYardService`.
- Backend exposes an initial Convex schema for `sales` and `items` without being imported by the web app.

- [ ] **Step 1: Create the Next.js app with the mock service seam**

Build a minimal landing page that proves the shared contracts and mock fixture are usable. Keep visual feature work outside this foundation task.

- [ ] **Step 2: Create the Convex app skeleton**

Define minimal sales and items tables aligned with shared contract fields. Document `pnpm --filter @yard/backend dev` as the setup command that creates deployment-generated files.

- [ ] **Step 3: Verify both apps independently**

Run: `pnpm --filter @yard/web build && pnpm --filter @yard/backend typecheck`

Expected: Next.js builds and backend TypeScript validation passes without requiring the web app.

### Task 4: Repository Guidance and Final Verification

**Files:**
- Create: `AGENTS.md`
- Create: `CLAUDE.md`
- Modify: `README.md`

**Interfaces:**
- Produces the same architectural and workflow rules for Codex and Claude contributors.

- [ ] **Step 1: Add root agent guidance**

Document workspace ownership, allowed dependencies, commands, hackathon scope, shared-contract policy, and secret handling. Make `CLAUDE.md` reference the canonical `AGENTS.md` rules and add Claude-specific reminders without duplicating the full document.

- [ ] **Step 2: Add contributor setup documentation**

Document installation, filtered development commands, mock-first frontend work, Convex initialization, and final adapter integration.

- [ ] **Step 3: Run full repository verification**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`

Expected: every configured workspace task succeeds through Turborepo.

- [ ] **Step 4: Review repository state**

Run: `git diff --check && git status --short`

Expected: no whitespace errors; only intentional monorepo files and the pre-existing untracked technical specification are present.

