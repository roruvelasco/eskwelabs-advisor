# Eskwelabs Advisor

Skeleton monorepo for a Next.js, Hono, TypeScript, Supabase-oriented internal AI advisor platform.

This repo intentionally contains architecture stubs rather than product-complete behavior. The folders mirror the backend and frontend hierarchy that future implementation work should follow.

## Commands

- `bun install --frozen-lockfile`
- `bun run dev`
- `bun run check`
- `bun run lint`
- `bun run format`
- `bun run format:fix`
- `bun run build`
- `bun run test`

## Shape

- `apps/web` is the Vercel-deployed Next.js app.
- `packages/server` contains the Hono backend mounted by the Next API route.
- `packages/ui` contains shared React UI components.
- `packages/apps-config` and `packages/typescript-config` contain shared tooling defaults.
