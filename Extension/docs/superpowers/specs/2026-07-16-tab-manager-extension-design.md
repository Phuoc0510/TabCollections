# Tab Collection Extension — Design Spec

## Overview

A Chrome/Brave extension that lets users manually collect tabs into topic-based groups (workspaces/sessions) and view/manage them on the new tab page.

## Architecture

Four components communicating via `chrome.runtime.sendMessage`:

| Component | File | Role |
|---|---|---|
| **New Tab Page** | `newtab/` | Overrides `chrome://newtab`; displays groups and tab entries |
| **Popup** | `popup/` | Opens when user clicks extension icon; select tabs → add to group |
| **Service Worker** | `background.js` | Storage operations, context menu, messaging hub, tab lifecycle |
| **Storage Layer** | `storage.js` | `chrome.storage.local` wrapper + export/import logic |

## Data Model

```
Group {
  id: string          // UUID
  name: string        // e.g. "Work", "Dev", "Read"
  icon: string        // emoji string or fallback
  createdAt: number   // Date.now()
  updatedAt: number   // Date.now()
}

TabEntry {
  id: string          // UUID
  title: string       // page title at time of save
  url: string         // full URL
  favicon: string     // favicon URL or empty
  groupId: string     // FK → Group.id
  addedAt: number     // Date.now()
}
```

Storage key: `tabCollector` → `{ groups: {[id]: Group}, tabs: {[id]: TabEntry} }`

## New Tab Page UI

- Layout: grid of group cards, grouped collections
- Each group card: icon + name + tab count + last-updated relative time
- Click group card → expand to tab list (back navigation to groups)
- Each tab in list: favicon + title + URL (truncated) + delete button + click to open
- Header: "Tab Collections" + [New Group] [Export] [Import]
- Group detail view: [Open All] [Edit] [Delete] buttons

## Popup UI

- Lists all tabs in current window with checkboxes
- Checkbox selection + "Add to Group" dropdown
- Dropdown lists existing groups + "New Group" option
- "Manage Groups" link opens new tab page
- Context menu (background.js): right-click tab → "Add to Tab Collection" → submenu of groups

## Storage & Persistence

- `chrome.storage.local` for all data (~5MB quota)
- Export: generates JSON file (`{ version, exportedAt, groups[], tabs[] }`), triggers browser download
- Import: file input → read JSON → validate schema → merge into storage
- Duplicate URLs within same group: skipped
- Empty groups: user can delete manually

## Tab Lifecycle

- Saved tabs retain title + URL + favicon snapshot even after the original tab is closed
- Clicking a saved tab always opens the URL in a new tab
- Badge/highlight optional for currently-open vs saved tabs (post-MVP)

## Edge Cases

- Tab without favicon → fallback globe icon
- URL changed after save → stored URL used (user can delete + re-add)
- Storage near quota → console warning only (MVP)
- Extension uninstall → data lost (user must export first)
- Import with conflicting group names → append "(imported)"

## Implementation Plan

See next step — writing-plans skill invoked after spec approval.
