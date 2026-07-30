# Unified Task Filter Bar

**Date:** 2026-07-28

## Problem

The tasks toolbar had 6 separate controls (5 dropdowns + 1 search input) in two different wrappers,
taking excessive horizontal space and wrapping awkwardly on narrow screens.

## Design

The unified bar lives in the `<header>` as `#tasks-header-actions`, replacing collections
search/actions when the Tasks tab is active. No toolbar needed inside `#tasks-content`.

```
<head>                          [Collections tab]          [Tasks tab]
[Tab Collections] [📂][📋]  [🔍 Search...] [view-toggle]  |  [🔍 Task hôm nay...] [👤][📅][📋][⬜][🔴] ✕ ⟳ 📊 ]
```

### Changes

- Header gains `#tasks-header-actions` (flex row, `display:none` initially)
- `switchView()` toggles it alongside `#collections-header-actions` / `#search-input`
- `.tasks-search-wrap` with icon + `<input>`, `flex: 1 1 180px` inside the header
- **Filters** are compact `<select>` with icon-first labels (e.g. "👤 Tất cả", "📅 H.nay")
- **Buttons** (reset, refresh, board link) use `.tasks-icon-btn` — 32×32px icon-only
- **Title** removed as separate element; scope text moves to search placeholder dynamically
- `#tasks-toolbar` removed from `#tasks-content` entirely

### Files touched

- `newtab/newtab.html` — added `#tasks-header-actions` in `<header>`, removed `#tasks-toolbar`
- `newtab/newtab.css` — added `.tasks-header-actions`, removed `#tasks-toolbar`
- `newtab/newtab.js` — unchanged (`switchView` already references `#tasks-header-actions`)
- `styles/responsive.css` — added `.tasks-header-actions` to mobile breakpoint
