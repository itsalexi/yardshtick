# Yard Hackathon Monorepo Architecture

**Date:** July 18, 2026  
**Status:** Approved for implementation planning

## Objective

Structure Yard as a pnpm and Turborepo monorepo so the frontend and AI/backend teams can work independently, share stable contracts, and integrate late in the hackathon without rewriting the frontend.

This design supplements the approved Yard technical specification. It does not change the product flow or replace Convex.

## Workspace Structure

```text
yardshtick/
├── apps/
│   ├── web/                 # Next.js product frontend
│   ├── lab/                 # Disposable Vite UI for live backend testing
│   └── backend/             # Convex schema, functions, and actions
├── packages/
│   ├── contracts/           # Zod schemas and inferred TypeScript types
│   ├── ai/                  # Provider clients and framework-independent AI logic
│   ├── mock-data/           # Validated frontend demo fixtures
│   ├── typescript-config/   # Shared TypeScript presets
│   └── eslint-config/       # Shared lint configuration
├── docs/
├── package.json
├── pnpm-workspace.yaml
└── turbo.json
```

The repository uses pnpm workspaces for package management and Turborepo for task orchestration and caching. Each app remains independently runnable and deployable.

## Ownership and Dependency Rules

The frontend team owns `apps/web`. The AI/backend team owns `apps/backend`, `apps/lab`, and `packages/ai`. Both teams jointly own `packages/contracts`. Mock fixtures belong in `packages/mock-data` rather than being embedded throughout frontend components.

Allowed dependency direction:

```text
apps/web       ──────> packages/contracts
apps/web       ──────> packages/mock-data
apps/lab       ──────> packages/contracts
apps/backend   ───> packages/contracts
apps/backend   ───> packages/ai
packages/ai    ───> packages/contracts
packages/mock-data -> packages/contracts
```

`apps/web` and `apps/lab` must not import from `apps/backend` or `packages/ai`. The lab uses named Convex function references and shared contracts instead of importing generated backend code. `packages/contracts` must not depend on any app, Convex-generated code, browser API, or provider SDK.

## Application Responsibilities

### Web application

`apps/web` contains the Next.js App Router experience for capture, scanning progress, scene overlays, listing editing, publishing, the public storefront, and reservations.

During parallel development, it runs against a mock implementation of a stable `YardService` interface. UI components consume service results and shared contract types rather than importing Convex functions directly.

The mock service simulates the important progressive states of the demo:

```text
uploaded -> discovering -> boxes available -> segmenting
         -> masks available -> refining -> listings ready -> published
```

Mock delays should be short and configurable so developers can inspect progressive UI behavior without slowing routine work.

### Backend lab application

`apps/lab` is a small Vite and React application for AI/backend development before the product frontend connects to Convex. It uploads fixture or custom scenes, starts real scans, subscribes to reactive progress, renders boxes and polygons, generates revisioned browser crops, and compares real crops with GPT Image 2 outputs.

The lab is internal tooling rather than a second product frontend. It has no product styling, routing system, authentication, or marketplace flows. It may be removed after final frontend integration.

### Backend application

`apps/backend` is the Convex backend from the approved technical specification. It owns:

- Convex schema, queries, mutations, and actions
- Canonical image and crop storage
- Scan orchestration and persisted progress
- OpenAI and Roboflow calls
- Publishing and atomic reservations
- Reactive seller and buyer state

Convex remains the deployed backend. A separate AI HTTP service is not part of the hackathon architecture.

### AI package

`packages/ai` contains framework-independent TypeScript logic that can be called from Convex actions:

- OpenAI and Roboflow provider adapters
- Prompt and model configuration
- Structured-output validation
- Coordinate conversion
- Candidate and mask validation
- Polygon utilities
- Prepared catalog matching and pricing

It does not own database access, Convex authorization, UI state, or HTTP routes. Provider clients receive keys and configuration from their caller rather than reading browser-exposed configuration.

### Shared contracts

`packages/contracts` is the integration boundary. It uses Zod schemas as the source of truth and exports inferred TypeScript types.

The initial contracts cover:

- Sale and processing state
- Scene candidates, boxes, points, and polygons
- Seller listing items and pricing strategies
- Public storefront data
- Service command inputs and results
- Safe, user-facing service errors

Convex document types and generated API types are implementation details. The backend adapter maps them into shared contract shapes before the frontend consumes them.

## Frontend Service Boundary

The frontend depends on a small capability-based interface rather than on transport details. Its operations cover the hackathon flow:

- Create a draft from an uploaded image
- Start a scan and observe progressive state
- Select or deselect an item
- Update listing fields and price
- Publish a sale
- Load a public storefront
- Reserve an available item
- Observe seller status

The frontend initially selects `MockYardService`. Final integration introduces `ConvexYardService`, which implements the same capabilities using Convex hooks and commands. Environment configuration selects the implementation; UI components do not branch on mock versus Convex behavior.

Reactive data does not need to be forced into a request/response abstraction. The service boundary may expose subscriptions or framework hooks where necessary, but both adapters must return the same contract shapes and processing states.

## Integration Sequence

1. Agree on shared contracts and representative fixtures.
2. Build the frontend against `MockYardService`.
3. Build Convex operations and AI orchestration against the same contracts.
4. Validate backend outputs through the shared Zod schemas.
5. Implement `ConvexYardService` as a thin frontend adapter.
6. Switch the frontend service configuration to Convex.
7. Run the complete rehearsed demo and fix contract mismatches at the adapter boundary.

Integration must not require redesigning UI components or moving AI logic into the frontend.

## Demo-Grade Reliability and Security

This is a hackathon demo, not a production marketplace. The implementation explicitly defers:

- Buyer and seller accounts
- Comprehensive authorization systems
- Production rate limiting and abuse prevention
- Audit trails and compliance controls
- Cleanup and data-retention jobs
- Production monitoring infrastructure
- Elaborate retry and recovery systems

The demo retains only safeguards required to protect credentials and preserve the presentation:

- OpenAI and Roboflow keys remain in Convex environment variables.
- Provider keys are never committed or shipped to the browser.
- Generated and provider data is validated before the UI consumes it.
- Roboflow failures fall back to bounding boxes.
- Missing prepared prices remain manually editable.
- Refinement failures retain initial listing content.
- Reservations use an atomic mutation so the live demo cannot double-reserve an item.

## Testing Scope

Testing is intentionally narrow:

- Shared fixtures must parse successfully through contract schemas.
- Coordinate conversion and prepared pricing receive focused unit tests.
- The web app receives one mocked happy-path test covering scan through publish.
- The backend receives one atomic reservation-conflict test.
- Provider clients use sanitized fixtures rather than paid calls in routine tests.
- Before presentation, the team runs one integrated walkthrough using the final scene and deployed services.

Linting, type checking, and tests run per workspace through Turborepo. Root commands operate across the repository, while filtered pnpm commands allow each team to work only on its app and dependencies.

## Definition of Done

The monorepo foundation is complete when:

- pnpm installs every workspace from the repository root.
- Turborepo can run development, build, lint, type-check, and test tasks where those tasks exist.
- The web, lab, and backend apps start independently.
- Package imports follow the documented dependency direction.
- The frontend can complete the rehearsed flow using validated mock fixtures.
- Shared contracts can be consumed by both apps.
- The AI package can be invoked from a Convex action without importing frontend code.
- Replacing the mock service with the Convex service does not require changing UI component contracts.

## Explicitly Out of Scope

- A standalone AI microservice
- Multiple product frontend applications beyond `apps/web`
- Shared component libraries before duplication exists
- Storybook or a dedicated design-system site
- Container orchestration
- Remote Turborepo caching setup
- Production authentication and authorization
- Production observability and data lifecycle automation
- Generalizing the packages for use outside Yard
