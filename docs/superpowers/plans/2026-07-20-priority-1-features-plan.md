# Priority 1 Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add search, pin collections, grid/list view toggle, and undo/trash to the Tab Collection extension.

**Architecture:** Extend the existing storage layer (`storage.js`) with soft-delete and pin fields, wire up new message handlers in `background.js`, and build UI components in `newtab/` — all vanilla JS following existing patterns.

**Tech Stack:** Chrome Extension Manifest V3, vanilla JS, CSS3.

---

### Task 1: Storage Layer — new fields + functions

**Files:**
- Modify: `storage.js` (add fields, new functions, modify getGroups/getTabsByGroup)
- Test: `storage.test.js`

- [ ] **Step 1: Modify `getGroups` to filter deletedAt and sort pinned first**

```js
async function getGroups() {
  const data = await getAllData();
  return Object.values(data.groups)
    .filter(g => !g.deletedAt)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return (b.position ?? b.updatedAt) - (a.position ?? a.updatedAt);
    });
}
```

- [ ] **Step 2: Modify `getTabsByGroup` to filter deletedAt**

```js
async function getTabsByGroup(groupId) {
  const data = await getAllData();
  return Object.values(data.tabs)
    .filter(t => t.groupId === groupId && !t.deletedAt)
    .sort((a, b) => (b.position ?? b.addedAt) - (a.position ?? a.addedAt));
}
```

- [ ] **Step 3: Add `togglePinGroup` function**

```js
async function togglePinGroup(id) {
  const data = await getAllData();
  if (!data.groups[id]) throw new Error('Group not found');
  data.groups[id].pinned = !data.groups[id].pinned;
  await saveAllData(data);
}
```

- [ ] **Step 4: Add `softDeleteGroup` — sets deletedAt on group and all its tabs**

```js
async function softDeleteGroup(id) {
  const data = await getAllData();
  if (!data.groups[id]) throw new Error('Group not found');
  data.groups[id].deletedAt = Date.now();
  for (const tab of Object.values(data.tabs)) {
    if (tab.groupId === id) tab.deletedAt = Date.now();
  }
  await saveAllData(data);
}
```

- [ ] **Step 5: Add `softDeleteTab` — sets deletedAt on single tab**

```js
async function softDeleteTab(id) {
  const data = await getAllData();
  if (!data.tabs[id]) throw new Error('Tab not found');
  data.tabs[id].deletedAt = Date.now();
  await saveAllData(data);
}
```

- [ ] **Step 6: Add `restoreGroup` — clears deletedAt on group and its tabs**

```js
async function restoreGroup(id) {
  const data = await getAllData();
  if (!data.groups[id]) throw new Error('Group not found');
  data.groups[id].deletedAt = null;
  for (const tab of Object.values(data.tabs)) {
    if (tab.groupId === id) tab.deletedAt = null;
  }
  await saveAllData(data);
}
```

- [ ] **Step 7: Add `restoreTab` — clears deletedAt on single tab**

```js
async function restoreTab(id) {
  const data = await getAllData();
  if (!data.tabs[id]) throw new Error('Tab not found');
  data.tabs[id].deletedAt = null;
  await saveAllData(data);
}
```

- [ ] **Step 8: Add `purgeDeleted` — hard-deletes items past 30s window**

```js
async function purgeDeleted() {
  const data = await getAllData();
  const cutoff = Date.now() - 30000;
  let changed = false;
  for (const [id, group] of Object.entries(data.groups)) {
    if (group.deletedAt && group.deletedAt < cutoff) {
      delete data.groups[id];
      changed = true;
    }
  }
  for (const [id, tab] of Object.entries(data.tabs)) {
    if (tab.deletedAt && tab.deletedAt < cutoff) {
      delete data.tabs[id];
      changed = true;
    }
  }
  if (changed) await saveAllData(data);
}
```

- [ ] **Step 9: Keep the old `deleteGroup` and `removeTab` as hard-delete (used by purgeDeleted won't call them, export/import still use them).**

- [ ] **Step 10: Export all new functions at bottom of file**

Add to the existing `module.exports` line: `togglePinGroup, softDeleteGroup, softDeleteTab, restoreGroup, restoreTab, purgeDeleted`

- [ ] **Step 11: Commit**

```bash
git add storage.js
git commit -m "feat: add pin, soft-delete, and undo storage functions"
```

---

### Task 2: Background — message handlers + cleanup timer

**Files:**
- Modify: `background.js`

- [ ] **Step 1: Add message handlers for new actions**

Add these cases to the switch in `background.js`:

```js
case 'togglePinGroup':
  await togglePinGroup(msg.id);
  sendResponse({ ok: true });
  break;
case 'softDeleteGroup':
  await softDeleteGroup(msg.id);
  await rebuildContextMenu();
  sendResponse({ ok: true });
  break;
case 'softDeleteTab':
  await softDeleteTab(msg.tabId);
  sendResponse({ ok: true });
  break;
case 'restoreGroup':
  await restoreGroup(msg.id);
  await rebuildContextMenu();
  sendResponse({ ok: true });
  break;
case 'restoreTab':
  await restoreTab(msg.tabId);
  sendResponse({ ok: true });
  break;
```

- [ ] **Step 2: Add periodic purge timer at top level of background.js**

```js
// Purge soft-deleted items every 15s
setInterval(() => {
  purgeDeleted().catch(err => console.error('Purge failed:', err));
}, 15000);
```

- [ ] **Step 3: Commit**

```bash
git add background.js
git commit -m "feat: add background handlers for pin, soft-delete, and restore"
```

---

### Task 3: Search UI

**Files:**
- Modify: `newtab/newtab.html`, `newtab/newtab.js`, `newtab/newtab.css`

- [ ] **Step 1: Add search input to header in newtab.html**

Insert before `new-group-btn`:

```html
<input type="search" id="search-input" class="search-input" placeholder="🔍 Search collections and tabs...">
```

- [ ] **Step 2: Add search filter logic in newtab.js**

Add after the `esc` function:

```js
function matchesSearch(item, term) {
  if (!term) return true;
  const lower = term.toLowerCase();
  return item.name?.toLowerCase().includes(lower)
    || item.title?.toLowerCase().includes(lower)
    || item.url?.toLowerCase().includes(lower);
}
```

Modify `render()` — after loading groups, before creating HTML, apply filter when search term is non-empty:

```js
const searchTerm = $('search-input')?.value.trim().toLowerCase() || '';
let filteredGroups = groups;
if (searchTerm) {
  filteredGroups = groups.map(g => {
    const matchingTabs = (g.tabs || []).filter(t => matchesSearch(t, searchTerm));
    const nameMatch = matchesSearch(g, searchTerm);
    if (nameMatch || matchingTabs.length > 0) {
      return { ...g, tabs: nameMatch ? g.tabs : matchingTabs };
    }
    return null;
  }).filter(Boolean);
}
```

Use `filteredGroups` instead of `groups` when generating the grid HTML.

Add event listener after the header-actions section is built:

```js
$('search-input')?.addEventListener('input', () => {
  render();
});
```

- [ ] **Step 3: Add search input CSS in newtab.css**

```css
.search-input {
  padding: 8px 14px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  background: var(--glass-bg);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  width: 220px;
  outline: none;
  transition: border-color var(--transition-fast);
}

.search-input:focus {
  border-color: #4285f4;
}

.search-input::placeholder {
  color: var(--text-muted);
}
```

- [ ] **Step 4: Commit**

```bash
git add newtab/newtab.html newtab/newtab.js newtab/newtab.css
git commit -m "feat: add search with realtime filter by name, title, URL"
```

---

### Task 4: Pin UI

**Files:**
- Modify: `newtab/newtab.js`, `newtab/newtab.css`

- [ ] **Step 1: Add pin button to group card render in newtab.js**

In the `render()` function, inside the group card template, add before `group-chevron`:

```js
`<button class="group-pin-btn" data-id="${g.id}" title="${g.pinned ? 'Unpin' : 'Pin to top'}">${g.pinned ? '📌' : '📍'}</button>`
```

- [ ] **Step 2: Add pin click handler**

In the click event listener (before the toggle handler):

```js
const pinBtn = e.target.closest('.group-pin-btn');
if (pinBtn) {
  e.stopPropagation();
  await chrome.runtime.sendMessage({ action: 'togglePinGroup', id: pinBtn.dataset.id });
  await render();
  const g = groups.find(x => x.id === pinBtn.dataset.id);
  showStatus(g?.pinned ? 'Pinned to top' : 'Unpinned', 'success');
  return;
}
```

- [ ] **Step 3: Add pin button CSS in newtab.css**

```css
.group-pin-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 14px;
  padding: 2px 4px;
  opacity: 0.5;
  transition: opacity var(--transition-fast);
  line-height: 1;
}

.group-pin-btn:hover {
  opacity: 1;
}
```

- [ ] **Step 4: Commit**

```bash
git add newtab/newtab.js newtab/newtab.css
git commit -m "feat: add pin/unpin collections to top"
```

---

### Task 5: Grid / List View Toggle

**Files:**
- Modify: `newtab/newtab.html`, `newtab/newtab.js`, `newtab/newtab.css`

- [ ] **Step 1: Add toggle button in header (newtab.html)**

Insert after `new-group-btn`:

```html
<button id="view-toggle-btn" class="btn-ghost" title="Toggle view">▦ Grid</button>
```

- [ ] **Step 2: Add toggle logic in newtab.js**

Add after the privacy toggle:

```js
const VIEW_KEY = 'viewMode';

async function loadViewMode() {
  const result = await chrome.storage.local.get(VIEW_KEY);
  return result[VIEW_KEY] || 'grid';
}

async function toggleView() {
  const current = document.getElementById('groups-view').classList.contains('view-list') ? 'list' : 'grid';
  const next = current === 'grid' ? 'list' : 'grid';
  document.getElementById('groups-view').classList.toggle('view-list', next === 'list');
  document.getElementById('view-toggle-btn').textContent = next === 'grid' ? '▦ Grid' : '☰ List';
  await chrome.storage.local.set({ [VIEW_KEY]: next });
}

$('view-toggle-btn').addEventListener('click', toggleView);

// On init
loadViewMode().then(mode => {
  if (mode === 'list') {
    document.getElementById('groups-view').classList.add('view-list');
    document.getElementById('view-toggle-btn').textContent = '☰ List';
  }
});
```

- [ ] **Step 3: Add list view CSS in newtab.css**

```css
.view-list .groups-grid {
  display: flex;
  flex-direction: column;
  max-width: 700px;
  margin: 0 auto;
  gap: 12px;
}

.view-list .group-card {
  width: 100%;
}
```

- [ ] **Step 4: Commit**

```bash
git add newtab/newtab.html newtab/newtab.js newtab/newtab.css
git commit -m "feat: add grid/list view toggle"
```

---

### Task 6: Undo / Trash UI

**Files:**
- Modify: `newtab/newtab.html`, `newtab/newtab.js`, `newtab/newtab.css`

- [ ] **Step 1: Add toast container to newtab.html**

Before closing `</body>`:

```html
<div id="toast" class="toast" style="display:none">
  <span id="toast-message"></span>
  <button id="toast-undo-btn" class="toast-undo-btn">Undo</button>
  <div id="toast-progress" class="toast-progress"></div>
</div>
```

- [ ] **Step 2: Replace delete handlers in newtab.js to use soft-delete + toast**

Change the delete button click handler:

```js
const deleteBtn = e.target.closest('.group-delete-btn');
if (deleteBtn) {
  const g = groups.find(x => x.id === deleteBtn.dataset.id);
  if (!g) return;
  if (await showConfirm(`Delete "${g.name}" and all its tabs?`)) {
    await chrome.runtime.sendMessage({ action: 'softDeleteGroup', id: g.id });
    await render();
    showToast(`Deleted "${g.name}"`, g.id, 'group');
  }
  return;
}
```

Change the tab delete handler:

```js
const tabDelete = e.target.closest('.tab-delete');
if (tabDelete) {
  e.stopPropagation();
  const parentCard = tabDelete.closest('.group-card');
  const groupId = parentCard?.dataset.id;
  await chrome.runtime.sendMessage({ action: 'softDeleteTab', tabId: tabDelete.dataset.id });
  await render();
  showToast('Tab deleted', tabDelete.dataset.id, 'tab');
  return;
}
```

- [ ] **Step 3: Add toast show/hide functions in newtab.js**

```js
let toastTimer = null;
let toastStart = null;

function showToast(message, id, type) {
  const toast = $('toast');
  const msgEl = $('toast-message');
  const undoBtn = $('toast-undo-btn');
  const progress = $('toast-progress');

  if (toastTimer) clearTimeout(toastTimer);

  msgEl.textContent = message;
  undoBtn.onclick = async () => {
    const action = type === 'group' ? 'restoreGroup' : 'restoreTab';
    const param = type === 'group' ? { id } : { tabId: id };
    await chrome.runtime.sendMessage({ action, ...param });
    await render();
    hideToast();
  };

  toast.style.display = 'flex';
  toastStart = Date.now();
  progress.style.width = '100%';
  progress.style.transition = 'none';

  requestAnimationFrame(() => {
    progress.style.transition = `width 30s linear`;
    progress.style.width = '0%';
  });

  toastTimer = setTimeout(hideToast, 30000);
}

function hideToast() {
  const toast = $('toast');
  toast.style.display = 'none';
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
}
```

- [ ] **Step 4: Add toast CSS in newtab.css**

```css
.toast {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: #1a1a2e;
  color: #fff;
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  z-index: 9999;
  font-size: 14px;
  min-width: 300px;
  overflow: hidden;
}

.toast-undo-btn {
  background: #4285f4;
  color: #fff;
  border: none;
  padding: 6px 16px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  cursor: pointer;
  font-size: 13px;
  flex-shrink: 0;
}

.toast-undo-btn:hover {
  background: #5a95f5;
}

.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: #4285f4;
  width: 100%;
}
```

- [ ] **Step 5: Commit**

```bash
git add newtab/newtab.html newtab/newtab.js newtab/newtab.css
git commit -m "feat: add undo/trash with 30s toast and soft-delete"
```

---

### Task 7: Tests

**Files:**
- Modify: `storage.test.js`

- [ ] **Step 1: Add test for togglePinGroup**

Insert before the "All tests passed" line:

```js
// Test 25: togglePinGroup toggles pinned field
{
  let g = await createGroup('PinTest', '📌');
  assert(g.pinned === undefined || g.pinned === false, 'togglePinGroup initially false');
  await togglePinGroup(g.id);
  let data = await getAllData();
  assert(data.groups[g.id].pinned === true, 'togglePinGroup sets pinned true');
  await togglePinGroup(g.id);
  data = await getAllData();
  assert(data.groups[g.id].pinned === false, 'togglePinGroup sets pinned false');
}
```

- [ ] **Step 2: Add test for softDeleteGroup + restoreGroup**

```js
// Test 26: softDeleteGroup sets deletedAt on group and tabs
{
  let g = await createGroup('DelTest', '🗑️');
  let tab = await addTabToGroup({ title: 'DelTab', url: 'https://deltest.com' }, g.id);
  await softDeleteGroup(g.id);
  let data = await getAllData();
  assert(data.groups[g.id].deletedAt > 0, 'softDeleteGroup sets deletedAt');
  assert(data.tabs[tab.id].deletedAt > 0, 'softDeleteGroup deletes tabs too');
  let groups = await getGroups();
  assert(!groups.find(x => x.id === g.id), 'getGroups hides soft-deleted group');
}

// Test 27: restoreGroup clears deletedAt
{
  let g = await createGroup('RestTest', '♻️');
  let tab = await addTabToGroup({ title: 'RestTab', url: 'https://resttest.com' }, g.id);
  await softDeleteGroup(g.id);
  await restoreGroup(g.id);
  let data = await getAllData();
  assert(data.groups[g.id].deletedAt === null, 'restoreGroup clears deletedAt');
  assert(data.tabs[tab.id].deletedAt === null, 'restoreGroup restores tabs');
  let groups = await getGroups();
  assert(groups.find(x => x.id === g.id), 'getGroups shows restored group');
}
```

- [ ] **Step 3: Add test for softDeleteTab + restoreTab**

```js
// Test 28: softDeleteTab / restoreTab single tab
{
  let g = await createGroup('SingleTab', '📄');
  let t1 = await addTabToGroup({ title: 'Keep', url: 'https://keep.com' }, g.id);
  let t2 = await addTabToGroup({ title: 'Remove', url: 'https://remove.com' }, g.id);
  await softDeleteTab(t2.id);
  let tabs = await getTabsByGroup(g.id);
  assert(tabs.length === 1 && tabs[0].id === t1.id, 'softDeleteTab removes single tab from view');
  await restoreTab(t2.id);
  tabs = await getTabsByGroup(g.id);
  assert(tabs.length === 2, 'restoreTab brings tab back');
}
```

- [ ] **Step 4: Add test for purgeDeleted**

```js
// Test 29: purgeDeleted hard-deletes expired items
{
  let g = await createGroup('Expired', '⏰');
  await softDeleteGroup(g.id);
  // Manually set deletedAt to past cutoff
  let data = await getAllData();
  data.groups[g.id].deletedAt = Date.now() - 60000;
  await saveAllData(data);
  await purgeDeleted();
  data = await getAllData();
  assert(!data.groups[g.id], 'purgeDeleted removes expired group');
}
```

- [ ] **Step 5: Run tests and verify pass**

Run: `node storage.test.js`
Expected: `All tests passed.`

- [ ] **Step 6: Commit**

```bash
git add storage.test.js
git commit -m "test: add tests for pin, soft-delete, restore, and purge"
```

---

### Task 8: Final verification

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

- [ ] **Step 2: Run the full test suite**

```bash
node storage.test.js
```

Expected: `All tests passed.`

- [ ] **Step 3: Final commit with any lint fixes**

```bash
git add -A
git commit -m "chore: lint fixes and final cleanup"
```
