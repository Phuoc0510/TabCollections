# Side Panel for Tab Collection

> Add a Chrome Side Panel to browse collections and tabs without opening the
> new tab page. View-only, opened via keyboard shortcut.

## Architecture

```
Manifest ─→ sidePanel.default_path = sidepanel/sidepanel.html
                 │
  Ctrl+Shift+S ─→ background.js → chrome.sidePanel.open()
                 │
    sidepanel.html ─→ imports storage.js + constants.js via script tags
    sidepanel.js  ─→ getGroups() → render collapsible cards
                 │
                 └→ click tab → chrome.tabs.create({ url })
```

- Uses `chrome.runtime.sendMessage` to fetch data from the background service
  worker (same pattern as newtab.js).
- View-only: no create/edit/delete buttons, no search, no view toggle.
- Style inherits from the shared CSS variables used by newtab.

## Manifest Changes

Add `sidePanel` permission and configure the panel path:

```json
{
  "permissions": [
    "storage",
    "contextMenus",
    "tabs",
    "sidePanel"
  ],
  "side_panel": {
    "default_path": "sidepanel/sidepanel.html"
  },
  "commands": {
    "quick-save": { ... },
    "open-side-panel": {
      "suggested_key": {
        "default": "Ctrl+Shift+S",
        "mac": "Command+Shift+S"
      },
      "description": "Open Side Panel"
    }
  }
}
```

The existing `default_popup` (`popup/popup.html`) is kept unchanged — the
popup and side panel coexist.

## Background Changes

Add a second `chrome.commands.onCommand` listener in `background.js` for the
side panel (Chrome allows multiple listeners):

```js
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-side-panel') {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) chrome.sidePanel.open({ windowId: tab.windowId });
    });
  }
});
```

The existing `quick-save` handler chain stays as-is.

## New Files

```
sidepanel/
├── sidepanel.html
├── sidepanel.js
└── sidepanel.css
```

### sidepanel.html

Minimal HTML shell. Imports storage, constants, and sidepanel logic:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="../styles/variables.css">
  <link rel="stylesheet" href="../styles/glass.css">
  <link rel="stylesheet" href="../styles/components.css">
  <link rel="stylesheet" href="sidepanel.css">
</head>
<body>
  <header class="panel-header">
    <h1>📁 Tab Collections</h1>
  </header>
  <div id="panel-content">
    <div id="groups-list"></div>
    <div id="empty-state" class="empty-state" style="display:none">
      <p>No collections yet.</p>
    </div>
  </div>
  <script src="../constants.js"></script>
  <script src="sidepanel.js"></script>
</body>
</html>
```

### sidepanel.js

Render logic, view-only. No edit/create/delete/search:

```js
let groups = [];

async function loadAll() {
  groups = await chrome.runtime.sendMessage({ action: 'getGroups' });
  const data = await chrome.runtime.sendMessage({ action: 'getAllData' });
  for (const g of groups) {
    g.tabs = Object.values(data.tabs)
      .filter(t => t.groupId === g.id)
      .sort((a, b) => (b.position ?? b.addedAt) - (a.position ?? a.addedAt));
  }
}

function esc(s) { /* sanitization helper */ }

function render() {
  const list = document.getElementById('groups-list');
  const empty = document.getElementById('empty-state');

  if (groups.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = groups.map(g => `
    <details class="group-card" data-id="${g.id}">
      <summary class="group-header">
        <span class="group-icon">${g.icon || '📁'}</span>
        <span class="group-name">${esc(g.name)}</span>
        <span class="group-meta">${g.tabs.length} tab${g.tabs.length !== 1 ? 's' : ''}</span>
      </summary>
      <div class="group-tabs">
        ${g.tabs.map(t => `
          <div class="tab-entry" data-url="${esc(t.url)}">
            ${t.favicon ? `<img src="${t.favicon}" alt="">` : ''}
            <div class="tab-info">
              <div class="tab-title">${esc(t.title)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    </details>
  `).join('');
}

document.getElementById('groups-list').addEventListener('click', e => {
  const tabEntry = e.target.closest('.tab-entry');
  if (tabEntry) {
    chrome.tabs.create({ url: tabEntry.dataset.url });
  }
});

loadAll().then(render);
```

### sidepanel.css

Compact styles, inherits CSS variables:

```css
body {
  margin: 0;
  padding: 12px;
  font-family: 'Inter', sans-serif;
  background: var(--bg, #f5f5f7);
  color: var(--text-primary, #1a1a2e);
  font-size: 13px;
}

.panel-header h1 {
  font-size: 16px;
  margin: 0 0 12px;
  font-weight: 700;
}

.group-card {
  margin-bottom: 8px;
  border-radius: var(--radius-md);
  background: var(--glass-card-bg);
  border: 1px solid var(--border-color);
  overflow: hidden;
}

.group-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  cursor: pointer;
  font-weight: 600;
}

.group-icon { font-size: 18px; }
.group-name { flex: 1; }
.group-meta { font-size: 11px; color: var(--text-muted); }

.group-tabs {
  border-top: 1px solid var(--border-color);
}

.tab-entry {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px 6px 20px;
  cursor: pointer;
  transition: background 0.15s;
}

.tab-entry:hover {
  background: var(--hover-bg);
}

.tab-entry img {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.tab-info { flex: 1; min-width: 0; }
.tab-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
}
```

## Files Changed

| File | Change |
|------|--------|
| `manifest.json` | Add `sidePanel` permission, `side_panel` config, `open-side-panel` command |
| `background.js` | Add `chrome.commands.onCommand` handler for `open-side-panel` |
| `sidepanel/sidepanel.html` | Create — new file |
| `sidepanel/sidepanel.js` | Create — new file |
| `sidepanel/sidepanel.css` | Create — new file |

## Error Handling

- If `chrome.sidePanel.open` fails (e.g., no active tab), error is caught and
  logged (`.catch()` on the query callback).
- Empty state shown when no collections exist — no crash.
- Tab click with no URL: the tab entry won't be rendered without a URL, but
  if one somehow exists, `chrome.tabs.create` will fail silently.

## Testing

- Manual: open side panel with `Ctrl+Shift+S` / `Cmd+Shift+S`, verify
  collections + tabs render correctly, click tab opens URL.
- Edge cases: empty state, single collection, many tabs, long titles.
