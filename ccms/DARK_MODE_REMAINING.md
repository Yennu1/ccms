# Dark Mode — Remaining Work

This is a follow-up to the **"Complete dark mode foundation"** change, which shipped the
working pieces of dark mode:

- `useTheme.ts` hook + `ThemeToggle` mounted in the TopBar (toggles the `.dark` class on
  `document.documentElement`, persisted to `localStorage('ccms-theme')`).
- The full `--dm-*` design-token family **defined** in `src/index.css` under both `:root`
  (light) and `.dark` (dark). These were referenced across the app but never defined, which
  is why some pages had transparent/"missing" backgrounds in dark mode.
- The app shell converted to be theme-aware: `TopBar.tsx`, `Sidebar.tsx` (dropdown), and
  `AppLayout.tsx` (`<main>` background).

After that change, dark mode **works** on: the shell (TopBar, Sidebar, AppLayout) and the
**7 pages already wired to `--dm-*` tokens**: Reports, Event Detail, Transaction Detail,
Group New, Ministry New, Login, Not Found.

## What's still light-only

There are **no Tailwind `dark:` variants anywhere** in the codebase. The pages below were
never made theme-aware — they use **hardcoded light hex values in inline `style={{}}`
objects**, so they render fully light in dark mode regardless of the `.dark` class.

The counts are **`background` declarations only**. Hardcoded text colours (`#111827`,
`#374151`, `#6B7280`, `#9CA3AF`) and borders (`#E5E7EB`, `#E6E8F0`, `#EFF1F7`, `#D1D5DB`)
are on top of these and also need converting.

| Area | Files (hardcoded `background` counts) |
|---|---|
| Members | `MemberProfilePage` **34**, `HouseholdProfilePage` 12, `MembersPage` 9, `HouseholdsPage` 7, `HouseholdNewPage` 6, `MemberEditPage` 5, `MemberNewPage` 4 |
| Groups | `GroupDetailPage` **23**, `MinistryDetailPage` 15, `MinistriesPage` 8 |
| Donations | `DonationsPage` 13, `RecordGivingPage` 13, `EditTransactionPage` 10, `AddPledgePage` 6, `EditPledgePage` 6, `PledgesPage` 6 |
| Events | `EventsListPage` 13, `CreateEventPage` 4, `CalendarViewPage` 3, `EditEventPage` 3 |
| Dashboard | `DashboardPage` 14 |
| Other | `ExportModal` 2, `SettingsPage` 1 |

**Total: 217 hardcoded `background` declarations across 23 files** (backgrounds only).

## How to convert (use the existing `--dm-*` tokens)

Replace hardcoded hex with the tokens defined in `src/index.css`. They already carry correct
light + dark values, so no `dark:` logic is needed — they switch with the `.dark` class.

| Hardcoded value | Replace with | Notes |
|---|---|---|
| `#fff` (card / panel / input / menu surface) | `var(--dm-bg-card)` (or `--dm-bg-surface`) | |
| `#F4F5F7` (page / inset) | `var(--dm-bg-page)` (or `--dm-bg-muted`) | |
| `#F9FAFB` (zebra / subtle fill) | `var(--dm-bg-muted)` (or `--dm-bg-subtle`) | |
| `#E8ECF9` (mist tint) | `var(--dm-bg-tint)` | |
| `#111827` (ink / headings) | `var(--dm-text-ink)` | |
| `#374151` (body) | `var(--dm-text-body)` | |
| `#6B7280` (secondary) | `var(--dm-text-secondary)` | |
| `#9CA3AF` (muted) | `var(--dm-text-muted)` | |
| `#E5E7EB` / `#E6E8F0` / `#EFF1F7` (borders) | `var(--dm-border)` / `--dm-border-soft` / `--dm-border-subtle` | pick by visual weight |
| `#D1D5DB` (strong border) | `var(--dm-border-strong)` | |

### Do NOT convert (semantic / brand — correct in both themes)

- Brand: Indigo `#4F6BED`, Periwinkle `#7B93F5`, Navy `#1B2352` (sidebar), Gold `#C8964A`
- Status: Error `#EF4444`, Success `#22C55E`, Warning `#F59E0B`
- Intentionally-always-white elements: toggle-switch thumbs (e.g. `RecordGivingPage`,
  `CreateEventPage`, `EditTransactionPage`), avatar initials text.

> ⚠️ **Not a blind find-replace.** Several inline `#fff` values are toggle thumbs / avatar
> text that must stay white. Convert per-element, not per-file-sed.

## Charts caveat (Recharts — `ReportsPage`)

`--dm-chart-tick` / `--dm-chart-grid` are passed into Recharts SVG `stroke`/`fill`
attributes, where CSS `var()` can be unreliable. The tokens are defined, but verify the
charts actually pick them up; if not, set the colour via `currentColor` + a wrapper `style`,
or read the computed value in JS. Recharts stays on **v2.12.7** — do not change it.
