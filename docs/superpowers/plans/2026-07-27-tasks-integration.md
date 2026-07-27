# Tasks Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate task management from tasks.minhtuong.io.vn into the Tab Collection new tab page as a native Tasks tab.

**Architecture:** A new "Tasks" tab on newtab.html alongside "Collections". Data flows via `chrome.runtime.sendMessage` → `background.js` proxy → `fetch()` to web API. A `tasks/tasks-api.js` module encapsulates all web API calls. Authentication uses existing session cookies from the web app.

**Tech Stack:** Chrome Extension MV3, vanilla JS, `fetch()` with `credentials: "include"`, chrome storage

---

### Task 1: Create `tasks/tasks-api.js` — web API helper

**Files:**
- Create: `tasks/tasks-api.js`

- [ ] **Step 1: Write the file with all API functions**

This module wraps every interaction with the web backend. It uses `credentials: "include"` for cookie-based auth.

```js
const TASKS_API_BASE = 'https://tasks.minhtuong.io.vn/api/';

async function tasksApi(path, method = 'GET', body) {
  const opts = { method, credentials: 'include', headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(TASKS_API_BASE + path, opts);
  let data = {};
  try { data = await res.json(); } catch {}
  if (res.status === 401) throw new Error('SESSION_EXPIRED');
  if (!res.ok) throw new Error(data.error || 'API error ' + res.status);
  return data;
}

async function tasksLogin(username, password) {
  return tasksApi('login', 'POST', { username, password });
}

async function tasksLogout() {
  return tasksApi('logout', 'POST', {});
}

async function tasksMe() {
  return tasksApi('me', 'GET');
}

async function tasksList(queryParams = {}) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(queryParams)) {
    if (v !== undefined && v !== null && v !== 'all') q.set(k, v);
  }
  const qs = q.toString();
  const d = await tasksApi('tasks' + (qs ? '?' + qs : ''), 'GET');
  return d.tasks || d || [];
}

async function tasksCreate(payload) {
  return tasksApi('tasks/create', 'POST', payload);
}

async function tasksUpdate(id, payload) {
  return tasksApi('tasks/update', 'POST', { id, ...payload });
}

async function tasksDelete(id) {
  return tasksApi('tasks/delete', 'POST', { id });
}

async function tasksToggle(id, done) {
  return tasksApi('tasks/toggle', 'POST', { id, done });
}
```

- [ ] **Step 2: Verify lint**

```bash
npm run lint
```

Expected: no errors (the file uses standard JS patterns already in the codebase).

---

### Task 2: Add tasks message handlers to `background.js`

**Files:**
- Modify: `background.js`

- [ ] **Step 1: Add `importScripts` for tasks-api.js**

Add `importScripts('tasks/tasks-api.js');` at the top of `background.js`, after the existing `importScripts('storage.js')`.

- [ ] **Step 2: Add message handler cases for tasks actions**

Inside the `switch (msg.action)` block in `chrome.runtime.onMessage.addListener`, add these new cases **before the `default` case**:

```js
case 'tasks:login':
  sendResponse(await tasksLogin(msg.username, msg.password));
  break;
case 'tasks:logout':
  sendResponse(await tasksLogout());
  break;
case 'tasks:me':
  sendResponse(await tasksMe());
  break;
case 'tasks:list':
  sendResponse(await tasksList(msg.params || {}));
  break;
case 'tasks:create':
  sendResponse(await tasksCreate(msg.payload));
  break;
case 'tasks:update':
  sendResponse(await tasksUpdate(msg.id, msg.payload));
  break;
case 'tasks:delete':
  sendResponse(await tasksDelete(msg.id));
  break;
case 'tasks:toggle':
  sendResponse(await tasksToggle(msg.id, msg.done));
  break;
```

- [ ] **Step 3: Add permissions for tasks.minhtuong.io.vn**

Update `manifest.json` to add the host permission:

```json
"permissions": [
  "storage",
  "contextMenus",
  "tabs",
  "sidePanel"
],
"host_permissions": [
  "https://tasks.minhtuong.io.vn/*"
]
```

- [ ] **Step 4: Verify lint**

```bash
npm run lint
```

Expected: no errors.

---

### Task 3: Update `newtab/newtab.html` — add tab bar, tasks container, login gate, task modal

**Files:**
- Modify: `newtab/newtab.html`

- [ ] **Step 1: Add tab navigation to the header**

Replace the static `<h1 id="app-title">` with a tabbed header. Add a `.nav-tabs` container inside `.app-header`:

```html
<header class="app-header glass-strong">
  <h1 id="app-title" class="app-title">Tab Collections</h1>
  <div class="nav-tabs">
    <button class="nav-tab active" data-view="collections">📂 Collections</button>
    <button class="nav-tab" data-view="tasks">📋 Tasks</button>
  </div>
  <input type="search" id="search-input" class="search-input" placeholder="Search collections and tabs...">
  <div class="header-actions" id="collections-header-actions">
    <button id="view-toggle-btn" class="btn-ghost" title="Switch to List"><span class="btn-icon" id="view-toggle-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></span><span class="btn-label">Grid view</span></button>
  </div>
</header>

<!-- Hidden tasks header actions, shown via tab switch -->
<div id="tasks-header-actions" class="header-actions" style="display:none;padding:0 20px 16px;justify-content:flex-end">
  <button id="tasks-refresh-btn" class="btn-ghost" title="Refresh">⟳ Refresh</button>
</div>
```

The nav-tabs sit between the title and search, keeping the title editing feature intact.

- [ ] **Step 2: Wrap existing content and add tasks view**

After the opening `<div id="app" class="app" role="main">` tag, add a wrapper:

Remove the single `<div id="groups-view">` and instead have two views:

```html
<div id="collections-view">
  <div id="groups-grid" class="groups-grid animate-stagger"></div>
  <div id="empty-state" class="empty-state" style="display:none">...</div>
</div>

<div id="tasks-view" style="display:none">
  <div id="tasks-login-gate" style="display:none">
    <div class="tasks-login-card">
      <div class="tasks-login-icon">🔐</div>
      <h2>Đăng nhập để xem công việc</h2>
      <p class="subtitle">Kết nối với tài khoản Lịch Công Việc để xem và quản lý tasks</p>
      <button id="tasks-login-btn" class="btn-primary tasks-login-btn">Đăng nhập</button>
    </div>
  </div>
  <div id="tasks-content" style="display:none">
    <div id="tasks-toolbar">
      <span id="tasks-date-title">Hôm nay</span>
      <select id="tasks-pic-filter" class="tasks-filter">
        <option value="all">👥 Tất cả</option>
        <option value="tuong">Tường</option>
        <option value="dung">Dung</option>
        <option value="phuoc">Phước</option>
        <option value="tran">Trân</option>
        <option value="cuong">Cường</option>
        <option value="hao">Hào</option>
      </select>
      <select id="tasks-status-filter" class="tasks-filter">
        <option value="all">🗂️ Mọi trạng thái</option>
        <option value="todo">⬜ Chưa xong</option>
        <option value="done">✅ Đã xong</option>
      </select>
      <button id="tasks-add-btn" class="btn-primary">+ Tạo việc</button>
    </div>
    <div id="tasks-loader" class="tasks-loader">Đang tải...</div>
    <div id="tasks-list"></div>
  </div>
</div>
```

- [ ] **Step 3: Add task modal HTML**

Add the task modal after `#tab-edit-overlay`:

```html
<div id="task-modal-overlay" class="modal-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">
  <div id="task-modal" class="modal" style="width:450px">
    <h2 id="task-modal-title">Thêm công việc</h2>
    <div id="task-modal-body">
      <label>Tiêu đề *</label>
      <input type="text" id="task-title-input" class="modal-input" maxlength="200" placeholder="Việc cần làm...">

      <label>Ghi chú</label>
      <textarea id="task-note-input" class="modal-textarea" maxlength="1000" placeholder="Mô tả thêm (tuỳ chọn)"></textarea>

      <div class="task-modal-row">
        <label class="task-switch-label">
          <input type="checkbox" id="task-sticky-input">
          <span class="task-switch"></span>
          <span>📌 Thường trực</span>
        </label>
      </div>

      <div id="task-date-fields">
        <div class="task-modal-row">
          <label class="task-switch-label">
            <input type="checkbox" id="task-allday-input">
            <span class="task-switch"></span>
            <span>Cả ngày</span>
          </label>
        </div>
        <div class="task-modal-grid">
          <div><label>Bắt đầu</label><input type="datetime-local" id="task-start-input" class="modal-input"></div>
          <div><label>Kết thúc / Hạn</label><input type="datetime-local" id="task-due-input" class="modal-input"></div>
        </div>
      </div>

      <label>Mức ưu tiên</label>
      <div id="task-priority-group" class="task-prio-group">
        <label class="task-prio-option" data-prio="low"><input type="radio" name="task-prio" value="low"> 🟢 Thấp</label>
        <label class="task-prio-option" data-prio="normal"><input type="radio" name="task-prio" value="normal" checked> 🔵 Vừa</label>
        <label class="task-prio-option" data-prio="high"><input type="radio" name="task-prio" value="high"> 🔴 Cao</label>
      </div>

      <label>Người phụ trách (PIC)</label>
      <div id="task-pic-group" class="task-pic-group">
        <button type="button" class="task-pic-chip" data-pic="tuong">Tường</button>
        <button type="button" class="task-pic-chip" data-pic="dung">Dung</button>
        <button type="button" class="task-pic-chip" data-pic="phuoc">Phước</button>
        <button type="button" class="task-pic-chip" data-pic="tran">Trân</button>
        <button type="button" class="task-pic-chip" data-pic="cuong">Cường</button>
        <button type="button" class="task-pic-chip" data-pic="hao">Hào</button>
        <button type="button" class="task-pic-chip" data-pic="__team">👥 Cả team</button>
      </div>

      <div id="task-modal-error" class="task-modal-error"></div>
    </div>
    <div class="modal-actions" id="task-modal-actions">
      <button id="task-modal-cancel-btn" class="btn-ghost">Huỷ</button>
      <span class="spacer"></span>
      <button id="task-modal-delete-btn" class="btn-danger" style="display:none">Xoá</button>
      <button id="task-modal-done-btn" class="btn-ok" style="display:none">✓ Hoàn thành</button>
      <button id="task-modal-save-btn" class="btn-primary">Lưu</button>
    </div>
  </div>
</div>
```

Note: `<span class="spacer">` needs CSS `flex: 1` (add it in the modal-actions rule).

---

### Task 4: Add tasks CSS to `newtab/newtab.css`

**Files:**
- Modify: `newtab/newtab.css`

- [ ] **Step 1: Add nav-tabs styles**

```css
/* ── Nav Tabs ── */
.nav-tabs {
  display: flex;
  gap: 4px;
  background: var(--glass-bg);
  border-radius: var(--radius-md);
  padding: 3px;
  flex-shrink: 0;
}

.nav-tab {
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: inherit;
  white-space: nowrap;
}

.nav-tab:hover {
  color: var(--text-primary);
  background: var(--hover-bg);
}

.nav-tab.active {
  background: var(--bg-primary);
  color: var(--text-primary);
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* ── Tasks View ── */
#tasks-view {
  min-height: 300px;
}

/* ── Login Gate ── */
.tasks-login-card {
  max-width: 400px;
  margin: 80px auto;
  text-align: center;
  padding: 40px 30px;
  background: var(--glass-card-bg);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.tasks-login-icon {
  font-size: 48px;
  margin-bottom: 12px;
}

.tasks-login-card h2 {
  font-size: 20px;
  margin: 0 0 8px;
  color: var(--text-primary);
}

.tasks-login-card .subtitle {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0 0 24px;
}

.tasks-login-btn {
  padding: 10px 28px;
  font-size: 15px;
  font-weight: 700;
  border-radius: var(--radius-md);
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-family: inherit;
}

.tasks-login-btn:hover {
  opacity: 0.9;
}

/* ── Tasks Toolbar ── */
#tasks-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

#tasks-date-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.tasks-filter {
  padding: 6px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--glass-bg);
  color: var(--text-primary);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
}

.tasks-filter:focus {
  outline: none;
  border-color: var(--accent);
}

#tasks-add-btn {
  margin-left: auto;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 700;
  border-radius: var(--radius-sm);
  border: none;
  background: var(--accent);
  color: #fff;
  cursor: pointer;
  font-family: inherit;
}

#tasks-add-btn:hover {
  opacity: 0.9;
}

/* ── Task List ── */
.tasks-loader {
  text-align: center;
  padding: 40px;
  color: var(--text-muted);
  font-size: 14px;
}

.task-list-empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-muted);
  font-size: 15px;
}

.tasks-section {
  margin-bottom: 20px;
}

.tasks-section-header {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tasks-section-count {
  font-size: 12px;
  background: var(--hover-bg);
  padding: 1px 8px;
  border-radius: 999px;
  color: var(--text-secondary);
  font-weight: 600;
  text-transform: none;
  letter-spacing: normal;
}

.task-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
  cursor: pointer;
}

.task-item:hover {
  background: var(--hover-bg);
}

.task-checkbox {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  border: 2px solid var(--border-color);
  background: var(--bg-primary);
  cursor: pointer;
  flex-shrink: 0;
  margin-top: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: transparent;
  transition: all var(--transition-fast);
}

.task-checkbox:hover {
  border-color: var(--accent);
}

.task-item.done .task-checkbox {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.task-item-body {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.4;
}

.task-item.done .task-title {
  text-decoration: line-through;
  color: var(--text-muted);
}

.task-meta {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.task-priority-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 6px;
}

.task-pic-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 800;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--accent-selected-bg);
  color: var(--accent);
  vertical-align: middle;
}

/* ── Task Modal ── */
#task-modal .modal {
  max-height: 92vh;
  display: flex;
  flex-direction: column;
}

#task-modal-body {
  overflow-y: auto;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

#task-modal-body label {
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-muted);
  display: block;
  margin-bottom: 4px;
}

.modal-textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-family: inherit;
  font-size: 14px;
  color: var(--text-primary);
  background: var(--bg-primary);
  resize: vertical;
  min-height: 60px;
  box-sizing: border-box;
}

.modal-textarea:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.12);
}

.task-modal-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.task-switch-label {
  display: flex !important;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 600 !important;
  font-size: 13.5px !important;
  color: var(--text-primary) !important;
}

.task-switch-label input[type="checkbox"] {
  display: none;
}

.task-switch {
  position: relative;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
  background: var(--border-color);
  border-radius: 999px;
  transition: background var(--transition-fast);
}

.task-switch::after {
  content: "";
  position: absolute;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  top: 3px;
  left: 3px;
  transition: transform var(--transition-fast);
  box-shadow: 0 1px 2px rgba(0,0,0,0.2);
}

.task-switch-label input:checked + .task-switch {
  background: var(--accent);
}

.task-switch-label input:checked + .task-switch::after {
  transform: translateX(18px);
}

.task-modal-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.task-prio-group {
  display: flex;
  gap: 8px;
}

.task-prio-option {
  flex: 1;
  border: 1.5px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 8px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  color: var(--text-muted);
  transition: all var(--transition-fast);
}

.task-prio-option input { display: none; }

.task-prio-option.active[data-prio="low"] {
  border-color: #22c55e;
  background: #dcfce7;
  color: #15803d;
}

.task-prio-option.active[data-prio="normal"] {
  border-color: #3b82f6;
  background: #dbeafe;
  color: #1d4ed8;
}

.task-prio-option.active[data-prio="high"] {
  border-color: #ef4444;
  background: #fee2e2;
  color: #b91c1c;
}

.task-pic-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.task-pic-chip {
  border: 1.5px solid var(--border-color);
  background: var(--bg-primary);
  border-radius: 999px;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: inherit;
}

.task-pic-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.task-pic-chip.active {
  border-color: var(--accent);
  background: var(--accent-selected-bg);
  color: var(--accent);
}

.task-pic-chip.team.active {
  border-color: #7c3aed;
  background: #f3e8ff;
  color: #6d28d9;
}

.task-modal-error {
  color: #ef4444;
  font-size: 13px;
  font-weight: 600;
  min-height: 18px;
}
```

Also add `.spacer` to `styles/components.css` after the `.modal-actions` block:

```css
.spacer {
  flex: 1;
}
```

---

### Task 5: Update `newtab/newtab.js` — tasks logic

**Files:**
- Modify: `newtab/newtab.js`

This is the largest task. We need to add:
1. Tab switching between Collections and Tasks views
2. Tasks state management (logged in, tasks data, modal state)
3. Tasks rendering (list with sections)
4. Login gate flow
5. Task modal (create/edit/delete/toggle)
6. Filter handling

The file is already 1132 lines. We'll add tasks logic at the end (before the final `chrome.storage.onChanged` listener) to keep additions self-contained.

- [ ] **Step 1: Add tasks state variables after existing state**

After line 5 (`let privacyMode = false;`), add:

```js
// ── Tasks State ──
let tasksState = {
  loggedIn: false,
  items: [],
  picFilter: 'all',
  statusFilter: 'all',
  editingId: null,
  selectedPics: [],
  loading: false
};
```

- [ ] **Step 2: Add tasks helper functions**

After `loadViewMode()` and before the rendering init code, add all tasks-related functions:

```js
// ── Tasks API proxies ──
async function tasksSend(action, extra = {}) {
  try {
    return await chrome.runtime.sendMessage({ action, ...extra });
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') return { error: 'SESSION_EXPIRED' };
    throw err;
  }
}

async function checkTasksLogin() {
  try {
    const data = await tasksSend('tasks:me');
    if (data && data.user) {
      tasksState.loggedIn = true;
      return true;
    }
  } catch {}
  tasksState.loggedIn = false;
  return false;
}

async function loadTasks() {
  tasksState.loading = true;
  renderTasksView();
  try {
    const params = {};
    if (tasksState.picFilter !== 'all') params.pic = tasksState.picFilter;
    if (tasksState.statusFilter !== 'all') params.status = tasksState.statusFilter;
    const items = await tasksSend('tasks:list', { params });
    tasksState.items = Array.isArray(items) ? items : [];
  } catch (err) {
    if (err.message === 'SESSION_EXPIRED') {
      tasksState.loggedIn = false;
    }
    tasksState.items = [];
  }
  tasksState.loading = false;
  renderTasksView();
}

// ── Tasks Rendering ──
function renderTasksView() {
  const loginGate = $('tasks-login-gate');
  const content = $('tasks-content');

  if (!tasksState.loggedIn) {
    loginGate.style.display = 'block';
    content.style.display = 'none';
    return;
  }

  loginGate.style.display = 'none';
  content.style.display = 'block';

  if (tasksState.loading) {
    $('tasks-list').innerHTML = '<div class="tasks-loader">Đang tải...</div>';
    return;
  }

  const items = tasksState.items;
  const today = new Date().toISOString().slice(0, 10);

  // Split into sections
  const overdue = items.filter(t => !t.done && t.due && t.due.slice(0, 10) < today);
  const todayTasks = items.filter(t => !t.done && (!t.due || t.due.slice(0, 10) === today));
  const unstuck = items.filter(t => !t.done && !t.due && !t.start); // sticky tasks
  const done = items.filter(t => t.done);

  // Sort overdue + today by start time
  const sortByTime = (a, b) => {
    const tA = (a.start || a.due || '').slice(11) || '00:00';
    const tB = (b.start || b.due || '').slice(11) || '00:00';
    return tA.localeCompare(tB);
  };
  overdue.sort(sortByTime);
  todayTasks.sort(sortByTime);

  let html = '';

  if (overdue.length) {
    html += `<div class="tasks-section">
      <div class="tasks-section-header">🔴 Quá hạn <span class="tasks-section-count">${overdue.length}</span></div>
      ${overdue.map(renderTaskItem).join('')}
    </div>`;
  }

  if (todayTasks.length || unstuck.length) {
    html += `<div class="tasks-section">
      <div class="tasks-section-header">⬜ Hôm nay <span class="tasks-section-count">${todayTasks.length + unstuck.length}</span></div>
      ${todayTasks.map(renderTaskItem).join('')}
      ${unstuck.map(renderTaskItem).join('')}
    </div>`;
  }

  if (done.length) {
    html += `<div class="tasks-section">
      <div class="tasks-section-header">✅ Đã xong <span class="tasks-section-count">${done.length}</span></div>
      ${done.map(renderTaskItem).join('')}
    </div>`;
  }

  if (!html) {
    html = '<div class="task-list-empty">Không có công việc hôm nay 🎉</div>';
  }

  $('tasks-list').innerHTML = html;
}

const TASK_PRIO_COLORS = { low: '#22c55e', normal: '#3b82f6', high: '#ef4444' };
const TASK_MEMBER_LABEL = { tuong: 'Tường', dung: 'Dung', phuoc: 'Phước', tran: 'Trân', cuong: 'Cường', hao: 'Hào' };
const TASK_MEMBERS = ['tuong', 'dung', 'phuoc', 'tran', 'cuong', 'hao'];

function getPicBadge(pic) {
  const p = Array.isArray(pic) ? pic.filter(k => TASK_MEMBER_LABEL[k]) : [];
  if (!p.length) return '';
  if (p.length >= TASK_MEMBERS.length) return '<span class="task-pic-badge">Team</span>';
  if (p.length === 1) return `<span class="task-pic-badge">${TASK_MEMBER_LABEL[p[0]]}</span>`;
  return `<span class="task-pic-badge">${p.map(k => TASK_MEMBER_LABEL[k][0]).join('')}</span>`;
}

function getPicLabel(pic) {
  const p = Array.isArray(pic) ? pic.filter(k => TASK_MEMBER_LABEL[k]) : [];
  if (!p.length) return '';
  if (p.length >= TASK_MEMBERS.length) return 'Cả team';
  return p.map(k => TASK_MEMBER_LABEL[k]).join(', ');
}

function renderTaskItem(t) {
  const isOverdue = !t.done && t.due && t.due.slice(0, 10) < new Date().toISOString().slice(0, 10);
  const timeStr = t.start ? t.start.slice(11, 16) : (t.due ? t.due.slice(11, 16) : '');
  const isSticky = !t.start && !t.due;
  const picBadge = getPicBadge(t.pic);
  const picLabel = getPicLabel(t.pic);
  const prioColor = t.color || TASK_PRIO_COLORS[t.priority] || TASK_PRIO_COLORS.normal;

  let metaParts = [];
  if (isSticky) metaParts.push('📌 Thường trực');
  else if (timeStr) metaParts.push(timeStr);
  if (t.allDay) metaParts.push('Cả ngày');
  if (picLabel) metaParts.push(picLabel);

  return `<div class="task-item${t.done ? ' done' : ''}" data-id="${t.id}">
    <div class="task-checkbox" data-id="${t.id}" data-done="${t.done}">${t.done ? '✓' : ''}</div>
    <div class="task-priority-dot" style="background:${prioColor}"></div>
    <div class="task-item-body">
      <div class="task-title">${esc(t.title)}</div>
      <div class="task-meta">${picBadge} ${esc(metaParts.join(' · '))}</div>
    </div>
  </div>`;
}

// ── Tasks Event Handlers ──
function initTasksHandlers() {
  // Login button
  $('tasks-login-btn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://tasks.minhtuong.io.vn/' });
  });

  // Filters
  $('tasks-pic-filter').addEventListener('change', async e => {
    tasksState.picFilter = e.target.value;
    await loadTasks();
  });

  $('tasks-status-filter').addEventListener('change', async e => {
    tasksState.statusFilter = e.target.value;
    await loadTasks();
  });

  // Add button
  $('tasks-add-btn').addEventListener('click', () => openTaskModal());

  // Task list clicks (checkbox + item click)
  $('tasks-list').addEventListener('click', async e => {
    const checkbox = e.target.closest('.task-checkbox');
    if (checkbox) {
      e.stopPropagation();
      const id = checkbox.dataset.id;
      const done = checkbox.dataset.done === 'true';
      try {
        await tasksSend('tasks:toggle', { id, done: !done });
        await loadTasks();
      } catch (err) {
        showStatus('Lỗi: ' + err.message, 'error');
      }
      return;
    }

    const item = e.target.closest('.task-item');
    if (item) {
      const id = item.dataset.id;
      const task = tasksState.items.find(t => t.id === id);
      if (task) openTaskModal(task);
    }
  });

  // Modal buttons
  $('task-modal-cancel-btn').addEventListener('click', closeTaskModal);
  $('task-modal-overlay').addEventListener('click', e => {
    if (e.target === $('task-modal-overlay')) closeTaskModal();
  });
  $('task-modal-save-btn').addEventListener('click', saveTask);
  $('task-modal-delete-btn').addEventListener('click', deleteTask);
  $('task-modal-done-btn').addEventListener('click', toggleTaskDone);
  $('task-modal-reopen-btn')?.addEventListener('click', toggleTaskDone);

  // Sticky toggle hides date fields
  $('task-sticky-input').addEventListener('change', () => {
    const sticky = $('task-sticky-input').checked;
    $('task-date-fields').style.display = sticky ? 'none' : 'block';
  });

  // Priority click toggles
  document.querySelectorAll('.task-prio-option').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.task-prio-option').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      el.querySelector('input').checked = true;
    });
  });

  // PIC chips
  document.querySelectorAll('.task-pic-chip').forEach(el => {
    el.addEventListener('click', () => {
      el.classList.toggle('active');
    });
  });
}

// ── Task Modal ──
function openTaskModal(task) {
  const overlay = $('task-modal-overlay');
  const titleEl = $('task-modal-title');
  const saveBtn = $('task-modal-save-btn');
  const deleteBtn = $('task-modal-delete-btn');
  const doneBtn = $('task-modal-done-btn');

  // Reset form
  $('task-title-input').value = '';
  $('task-note-input').value = '';
  $('task-sticky-input').checked = false;
  $('task-date-fields').style.display = 'block';
  $('task-allday-input').checked = false;
  $('task-start-input').value = '';
  $('task-due-input').value = '';
  $('task-modal-error').textContent = '';

  // Reset priority
  document.querySelectorAll('.task-prio-option').forEach(el => el.classList.remove('active'));
  document.querySelector('.task-prio-option[data-prio="normal"]').classList.add('active');
  document.querySelector('.task-prio-option[data-prio="normal"] input').checked = true;

  // Reset PIC
  document.querySelectorAll('.task-pic-chip').forEach(el => el.classList.remove('active'));
  document.querySelector('.task-pic-chip[data-pic="phuoc"]').classList.add('active');

  tasksState.editingId = null;

  if (task) {
    // Edit mode
    titleEl.textContent = 'Sửa công việc';
    saveBtn.textContent = 'Lưu';
    tasksState.editingId = task.id;
    $('task-title-input').value = task.title || '';
    $('task-note-input').value = task.note || '';
    $('task-sticky-input').checked = !task.start && !task.due;
    $('task-date-fields').style.display = $('task-sticky-input').checked ? 'none' : 'block';
    $('task-allday-input').checked = !!task.allDay;
    if (task.start) $('task-start-input').value = task.start.slice(0, 16);
    if (task.due) $('task-due-input').value = task.due.slice(0, 16);

    // Priority
    document.querySelectorAll('.task-prio-option').forEach(el => el.classList.remove('active'));
    const prio = document.querySelector(`.task-prio-option[data-prio="${task.priority || 'normal'}"]`);
    if (prio) { prio.classList.add('active'); prio.querySelector('input').checked = true; }

    // PIC
    document.querySelectorAll('.task-pic-chip').forEach(el => el.classList.remove('active'));
    const pics = Array.isArray(task.pic) ? task.pic : [];
    pics.forEach(k => {
      const chip = document.querySelector(`.task-pic-chip[data-pic="${k}"]`);
      if (chip) chip.classList.add('active');
    });

    deleteBtn.style.display = 'inline-block';
    doneBtn.style.display = task.done ? 'none' : 'inline-block';
    // For done tasks, show a reopen button instead - skip for simplicity
  } else {
    titleEl.textContent = 'Thêm công việc';
    saveBtn.textContent = 'Thêm';
    deleteBtn.style.display = 'none';
    doneBtn.style.display = 'none';
  }

  overlay.style.display = 'flex';
  $('task-title-input').focus();
}

function closeTaskModal() {
  $('task-modal-overlay').style.display = 'none';
  tasksState.editingId = null;
}

async function saveTask() {
  const title = $('task-title-input').value.trim();
  if (!title) {
    $('task-modal-error').textContent = 'Tiêu đề không được để trống';
    return;
  }
  $('task-modal-error').textContent = '';

  const isSticky = $('task-sticky-input').checked;
  const payload = { title };

  // Note
  const note = $('task-note-input').value.trim();
  if (note) payload.note = note;

  // Priority
  const activePrio = document.querySelector('.task-prio-option.active');
  if (activePrio) payload.priority = activePrio.dataset.prio;

  // PIC
  const activePics = [...document.querySelectorAll('.task-pic-chip.active')].map(el => el.dataset.pic);
  if (activePics.length) payload.pic = activePics;

  // Dates
  if (isSticky) {
    payload.sticky = true;
  } else {
    payload.allDay = $('task-allday-input').checked || false;
    const start = $('task-start-input').value;
    const due = $('task-due-input').value;
    if (start) payload.start = start;
    if (due) payload.due = due;
  }

  try {
    if (tasksState.editingId) {
      await tasksSend('tasks:update', { id: tasksState.editingId, payload });
    } else {
      await tasksSend('tasks:create', { payload });
    }
    closeTaskModal();
    await loadTasks();
  } catch (err) {
    $('task-modal-error').textContent = 'Lỗi: ' + err.message;
  }
}

async function deleteTask() {
  if (!tasksState.editingId) return;
  if (!await showConfirm('Xoá công việc này?')) return;
  try {
    await tasksSend('tasks:delete', { id: tasksState.editingId });
    closeTaskModal();
    await loadTasks();
  } catch (err) {
    $('task-modal-error').textContent = 'Lỗi: ' + err.message;
  }
}

async function toggleTaskDone() {
  if (!tasksState.editingId) return;
  const task = tasksState.items.find(t => t.id === tasksState.editingId);
  if (!task) return;
  try {
    await tasksSend('tasks:toggle', { id: tasksState.editingId, done: !task.done });
    closeTaskModal();
    await loadTasks();
  } catch (err) {
    $('task-modal-error').textContent = 'Lỗi: ' + err.message;
  }
}
```

- [ ] **Step 3: Add tab switching and initialization**

After the existing `chrome.storage.onChanged` listener (end of file), add:

```js
// ── Tab Switching ──
function switchView(view) {
  const collectionsView = $('collections-view');
  const tasksView = $('tasks-view');
  const collectionsSearch = $('search-input');
  const collectionsActions = $('collections-header-actions');
  const tasksActions = $('tasks-header-actions');

  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));

  if (view === 'tasks') {
    collectionsView.style.display = 'none';
    tasksView.style.display = 'block';
    collectionsSearch.style.display = 'none';
    collectionsActions.style.display = 'none';
    tasksActions.style.display = 'flex';
    initTasksView();
  } else {
    collectionsView.style.display = 'block';
    tasksView.style.display = 'none';
    collectionsSearch.style.display = 'block';
    collectionsActions.style.display = 'flex';
    tasksActions.style.display = 'none';
  }
}

let tasksInitialized = false;

async function initTasksView() {
  if (tasksInitialized) return;
  tasksInitialized = true;
  await checkTasksLogin();
  if (tasksState.loggedIn) {
    await loadTasks();
  } else {
    renderTasksView();
  }
}

// Tab click handlers
document.querySelectorAll('.nav-tab').forEach(tab => {
  tab.addEventListener('click', () => switchView(tab.dataset.view));
});

// Refresh button
$('tasks-refresh-btn')?.addEventListener('click', async () => {
  if (tasksState.loggedIn) await loadTasks();
});

// ── Init ──
// Wrap the original init in a function
async function initApp() {
  initTitle();
  await loadTheme();
  await render();

  // Init handlers on DOM ready
  initTasksHandlers();

  // If the default view is tasks (from URL param), switch
  const params = new URLSearchParams(window.location.search);
  if (params.get('view') === 'tasks') {
    switchView('tasks');
  }
}

initApp();
```

Now the old init code at lines 1123-1124 needs to be replaced. Replace:

```js
initTitle();
loadTheme().then(() => render());
```

with nothing (it's now in `initApp()`).

Also the old `chrome.storage.onChanged` listener should remain as is but should be conditioned to only re-render collections when collections view is active. Update it:

```js
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    if (isDragging) { pendingRender = true; return; }
    if (document.querySelector('.nav-tab[data-view="collections"].active')) {
      render().catch(err => console.error('Storage change render failed:', err));
    }
  }
});
```

---

### Task 6: Test and verify

- [ ] **Step 1: Run lint**

```bash
npm run lint
```

Expected: no errors. Fix any issues found.

- [ ] **Step 2: Verify manifest.json structure**

```bash
node -e "const m = require('./manifest.json'); console.log('Permissions:', m.permissions); console.log('Host perms:', m.host_permissions);"
```

Expected: host_permissions includes `https://tasks.minhtuong.io.vn/*`.

- [ ] **Step 3: Manual verification checklist**

1. Load unpacked extension in Chrome/Brave
2. Open new tab → see Collections tab working as before
3. Click Tasks tab → see login gate
4. Click "Đăng nhập" → web opens in new tab
5. Log in on web, then go back to extension
6. Click Tasks tab → see task list
7. Toggle checkbox on a task → task marked done
8. Click "[+] Tạo việc" → modal opens → fill in → save → task appears
9. Click a task → modal pre-filled → edit → save → updated
10. Click delete → confirm → task removed
11. Filter by PIC → list updates
12. Filter by status → list updates
