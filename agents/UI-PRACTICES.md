# UI Building Practices

## Golden Rule

**Never build from scratch.** Always check existing UI components first.
If a component doesn't exist yet, pull it from shadcn/ui before writing a single line of custom code.

## Think in shadcn Components

Before writing any JSX, ask yourself: _"What shadcn/ui component would a production app use here?"_

- A toggle? → `Switch` (already exists)
- A list of options? → `Select` or `RadioGroup` (exists)
- A modal? → `Dialog` (exists)
- A tabbed view? → `Tabs` (exists)
- A dropdown menu? → `DropdownMenu` (exists)
- A card with stats? → `Card` with `CardHeader`/`CardContent` (exists)
- A badge or tag? → `Badge` (exists)
- A table of data? → `Table` (exists)
- An avatar with fallback? → `Avatar` (exists)
- A collapsible section? → `Accordion` or `Collapsible` (Accordion exists)
- A popover with info? → `Popover` (exists)
- A progress step flow? → shadcn has no `Stepper` — build with `Card` + `Separator` + `Badge`
- A file upload? → shadcn has `Input type="file"` (Input exists)

If shadcn/ui has a component for it, that is the answer — not hand-rolling `<div>` soup.

## Principles

### 1. shadcn/ui Is the Foundation

Every UI component starts as a shadcn/ui component. You own the generated code and can tweak it, but the skeleton, accessibility, keyboard navigation, and composition patterns come from shadcn/ui.

- Use `npx shadcn@latest add` to install new components
- Components live in `packages/ui/src/components/ui/`
- Never hand-write a Radix wiring — shadcn/ui already did it
- After adding, move to the shared package and update the barrel

### 2. Design Tokens, Not Scattered Classes

All color, radius, spacing, and typography decisions live in CSS custom properties in `apps/web/src/styles/globals.css`. Components reference tokens (`bg-primary`, `text-muted-foreground`, `rounded-lg`) — never hardcode hex values or arbitrary Tailwind values in component files.

| Token                            | Purpose                   |
| -------------------------------- | ------------------------- |
| `--background`                   | Page background           |
| `--foreground`                   | Default text              |
| `--primary`                      | Primary action color      |
| `--primary-foreground`           | Text on primary           |
| `--ring`                         | Focus ring                |
| `--muted` / `--muted-foreground` | Secondary text / surfaces |
| `--radius`                       | Base border radius        |
| `--font-sans` / `--font-serif`   | Typeface tokens           |

To change the look of the app, edit the CSS variables — not 30 component files.

### 3. Composition Over Configuration

Components follow the compound-component pattern:

```
Dialog.Root → Dialog.Trigger → Dialog.Content → Dialog.Header → Dialog.Title → Dialog.Description
```

This keeps each piece small, testable, and recombinable. Never build a monolithic "mega-component" that takes 15 props to configure its internals.

### 4. Everything Is Modular

- One component = one directory with an `index.ts` barrel export
- Sub-components are siblings in the same directory
- Variants via `class-variance-authority` (CVA), not conditional logic
- Shared utilities (`cn`, type helpers) in `packages/ui/src/utils/`

### 5. Subtle Motion, Not Noise

Animations should feel like the app is alive — not like a PowerPoint transition.

- Use `tw-animate-css` for enter/exit animations
- Use custom motion utilities for hover interactions: `.motion-lift` (hover raises), `.motion-press` (click scales down), `.motion-pop` (appear with bounce)
- Always respect `prefers-reduced-motion`

### 6. Elegant > Novel

The app should feel refined, not "designed." No "vibe-coded" aesthetics — no random gradients, no purple/blue mishmashes, no conflicting shadows, no decorative elements that serve no purpose. That means:

- Consistent border radius (start with `--radius: 0.625rem`)
- Same type scale everywhere
- Same spacing rhythm (use Tailwind's built-in scale)
- Serif typeface for headings, sans-serif for body
- Focus rings that are visible but not aggressive
- Cards with subtle shadows and thin borders (0.5px)
- A restrained color palette: one primary (emerald green `#2d6a4f`), one accent (warm gold `#d4a373`), and neutral tones. Nothing else.
- No hand-painted gradients, no glow effects, no decorative blobs
- No purple. No hot pink. No neon.

Every component gets a once-over after generation: tighten the spacing, soften the shadow, add a motion-lift. The skeleton is shadcn/ui; the feel is ours.

### 7. Accessibility Is Not Optional

- All Radix-based components inherit ARIA attributes for free
- Manual components get `role`, `aria-label`, `aria-disabled` as needed
- Focus management, keyboard navigation, and screen-reader text are part of every component
- The `cn()` utility handles conditional classes without breaking accessibility

## Workflow

```
Need a UI element?
  ↓
What shadcn/ui component would this be?
  ↓
Check packages/ui/src/components/ui/ — does it exist?
  ↓                                          ↓
YES → Use it.                                NO → npx shadcn@latest add <component> -c apps/web --yes
  ↓                                               ↓
Done                                        Move to packages/ui/src/components/ui/
                                            Add export to packages/ui/src/index.ts
                                            Done
```

## Design System Evolution

The design token CSS file (`globals.css`) is the single source of truth. When the visual direction evolves:

1. Update the CSS variables
2. Verify components still look right (they will, since everything references tokens)
3. Done

No component rewrites. No class-name scavenger hunts.

## Maintaining Consistency

- Run `bun run format:fix` (Prettier) to keep Tailwind class ordering consistent
- Run `bun run lint` to catch accessibility and style issues
- Review component PRs against this doc — every new component should feel like it belongs to the same family
- If a PR adds a gradient, a glow, or a new accent color, ask: _"Does this match the palette? Is there a simpler way?"_
