# Priority 1 Features for Tab Collection

> Add search, pin, grid/list view toggle, and undo/trash to the Tab Collection
> extension.

## Data Model

Extend existing `storage.js` group and tab objects with new fields:

```json
{
  "groups": {
    "group-uuid": {
      ...existing,
      "pinned": false,
      "deletedAt": null
    }
  },
  "tabs": {
    "tab-uuid": {
      ...existing,
      "deletedAt": null
    }
  }
}
```

### New Storage Functions

| Function | Purpose |
|----------|---------|
| `softDeleteGroup(id)` | Set `group.deletedAt = Date.now()` instead of deleting |
| `softDeleteTab(id)` | Set `tab.deletedAt = Date.now()` |
| `restoreGroup(id)` | Set `group.deletedAt = null`, restore all its soft-deleted tabs |
| `restoreTab(id)` | Set `tab.deletedAt = null` |
| `purgeDeleted()` | Hard-delete items with `deletedAt < now - 30000` |
| `togglePinGroup(id)` | Toggle `group.pinned` |

### Modified Storage Functions

- `getGroups()` — filter out `deletedAt` groups, sort pinned first then by position
- `getTabsByGroup(groupId)` — filter out `deletedAt` tabs
- `deleteGroup(id)` → replaced by `softDeleteGroup(id)`
- `removeTab(id)` → replaced by `softDeleteTab(id)`

## Background Changes

### Message Handlers

Add handlers in `background.js` for: `softDeleteGroup`, `softDeleteTab`,
`restoreGroup`, `restoreTab`, `togglePinGroup`.

### Cleanup Timer

```js
setInterval(async () => {
  await purgeDeleted();
}, 15000);
```

Runs every 15s in the service worker. Items past their 30s window are
hard-deleted.

## Feature: Search

### Location

Search input in the header bar between the app title and action buttons.

### Behavior

- Real-time filtering as user types (debounced at 150ms)
- Matches against: collection name (case-insensitive), tab title, tab URL
- Empty search term shows all collections
- When searching, collections with no matching tabs and no matching name are
  hidden; tabs within a matching collection are filtered to only show matches
- No scope dropdown (searches everything — confirmed by user)

### Files Changed

| File | Change |
|------|--------|
| `newtab/newtab.html` | Add `<input type="search">` in header |
| `newtab/newtab.js` | Add `filterGroups()` function, event listener on input |
| `newtab/newtab.css` | Style search input |

## Feature: Pin Collection

### Behavior

- Each collection card has a 📌 icon button
- Click toggles pinned state
- Pinned collections appear first in the grid/list (sorted by position among
  pinned items)
- Unpinned collections follow
- State persisted via `group.pinned` in `chrome.storage.local`

### Files Changed

| File | Change |
|------|--------|
| `storage.js` | Add `togglePinGroup()`, modify `getGroups()` sort |
| `background.js` | Add `togglePinGroup` message handler |
| `newtab/newtab.js` | Add pin button in `render()`, click handler |
| `newtab/newtab.css` | Style pin button |

## Feature: Grid / List View

### Behavior

- Toggle button in header: `▦ Grid` / `☰ List`
- Preference saved in `chrome.storage.local` as `viewMode: 'grid' | 'list'`
- Default is `'grid'` (backward-compatible)
- List view: collections render as a single-column vertical list (max-width
  700px, centered), cards are full-width, color bar stays on the left
- Expand/collapse still works in list view
- Drag-and-drop reorder works in both views
- Implemented via CSS class `.view-list` on the container

### Files Changed

| File | Change |
|------|--------|
| `newtab/newtab.html` | Add toggle button in header |
| `newtab/newtab.js` | Toggle logic, load/save `viewMode` |
| `newtab/newtab.css` | `.view-list` styles |

## Feature: Undo / Trash

### UX Flow

1. User clicks Delete on a collection or tab
2. `softDeleteGroup` / `softDeleteTab` sets `deletedAt` — item disappears from
   the grid immediately
3. A toast appears at the bottom center: "Deleted 'X'" with an "Undo" button
   and a 30s progress bar
4. Clicking Undo calls `restoreGroup` / `restoreTab` — item reappears, toast
   hides
5. After 30s (or page reload), `purgeDeleted()` hard-deletes the item
6. Background cleanup runs every 15s

### Toast UI

- Fixed position: bottom-center, high z-index
- Dark background, white text, rounded corners
- Contains: message text, Undo button (primary color), progress bar timer
- Auto-hides after 30s or on Undo click

### Files Changed

| File | Change |
|------|--------|
| `storage.js` | Add 5 functions: `softDeleteGroup`, `softDeleteTab`, `restoreGroup`, `restoreTab`, `purgeDeleted`. Modify `getGroups`/`getTabsByGroup` to filter deleted. |
| `background.js` | Add message handlers + `setInterval(purgeDeleted, 15000)` |
| `newtab/newtab.html` | Add toast container |
| `newtab/newtab.js` | Toast show/hide logic, undo event handler |
| `newtab/newtab.css` | Toast styles |

## Error Handling

- All storage operations wrapped in try/catch with user-facing status messages
- If soft-delete fails, show error instead of silently losing data
- `purgeDeleted()` is safe to call repeatedly (idempotent)
- Background cleanup will not block on error (individual operation failures
  are caught and logged)
- Import/export: `deletedAt` fields are included in export to preserve undo
  state; deleted items are filtered out on display

## Testing

- `storage.test.js` — add tests for all 6 new storage functions
- Manual: verify each feature on new tab page with real data
- Edge cases:
  - Delete + undo + delete again within 30s
  - Rapidly pin/unpin multiple collections
  - Toggle view mode while dragging
  - Search with special regex characters
