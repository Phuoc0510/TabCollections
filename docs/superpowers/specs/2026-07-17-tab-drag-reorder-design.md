# Tab Drag-and-Drop Reorder

## Problem

Users cannot reorder URLs (tabs) within a collection card. Currently tabs are sorted by `addedAt` descending and have no way to change their order.

## Solution

Add drag-and-drop reordering for tabs within each card using HTML5 Drag and Drop API (same pattern as existing card reorder). Add a drag handle (☰) on each tab entry. Persist the custom order to `chrome.storage.local`.

## Data Layer

- New tabs get `position: Date.now()` (mirrors group position pattern)
- `getTabsByGroup` sorts by `position` desc, fallback `addedAt` desc
- New `updateTabPositions(groupId, orderedIds)` writes position values to storage
- New background message action `updateTabPositions`

### Files changed

- **storage.js**: add `updateTabPositions`, modify `getTabsByGroup` sort, add `position` to `addTabToGroup`
- **background.js**: add `case 'updateTabPositions'`

## UI Layer

- Drag handle (`⠿`) at the start of each `.tab-entry`
- Only handle initiates drag; clicking title/URL/buttons works normally
- Card drag-start skips if dragging from a tab-entry (prevent conflict)
- Tab drag handlers (dragstart/dragover/dragend) on `#groups-grid`
- On dragend: compute new ID order, send `updateTabPositions` message
- Visual feedback: grab cursor on handle, reduced opacity on dragged entry

### Files changed

- **newtab.js**: update `renderTabEntry`, add drag handlers, update card dragstart guard
- **newtab.css**: `.tab-drag-handle` styles, `.tab-entry.dragging` style

## Implementation Order

1. storage.js — data functions
2. background.js — message handler
3. newtab.js — rendering + drag logic
4. newtab.css — drag handle + state styles
