# ONYX45 CRM — Heritage Bordeaux 2.0 (official active palette)

The currently requested color direction is **Heritage Bordeaux 2.0**, not the old lime/charcoal theme.

| Purpose | Hex | Token |
|---|---|---|
| Background | `#211B1E` | `--o45-bg` |
| Espresso panels | `#322629` | `--o45-panel` |
| Raised surfaces | `#42323A` | `--o45-panel-raised` |
| Bordeaux action | `#552632` | `--o45-bordeaux` |
| Ivory text | `#F2EBE2` | `--o45-text` |
| Heritage Blue | `#AFC3CF` | `--o45-blue` |
| Rose Taupe highlights | `#BCA4A2` | `--o45-accent` |
| Plum hover/detail | `#776174` | `--o45-plum` |
| Borders | `#705A62` | `--o45-border` |

Keep the simplified two-pane CRM, integrated dashboard reports, and existing data, but apply the Bordeaux theme consistently. The former green accent `#B1FF69` is **not** part of this active theme.

The entry point imports `src/style.css` and then `src/crm-refresh.css`; component CSS uses semantic `--o45-*` tokens. Avoid hard-coded colors in components. `node scripts/check-theme.mjs` is required by CI before deployment.
