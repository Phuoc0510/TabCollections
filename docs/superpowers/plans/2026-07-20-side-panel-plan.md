# Side Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Chrome Side Panel that lets users browse collections and tabs view-only via `Ctrl+Shift+S` / `Cmd+Shift+S`.

**Architecture:** Three standalone side panel files (HTML/JS/CSS) that fetch data via `chrome.runtime.sendMessage` from the existing background service worker. Manifest is extended with `sidePanel` permission and a keyboard shortcut. The popup remains untouched.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JS, CSS3.

---

### Task 1: Manifest + Background Changes

**Files:**
- Modify: `manifest.json`
- Modify: `background.js`

- [ ] **Step 1: Add `sidePanel` permission to manifest.json**

Find the `"permissions"` array and add `"sidePanel"`:

```
"permissions": [
  "storage",
  "contextMenus",
  "tabs",
  "sidePanel"
]
```

- [ ] **Step 2: Add `side_panel` config to manifest.json**

After the `"action"` block (before `"chrome_url_overrides"`), add:

```json
"side_panel": {
  "default_path": "sidepanel/sidepanel.html"
}
```

- [ ] **Step 3: Add `open-side-panel` command to manifest.json**

In the `"commands"` object, after `"quick-save"`, add:

```json
"open-side-panel": {
  "suggested_key": {
    "default": "Ctrl+Shift+S",
    "mac": "Command+Shift+S"
  },
  "description": "Open Side Panel"
}
```

- [ ] **Step 4: Add command handler to background.js**

At the END of `background.js` (after the existing quick-save handler), add:

```js
chrome.commands.onCommand.addListener((command) => {
  if (command === 'open-side-panel') {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (tab) chrome.sidePanel.open({ windowId: tab.windowId });
    });
  }
});
```

- [ ] **Step 5: Commit**

```bash
git add manifest.json background.js
git commit -m "feat: add sidePanel permission, config, and keyboard shortcut"
```

---

### Task 2: Create Side Panel Files

**Files:**
- Create: `sidepanel/sidepanel.html`
- Create: `sidepanel/sidepanel.js`
- Create: `sidepanel/sidepanel.css`

- [ ] **Step 1: Create `sidepanel/` directory**

```bash
mkdir -p sidepanel
```

- [ ] **Step 2: Create `sidepanel/sidepanel.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
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

- [ ] **Step 3: Create `sidepanel/sidepanel.js`**

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

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

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
            ${t.favicon ? `<img src="${t.favicon}" alt="" onerror="this.style.display='none'">` : ''}
            <div class="tab-info">
              <div class="tab-title">${esc(t.title || t.url)}</div>
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

- [ ] **Step 4: Create `sidepanel/sidepanel.css`**

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
  font-family: inherit;
  font-size: inherit;
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

- [ ] **Step 5: Commit**

```bash
git add sidepanel/
git commit -m "feat: add side panel with view-only collection browser"
```

---

### Task 3: Final Verification

- [ ] **Step 1: Run lint**

```bash
npm run lint 2>&1 | grep -E "error"
```

Expected: 0 errors (warnings from storage.test.js are pre-existing).

- [ ] **Step 2: Add eslint globals if needed**

If lint complains about `chrome` or other globals in sidepanel.js (add to `eslint.config.js` if needed), fix and re-run.

- [ ] **Step 3: Run tests**

```bash
node storage.test.js
```

Expected: `All tests passed.`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: lint fixes and final cleanup"
```
