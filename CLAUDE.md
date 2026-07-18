# Claude Guide for Yard

Follow the canonical repository instructions in `AGENTS.md` before making changes.

Additional reminders for Claude-powered work:

- Keep the frontend mock-first until an integration task explicitly enables Convex.
- Respect the dependency direction in `AGENTS.md`; do not solve type errors by importing across app boundaries.
- Update Zod contracts before implementations when shared data changes.
- Prefer filtered pnpm commands while iterating, then run the root checks for cross-workspace changes.
- Treat this as a hackathon demo: protect provider credentials and preserve fallbacks, but avoid production-only infrastructure.
- Do not modify generated Convex files or the approved technical specification unless explicitly asked.
