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
- A slide-in panel? → `Sheet` (exists)
- A bottom-sheet / mobile drawer? → `Drawer` (exists)

If shadcn/ui has a component for it, that is the answer — not hand-rolling `<div>` soup.

## Principles

### 1. shadcn/ui Is the Foundation

Every UI component starts as a shadcn/ui component. You own the generated code and can tweak it, but the skeleton, accessibility, keyboard navigation, and composition patterns come from shadcn/ui.

**CLI workflow:**

```sh
# 1. Generate into apps/web (where components.json lives)
npx shadcn@latest add <component> -c apps/web --yes

# 2. Move the generated file out of the web app into the shared package
mv apps/web/src/components/ui/<component>.tsx packages/ui/src/components/ui/

# 3. Add the export to the shared barrel
# packages/ui/src/index.ts → export * from './components/ui/<component>'
```

- The `-c apps/web` flag is required because `components.json` lives at `apps/web/components.json` and defines the path aliases that shadcn uses for generation
- Never hand-write Radix primitives — shadcn/ui already wired them
- After moving, update the barrel at `packages/ui/src/index.ts`

### 2. Design Tokens, Not Scattered Classes

All color, radius, spacing, and typography decisions live in CSS custom properties in `apps/web/src/styles/globals.css`. Components reference tokens (`bg-primary`, `text-muted-foreground`, `rounded-lg`) — never hardcode hex values or arbitrary Tailwind values in component files.

**Critical Tailwind v4 rules for this file:**

- The `@source` directive **must** be present so Tailwind scans class names inside `packages/ui`. Without it, shared component classes get purged in production:
  ```css
  @source '../../node_modules/@eskwelabs-advisor/ui/src';
  ```
- Custom utilities use `@utility` syntax (v4 only — not `@layer utilities` + plugin):
  ```css
  @utility no-scrollbar {
    scrollbar-width: none;
    &::-webkit-scrollbar {
      display: none;
    }
  }
  ```
- Custom variants use `@custom-variant` (v4 only):
  ```css
  @custom-variant dark (&:is(.dark *));
  @custom-variant data-open {
    &:where([data-state='open']) {
      @slot;
    }
  }
  ```

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

---

## Responsive Design

**Every component must be built mobile-first.** The app is used on phones. If a layout breaks below 768px, it is a bug.

### Breakpoint System

The design system uses Tailwind v4 breakpoints. A custom `xs` breakpoint is registered in `globals.css`:

```css
@theme inline {
  --breakpoint-xs: 30rem; /* 480px */
}
```

| Prefix    | Min-width | Use for                                  |
| --------- | --------- | ---------------------------------------- |
| (default) | 0px       | Mobile — the baseline, always start here |
| `xs:`     | 480px     | Large phones, small phablets             |
| `sm:`     | 640px     | Landscape phones, small tablets          |
| `md:`     | 768px     | Tablets, small laptops                   |
| `lg:`     | 1024px    | Laptops, desktops                        |
| `xl:`     | 1280px    | Wide desktops                            |

**Negative / exclusion variants** are also available and preferred over duplicating classes when you want to apply something _only_ below a breakpoint:

| Variant   | Meaning                     | Use case                   |
| --------- | --------------------------- | -------------------------- |
| `max-md:` | Applies only below `md:`    | "Only on mobile" overrides |
| `not-md:` | Applies at all except `md:` | "Not at this exact width"  |

Example: `max-md:flex-col` means stack vertically on everything below 768px.

### Core Responsive Rules

**1. Mobile-first, always.** Write base styles for mobile. Add `sm:` / `md:` / `lg:` overrides for larger screens.

```tsx
// ✅ Correct — starts mobile, scales up
<div className="flex flex-col gap-4 md:flex-row md:gap-8">

// ❌ Wrong — assumes desktop, tries to fix mobile later
<div className="flex flex-row gap-8 max-md:flex-col max-md:gap-4">
```

**2. Viewport units.** Use `h-dvh` / `w-dvw` instead of `h-screen` / `w-screen` on mobile — dynamic viewport units account for the browser chrome that appears/disappears when scrolling on iOS/Android.

```tsx
<div className="h-dvh w-dvw overflow-hidden">
```

**3. Safe-area insets.** Fixed bottom bars, floating buttons, and docked footers must account for the iOS home bar and Android navigation bar. Use `env(safe-area-inset-bottom)`:

```tsx
// Floating action bar, safe on all devices
<div className="fixed bottom-[calc(env(safe-area-inset-bottom)+3rem)] left-2 right-2 z-50">
```

**4. Touch gestures on mobile.** Sheet/drawer components that slide in from a side should handle swipe-to-close on mobile. Use `onTouchStart` / `onTouchMove` with a delta threshold (e.g., 48px). Use `window.matchMedia('(max-width: 639px)')` to gate gesture handling to mobile only.

**5. Fluid typography.** For large display headings (hero text, page titles), use `clamp()` instead of fixed sizes so text scales gracefully between breakpoints:

```css
h1,
.cg-h1 {
  font-size: clamp(2.5rem, calc(1.5rem + 3vw), 5rem);
  line-height: 1.1;
}
```

For everything else (body, labels, captions), use the standard Tailwind type scale (`text-sm`, `text-base`, `text-lg`), then override at breakpoints where needed (`sm:text-xs`, `md:text-base`).

**6. Responsive grids.** Always declare a single-column base, then expand:

```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
```

**7. Navigation on small screens.** Full sidebars collapse on mobile. Use `Sheet` (shadcn/ui) for a slide-in drawer on mobile that becomes a persistent sidebar on `md:`. Icons-only nav on `sm:`, labels visible on `md:`.

**8. Sheet sizing on mobile.** Sheets that are full-screen on mobile narrow on larger screens:

```tsx
// Full-width on mobile, fixed width on xs+
<SheetContent className="w-dvw xs:w-96 p-0">
```

**9. Hidden / visible patterns.** Use `hidden md:block` / `block md:hidden` to swap layout sections between mobile and desktop — not conditional rendering in JS (which causes hydration mismatches).

```tsx
// Desktop sidebar panel — hidden on mobile
<div className="hidden md:flex md:h-dvh md:w-2/5 md:flex-col">

// Mobile stepper shown above fold — hidden on desktop
<div className="px-6 pt-2 pb-4 md:hidden">
```

**10. Container queries for components.** When a component needs to adapt to its _container_ width rather than the viewport (e.g., a card that lives in different column widths), use Tailwind's `@container` / `@md:` container query modifiers instead of viewport breakpoints.

```tsx
<div className="@container">
  <div className="flex flex-col @md:flex-row">
```

**11. Logo and branding in nav.** On mobile, the logo often moves inside a scrollable pill nav to save vertical space. On desktop it sits in its own fixed position. Implement with `hidden sm:block` / `sm:hidden` on the two instances:

```tsx
<a className="min-w-21 hidden font-serif text-3xl sm:block">kubo</a>;
{
  /* inside pill on mobile */
}
<a className="px-1 font-serif text-lg sm:hidden">kubo</a>;
```

**12. Layout components over inline wrappers.** Use the shared layout components (`Container`, `Stack`, `Grid`) instead of repeating inline `<div className="mx-auto max-w-5xl px-6 py-10">` across every page. This keeps spacing consistent and makes global layout changes a single edit.

```tsx
// ✅ Correct — uses layout components
<Container>
  <Stack gap={6}>
    <Grid cols={{ base: 1, sm: 2, lg: 3 }} gap={4}>
      {/* cards */}
    </Grid>
  </Stack>
</Container>

// ❌ Avoid — inline soup that varies per page
<div className="mx-auto min-h-screen max-w-5xl flex-col gap-6 px-6 py-10">
```

If the layout component doesn't exist yet, create it in `packages/ui/src/components/layout/` following the same pattern as the existing shadcn components (compound component, CVA variants, `cn()` utility).

**13. Adaptive components.** When a component needs fundamentally different behavior on mobile vs desktop (not just layout — behavior), wrap both versions in a single component gated by `useMediaQuery`. This pattern is for components where the DOM structure changes, not for styling:

```tsx
// Dialog on desktop, Drawer on mobile — same trigger, same content
function ResponsiveModal({ children, ...props }) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isDesktop) {
    return <Dialog.Root {...props}>{children}</Dialog.Root>;
  }
  return <Drawer.Root {...props}>{children}</Drawer.Root>;
}
```

Reserve this for cases where CSS alone can't solve it (different component primitives). Never use it for layout — that's what responsive utilities are for.

**14. Scroll position preservation.** When the user filters a list and navigates away then returns, restore `scrollTop` from `sessionStorage`. This is critical on mobile where re-render jank is noticeable.

### Practical Checklist

Before marking any page or component as done, verify:

- [ ] Renders correctly at 375px (iPhone SE) without horizontal overflow
- [ ] Renders correctly at 768px (tablet)
- [ ] Renders correctly at 1280px (desktop)
- [ ] Fixed/floating elements account for `safe-area-inset-bottom`
- [ ] `h-dvh` used instead of `h-screen` wherever full viewport height is needed
- [ ] No text overflows or truncates unexpectedly at any breakpoint
- [ ] Touch targets are at minimum 44×44px on mobile (use `size-11` minimum for interactive elements)
- [ ] Toaster/notification position adapts (`top-center` on mobile, `bottom-right` on desktop)
- [ ] Modals and sheets use `w-dvw xs:w-96` or similar — never a fixed px width that clips on small screens

### Responsive Toaster Positioning

The Toaster component position must adapt based on context:

```tsx
// Derive position based on route and viewport
const isSmallScreen = useMediaQuery('(max-width: 767px)');
const toasterPosition = isApplyPage
  ? isSmallScreen
    ? 'top-center'
    : 'bottom-left'
  : 'bottom-right';
```

### Detecting Viewport Width in React

For JS-driven responsive logic (e.g., conditional rendering where CSS alone can't help), use the hooks in `packages/ui/src/hooks/`:

| Hook                       | Returns                                         | Use case                                           |
| -------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| `useMediaQuery(query)`     | `boolean` — whether the query matches           | Generic media query check                          |
| `useIsMobile(breakpoint?)` | `boolean` — defaults to `(max-width: 767px)`    | Mobile gating for touch handlers, toaster position |
| `useBreakpoint()`          | `'xs' \| 'sm' \| 'md' \| 'lg' \| 'xl' \| '2xl'` | When you need the current named breakpoint         |

```tsx
import { useMediaQuery, useIsMobile } from '@eskwelabs-advisor/ui/hooks';

const isDesktop = useMediaQuery('(min-width: 768px)');
const isMobile = useIsMobile();
```

> **Caution:** Avoid JS-driven breakpoints for layout. CSS classes (`hidden md:block`) are always the first choice. Use the hook only when DOM behaviour (e.g., touch handler activation, toaster position, component primitive switching) must change.

---

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
Does it need to adapt to screen size?        Move to packages/ui/src/components/ui/
  ↓                                          Add export to packages/ui/src/index.ts
Apply responsive classes (mobile-first)      Done
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
- If a PR doesn't mention mobile, it is incomplete
