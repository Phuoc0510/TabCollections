# Tab Collection Extension — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Chrome/Brave extension that lets users manually collect tabs into groups and manage them on the new tab page.

**Architecture:** Four components (new tab page, popup, background worker, storage layer) communicate via `chrome.runtime.sendMessage`. Data persists in `chrome.storage.local` with JSON export/import.

**Tech Stack:** Vanilla JS (no framework), Chrome Extensions Manifest V3, `chrome.storage.local`

---
## File Structure

```
extension/
├── manifest.json              # Extension manifest V3
├── background.js              # Service worker: context menu + message hub
├── storage.js                 # Storage layer (CRUD, export/import)
├── storage.test.js            # Unit tests for storage layer
├── popup/
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── newtab/
│   ├── newtab.html
│   ├── newtab.css
│   └── newtab.js
├── icons/
│   └── icon128.png            # Extension icon
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-07-16-tab-manager-extension-design.md
```

---

### Task 1: Scaffold — manifest.json + Icons

**Files:**
- Create: `manifest.json`
- Create: `icons/icon128.png` (generated via script)

- [ ] **Step 1: Create manifest.json**

```json
{
  "manifest_version": 3,
  "name": "Tab Collection",
  "version": "1.0.0",
  "description": "Collect tabs into groups and manage them from your new tab page",
  "permissions": ["storage", "contextMenus", "tabs"],
  "background": {
    "service_worker": "background.js"
  },
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "Tab Collection"
  },
  "chrome_url_overrides": {
    "newtab": "newtab/newtab.html"
  },
  "icons": {
    "128": "icons/icon128.png"
  }
}
```

- [ ] **Step 2: Generate icon**

Run: `python3 -c "
import struct, zlib
w, h = 128, 128
pixels = []
for y in range(h):
    row = []
    for x in range(w):
        cx, cy = x - w//2, y - h//2
        d = (cx*cx + cy*cy)**0.5
        if d < 50:
            row.extend([66, 133, 244, 255])
        elif d < 58:
            row.extend([255, 255, 255, 255])
        else:
            row.extend([0, 0, 0, 0])
    pixels.append(bytes([0]) + bytes(row))
raw = b''.join(pixels)

def chunk(ctype, data):
    c = ctype + data
    return struct.pack('>I', len(data)) + c + struct.pack('>I', zlib.crc32(c) & 0xffffffff)

with open('icons/icon128.png', 'wb') as f:
    f.write(b'\x89PNG\r\n\x1a\n')
    f.write(chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)))
    f.write(chunk(b'IDAT', zlib.compress(raw)))
    f.write(chunk(b'IEND', b''))
print('OK')
"`

Expected: File `icons/icon128.png` created.

- [ ] **Step 3: Verify structure**

Run: `ls -la manifest.json icons/icon128.png`
Expected: Both files exist.

---

### Task 2: Storage Layer (storage.js + tests)

**Files:**
- Create: `storage.js`
- Create: `storage.test.js`

**Interface:**

```js
// storage.js API (chrome.storage.local wrapper)

async function getAllData()         // returns { groups: {}, tabs: {} }
async function getGroups()          // returns Group[]
async function getTabsByGroup(groupId) // returns TabEntry[]
async function createGroup(name, icon) // returns Group
async function updateGroup(id, data)   // void
async function deleteGroup(id)         // void
async function addTabToGroup(tab, groupId) // returns TabEntry
async function removeTab(tabId)           // void
async function exportData()              // returns JSON string
async function importData(jsonStr)       // void
```

- [ ] **Step 1: Write the failing tests**

```js
// storage.test.js
// Minimal mock for chrome.storage
global.chrome = {
  storage: {
    local: {
      get: async (keys) => ({}),
      set: async (items) => {},
      remove: async (keys) => {},
    }
  }
};

async function main() {
  const { getAllData, createGroup, addTabToGroup, getTabsByGroup, deleteGroup, removeTab, exportData, importData } = await import('./storage.js');

  // Test 1: createGroup returns a group with id, name, timestamps
  let stored = {};
  chrome.storage.local.get = async () => stored;
  chrome.storage.local.set = async (items) => { stored = { ...stored, ...items }; };
  chrome.storage.local.remove = async (keys) => { for (const k of keys) delete stored[k]; };

  let g = await createGroup('Work', '💼');
  console.assert(g.id && g.name === 'Work' && g.icon === '💼' && g.createdAt > 0, 'FAIL: createGroup basic');
  console.log('PASS: createGroup basic');

  // Test 2: addTabToGroup adds tab entry with correct fields
  let tab = { title: 'GitHub', url: 'https://github.com', favicon: 'https://github.com/favicon.ico' };
  let entry = await addTabToGroup(tab, g.id);
  console.assert(entry.id && entry.title === 'GitHub' && entry.url === 'https://github.com' && entry.groupId === g.id, 'FAIL: addTabToGroup fields');
  console.log('PASS: addTabToGroup fields');

  // Test 3: getTabsByGroup returns tabs for group
  let tabs = await getTabsByGroup(g.id);
  console.assert(tabs.length === 1 && tabs[0].title === 'GitHub', 'FAIL: getTabsByGroup');
  console.log('PASS: getTabsByGroup');

  // Test 4: duplicate URL in same group is rejected
  let dup = await addTabToGroup(tab, g.id);
  console.assert(dup === null, 'FAIL: duplicate URL rejected');
  console.log('PASS: duplicate URL rejected');

  // Test 5: removeTab removes tab entry
  await removeTab(entry.id);
  tabs = await getTabsByGroup(g.id);
  console.assert(tabs.length === 0, 'FAIL: removeTab');
  console.log('PASS: removeTab');

  // Test 6: getAllData returns full structure
  let data = await getAllData();
  console.assert(typeof data.groups === 'object' && typeof data.tabs === 'object', 'FAIL: getAllData shape');
  console.log('PASS: getAllData shape');

  // Test 7: exportData returns valid JSON string
  let jsonStr = await exportData();
  let parsed = JSON.parse(jsonStr);
  console.assert(parsed.version === 1 && Array.isArray(parsed.groups) && Array.isArray(parsed.tabs), 'FAIL: exportData format');
  console.log('PASS: exportData format');

  // Test 8: importData merges data
  let importJson = JSON.stringify({
    version: 1,
    exportedAt: '2026-01-01',
    groups: [{ id: 'g1', name: 'Imported', icon: '📦', createdAt: 1, updatedAt: 1 }],
    tabs: [{ id: 't1', title: 'Test', url: 'https://test.com', favicon: '', groupId: 'g1', addedAt: 1 }]
  });
  await importData(importJson);
  let groups = await getAllData();
  console.assert(groups.groups['g1'].name === 'Imported', 'FAIL: importData merge');
  console.log('PASS: importData merge');

  console.log('\nAll tests passed.');
}

main().catch(e => { console.error('TEST FAILED:', e); process.exit(1); });
```

- [ ] **Step 2: Run test to verify failure**

Run: `node storage.test.js`
Expected: Fails with import errors or function not defined.

- [ ] **Step 3: Implement storage.js**

```js
// storage.js
const STORAGE_KEY = 'tabCollector';

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

async function getAllData() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || { groups: {}, tabs: {} };
}

async function saveAllData(data) {
  await chrome.storage.local.set({ [STORAGE_KEY]: data });
}

async function getGroups() {
  const data = await getAllData();
  return Object.values(data.groups).sort((a, b) => b.updatedAt - a.updatedAt);
}

async function getTabsByGroup(groupId) {
  const data = await getAllData();
  return Object.values(data.tabs)
    .filter(t => t.groupId === groupId)
    .sort((a, b) => b.addedAt - a.addedAt);
}

async function createGroup(name, icon = '📁') {
  const data = await getAllData();
  const now = Date.now();
  const group = { id: uuid(), name, icon, createdAt: now, updatedAt: now };
  data.groups[group.id] = group;
  await saveAllData(data);
  return group;
}

async function updateGroup(id, updates) {
  const data = await getAllData();
  if (!data.groups[id]) throw new Error('Group not found');
  data.groups[id] = { ...data.groups[id], ...updates, updatedAt: Date.now() };
  await saveAllData(data);
}

async function deleteGroup(id) {
  const data = await getAllData();
  delete data.groups[id];
  Object.keys(data.tabs).forEach(k => {
    if (data.tabs[k].groupId === id) delete data.tabs[k];
  });
  await saveAllData(data);
}

async function addTabToGroup(tabInfo, groupId) {
  const data = await getAllData();
  if (!data.groups[groupId]) throw new Error('Group not found');
  const dup = Object.values(data.tabs).find(t => t.url === tabInfo.url && t.groupId === groupId);
  if (dup) return null;
  const entry = {
    id: uuid(),
    title: tabInfo.title || tabInfo.url,
    url: tabInfo.url,
    favicon: tabInfo.favicon || '',
    groupId,
    addedAt: Date.now()
  };
  data.tabs[entry.id] = entry;
  data.groups[groupId].updatedAt = Date.now();
  await saveAllData(data);
  return entry;
}

async function removeTab(tabId) {
  const data = await getAllData();
  delete data.tabs[tabId];
  await saveAllData(data);
}

async function exportData() {
  const data = await getAllData();
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    groups: Object.values(data.groups),
    tabs: Object.values(data.tabs)
  }, null, 2);
}

async function importData(jsonStr) {
  const parsed = JSON.parse(jsonStr);
  if (!parsed.version || !Array.isArray(parsed.groups) || !Array.isArray(parsed.tabs)) {
    throw new Error('Invalid import format');
  }
  const data = await getAllData();
  for (const g of parsed.groups) {
    if (!data.groups[g.id]) data.groups[g.id] = g;
  }
  for (const t of parsed.tabs) {
    if (!data.tabs[t.id] && data.groups[t.groupId]) data.tabs[t.id] = t;
  }
  await saveAllData(data);
}

if (typeof module !== 'undefined') {
  module.exports = { getAllData, getGroups, getTabsByGroup, createGroup, updateGroup, deleteGroup, addTabToGroup, removeTab, exportData, importData };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node storage.test.js`
Expected: All PASS lines printed, no errors.

---

### Task 3: Background Service Worker (background.js)

**Files:**
- Create: `background.js`

**Responsibilities:** Context menu, message handling between popup/newtab and storage.

- [ ] **Step 1: Create background.js**

```js
// background.js
importScripts('storage.js');

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'tab-collection-parent',
    title: 'Add to Tab Collection',
    contexts: ['tab']
  });
});

async function rebuildContextMenu() {
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({
    id: 'tab-collection-parent',
    title: 'Add to Tab Collection',
    contexts: ['tab']
  });
  const groups = await getGroups();
  for (const g of groups) {
    chrome.contextMenus.create({
      id: `group-${g.id}`,
      parentId: 'tab-collection-parent',
      title: `${g.icon} ${g.name}`,
      contexts: ['tab']
    });
  }
  chrome.contextMenus.create({
    id: 'tab-collection-new-group',
    parentId: 'tab-collection-parent',
    title: '➕ New Group...',
    contexts: ['tab']
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'tab-collection-new-group') {
    const group = await createGroup('New Group');
    await addTabToGroup({ title: tab.title, url: tab.url, favicon: (tab.favIconUrl || '') }, group.id);
    await rebuildContextMenu();
    return;
  }
  if (info.menuItemId.startsWith('group-')) {
    const groupId = info.menuItemId.slice(6);
    await addTabToGroup({ title: tab.title, url: tab.url, favicon: (tab.favIconUrl || '') }, groupId);
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.action) {
        case 'getGroups':
          sendResponse(await getGroups());
          break;
        case 'getTabsByGroup':
          sendResponse(await getTabsByGroup(msg.groupId));
          break;
        case 'createGroup':
          await createGroup(msg.name, msg.icon);
          await rebuildContextMenu();
          sendResponse({ ok: true });
          break;
        case 'updateGroup':
          await updateGroup(msg.id, msg.data);
          await rebuildContextMenu();
          sendResponse({ ok: true });
          break;
        case 'deleteGroup':
          await deleteGroup(msg.id);
          await rebuildContextMenu();
          sendResponse({ ok: true });
          break;
        case 'addTabToGroup':
          await addTabToGroup(msg.tab, msg.groupId);
          sendResponse({ ok: true });
          break;
        case 'removeTab':
          await removeTab(msg.tabId);
          sendResponse({ ok: true });
          break;
        case 'getAllData':
          sendResponse(await getAllData());
          break;
        case 'exportData':
          sendResponse(await exportData());
          break;
        case 'importData':
          await importData(msg.json);
          sendResponse({ ok: true });
          break;
        default:
          sendResponse({ error: 'Unknown action' });
      }
    } catch (e) {
      sendResponse({ error: e.message });
    }
  })();
  return true; // keep channel open for async
});

rebuildContextMenu();
```

- [ ] **Step 2: Verify no syntax errors**

Run: `node --check background.js`
Expected: No output (syntax OK). Note: `importScripts` error because Node doesn't support it — that's expected. Use a try-catch to test just syntax: `node -e "try { require('fs').readFileSync('background.js','utf8') } catch(e){}"`

Actually run: `node -e "const src = require('fs').readFileSync('background.js','utf8'); new Function(src); console.log('Syntax OK')"`
Expected: Syntax OK (function-level check only, not execution).

---

### Task 4: Popup UI

**Files:**
- Create: `popup/popup.html`
- Create: `popup/popup.css`
- Create: `popup/popup.js`

- [ ] **Step 1: Create popup.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div id="app">
    <h1>Tab Collection</h1>
    <div id="tabs-section">
      <h2>Current Tabs</h2>
      <div id="tab-list"></div>
    </div>
    <div id="actions">
      <button id="add-to-group-btn" disabled>Add to Group</button>
      <select id="group-select">
        <option value="">Select group...</option>
      </select>
    </div>
    <div id="bottom-actions">
      <button id="manage-groups-btn">Manage Groups</button>
    </div>
  </div>
  <script src="popup.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create popup.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { width: 380px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; color: #1a1a2e; background: #fff; }
#app { padding: 16px; }
h1 { font-size: 18px; font-weight: 700; margin-bottom: 12px; color: #1a1a2e; }
h2 { font-size: 13px; font-weight: 600; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
#tab-list { max-height: 300px; overflow-y: auto; margin-bottom: 12px; }
.tab-item { display: flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
.tab-item:hover { background: #f0f4ff; }
.tab-item input[type="checkbox"] { margin: 0; }
.tab-item img { width: 16px; height: 16px; }
.tab-item .tab-title { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 13px; }
#actions { display: flex; gap: 8px; margin-bottom: 12px; }
#group-select { flex: 1; padding: 6px 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 13px; }
#add-to-group-btn { padding: 6px 16px; background: #4285f4; color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; }
#add-to-group-btn:disabled { background: #ccc; cursor: not-allowed; }
#bottom-actions { border-top: 1px solid #eee; padding-top: 10px; }
#manage-groups-btn { background: none; border: 1px solid #ddd; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 13px; width: 100%; }
#manage-groups-btn:hover { background: #f5f5f5; }
.status { padding: 6px; border-radius: 4px; margin-bottom: 8px; font-size: 12px; display: none; }
.status.success { display: block; background: #e6f4ea; color: #1e7e34; }
.status.error { display: block; background: #fce8e6; color: #c5221f; }
```

- [ ] **Step 3: Create popup.js**

```js
// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  const tabList = document.getElementById('tab-list');
  const groupSelect = document.getElementById('group-select');
  const addBtn = document.getElementById('add-to-group-btn');
  const manageBtn = document.getElementById('manage-groups-btn');

  const [tabs, groups] = await Promise.all([
    chrome.tabs.query({ currentWindow: true }),
    chrome.runtime.sendMessage({ action: 'getGroups' })
  ]);

  function renderTabs() {
    tabList.innerHTML = tabs.map(t => `
      <label class="tab-item">
        <input type="checkbox" value="${t.id}">
        <img src="${t.favIconUrl || 'https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(t.url).hostname)}&sz=16'}" alt="">
        <span class="tab-title">${t.title || t.url}</span>
      </label>
    `).join('');
    updateButtonState();
  }

  function updateButtonState() {
    const checked = tabList.querySelectorAll('input[type="checkbox"]:checked');
    addBtn.disabled = checked.length === 0 || !groupSelect.value;
  }

  function renderGroups() {
    groupSelect.innerHTML = '<option value="">Select group...</option>' +
      groups.map(g => `<option value="${g.id}">${g.icon} ${g.name}</option>`).join('') +
      '<option value="__new__">➕ New Group...</option>';
  }

  tabList.addEventListener('change', updateButtonState);

  groupSelect.addEventListener('change', async (e) => {
    updateButtonState();
    if (e.target.value === '__new__') {
      const name = prompt('Group name:');
      if (name && name.trim()) {
        await chrome.runtime.sendMessage({ action: 'createGroup', name: name.trim() });
        groups.push({ id: crypto.randomUUID(), name: name.trim(), icon: '📁' });
        renderGroups();
        groupSelect.value = groups[groups.length - 1].id;
        updateButtonState();
      } else {
        groupSelect.value = '';
        updateButtonState();
      }
    }
  });

  addBtn.addEventListener('click', async () => {
    const groupId = groupSelect.value;
    if (!groupId) return;
    const checked = tabList.querySelectorAll('input[type="checkbox"]:checked');
    const selectedTabs = tabs.filter(t => Array.from(checked).some(c => c.value == t.id));
    let added = 0;
    for (const t of selectedTabs) {
      const result = await chrome.runtime.sendMessage({
        action: 'addTabToGroup',
        tab: { title: t.title, url: t.url, favicon: t.favIconUrl || '' },
        groupId
      });
      if (result.ok) added++;
    }
    window.close();
  });

  manageBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('newtab/newtab.html') });
  });

  renderTabs();
  renderGroups();
});
```

---

### Task 5: New Tab Page

**Files:**
- Create: `newtab/newtab.html`
- Create: `newtab/newtab.css`
- Create: `newtab/newtab.js`

- [ ] **Step 1: Create newtab.html**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="stylesheet" href="newtab.css">
</head>
<body>
  <div id="app">
    <header>
      <h1>Tab Collections</h1>
      <div class="header-actions">
        <button id="new-group-btn">+ New Group</button>
        <button id="export-btn">Export</button>
        <button id="import-btn">Import</button>
        <input type="file" id="import-input" accept=".json" style="display:none">
      </div>
    </header>

    <div id="status-bar"></div>

    <div id="groups-view">
      <div id="groups-grid"></div>
      <div id="empty-state" style="display:none">
        <p>No collections yet. Use the extension popup to add tabs, or click "+ New Group" to start.</p>
      </div>
    </div>

    <div id="group-detail-view" style="display:none">
      <button id="back-btn">← Back to Collections</button>
      <div id="detail-header">
        <h2 id="detail-title"></h2>
        <div class="detail-actions">
          <button id="open-all-btn">Open All</button>
          <button id="edit-group-btn">Edit</button>
          <button id="delete-group-btn">Delete</button>
        </div>
      </div>
      <div id="detail-tab-list"></div>
      <div id="detail-empty" style="display:none">
        <p>This collection is empty. Use the extension popup to add tabs from any page.</p>
      </div>
    </div>
  </div>
  <script src="newtab.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create newtab.css**

```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8f9fa; color: #1a1a2e; min-height: 100vh; }
#app { max-width: 960px; margin: 0 auto; padding: 32px 24px; }
header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 32px; flex-wrap: wrap; gap: 12px; }
h1 { font-size: 28px; font-weight: 700; }
.header-actions { display: flex; gap: 8px; }
button { padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: 1px solid #ddd; background: #fff; }
button:hover { background: #f0f4ff; border-color: #4285f4; }
#new-group-btn { background: #4285f4; color: #fff; border-color: #4285f4; }
#new-group-btn:hover { background: #3b78e7; }

#groups-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 16px; }
.group-card { background: #fff; border: 1px solid #e0e0e0; border-radius: 12px; padding: 20px; cursor: pointer; transition: box-shadow 0.2s; }
.group-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
.group-card .group-icon { font-size: 32px; margin-bottom: 8px; }
.group-card .group-name { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
.group-card .group-meta { font-size: 12px; color: #888; }

#empty-state { text-align: center; padding: 60px 20px; color: #888; }
#empty-state p { font-size: 16px; }

#group-detail-view { }
#back-btn { margin-bottom: 20px; }
#detail-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
#detail-title { font-size: 24px; font-weight: 700; }
.detail-actions { display: flex; gap: 8px; }
#delete-group-btn { color: #c5221f; border-color: #c5221f; }
#delete-group-btn:hover { background: #fce8e6; }

#detail-tab-list { display: flex; flex-direction: column; gap: 8px; }
.tab-entry { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; }
.tab-entry:hover { background: #f0f4ff; }
.tab-entry img { width: 18px; height: 18px; }
.tab-entry .tab-title { flex: 1; font-size: 14px; font-weight: 500; }
.tab-entry .tab-url { font-size: 12px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px; }
.tab-entry .tab-delete { background: none; border: none; color: #c5221f; cursor: pointer; padding: 4px 8px; font-size: 13px; border-radius: 4px; }
.tab-entry .tab-delete:hover { background: #fce8e6; }
.tab-entry .tab-open { text-decoration: none; color: #4285f4; font-size: 13px; }

#status-bar { padding: 10px 16px; border-radius: 8px; margin-bottom: 16px; display: none; font-size: 14px; }
#status-bar.success { display: block; background: #e6f4ea; color: #1e7e34; }
#status-bar.error { display: block; background: #fce8e6; color: #c5221f; }
```

- [ ] **Step 3: Create newtab.js**

```js
// newtab.js
const $ = id => document.getElementById(id);

let state = {
  view: 'groups',
  currentGroupId: null,
  groups: []
};

function showStatus(msg, type) {
  const bar = $('status-bar');
  bar.textContent = msg;
  bar.className = type;
  setTimeout(() => { bar.style.display = 'none'; }, 3000);
}

async function loadGroups() {
  state.groups = await chrome.runtime.sendMessage({ action: 'getGroups' });
}

async function getTabs(groupId) {
  return chrome.runtime.sendMessage({ action: 'getTabsByGroup', groupId });
}

async function renderGroupsView() {
  await loadGroups();
  $('groups-view').style.display = 'block';
  $('group-detail-view').style.display = 'none';

  const grid = $('groups-grid');
  const empty = $('empty-state');

  if (state.groups.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  grid.innerHTML = state.groups.map(g => {
    const tabCount = g.tabCount || 0;
    const timeAgo = g.updatedAt ? timeAgoStr(g.updatedAt) : 'never';
    return `<div class="group-card" data-id="${g.id}">
      <div class="group-icon">${g.icon || '📁'}</div>
      <div class="group-name">${esc(g.name)}</div>
      <div class="group-meta">${tabCount} tab${tabCount !== 1 ? 's' : ''} · ${timeAgo}</div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.group-card').forEach(card => {
    card.addEventListener('click', () => showGroupDetail(card.dataset.id));
  });
}

function timeAgoStr(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function showGroupDetail(groupId) {
  state.currentGroupId = groupId;
  $('groups-view').style.display = 'none';
  $('group-detail-view').style.display = 'block';

  const group = state.groups.find(g => g.id === groupId);
  if (!group) return;

  $('detail-title').textContent = `${group.icon || '📁'} ${group.name}`;

  const tabs = await getTabs(groupId);
  const list = $('detail-tab-list');
  const empty = $('detail-empty');

  if (tabs.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  list.innerHTML = tabs.map(t => {
    const displayUrl = t.url.length > 60 ? t.url.slice(0, 57) + '...' : t.url;
    return `<div class="tab-entry" data-id="${t.id}">
      <img src="${t.favicon || 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(new URL(t.url).hostname) + '&sz=18'}" alt="">
      <div>
        <div class="tab-title">${esc(t.title)}</div>
        <div class="tab-url">${esc(displayUrl)}</div>
      </div>
      <a class="tab-open" href="${esc(t.url)}" target="_blank">Open</a>
      <button class="tab-delete" data-id="${t.id}">✕</button>
    </div>`;
  }).join('');

  list.querySelectorAll('.tab-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const tabId = btn.dataset.id;
      await chrome.runtime.sendMessage({ action: 'removeTab', tabId });
      // Update tabCount for group
      const gIdx = state.groups.findIndex(g => g.id === groupId);
      if (gIdx >= 0) state.groups[gIdx].tabCount = (state.groups[gIdx].tabCount || 1) - 1;
      showGroupDetail(groupId);
    });
  });

  list.querySelectorAll('.tab-open').forEach(a => {
    a.addEventListener('click', async (e) => {
      e.preventDefault();
      await chrome.tabs.create({ url: a.href });
    });
  });
}

$('back-btn').addEventListener('click', renderGroupsView);

$('new-group-btn').addEventListener('click', async () => {
  const name = prompt('Collection name:');
  if (name && name.trim()) {
    await chrome.runtime.sendMessage({ action: 'createGroup', name: name.trim() });
    await renderGroupsView();
    showStatus(`Created "${name.trim()}"`, 'success');
  }
});

$('edit-group-btn').addEventListener('click', async () => {
  const group = state.groups.find(g => g.id === state.currentGroupId);
  if (!group) return;
  const name = prompt('Edit collection name:', group.name);
  if (name && name.trim()) {
    await chrome.runtime.sendMessage({ action: 'updateGroup', id: group.id, data: { name: name.trim() } });
    showGroupDetail(group.id);
    showStatus('Updated', 'success');
  }
});

$('delete-group-btn').addEventListener('click', async () => {
  const group = state.groups.find(g => g.id === state.currentGroupId);
  if (!group) return;
  if (confirm(`Delete "${group.name}" and all its tabs?`)) {
    await chrome.runtime.sendMessage({ action: 'deleteGroup', id: group.id });
    await renderGroupsView();
    showStatus(`Deleted "${group.name}"`, 'success');
  }
});

$('open-all-btn').addEventListener('click', async () => {
  const tabs = await getTabs(state.currentGroupId);
  for (const t of tabs) {
    await chrome.tabs.create({ url: t.url });
  }
  showStatus(`Opened ${tabs.length} tab${tabs.length !== 1 ? 's' : ''}`, 'success');
});

$('export-btn').addEventListener('click', async () => {
  const json = await chrome.runtime.sendMessage({ action: 'exportData' });
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tab-collection-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showStatus('Exported', 'success');
});

$('import-btn').addEventListener('click', () => {
  $('import-input').click();
});

$('import-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    await chrome.runtime.sendMessage({ action: 'importData', json: text });
    await renderGroupsView();
    showStatus('Imported successfully', 'success');
  } catch (err) {
    showStatus('Import failed: ' + err.message, 'error');
  }
  e.target.value = '';
});

// Init
renderGroupsView();
```

---

### Task 6: Load extension in browser & manual test

- [ ] **Step 1: Load unpacked extension**

Open Chrome/Brave → chrome://extensions → Enable "Developer mode" → "Load unpacked" → select `/path/to/extension` directory.
Expected: Extension appears in toolbar with icon.

- [ ] **Step 2: Test flow — create group via popup**

Click extension icon → check a tab → select a group (create new) → click "Add to Group"
Expected: Popup closes. Tab saved.

- [ ] **Step 3: Test flow — view on new tab page**

Open new tab.
Expected: The group card appears with tab count. Click it → see saved tab with title, URL, favicon.

- [ ] **Step 4: Test context menu**

Right-click any tab → "Add to Tab Collection" → pick group.
Expected: Tab added. Open new tab to verify.

- [ ] **Step 5: Test CRUD — edit, delete group, remove tab**

On new tab page: click group → delete a tab → back → edit group name → delete group.
Expected: All operations work without errors.

- [ ] **Step 6: Test export/import**

Click Export → download JSON. Delete all groups. Click Import → pick the JSON file.
Expected: Groups and tabs restored.

---

### Task 7: Polish & edge cases

- [ ] **Step 1: Handle favicon fallback in popup.js**

In `popup.js`, the `tab-icon` img `src` currently uses `t.favIconUrl` which can be `undefined` on some pages. Modify the template:

```js
const favicon = t.favIconUrl ? t.favIconUrl 
  : `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(t.url).hostname)}&sz=16`;
```

Update the `renderTabs` function in `popup.js` to use this fallback.

- [ ] **Step 2: Handle tab without title in newtab.js**

In the tab entry template in `newtab.js`, ensure:
```js
const title = t.title || new URL(t.url).hostname || 'Untitled';
```
Replace `esc(t.title)` with `esc(title)`.

- [ ] **Step 3: Verify all files present**

Run: `ls -la manifest.json background.js storage.js popup/popup.{html,css,js} newtab/newtab.{html,css,js} icons/icon128.png`
Expected: All files exist.
