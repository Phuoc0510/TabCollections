# LumiList Features for Tab Collection

> Extend the existing Tab Collection extension with Pages, Quick Save, Smart Search, and Privacy Mode — inspired by LumiList.

## Data Model

Add a `pages` object to `chrome.storage.local`, separate from existing `groups`/`tabs`:

```json
{
  "groups": { ... },
  "tabs": { ... },
  "pages": {
    "page-uuid": {
      "id": "page-uuid",
      "name": "Work",
      "icon": "💼",
      "position": 0,
      "groupIds": ["group-uuid-1", "group-uuid-2"]
    }
  }
}
```

- Groups not assigned to any page appear under "Uncategorized".
- Each group can belong to **one or more** pages.
- Migration: existing data transforms into a single "General" page containing all existing groups.

## New Storage Functions (in `storage.js`)

- `getPages()` — return all pages sorted by position
- `createPage(name, icon)` — create page, defaults to `groupIds: []`
- `updatePage(id, data)` — rename, reorder, change icon
- `deletePage(id)` — remove page (groups inside are NOT deleted)
- `addGroupToPage(pageId, groupId)`
- `removeGroupFromPage(pageId, groupId)`

## New Background Features (in `background.js`)

### Quick Save (Keyboard Shortcut)

- Register `commands` in `manifest.json`:
  - Mac: `⌘+Shift+Y`
  - Win/Linux: `Ctrl+Shift+Y`
- `chrome.commands.onCommand` listener:
  1. Grab active tab from current window
  2. Store tab info in `chrome.storage.session` as `pendingQuickSave`
  3. Open popup (`action.openPopup`) — popup detects `pendingQuickSave` and shows group picker
  4. User selects group → tab saves → toast confirmation
  5. Clear `pendingQuickSave`

### Privacy Mode (no background change needed — purely UI)

## New UI Features (in `newtab/`)

### Pages Navigation

- Horizontal tab bar above groups:
  ```
  [📁 All] [💼 Work] [👤 Personal] [📚 Projects]  [+]
  ```
- Selecting a page filters visible groups to `page.groupIds`
- "+" button creates a new page (inline name prompt)
- Right-click / edit icon on page tab: rename, change icon, delete
- Drag page tabs to reorder (update positions in storage)

### Smart Search

- Search bar below page tabs, above group cards
- Scope dropdown: filter within current page, all pages, or specific group
- Toggle: Exact Match mode (regex anchor `^...$`)
- Real-time filtering as user types:
  - Match against bookmark title (case-insensitive substring)
  - Match against bookmark URL (case-insensitive substring)
- Highlight matching text in results using `<mark>` tags
- Counter: "X matches in Y groups"

### Privacy Mode

- Toggle button (👁 icon) in newtab header
- State persisted in `chrome.storage.local` as `privacyMode: boolean`
- Toggle adds/removes `.privacy-mode` class on `<body>`
- CSS: `.privacy-mode .tab-item { filter: blur(8px); pointer-events: none; transition: filter 0.2s; }`
- When privacy mode is on, blur also applies to group names and page names
- Hover to temporarily unblur (`.privacy-mode .tab-item:hover { filter: none; }`)

## Files Changed

| File | Change |
|------|--------|
| `manifest.json` | Add `"commands"` for Quick Save (Ctrl+Shift+Y) |
| `storage.js` | Add pages CRUD functions, export them |
| `background.js` | Add `chrome.commands.onCommand` listener for Quick Save |
| `popup/popup.js` | Detect `pendingQuickSave` from session, show group picker |
| `newtab/newtab.html` | Add page tabs bar, search bar, privacy toggle |
| `newtab/newtab.css` | Add styles for pages bar, search, privacy blur |
| `newtab/newtab.js` | Add page selection, search filtering, privacy toggle logic |

## No-Change Items

- Drag-and-drop logic (already exists)
- Background image customization (already exists)
- Export/Import (already exists, will include pages data)
- Context menu (already exists)
