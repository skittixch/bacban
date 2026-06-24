# UX/UI AUDIT — BacBan Kanban Board

**Auditor:** Staff Product Designer / Lead Frontend Architect  
**Date:** 2026-05-23  
**Scope:** Full frontend source (`kanban-frontend/src/`), backend persistence layer, HTML template, and CSS  
**Verdict:** ⚠️ **Functional but structurally fragmented — needs unification before feature growth**

---

## Executive Summary

BacBan is a surprisingly capable personal kanban with some genuinely inventive features — fractal nested subtasks, FLIP-animated overlays, a contentEditable reference editor, and snapshot-based undo/redo. The engineering is ambitious. The design, however, was never designed — it was *accreted*.

**The brutal truth:**

1. **There is no design system.** Colors, spacing, typography, and interaction patterns are defined ad-hoc in 4 different places (CSS custom properties, hardcoded hex in CSS, hardcoded hex in JSX, and Tailwind CDN utilities), with no single source of truth for any of them. Changing "the blue" requires editing 6+ files.

2. **Dark mode is implemented three separate ways** — a `.dark-mode` body class in CSS, `isDarkMode` ternaries in every component's JSX, and `.dark`/`.light` CSS class variants — all of which must manually agree. This has produced ~120 conditional className expressions across the codebase.

3. **Tailwind CDN is loaded as a runtime script** from `index.html`, competing with a 1,400-line custom stylesheet. Specificity conflicts are already appearing (`!important` in `index.css:539`). Neither system is authoritative.

4. **Interaction grammar is inconsistent.** Board titles edit on single-click, task cards open on single-click, task text edits on double-click, and subtask text edits on double-click. Delete operations range from instant-with-undo (tasks) to instant-no-undo (subtasks, columns) to confirmation-dialog (boards). Users cannot form a reliable mental model.

5. **Accessibility is near-zero.** No ARIA roles on the modal overlay, no focus trapping, no keyboard drag-and-drop alternative, no `aria-label` on icon-only buttons, and text as small as 9px. The app is unusable without a mouse.

6. **Prop drilling is extreme.** The `<Board>` component receives 34 individual props. The `useKanban` hook returns everything to `App.jsx`, which manually distributes it downward. Adding any new feature requires touching 4+ files to thread a new prop.

7. **The backend will silently truncate data.** `express.json()` defaults to a 100KB body limit, but the reference editor allows 10MB base64 images stored inline in the JSON payload. This is an active data-loss bug.

The app works *despite* these issues because it's small and single-user. But every new feature will compound the fragmentation. The refactoring cost grows exponentially from here.

---

## Inconsistencies Found

### 1. Design System Consistency

#### 1.1 Hardcoded Colors — No Token Layer

The app uses 30+ unique hardcoded color values scattered across CSS and JSX with no central definition.

| Color | Files & Lines | Semantic Intent | Occurrences |
|-------|---------------|----------------|-------------|
| `#94a3b8` | `index.css:48,338,415,492,521,748,834,1326` / `TaskCard.jsx:74` | Muted/disabled text | 9 |
| `#22c55e` | `index.css:57,260,345,501,871` / `Board.jsx:72` / `TaskCard.jsx:26` / `App.jsx:118` | Success/done | 8 |
| `#64748b` | `index.css:422,582,777,857,939,991,1094,1102,1108` | Subtle/secondary text | 9 |
| `#ef4444` | `index.css:262,540,1249` / `TaskCard.jsx:6` | Danger/delete | 4 |
| `#f59e0b` | `index.css:52,261` / `Board.jsx:73` / `App.jsx:118` | Warning/in-progress | 4 |
| `#e2e8f0` | `index.css:177,458,649,721,828,1335` | Primary text (dark mode) | 6 |
| `#1e293b` | `index.css:176,655,719,727,829,1199,1277,1341` | Primary surface (dark) / Primary text (light) | 8 |
| `#cbd5e1` | `index.css:458,1011,1152` | Secondary text (dark mode) | 3 |
| `#475569` | `index.css:469,1012,1157` | Secondary text (light mode) | 3 |
| `#60a5fa` | `index.css:191,1153,1213` | Link/accent blue (hardcoded, ignores theme) | 3 |
| `#f97316` | `TaskCard.jsx:6` / `App.jsx:37` | Orange (card color + theme) | 2 |
| `#8b5cf6` | `TaskCard.jsx:6` / `App.jsx:25` | Purple (card color + theme) | 2 |
| `#ec4899` | `TaskCard.jsx:6` / `App.jsx:39` | Pink (card color + theme) | 2 |
| `#3b82f6` | `App.jsx:11` / `TaskCard.jsx:6` | Blue (theme primary + card color) | 2 |

**Critical conflict:** The theme system in `App.jsx:9-45` defines `--theme-primary` etc. via inline styles, but numerous CSS rules bypass these tokens and hardcode the same colors directly. Example: `index.css:562` hardcodes `rgba(59, 130, 246, 0.3)` for the subtask empty hover state — this is the blue theme's exact color, baked in, ignoring whatever theme is active.

**Files with hardcoded color values:**
- `kanban-frontend/src/index.css` — **62 hardcoded hex/rgba values**
- `kanban-frontend/src/App.jsx` — 15 hardcoded values (themes object + confetti)
- `kanban-frontend/src/components/TaskCard.jsx` — 8 values (`CARD_COLORS` array + inline)
- `kanban-frontend/src/components/Board.jsx` — 2 values (accent colors)
- `kanban-frontend/src/components/TaskOverlay.jsx` — 0 (uses CSS classes)
- `kanban-frontend/src/components/SubtaskBoard.jsx` — 0 (uses CSS classes)
- `kanban-frontend/src/components/ReferenceEditor.jsx` — 0 (uses CSS classes)

#### 1.2 Typography — 10 Distinct Font Sizes

| Size | Usage | Location(s) |
|------|-------|-------------|
| `9px` | Subtask column title, subtask empty state, subtask column count | `index.css:412,419,549` |
| `10px` | KBD shortcuts, link URL display, priority clear button, subtask col title (overlay 1200px) | `index.css:266` / `TaskCard.jsx:223,254,270` / `index.css:968,972` |
| `11px` | Section headers, meta badges, priority badge, subtask pill, waiting-on input, section title | `index.css:444,861,869,935,943` / `TaskCard.jsx:168,249,264` / `App.jsx:237,260` |
| `12px` | Overlay date, overlay links, ref editor placeholder | `index.css:857,889,1016,1174` |
| `13px` | Ref editor base, subtask pill (overlay), ref section icon | `index.css:963,1144` |
| `14px` | Subtask pill (overlay 1200px), ref editor (1200px) | `index.css:1049,1387` |
| `15px` | Detail text, editor h4 | `index.css:1006,1192` |
| `18px` | Board title (`text-lg`), column title | Tailwind utility in `Board.jsx:113,119` |
| `20px` | Overlay title | `index.css:801,816` |
| `24px` | Overlay title (1200px+) | `index.css:1036` |

**Problem:** 10 sizes with no type scale. The jump from 9px → 24px is a 2.67× ratio with no consistent modular scale (e.g., 1.2× or 1.25×). Several sizes (9px, 10px) are below WCAG minimum legibility thresholds.

#### 1.3 Spacing — No Grid System

Padding and margin values are inconsistent across similar elements:

| Element | Padding | Location |
|---------|---------|----------|
| Task card | `p-3` (12px) | `TaskCard.jsx:135` |
| Column container | `p-3.5` (14px) | `Board.jsx:190` |
| Board header | `px-5 py-3.5` (20px/14px) | `Board.jsx:94` |
| App header | `px-5 py-2.5` (20px/10px) | `App.jsx:194` |
| Overlay header | `12px 16px` | `index.css:731` |
| Overlay body | `20px 24px 28px` | `index.css:781` |
| Overlay body (1200px) | `28px 36px 36px` | `index.css:1032` |
| Subtask pill | `4px 6px` | `index.css:442` |
| Subtask pill (overlay) | `8px 10px` | `index.css:961` |
| Subtask pill (overlay 1200px) | `10px 12px` | `index.css:1049` |
| Settings panel | `px-5 py-4` (20px/16px) | `App.jsx:234` |

No 4px or 8px grid is enforced. Values like 3.5, 2.5, 14px, 28px, 36px don't align to any base unit.

#### 1.4 Tailwind CDN vs Custom CSS Conflict

- **`index.html:12`** loads `<script src="https://cdn.tailwindcss.com">` — a runtime JIT compiler
- **`index.css`** is 1,399 lines of custom CSS
- Components freely mix both in a single `className`:

```jsx
// Board.jsx:190 — Tailwind utilities + custom CSS class in same attribute
className={`${cardBg} rounded-lg shadow-sm p-3.5 flex-1 min-w-[220px] transition-all duration-200
  border ${isDarkMode ? 'border-gray-700/50' : 'border-gray-200'}
  flex flex-col group/col
  ${draggedColumn === column.id && draggedColumnBoard === boardId ? 'opacity-40 rotate-1 scale-95' : ''}
`}
```

- `index.css:134` already uses `!important` to override Tailwind specificity
- Tailwind's `dark:` prefix is available but unused; dark mode is handled manually
- The CDN approach requires an internet connection and provides no version lockfile

#### 1.5 Dark Mode — Three Independent Systems

**System A: CSS body class** (`App.jsx:108`)
```js
document.body.className = isDarkMode ? 'dark-mode' : '';
```
Used by: `index.css:38-44, 372-376, 682-684, 1276-1278`

**System B: `isDarkMode` prop ternaries** (every component)
```jsx
className={`... ${isDarkMode ? 'bg-gray-800' : 'bg-white'} ...`}
```
Used by: `App.jsx` (12 ternaries), `Board.jsx` (9 ternaries), `TaskCard.jsx` (8 ternaries), `TaskOverlay.jsx` (5 ternaries)

**System C: `.dark` / `.light` CSS class variants**
```css
.subtask-pill.dark { background: rgba(255, 255, 255, 0.06); }
.subtask-pill.light { background: rgba(255, 255, 255, 0.8); }
```
Used by: `index.css:394-400, 456-477, 582-598, 616-634, 647-655, 717-727, 828-829, 894-914, 1011-1012, 1127-1135, 1151-1158, 1294-1307, 1367-1377`

**Total dark-mode branching points across the codebase: ~120+**

---

### 2. Component Unification

#### 2.1 Duplicate Inline Edit Pattern

The "click-to-edit with input swap" pattern is implemented independently in 5 places with no shared component:

| Location | State Variable | Ref | Save Trigger |
|----------|---------------|-----|-------------|
| Board title | `editingBoardTitle` | `boardTitleRef` | Enter/blur → `onUpdateBoardTitle` |
| Column title | `editingColumn` | `columnEditRef` | Enter/blur → `onUpdateColumnTitle` |
| Task card text | `isEditing` | `editRef` | Enter/blur → `handleSave` |
| Overlay title | `isEditingTitle` | `titleRef` | Enter/blur → `handleTitleSave` |
| Subtask text | `editingSubtask` | `editRef` | Enter/blur → `handleEditSave` |

Each implementation duplicates: `useState` for edit mode, `useRef` for autofocus, `useEffect` for focus-on-mount, Enter/Escape key handlers, blur-to-save logic. This is ~25 lines of logic × 5 = ~125 lines of duplication.

**Should be:** A single `<InlineEdit>` component.

#### 2.2 Duplicate URL Extraction

The `extractUrls()` function exists in two places with slightly different signatures:

- `TaskCard.jsx:94-102` — returns `{ links, textWithoutUrls }`
- `TaskOverlay.jsx:96-104` — returns `{ links, text }`

Identical regex logic, different return property names. This should be a shared utility.

#### 2.3 Duplicate Drag State Reset

The drag state cleanup pattern (setting 6 state variables to null) is duplicated in 3 places:

- `useKanban.js:721-728` (handleDrop — same-column case)
- `useKanban.js:773-778` (handleDrop — cross-column case)
- `useKanban.js:782-789` (handleDragEnd)

**Should be:** A single `resetDragState()` helper.

#### 2.4 No Shared Button Component

Buttons are styled inline everywhere with long conditional classNames:

```jsx
// Board.jsx:151-153
className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"

// Board.jsx:162-165
className={`p-1.5 rounded-lg transition-all ${
  isDarkMode ? 'text-gray-400 hover:text-white hover:bg-gray-700'
    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
}`}

// App.jsx:205-209
className={`p-2 rounded-lg transition-all ${
  isDarkMode ? 'text-gray-400 hover:text-yellow-300 hover:bg-yellow-500/10'
    : 'text-gray-500 hover:text-indigo-600 hover:bg-indigo-50'
}`}
```

Each icon button has its own bespoke styling. There should be a `<IconButton variant="ghost|danger|primary">` component.

#### 2.5 No Shared Picker/Popover

The priority picker (`TaskCard.jsx:258-275`) and color picker (`TaskCard.jsx:288-299`) are both inline popovers with nearly identical show/hide logic, positioning, and styling. Neither has click-outside-to-close behavior (clicking outside the color picker doesn't close it — only selecting a color does).

---

### 3. User Flow & Interaction

#### 3.1 Click vs Double-Click Ambiguity

| Element | Single Click | Double Click |
|---------|-------------|--------------|
| Board title | Enters edit mode | — |
| Column title | Enters edit mode | — |
| Task card | Opens overlay | Enters inline edit |
| Subtask pill | Opens drill-down (overlay) | Enters inline edit |
| Overlay title | Enters edit mode | — |

Users learn "click = edit" on titles, then discover "click = navigate" on cards. There's no visual signifier distinguishing editable text from navigable cards.

#### 3.2 Destructive Action Inconsistency

| Element | Delete Behavior | Protection Level |
|---------|----------------|-----------------|
| Board | Inline confirmation ("Delete? Yes/No") | 🟢 High — `Board.jsx:132-149` |
| Task | Instant delete + 5-second undo toast | 🟡 Medium — `useKanban.js:245-264`, `App.jsx:366-372` |
| Subtask | Instant delete, no undo, no confirm | 🔴 None — `SubtaskBoard.jsx:144-151` |
| Column (with all tasks) | Instant delete, no undo, no confirm | 🔴 None — `Board.jsx:246-251` |

**Critical:** Deleting a column (which may contain many tasks with subtasks and references) has *less* protection than deleting a single empty board. Column deletion also has no undo — the history system captures it, but Ctrl+Z is the only recovery path, and users won't know that.

#### 3.3 Loading States

- **Initial load:** Spinner + "Loading boards…" text — `App.jsx:156-167` ✅
- **Save in progress:** Amber pulsing dot — `index.css:261` ✅
- **Save error:** Red dot, no actionable message — `index.css:262` ⚠️
- **Save success:** Green dot, no text — `index.css:260` ✅
- **Task CRUD:** No loading state. Operations are optimistic with no rollback on failure ⚠️
- **Image upload (paste/drop):** No progress indicator. FileReader is synchronous-feeling but large images cause a visible freeze ⚠️

#### 3.4 Error States

- **Network failure on load:** Console error + red dot. No retry button, no user-facing message — `useKanban.js:99-101` ❌
- **Network failure on save:** Console error + red dot. No retry mechanism — `useKanban.js:119-123` ❌
- **No React Error Boundary:** If any component throws during render, the entire app white-screens with no recovery ❌

#### 3.5 Empty States

- **Empty column:** Dashed border + "+ Add a task" text — `Board.jsx:300-308` — minimal ✅
- **Empty subtask column:** "Drop here" text — `SubtaskBoard.jsx:158-167` — functional but terse ⚠️
- **No boards at all:** Falls through to just the "Add Board" button. No welcome/onboarding state ❌
- **Empty reference editor:** Placeholder "Drop images, paste screenshots, or type notes…" — `ReferenceEditor.jsx:389` ✅

#### 3.6 Hover/Focus States

- **Task cards:** `hover:shadow-md` + edit/delete icons appear — `TaskCard.jsx:137` + `TaskCard.jsx:232` ✅
- **Subtask pills:** Grip + delete icons appear on hover — `index.css:496,534` ✅
- **Icon buttons:** Each has bespoke hover colors (no pattern) ⚠️
- **Focus states:** Only inputs have focus styles via `themed-ring` class. Buttons have NO visible focus indicator for keyboard navigation ❌
- **Column delete button:** Uses `opacity-0 group-hover/col:opacity-100` — invisible until column hover — `Board.jsx:247` ⚠️

#### 3.7 Transitions

- **Overlay enter:** FLIP animation from card position — beautiful ✅
- **Overlay exit:** Instant disappearance — no exit animation ❌
- **Settings panel enter:** `slideDown` animation — `index.css:228-236` ✅
- **Settings panel exit:** Instant disappearance — no exit animation ❌
- **Board collapse:** `max-h` + opacity transition — `Board.jsx:176-178` ✅
- **Toast enter:** `slideUp` animation — `index.css:208-217` ✅
- **Toast exit:** Instant disappearance (state sets to `null`) ❌
- **Board/column drag:** Live reorder with opacity + rotation transform ✅

#### 3.8 Auto-Deletion Without Warning

Tasks dropped into "done" columns get a `doneAt` timestamp (`useKanban.js:754`) and are auto-deleted after 3 days (`useKanban.js:88,143-167`). The only visual hint is a gradual opacity fade (`TaskCard.jsx:68-71`). There is:
- No tooltip or badge saying "auto-removes in X days"
- No setting to disable auto-deletion
- No archive/history of deleted items
- No way to "pin" a done task to prevent deletion

---

### 4. Accessibility (a11y)

#### 4.1 Missing ARIA Roles and Attributes

| Element | Required | Current | Location |
|---------|----------|---------|----------|
| Task overlay | `role="dialog"`, `aria-modal="true"`, `aria-label` | None | `TaskOverlay.jsx:121-131` |
| Overlay backdrop | `aria-hidden="true"` | None | `TaskOverlay.jsx:113-118` |
| Board section | `role="region"`, `aria-label="{board title}"` | None | `Board.jsx:78-85` |
| Column | `role="list"` or `role="group"`, `aria-label="{column title}"` | None | `Board.jsx:183-195` |
| Task card | `role="article"` or `role="listitem"` | None | `TaskCard.jsx:125-146` |
| Settings panel | `aria-expanded`, `aria-controls` | None | `App.jsx:230-274` |
| Save status dot | `aria-label`, `role="status"` | `title` only | `App.jsx:197-200` |
| Icon buttons (all) | `aria-label` | `title` only | Multiple files |
| Priority picker | `role="listbox"` or `role="menu"` | None | `TaskCard.jsx:258-275` |
| Color picker | `role="listbox"` or `role="menu"` | None | `TaskCard.jsx:288-299` |
| Theme swatches | `role="radiogroup"`, `aria-checked` | None | `App.jsx:241-256` |
| Reference editor | `role="textbox"`, `aria-label`, `aria-multiline` | None | `ReferenceEditor.jsx:376-391` |
| Breadcrumb | `aria-label="Breadcrumb"`, `nav` element | `div` | `TaskOverlay.jsx:142-146` |

#### 4.2 Focus Management

- **Overlay open:** Focus is NOT moved to the overlay container — `TaskOverlay.jsx` has no focus-on-mount logic ❌
- **Overlay close:** Focus is NOT returned to the triggering card ❌
- **No focus trap:** When overlay is open, Tab key moves focus to elements behind the backdrop (which are `pointer-events: none` but still focusable) ❌
- **Task card activation:** Cards are `div` elements with `onClick`. No `tabIndex`, no `onKeyDown` for Enter/Space. Keyboard-only users cannot open a task detail ❌
- **Subtask pills:** Same issue — `div` with `onClick`, no keyboard activation ❌
- **Priority/color picker:** No focus management. Clicking a picker doesn't trap focus, Escape doesn't close it, Tab doesn't cycle through options ❌

#### 4.3 Keyboard Navigation

- **Undo/Redo:** Ctrl+Z / Ctrl+Shift+Z — works ✅
- **Dark mode toggle:** `T` key — works ✅
- **Settings toggle:** `S` key — works ✅
- **Close overlay:** Escape — works ✅
- **Open task detail:** No keyboard trigger ❌
- **Move tasks:** No keyboard DnD alternative (e.g., Ctrl+Arrow) ❌
- **Navigate between cards:** No arrow-key navigation between tasks in a column ❌
- **Navigate between columns:** No arrow-key navigation ❌

#### 4.4 Semantic HTML

- **Headings:** `<h1>` for app title, `<h2>` for board titles (in overlay), `<h3>` for column titles and section headers — reasonable hierarchy ✅
- **Lists:** Task lists are `div > div` instead of `ul > li` ❌
- **Buttons:** Most interactive elements are proper `<button>` elements ✅
- **Links:** External links use `<a>` with `target="_blank" rel="noopener noreferrer"` ✅
- **Landmark regions:** No `<main>`, `<nav>`, `<aside>`, `<header>` elements (all `div`) ❌

#### 4.5 Color Contrast Failures

| Element | Foreground | Background | Ratio | WCAG AA (4.5:1) |
|---------|-----------|------------|-------|-----------------|
| Subtask col title (light) | `#94a3b8` | white | 2.9:1 | ❌ FAIL |
| Muted text (light) | `#94a3b8` | white | 2.9:1 | ❌ FAIL |
| Subtle text (light) | `#64748b` | white | 4.6:1 | ✅ PASS (barely) |
| Overlay date | `#64748b` | white | 4.6:1 | ✅ PASS |
| Subtask text (dark) | `#cbd5e1` | `rgba(255,255,255,0.06)` on `#1e293b` | ~8:1 | ✅ PASS |
| Placeholder text | `rgba(148,163,184,0.45)` | varies | ~1.5:1 | ❌ FAIL |
| Save dot (7×7px, no label) | — | color-only | — | ❌ FAIL (no text alternative) |

---

## Proposed Architecture

### Design Tokens

Replace all hardcoded values with CSS custom properties in a new `:root` / `.dark-mode` token system:

```
kanban-frontend/src/
├── tokens/
│   └── tokens.css          ← NEW: All design tokens
├── components/
│   ├── shared/
│   │   ├── IconButton.jsx  ← NEW: Unified icon button
│   │   ├── InlineEdit.jsx  ← NEW: Unified inline edit
│   │   ├── Popover.jsx     ← NEW: Shared picker/popover
│   │   └── Toast.jsx       ← NEW: Shared toast notification
│   ├── Board.jsx
│   ├── TaskCard.jsx
│   ├── TaskOverlay.jsx
│   ├── SubtaskBoard.jsx
│   └── ReferenceEditor.jsx
├── contexts/
│   ├── FocusContext.js
│   └── KanbanContext.js    ← NEW: Replace prop drilling
├── hooks/
│   └── useKanban.js
├── utils/
│   └── extractUrls.js      ← NEW: Shared URL extractor
├── index.css               ← REFACTOR: Remove hardcoded values, reference tokens
├── index.js
└── App.jsx                 ← REFACTOR: Slim down, use KanbanContext
```

### Token File Structure (`tokens.css`)

```css
:root {
  /* ---- Color Palette (Semantic) ---- */
  --color-success: #22c55e;
  --color-success-light: rgba(34, 197, 94, 0.1);
  --color-danger: #ef4444;
  --color-danger-light: rgba(239, 68, 68, 0.1);
  --color-warning: #f59e0b;
  --color-warning-light: rgba(245, 158, 11, 0.1);

  /* ---- Surfaces ---- */
  --surface-primary: #ffffff;
  --surface-secondary: #f8fafc;
  --surface-tertiary: rgba(0, 0, 0, 0.02);
  --surface-elevated: #ffffff;
  --surface-overlay: rgba(0, 0, 0, 0.45);

  /* ---- Text ---- */
  --text-primary: #1e293b;
  --text-secondary: #475569;
  --text-muted: #64748b;
  --text-disabled: #94a3b8;

  /* ---- Borders ---- */
  --border-default: rgba(0, 0, 0, 0.08);
  --border-strong: rgba(0, 0, 0, 0.15);
  --border-interactive: var(--theme-primary);

  /* ---- Typography Scale (1.25 ratio) ---- */
  --text-xs: 0.6875rem;   /* 11px — smallest allowed */
  --text-sm: 0.8125rem;   /* 13px */
  --text-base: 0.875rem;  /* 14px */
  --text-lg: 1.125rem;    /* 18px */
  --text-xl: 1.25rem;     /* 20px */
  --text-2xl: 1.5rem;     /* 24px */

  /* ---- Spacing (4px base grid) ---- */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;

  /* ---- Border Radius ---- */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;

  /* ---- Motion ---- */
  --duration-fast: 150ms;
  --duration-normal: 250ms;
  --duration-slow: 400ms;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);

  /* ---- Shadows ---- */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
  --shadow-overlay: 0 25px 80px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.15);
}

.dark-mode {
  --surface-primary: #1e293b;
  --surface-secondary: #0f172a;
  --surface-tertiary: rgba(255, 255, 255, 0.03);
  --surface-elevated: #1e293b;
  --surface-overlay: rgba(0, 0, 0, 0.6);

  --text-primary: #e2e8f0;
  --text-secondary: #cbd5e1;
  --text-muted: #94a3b8;
  --text-disabled: #64748b;

  --border-default: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.15);

  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.4);
}
```

### KanbanContext Pattern

```jsx
// contexts/KanbanContext.js
const KanbanContext = createContext(null);

export function KanbanProvider({ children }) {
  const kanban = useKanban();
  return (
    <KanbanContext.Provider value={kanban}>
      {children}
    </KanbanContext.Provider>
  );
}

export function useKanbanActions() {
  const ctx = useContext(KanbanContext);
  if (!ctx) throw new Error('useKanbanActions must be inside KanbanProvider');
  return ctx;
}
```

This eliminates ~30 props from `<Board>` and ~15 from `<TaskOverlay>`. Components call `const { addTask, deleteTask } = useKanbanActions()` directly.

### Shared Component Specs

**`<InlineEdit>`** — Replaces 5 duplicate implementations:
```
Props: value, onSave, onCancel, as ("input"|"textarea"), className, placeholder
Behavior: Click to edit, Enter to save, Escape to cancel, blur to save, auto-focus on mount
```

**`<IconButton>`** — Replaces ~20 bespoke button stylings:
```
Props: icon, onClick, variant ("ghost"|"danger"|"primary"), size ("sm"|"md"), title, ariaLabel
Behavior: Consistent hover/focus states, dark-mode-aware via tokens, proper aria-label
```

**`<Popover>`** — Replaces priority picker and color picker:
```
Props: trigger, children, isOpen, onClose, placement
Behavior: Click-outside-to-close, Escape-to-close, focus trap, portal rendering
```

---

## Action Plan

### 🔴 Priority 1 — Critical (Do Immediately)

- [ ] **P1.1 — Fix `express.json()` body limit**
  - File: `kanban-backend/server.js:11`
  - Change: `app.use(express.json({ limit: '50mb' }))` 
  - Reason: Active data-loss bug. Base64 images in references will silently truncate at 100KB default
  - Impact: **Critical** | Effort: 1 line

- [ ] **P1.2 — Create `tokens.css` and define all design tokens**
  - Create: `kanban-frontend/src/tokens/tokens.css`
  - Content: Full `:root` and `.dark-mode` token definitions (see Proposed Architecture above)
  - Import: Add `@import './tokens/tokens.css'` at top of `index.css`
  - Impact: **High** (unlocks all subsequent refactoring) | Effort: ~1 hour

- [ ] **P1.3 — Remove Tailwind CDN**
  - File: `kanban-frontend/public/index.html:12`
  - Change: Remove `<script src="https://cdn.tailwindcss.com">` 
  - Prereq: Must first replace all Tailwind utilities in JSX with either custom CSS classes or inline styles referencing tokens
  - Impact: **High** (eliminates specificity conflicts, removes runtime dependency) | Effort: ~4 hours

- [ ] **P1.4 — Add `role="dialog"` and focus trap to TaskOverlay**
  - File: `kanban-frontend/src/components/TaskOverlay.jsx:121-131`
  - Changes: Add `role="dialog"`, `aria-modal="true"`, `aria-label`, focus-on-mount, focus-return-on-close, Tab trap
  - Impact: **High** (a11y) | Effort: ~1 hour

- [ ] **P1.5 — Add `aria-label` to all icon-only buttons**
  - Files: `App.jsx`, `Board.jsx`, `TaskCard.jsx`, `SubtaskBoard.jsx`, `TaskOverlay.jsx`, `ReferenceEditor.jsx`
  - Change: Replace `title="..."` with both `title` and `aria-label` on every icon-only `<button>`
  - Impact: **High** (a11y) | Effort: ~30 min

### 🟠 Priority 2 — High (Do This Sprint)

- [ ] **P2.1 — Migrate all hardcoded colors in `index.css` to token references**
  - File: `kanban-frontend/src/index.css` (62 hardcoded values)
  - Change: Replace every hex/rgba with `var(--token-name)`
  - Prereq: P1.2 (tokens exist)
  - Impact: **High** | Effort: ~2 hours

- [ ] **P2.2 — Migrate JSX color ternaries to token-based CSS**
  - Files: All 5 component files + `App.jsx`
  - Change: Replace `isDarkMode ? 'bg-gray-800' : 'bg-white'` with a single class that uses `var(--surface-primary)`
  - Prereq: P1.2, P1.3 (Tailwind removed)
  - Impact: **High** (eliminates ~120 ternaries) | Effort: ~4 hours

- [ ] **P2.3 — Create `KanbanContext` and eliminate prop drilling**
  - Create: `kanban-frontend/src/contexts/KanbanContext.js`
  - Refactor: `App.jsx`, `Board.jsx`, `TaskCard.jsx`, `TaskOverlay.jsx`
  - Impact: **High** (cuts Board props from 34 to ~5) | Effort: ~2 hours

- [ ] **P2.4 — Create `<InlineEdit>` shared component**
  - Create: `kanban-frontend/src/components/shared/InlineEdit.jsx`
  - Refactor: Board title, column title, task text, overlay title, subtask text
  - Impact: **Medium** (eliminates ~125 lines of duplication) | Effort: ~1.5 hours

- [ ] **P2.5 — Unify destructive action patterns**
  - Change: Add undo toast to subtask and column deletes (match task delete behavior)
  - OR: Add confirmation dialog to all deletes
  - Pick one pattern and apply everywhere
  - Impact: **High** (interaction consistency + data safety) | Effort: ~2 hours

- [ ] **P2.6 — Unify click vs double-click**
  - Decide: Single-click = primary action (open/navigate), Double-click = inline edit — EVERYWHERE
  - Change: Board title and column title should require double-click to edit (currently single-click)
  - Impact: **High** (interaction grammar) | Effort: ~30 min

- [ ] **P2.7 — Add overlay exit animation**
  - File: `TaskOverlay.jsx` and `index.css`
  - Change: Implement reverse FLIP or fade-out transition on close
  - Impact: **Medium** (motion polish) | Effort: ~1 hour

### 🟡 Priority 3 — Medium (Next Sprint)

- [ ] **P3.1 — Create `<IconButton>` shared component**
  - Create: `kanban-frontend/src/components/shared/IconButton.jsx`
  - Refactor: All ~20 icon buttons across the app
  - Impact: **Medium** | Effort: ~2 hours

- [ ] **P3.2 — Create `<Popover>` shared component with click-outside-to-close**
  - Create: `kanban-frontend/src/components/shared/Popover.jsx`
  - Refactor: Priority picker, color picker
  - Impact: **Medium** | Effort: ~1.5 hours

- [ ] **P3.3 — Add keyboard task activation**
  - Files: `TaskCard.jsx`, `SubtaskBoard.jsx`
  - Change: Add `tabIndex={0}`, `role="button"`, `onKeyDown` for Enter/Space
  - Impact: **High** (a11y) | Effort: ~30 min

- [ ] **P3.4 — Add semantic HTML landmarks**
  - File: `App.jsx`
  - Change: Wrap header in `<header>`, content in `<main>`, overlay in proper structure
  - Impact: **Medium** (a11y) | Effort: ~20 min

- [ ] **P3.5 — Standardize typography to 6-size scale**
  - File: `index.css`
  - Change: Replace 9px/10px with `var(--text-xs)` (11px), consolidate to 6 sizes
  - Impact: **Medium** | Effort: ~1 hour

- [ ] **P3.6 — Standardize spacing to 4px grid**
  - Files: `index.css`, all component files
  - Change: Replace non-grid values (3.5, 2.5, 14px, 28px, 36px) with token references
  - Impact: **Medium** | Effort: ~2 hours

- [ ] **P3.7 — Add error boundary**
  - Create: `kanban-frontend/src/components/ErrorBoundary.jsx`
  - Wrap: `<App>` in `index.js`
  - Impact: **Medium** | Effort: ~30 min

- [ ] **P3.8 — Add auto-deletion warning to done tasks**
  - File: `TaskCard.jsx`
  - Change: Show "Removes in X days" badge on tasks with `doneAt`
  - Impact: **Medium** (user trust) | Effort: ~30 min

- [ ] **P3.9 — Standardize motion tokens**
  - File: `index.css`
  - Change: Replace 7 unique durations and 4 easings with `var(--duration-*)` / `var(--ease-*)`
  - Prereq: P1.2
  - Impact: **Medium** | Effort: ~1 hour

- [ ] **P3.10 — Extract `extractUrls` utility**
  - Create: `kanban-frontend/src/utils/extractUrls.js`
  - Refactor: `TaskCard.jsx:94-102`, `TaskOverlay.jsx:96-104`
  - Impact: **Low** | Effort: ~15 min

### 🟢 Priority 4 — Low (Backlog)

- [ ] **P4.1 — Replace `document.execCommand` with modern editing API**
  - File: `ReferenceEditor.jsx:218-222`
  - Consider: Tiptap, Lexical, or Slate
  - Impact: **Low** (works today, deprecated but not removed) | Effort: ~8 hours

- [ ] **P4.2 — Replace `prompt()` with inline URL input**
  - File: `ReferenceEditor.jsx:225`
  - Impact: **Low** (UX polish) | Effort: ~1 hour

- [ ] **P4.3 — Add keyboard drag-and-drop**
  - Files: `Board.jsx`, `TaskCard.jsx`, `SubtaskBoard.jsx`
  - Change: Ctrl+↑/↓ to move tasks, Ctrl+←/→ to move between columns
  - Impact: **Medium** (a11y) | Effort: ~4 hours

- [ ] **P4.4 — Add search/filter capability**
  - New feature: Search bar in header, filter by priority/color
  - Impact: **Medium** (UX) | Effort: ~4 hours

- [ ] **P4.5 — Add responsive breakpoints for tablet/mobile**
  - File: `index.css`
  - Change: Add `@media (max-width: 768px)` and `(max-width: 640px)` breakpoints
  - Impact: **Low** (if desktop-only tool) | Effort: ~4 hours

- [ ] **P4.6 — Cap overlay max-width**
  - File: `index.css:691,1027,1065`
  - Change: Add `max-width: 920px` absolute cap (currently 82vw = 3149px on 4K)
  - Impact: **Low** | Effort: ~5 min

---

## Estimated Total Effort

| Priority | Tasks | Est. Hours |
|----------|-------|-----------|
| 🔴 P1 (Critical) | 5 | ~7 hours |
| 🟠 P2 (High) | 7 | ~13 hours |
| 🟡 P3 (Medium) | 10 | ~10 hours |
| 🟢 P4 (Low) | 6 | ~21 hours |
| **Total** | **28** | **~51 hours** |

P1 + P2 (the "design system foundation" phase) can be completed in **~20 hours of focused work** and will transform the codebase from fragmented to unified. P3 and P4 are incremental improvements that can be tackled over subsequent sprints.

---

*Awaiting approval to begin refactoring phase.*
