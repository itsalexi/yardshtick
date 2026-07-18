# Yard

Yard turns one photo of a pile of objects into editable garage-sale listings and a shareable storefront. This repository is a pnpm and Turborepo monorepo built for parallel hackathon development.

## Workspaces

| Workspace | Responsibility |
|---|---|
| `apps/web` | Next.js frontend, currently backed by typed mock data |
| `apps/backend` | Convex backend and AI orchestration |
| `apps/lab` | Standalone Vite interface for testing live scans and overlays |
| `packages/contracts` | Shared Zod schemas and TypeScript types |
| `packages/ai` | Framework-independent AI and geometry logic |
| `packages/mock-data` | Validated demo fixtures |

## Setup

Requires Node.js 24+ and pnpm 10.33.2.

```sh
pnpm install
pnpm dev
```

Run a single app during parallel development:

```sh
pnpm --filter @yard/web dev
pnpm --filter @yard/backend dev
pnpm --filter @yard/lab dev
```

The web app runs without Convex by using `MockYardService`. Starting the backend for the first time launches Convex setup and generates `apps/backend/convex/_generated`.

Seed and test the AI pipeline without starting the product frontend:

```sh
pnpm dataset:seed
pnpm --filter @yard/lab dev
```

The lab reads `VITE_CONVEX_URL` from `apps/lab/.env.local`, lists the six seeded fixtures, uploads custom JPEG/PNG/WebP scenes, starts scans, and displays reactive boxes, polygons, metrics, and safe errors. Provider keys stay in the Convex deployment environment.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Integration Model

Frontend code depends on the `YardService` contract rather than Convex directly. During the final integration stretch, add a Convex implementation of that interface and select it in the web service factory. Shared response data must continue to validate through `@yard/contracts`.

See [the approved technical specification](docs/Yard-Technical-Spec-Roboflow-SAM2-v2.md) and [the monorepo architecture design](docs/superpowers/specs/2026-07-18-monorepo-architecture-design.md) for details.
