# Graph Report - .  (2026-07-03)

## Corpus Check
- 110 files · ~122,839 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 879 nodes · 1263 edges · 59 communities (53 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Session Timeout & Toasts|Session Timeout & Toasts]]
- [[_COMMUNITY_Settings & Role Config|Settings & Role Config]]
- [[_COMMUNITY_Member Profile Page|Member Profile Page]]
- [[_COMMUNITY_Member Avatar & Edit|Member Avatar & Edit]]
- [[_COMMUNITY_Package Dependencies|Package Dependencies]]
- [[_COMMUNITY_Reports Page|Reports Page]]
- [[_COMMUNITY_Group Detail Page|Group Detail Page]]
- [[_COMMUNITY_Dev Dependencies|Dev Dependencies]]
- [[_COMMUNITY_Dashboard Page|Dashboard Page]]
- [[_COMMUNITY_Donations Page|Donations Page]]
- [[_COMMUNITY_Event Detail Page|Event Detail Page]]
- [[_COMMUNITY_Toast UI Component|Toast UI Component]]
- [[_COMMUNITY_Ministry Detail Page|Ministry Detail Page]]
- [[_COMMUNITY_Household Profile Page|Household Profile Page]]
- [[_COMMUNITY_Events List Page|Events List Page]]
- [[_COMMUNITY_Member Import Page|Member Import Page]]
- [[_COMMUNITY_TS Config (Node)|TS Config (Node)]]
- [[_COMMUNITY_TS Config (App)|TS Config (App)]]
- [[_COMMUNITY_Shadcn Component Aliases|Shadcn Component Aliases]]
- [[_COMMUNITY_Record Giving Page|Record Giving Page]]
- [[_COMMUNITY_Form UI Component|Form UI Component]]
- [[_COMMUNITY_Ministries List Page|Ministries List Page]]
- [[_COMMUNITY_Small UI Primitives|Small UI Primitives]]
- [[_COMMUNITY_Auth Context & Supabase|Auth Context & Supabase]]
- [[_COMMUNITY_Households List Page|Households List Page]]
- [[_COMMUNITY_Create Event Page|Create Event Page]]
- [[_COMMUNITY_Edit Event Page|Edit Event Page]]
- [[_COMMUNITY_New Group Page|New Group Page]]
- [[_COMMUNITY_Edit Transaction Page|Edit Transaction Page]]
- [[_COMMUNITY_Transaction Detail Page|Transaction Detail Page]]
- [[_COMMUNITY_New Household Page|New Household Page]]
- [[_COMMUNITY_Login & Protected Route|Login & Protected Route]]
- [[_COMMUNITY_Pledges Page|Pledges Page]]
- [[_COMMUNITY_New Member Page|New Member Page]]
- [[_COMMUNITY_Export Modal (CSVExcel)|Export Modal (CSV/Excel)]]
- [[_COMMUNITY_Dropdown Menu UI|Dropdown Menu UI]]
- [[_COMMUNITY_Sheet UI Component|Sheet UI Component]]
- [[_COMMUNITY_Table UI Component|Table UI Component]]
- [[_COMMUNITY_Select UI Component|Select UI Component]]
- [[_COMMUNITY_App Entry & Routing|App Entry & Routing]]
- [[_COMMUNITY_Calendar View Page|Calendar View Page]]
- [[_COMMUNITY_New Ministry Page|New Ministry Page]]
- [[_COMMUNITY_Card UI Component|Card UI Component]]
- [[_COMMUNITY_Dialog UI Component|Dialog UI Component]]
- [[_COMMUNITY_Add Pledge Page|Add Pledge Page]]
- [[_COMMUNITY_Button UI & 404 Page|Button UI & 404 Page]]
- [[_COMMUNITY_Badge UI Component|Badge UI Component]]
- [[_COMMUNITY_Reports Formatters|Reports Formatters]]
- [[_COMMUNITY_Shared TS Types|Shared TS Types]]
- [[_COMMUNITY_TS Config (Root)|TS Config (Root)]]
- [[_COMMUNITY_Reports Tooltip Helpers|Reports Tooltip Helpers]]
- [[_COMMUNITY_Reports Avatar Helpers|Reports Avatar Helpers]]
- [[_COMMUNITY_Reports Currency Format|Reports Currency Format]]
- [[_COMMUNITY_Vercel Config|Vercel Config]]

## God Nodes (most connected - your core abstractions)
1. `useAuth()` - 70 edges
2. `supabase` - 35 edges
3. `cn()` - 24 edges
4. `compilerOptions` - 18 edges
5. `compilerOptions` - 16 edges
6. `DashboardPage()` - 13 edges
7. `useSidebar()` - 11 edges
8. `TransactionDetailPage()` - 8 edges
9. `modalInputStyle()` - 8 edges
10. `MemberAvatar()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `DialogHeader()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/dialog.tsx → src/lib/utils.ts
- `DialogFooter()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/dialog.tsx → src/lib/utils.ts
- `DropdownMenuShortcut()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/dropdown-menu.tsx → src/lib/utils.ts
- `SheetHeader()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/sheet.tsx → src/lib/utils.ts
- `SheetFooter()` --calls--> `cn()`  [EXTRACTED]
  src/components/ui/sheet.tsx → src/lib/utils.ts

## Import Cycles
- 1-file cycle: `src/components/ui/sonner.tsx -> src/components/ui/sonner.tsx`

## Communities (59 total, 6 thin omitted)

### Community 0 - "Session Timeout & Toasts"
Cohesion: 0.08
Nodes (33): sonner, formatTime(), Props, SessionTimeoutWarning(), ThemeToggle(), Toaster(), ToasterProps, SettingsContext (+25 more)

### Community 1 - "Settings & Role Config"
Cohesion: 0.06
Nodes (23): ROLE_HOME_ROUTE, ROLE_LABELS, ROLES, AddBranchModal(), AddCategoryModal(), AVATAR_PALETTE, avatarColor(), BranchOption (+15 more)

### Community 2 - "Member Profile Page"
Cohesion: 0.05
Nodes (27): ATT_TYPE_STYLES, AttRecord, AVATAR_PALETTE, capitalize(), cardHeaderStyle, cardStyle, formatAmount(), formatDate() (+19 more)

### Community 3 - "Member Avatar & Edit"
Cohesion: 0.05
Nodes (19): avatarPalette(), MemberAvatar(), PALETTE, Props, Branch, FormValues, MemberData, MemberEditPage() (+11 more)

### Community 4 - "Package Dependencies"
Cohesion: 0.06
Nodes (35): dependencies, class-variance-authority, clsx, date-fns, @fullcalendar/core, @fullcalendar/daygrid, @fullcalendar/list, @fullcalendar/react (+27 more)

### Community 5 - "Reports Page"
Cohesion: 0.06
Nodes (20): AgeBreakdown, AP, AtRisk, AttByEventType, AttWeeks, BirthdayMember, Branch, CatBreakdown (+12 more)

### Community 6 - "Group Detail Page"
Cohesion: 0.07
Nodes (13): AttendanceMemberRow, AVATAR_PALETTE, DAYS, formatScheduleTime(), Group, GroupDetailPage(), GroupMember, GroupSchedule (+5 more)

### Community 7 - "Dev Dependencies"
Cohesion: 0.07
Nodes (27): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, nodemon (+19 more)

### Community 8 - "Dashboard Page"
Cohesion: 0.11
Nodes (23): AP, AtRisk, Branch, BranchComp, CatBreakdown, computeEaster(), DashboardPage(), delta() (+15 more)

### Community 9 - "Donations Page"
Cohesion: 0.08
Nodes (14): Avatar(), AVATAR_PALETTE, Branch, Category, CATEGORY_STYLES, CategoryPill(), CombinedFilter, DateRange (+6 more)

### Community 10 - "Event Detail Page"
Cohesion: 0.09
Nodes (19): AttendanceRecord, AttendanceTab(), AVATAR_PALETTE, CATEGORY_STYLES, DetailTab, DonationsTab(), EVENT_TYPE_STYLES, EventDetailPage() (+11 more)

### Community 11 - "Toast UI Component"
Cohesion: 0.11
Nodes (24): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastTitle, toastVariants (+16 more)

### Community 12 - "Ministry Detail Page"
Cohesion: 0.09
Nodes (11): Avatar(), AVATAR_PALETTE, avatarColor(), Branch, DetailTab, Group, GroupSchedule, MemberOption (+3 more)

### Community 13 - "Household Profile Page"
Cohesion: 0.09
Nodes (9): cardHeaderStyle, cardStyle, formatDate(), Household, HouseholdMember, HouseholdProfilePage(), MemberOption, MemberStatus (+1 more)

### Community 14 - "Events List Page"
Cohesion: 0.10
Nodes (8): Branch, Event, EVENT_TYPE_STYLES, EventsListPage(), EventTab, EventTypeBadge(), getEventTypeStyle(), STATUS_STYLES

### Community 15 - "Member Import Page"
Cohesion: 0.09
Nodes (11): Branch, CCMS_FIELDS, ImportResult, ImportStep, MappedData, MemberImportPage(), MONTHS, PreviewFilter (+3 more)

### Community 16 - "TS Config (Node)"
Cohesion: 0.10
Nodes (19): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, moduleResolution, noEmit (+11 more)

### Community 17 - "TS Config (App)"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+9 more)

### Community 18 - "Shadcn Component Aliases"
Cohesion: 0.12
Nodes (16): aliases, components, hooks, lib, ui, utils, rsc, $schema (+8 more)

### Community 19 - "Record Giving Page"
Cohesion: 0.14
Nodes (13): CAT_STYLE, COLLECTIVE_OFFERING_TYPES, DbBranch, DbCategory, DbEvent, DbMember, FormValues, getCatKey() (+5 more)

### Community 20 - "Form UI Component"
Cohesion: 0.14
Nodes (11): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+3 more)

### Community 21 - "Ministries List Page"
Cohesion: 0.14
Nodes (7): Avatar(), AVATAR_PALETTE, avatarColor(), Branch, MinistriesPage(), Ministry, MinistryTab

### Community 22 - "Small UI Primitives"
Cohesion: 0.21
Nodes (8): Avatar, AvatarFallback, AvatarImage, Input, Separator, Skeleton(), Textarea, cn()

### Community 23 - "Auth Context & Supabase"
Cohesion: 0.20
Nodes (10): AuthContext, AuthContextValue, AuthUser, supabase, AcceptInvitePage(), DbCategory, DbMember, EditPledgePage() (+2 more)

### Community 24 - "Households List Page"
Cohesion: 0.14
Nodes (5): Branch, Household, HouseholdMember, HouseholdsPage(), SortBy

### Community 25 - "Create Event Page"
Cohesion: 0.17
Nodes (10): Branch, countOccurrences(), CreateEventPage(), errorStyle, EVENT_TYPES, eventSchema, FormValues, inputBase (+2 more)

### Community 26 - "Edit Event Page"
Cohesion: 0.15
Nodes (10): Branch, EditEventPage(), errorStyle, EVENT_TYPES, eventSchema, FormValues, inputBase, KNOWN_TYPES (+2 more)

### Community 27 - "New Group Page"
Cohesion: 0.15
Nodes (6): AVATAR_PALETTE, DAYS, GroupNewPage(), MemberOption, Ministry, ScheduleEntry

### Community 28 - "Edit Transaction Page"
Cohesion: 0.20
Nodes (11): CAT_STYLE, DbBranch, DbCategory, DbEvent, DbMember, EditTransactionPage(), FormValues, getCatKey() (+3 more)

### Community 29 - "Transaction Detail Page"
Cohesion: 0.24
Nodes (10): AVATAR_PALETTE, CAT_STYLE, formatAmount(), formatDate(), formatDateTime(), getAvatarColor(), getCatKey(), METHOD_LABELS (+2 more)

### Community 30 - "New Household Page"
Cohesion: 0.17
Nodes (5): Branch, FormValues, HouseholdNewPage(), MemberOption, schema

### Community 31 - "Login & Protected Route"
Cohesion: 0.24
Nodes (7): useAuth(), UserRole, LoginForm, LoginPage(), loginSchema, ProtectedRoute(), ProtectedRouteProps

### Community 32 - "Pledges Page"
Cohesion: 0.22
Nodes (7): AVATAR_PALETTE, formatAmount(), PledgeRow, PledgesPage(), PledgeStatus, ProgressBar(), STATUS_STYLES

### Community 33 - "New Member Page"
Cohesion: 0.18
Nodes (6): Branch, FormValues, MemberNewPage(), Ministry, REGIONS, schema

### Community 34 - "Export Modal (CSV/Excel)"
Cohesion: 0.20
Nodes (3): ExportFormat, ExportModal(), ExportModalProps

### Community 35 - "Dropdown Menu UI"
Cohesion: 0.20
Nodes (9): DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut(), DropdownMenuSubContent (+1 more)

### Community 36 - "Sheet UI Component"
Cohesion: 0.22
Nodes (8): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants

### Community 37 - "Table UI Component"
Cohesion: 0.22
Nodes (8): Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow

### Community 38 - "Select UI Component"
Cohesion: 0.25
Nodes (7): SelectContent, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger

### Community 39 - "App Entry & Routing"
Cohesion: 0.32
Nodes (4): AuthProvider(), AuthLayout(), RoleHomeRedirect(), router

### Community 40 - "Calendar View Page"
Cohesion: 0.25
Nodes (4): Branch, CalendarViewPage(), CalEvent, EVENT_TYPE_COLORS

### Community 41 - "New Ministry Page"
Cohesion: 0.25
Nodes (4): AVATAR_PALETTE, Branch, MemberOption, MinistryNewPage()

### Community 42 - "Card UI Component"
Cohesion: 0.29
Nodes (6): Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle

### Community 43 - "Dialog UI Component"
Cohesion: 0.29
Nodes (6): DialogContent, DialogDescription, DialogFooter(), DialogHeader(), DialogOverlay, DialogTitle

### Community 44 - "Add Pledge Page"
Cohesion: 0.29
Nodes (6): AddPledgePage(), DbBranch, DbCategory, DbMember, FormValues, pledgeSchema

### Community 45 - "Button UI & 404 Page"
Cohesion: 0.40
Nodes (4): Button, ButtonProps, buttonVariants, NotFoundPage()

### Community 46 - "Badge UI Component"
Cohesion: 0.67
Nodes (3): Badge(), BadgeProps, badgeVariants

### Community 47 - "Reports Formatters"
Cohesion: 0.67
Nodes (3): fGHSFull(), GivingTooltip(), monthLabel()

## Knowledge Gaps
- **411 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+406 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `Package Dependencies` to `Session Timeout & Toasts`, `Dev Dependencies`?**
  _High betweenness centrality (0.124) - this node is a cross-community bridge._
- **Why does `sonner` connect `Session Timeout & Toasts` to `Package Dependencies`?**
  _High betweenness centrality (0.122) - this node is a cross-community bridge._
- **Why does `useAuth()` connect `Login & Protected Route` to `Session Timeout & Toasts`, `Settings & Role Config`, `Member Profile Page`, `Member Avatar & Edit`, `Reports Page`, `Group Detail Page`, `Dashboard Page`, `Donations Page`, `Event Detail Page`, `Ministry Detail Page`, `Household Profile Page`, `Events List Page`, `Member Import Page`, `Record Giving Page`, `Ministries List Page`, `Auth Context & Supabase`, `Households List Page`, `Create Event Page`, `Edit Event Page`, `New Group Page`, `Edit Transaction Page`, `Transaction Detail Page`, `New Household Page`, `Pledges Page`, `New Member Page`, `App Entry & Routing`, `Calendar View Page`, `New Ministry Page`, `Add Pledge Page`, `Reports Currency Format`?**
  _High betweenness centrality (0.120) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _411 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Session Timeout & Toasts` be split into smaller, more focused modules?**
  _Cohesion score 0.08019323671497584 - nodes in this community are weakly interconnected._
- **Should `Settings & Role Config` be split into smaller, more focused modules?**
  _Cohesion score 0.057971014492753624 - nodes in this community are weakly interconnected._
- **Should `Member Profile Page` be split into smaller, more focused modules?**
  _Cohesion score 0.0507399577167019 - nodes in this community are weakly interconnected._