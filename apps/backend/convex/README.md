# Yard Convex backend

Run `pnpm --filter @yard/backend dev` from the repository root to authenticate with Convex, create or select a development deployment, and generate `convex/_generated`.

Provider credentials belong in the Convex deployment environment, never in the web app:

```sh
pnpm --filter @yard/backend exec convex env set OPENAI_API_KEY your-key
pnpm --filter @yard/backend exec convex env set ROBOFLOW_API_KEY your-key
```
