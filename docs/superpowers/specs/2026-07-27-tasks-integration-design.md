# Tasks Integration Design

Integrate task management from [tasks.minhtuong.io.vn](https://tasks.minhtuong.io.vn) into the Tab Collection browser extension.

## Motivation

Users of Tab Collection want to see and manage their daily tasks from `tasks.minhtuong.io.vn` without leaving the new tab page. The integration enables task CRUD, completion toggling, and real-time sync with the web backend.

## Placement

A new **Tasks** tab on the new tab page, alongside the existing **Collections** tab. A tab bar in the header lets the user switch between the two views.

## Authentication

- Check login status by calling `GET /api/me` on the web backend
- If not logged in, show a login gate with a **Đăng nhập** button that opens `https://tasks.minhtuong.io.vn` in a new tab
- Session cookies are managed by the browser; the extension uses `credentials: "include"` on all API calls
- No password storage in the extension

## Task View

A simple **daily task list** showing today's tasks, grouped into sections:

| Section | Criteria |
|---------|----------|
| 🔴 Quá hạn | Tasks with due date before today, not done |
| ⬜ Chưa xong | Remaining tasks for today |
| ✅ Đã xong | Tasks completed today |

Each task row shows:
- Checkbox (toggle complete)
- Priority dot (🟢/🔵/🔴)
- PIC badge (short name or "Team")
- Title
- Time range
- PIC name

Filter support: PIC filter (dropdown, 6 members), status filter (all / todo / done), type filter (task / release).

## Data Flow

```
newtab.js → chrome.runtime.sendMessage({ action: 'tasks:*' })
  → background.js → fetch('https://tasks.minhtuong.io.vn/api/...')
    → response → back to newtab.js → render
```

All API calls use `https://tasks.minhtuong.io.vn/api/` as base with `credentials: "include"`.

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/tasks | List tasks (with query params) |
| POST | /api/tasks/create | Create task |
| POST | /api/tasks/update | Update task |
| POST | /api/tasks/delete | Delete task |
| POST | /api/tasks/toggle | Toggle done status |
| GET | /api/me | Check login status |
| POST | /api/login | Login |
| POST | /api/logout | Logout |

## UI Components

1. **Tab bar** — "Collections" / "Tasks" tabs in the header
2. **Login gate** — centered card with login button
3. **Task list** — grouped list with priority sections
4. **Task modal** — create/edit form with fields: title, notes, sticky, all-day, start/due, priority, PIC
5. **Task row** — checkbox + priority dot + PIC badge + title + time + PIC name

## Task Modal Fields

- Title (required)
- Notes (optional textarea)
- Sticky toggle (📌 persistent task, no date needed)
- All-day toggle
- Start / Due datetime (hidden if sticky)
- Priority: Low / Normal / High
- PIC: 6 members + "Cả team" selector

## Files Changed

- `newtab/newtab.html` — tab bar, tasks container, task modal
- `newtab/newtab.css` — task list, modal, login gate styles
- `newtab/newtab.js` — task rendering, modal logic, message handlers
- `background.js` — task API message handlers (proxy to fetch)
- `tasks/tasks-api.js` — helper functions for API calls

## Sync Model

Every user action (create, update, delete, toggle) calls the web API immediately. No offline queue. The task list refreshes after each mutation.

## Component Scope

Each unit is small and focused:

| Unit | File | Responsibility |
|------|------|---------------|
| TasksAPI | `tasks/tasks-api.js` | All `fetch()` calls to the web backend; returns parsed JSON |
| TasksRenderer | `newtab/newtab.js` (tasks section) | Renders task list, login gate, empty states |
| TaskModal | `newtab/newtab.js` (modal section) | Create/edit modal form, validation, save/delete/toggle |
| TasksHandlers | `background.js` (tasks:* cases) | Receives messages from views, calls TasksAPI, forwards results |

## Error States

| State | UX |
|-------|-----|
| Not logged in | Login gate with button to open web |
| Network error | Toast message "Lỗi kết nối — kiểm tra mạng" |
| API error | Toast with server error message |
| Loading | Skeleton/spinner while fetching |
| Empty day | "Không có công việc hôm nay" |
| Session expired | Auto-redirect to login gate |
