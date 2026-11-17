# ONYX45 CRM — Visual Design System

## Single active theme
- Entry point: `src/main.tsx` imports `src/style.css` and **then** `src/crm-refresh.css` last.
- Component CSS is permitted for layout, but must use the same semantic color tokens.
- The old `executive.css` and `nightdrive.css` themes were deleted. Do not re-import them.
- GitHub Pages CI runs `node scripts/check-theme.mjs` before building. New hard-coded CSS colors outside the token definitions fail deployment.

## Official ONYX45 palette
| Token | Hex | Application |
|---|---|---|
| `--o45-bg` | `#0B0F12` | Primary background |
| `--o45-panel` | `#151C22` | Panels, input dark surfaces |
| `--o45-panel-raised` | `#1D262D` | Raised secondary panels |
| `--o45-border` | `#34424B` | Standard subtle borders |
| `--o45-border-strong` | `#495A63` | Focusable neutral outlines |
| `--o45-text` | `#F4F7FA` | Main text |
| `--o45-text-secondary` | `#C8D2D8` | Secondary text |
| `--o45-muted` | `#94A6B1` | Metadata and muted text |
| `--o45-accent` | `#B1FF69` | CTA, active navigation, success |
| `--o45-accent-hover` | `#CBFFA0` | CTA hover |
| `--o45-accent-soft` | `#243622` | Subtle selection backgrounds |
| `--o45-danger` | `#FF9FA7` | Errors, destructive actions |
| `--o45-danger-bg` | `#3A252A` | Destructive/error surface |
| `--o45-warning` | `#F5C58B` | Warnings and unsaved edits |
| `--o45-success-bg` | `#22372B` | Success background |

## Rules
1. Never introduce bordeaux, purple, gold or a second accent color into the product UI.
2. Use **one** stylesheet as the final theme authority, imported after other component CSS.
3. Keep typography Inter / system sans-serif across the CRM. Don't introduce Georgia/serif headers.
4. Buttons are compact with 4–6 px radii, high-contrast text and lime only for primary actions.
5. Use subtle boundaries rather than thick colored outlines around every card.
6. Keep CRM notes visible above the fold in a two-pane workspace wherever screen dimensions allow.
7. Preserve reduced-motion support and accessible keyboard focus.

## Change process
Edit semantic tokens in `src/crm-refresh.css`, not hundreds of component colors. Use `var(--o45-...)` for new CSS declarations and let the CI guard detect drift.
