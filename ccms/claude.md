Open or create CLAUDE.md in the project root and add this section:

## Skills

Before building any UI component, page, or layout, read and apply:
- .claude/skills/frontend-design.md

## CCMS Design System

Project: Centry Church Management System (CCMS)
Feel: Clean, modern, premium SaaS. Inspired by Tithely and Linear.
Users: Church admins, pastors, finance officers — desktop/laptop first.

Colours:
- Navy: #1B2352 (sidebar, left panels, primary brand)
- Indigo: #4F6BED (buttons, links, focus rings)
- Periwinkle: #7B93F5 (hover states, secondary accents)
- Mist: #E8ECF9 (light backgrounds, badge fills)
- Gold: #C8964A (accent only — sparingly)
- Surface: #F4F5F7 (page background)
- Ink: #111827 (dark text)
- Success: #22C55E | Error: #EF4444 | Warning: #F59E0B

Typography:
- Display font: DM Sans (headings, hero text)
- Body font: Inter (body, labels, tables)
- Mono: for IDs, amounts, dates only
- Heading weight: 600, letter-spacing: -0.02em
- Body: 400, 13-14px, line-height 1.6

Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 40 / 48px
Border radius: 6 / 8 / 12 / 16px
Border weight: 0.5px always
Input height: 38px
Sidebar width: 220px

Component rules:
- No heavy shadows — 0.5px borders instead
- Cards: white bg, 0.5px border, 12px radius, 16-20px padding
- Buttons: 38px height, 8px radius, 500 weight, 13px
- Tables: zebra stripe #F9FAFB, 0.5px borders, 13px rows
- Every form: visible label + placeholder + error state
- Every async action: loading state
- Every list/table: empty state

Layout:
- Sidebar: 220px fixed left, navy #1B2352
- Main: white, 24-32px padding
- Page header: title (20px/600) + subtitle (13px muted) + actions right-aligned
- Max content width: 1200px

Dark mode:
- Background: #0A0D14
- Surface: #13161F
- Border: rgba(255,255,255,0.08)
- Text: #F0F1F5
- Muted: rgba(240,241,245,0.45)

Tone: Premium, breathing, whitespace-first. Never cram. Show less, show it well.