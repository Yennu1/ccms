---
name: ccms-frontend-design
description: The authoritative design system and frontend conventions for CCMS (Centry Church Management System). ALWAYS use this skill for any CCMS frontend work — building or editing components, pages, dashboards, modals, charts, tables, forms, dark mode, or styling of any kind. Trigger whenever the working directory is the CCMS repo, the user mentions CCMS/Centry, or any church-management UI is being built, even if the request doesn't mention "design." Do NOT apply this skill to GCTU school assignments or non-CCMS projects.
---

# CCMS Frontend Design System

CCMS is a multi-tenant church management SaaS for Ghanaian churches. Its UI must feel professional, trustworthy, and warm — church administrators are often non-technical volunteers. Every frontend change follows this document.

## 1. Design tokens

### Colors
| Token | Hex | Use for |
|---|---|---|
| Navy | `#1B2352` | Primary brand, headings, sidebar background, primary buttons |
| Indigo | `#4F6BED` | Interactive elements, links, active states, chart primary series |
| Periwinkle | `#7B93F5` | Hover states, secondary chart series, accents |
| Mist | `#E8ECF9` | Page/card backgrounds, dividers, subtle fills |
| Gold | `#C8964A` | Highlights, badges, donation/finance emphasis — use sparingly |

Never introduce new brand colors. Semantic colors (success green, error red, warning amber) may be added but must be muted to sit alongside Navy/Indigo.

### Typography
| Font | Role |
|---|---|
| Plus Jakarta Sans | Headings and display text |
| IBM Plex Sans | Body text, UI labels, buttons, form fields |
| IBM Plex Mono | Member IDs, amounts (GH₵), dates, reference numbers — anything tabular/numeric |

Any monetary amount, ID, or date rendered in a table or card uses IBM Plex Mono. No exceptions — it is a CCMS signature.

### Dark mode
Dark mode is implemented across all pages using `--dm-*` CSS custom tokens. Every new component MUST:
- Use the existing `--dm-*` tokens, never hardcoded dark values
- Be verified in both light and dark mode before the task is considered done

## 2. Non-negotiable component rules

1. **Export buttons always come in pairs.** Every export control offers BOTH "Export as CSV" and "Export as Excel (.xlsx)". Never build a single-format export button. Applies to every module: Members, Donations, Events, Groups, and all future modules.
2. **Charts use Recharts 2.15.4.** Never upgrade to Recharts v3 — it breaks the build. Watch for the known axes silent-fail pattern when charts render empty.
3. **Settings live in a modal overlay**, not a separate page. Follow the established Settings modal pattern.
4. **Sidebar is collapsible.** New nav items must work in both expanded and collapsed states (icon-only when collapsed).
5. **Role-aware UI.** Components respect the four roles: `super_admin`, `admin`, `finance_officer`, `group_leader`. Finance data is hidden from group_leaders. When in doubt, ask which roles should see the element.
6. **Multi-tenant awareness.** Never render data without org/branch scoping; UI must assume RLS is the enforcement layer but should not *display* cross-tenant affordances.

## 3. Stack constraints

- React 19; Recharts pinned at 2.15.4
- Project path: `C:\dev\ccms-repo\ccms` (must stay outside OneDrive)
- `.env.local` must be recreated after every fresh clone — if the app renders blank or Supabase calls fail after a clone, check this FIRST
- Shell is Git Bash (MINGW64) — use Unix command syntax
- Vercel deploys from repo root with Root Directory = `ccms`; `.npmrc` contains `legacy-peer-deps=true`

## 4. Debugging protocol

Before debugging ANY UI issue, ask the user:

> "Can you see the element but it's broken/not working, or can you not see the element at all?"

- **Visible but broken** → logic/state/handler problem; inspect props, state, and event wiring
- **Not visible at all** → rendering path problem; check conditional rendering, role gating, route, CSS display, and data fetch (empty data + silent fail is a known CCMS pattern, especially with Recharts axes)

## 5. Tone of the UI

- Clarity over cleverness: church volunteers must never guess what a button does
- Ghanaian context: currency is GH₵; date format DD/MM/YYYY; MoMo is a first-class payment concept
- Empty states always explain what the section is for and how to add the first record
- Loading states for anything hitting Supabase; no unexplained blank panels

## 6. What this skill does NOT cover

- GCTU school assignments — never apply CCMS branding, colors, or fonts to them (they use the Calibri cover-page template)
- Backend/RLS policy design (separate concern; a future ccms-rls-review skill owns it)
- Marketing website styling, unless explicitly stated to share the app's design system
