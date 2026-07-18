# Yard Repository Guide

## Product

Yard is a hackathon demo that turns one photo of several objects into editable garage-sale listings and a shareable storefront. Read `docs/Yard-Technical-Spec-Roboflow-SAM2-v2.md` for the product pipeline and `docs/superpowers/specs/2026-07-18-monorepo-architecture-design.md` for workspace boundaries.

Optimize for a reliable demo, not production completeness. Do not add accounts, payment processing, marketplace integrations, elaborate security infrastructure, or unrelated platform abstractions unless explicitly requested.

## Workspace Ownership

- `apps/web`: Next.js frontend. It must remain usable against the mock service until final integration.
- `apps/backend`: Convex schema, queries, mutations, actions, storage, and orchestration.
- `packages/contracts`: Stable Zod schemas and inferred TypeScript types shared across teams.
- `packages/ai`: Framework-independent AI provider, geometry, validation, and pricing logic.
- `packages/mock-data`: Demo fixtures that validate against `@yard/contracts`.
- `packages/typescript-config` and `packages/eslint-config`: Shared tooling only.

## Dependency Rules

- `apps/web` may import `@yard/contracts` and `@yard/mock-data`.
- `apps/backend` may import `@yard/contracts` and `@yard/ai`.
- `@yard/ai` and `@yard/mock-data` may import `@yard/contracts`.
- Never import backend or AI implementation code into `apps/web`.
- Never import app code, Convex-generated types, browser APIs, or provider SDKs into `@yard/contracts`.
- Zod schemas are the source of truth for shared data. Infer TypeScript types from them.
- Keep Convex documents behind an adapter; UI components should consume shared contract shapes.

## Frontend and Backend Integration

Frontend components obtain data through the `YardService` boundary in `@yard/contracts`. During parallel development, `apps/web` uses `MockYardService`. Final integration adds a Convex-backed implementation without changing component contracts.

When changing a shared shape:

1. Update its Zod schema and contract test.
2. Update validated mock fixtures.
3. Update backend mapping code.
4. Update consumers only when the product contract intentionally changed.

## Commands

Run commands from the repository root:

```sh
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

Use filters for team-specific work:

```sh
pnpm --filter @yard/web dev
pnpm --filter @yard/backend dev
pnpm --filter @yard/contracts test
pnpm --filter @yard/ai test
```

Before handing work off, run the narrowest relevant tests followed by `pnpm lint && pnpm typecheck && pnpm test && pnpm build` when the change crosses workspace boundaries.

## Engineering Rules

- Use pnpm; do not introduce npm or Yarn lockfiles.
- Keep files focused and packages small. Do not create a shared UI library until actual duplication justifies one.
- Preserve the box-only fallback throughout the AI pipeline.
- Keep coordinate transformations explicit and tested.
- Store provider keys in Convex environment variables. Never expose or commit OpenAI or Roboflow keys.
- Do not hand-edit `apps/backend/convex/_generated`.
- Preserve unrelated work in the repository and avoid destructive Git commands.
- Add dependencies to the workspace that directly uses them rather than to the root.

## Demo Definition of Done

The core demo remains: upload one image, progressively show detected boxes and masks, generate editable items and prepared prices, publish a storefront, reserve an item in a second browser, and reflect the status live. Provider failures should degrade to usable boxes or editable data instead of blocking the flow.
