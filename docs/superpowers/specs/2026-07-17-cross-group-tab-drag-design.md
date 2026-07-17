# Cross-Group Tab Drag — Tab Collection Extension

## Overview

Allow dragging a tab entry from one group card to another group card on the new tab page. Tab is moved (not copied) without confirmation. Visual feedback includes card highlight + line indicator during drag.

## Storage Layer

Add `moveTabToGroup(tabId, targetGroupId)` in `storage.js`:
- Validate target group and tab exist
- Update tab's `groupId` to target
- Set tab position to `Date.now()` (appends to end)
- Update target group's `updatedAt`
- No removal of old group reference (groupId changes)
- Export function

## Background

Add `moveTabToGroup` case in `background.js` message handler:
- Call `moveTabToGroup(msg.tabId, msg.targetGroupId)`
- Call `rebuildContextMenu()`
- Return `{ ok: true }`

## Frontend — Cross-Group Tab Drag

New state variables:
- `dragSrcGroupId`: string | null
- `dragTargetGroup`: element | null

### dragstart (modify existing tab handler)
Save source group ID from `entry.closest('.group-card').dataset.id`.

### dragover (modify existing tab dragover handler)
Check if target card differs from source group:
- Different group: add `.drag-target` class, inject `.tab-drop-indicator` at mouse Y position
- Same group: existing tab reorder logic

### drop
If target group ≠ source group:
- Send `moveTabToGroup` message

### dragend
- Remove `.drag-target` from all cards
- Remove `.tab-drop-indicator`
- Reset `dragSrcGroupId`

## CSS

```css
.group-card.drag-target {
  outline: 2px solid #4285f4;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(66, 133, 244, 0.15);
}

.tab-drop-indicator {
  height: 3px;
  background: #4285f4;
  border-radius: 2px;
  margin: 2px 0;
  pointer-events: none;
}
```
