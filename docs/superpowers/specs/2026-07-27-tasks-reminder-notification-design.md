# Tasks Reminder Notification

Daily reminder at 17:35 to review the task board. Clicking the notification opens the extension's new tab page with the Tasks view active.

## Permissions

Add `"alarms"` and `"notifications"` to `manifest.json` permissions.

## Background Alarm (background.js)

- On `chrome.runtime.onInstalled`: create a repeating alarm named `tasks-reminder` with `periodInMinutes: 1440` (24h). The first fire is scheduled at today's 17:35 local time; if that time has already passed, schedule for tomorrow 17:35.
- `chrome.alarms.onAlarm` listener: if `alarm.name === 'tasks-reminder'`, show a notification.

## Scheduling Logic

- Compute milliseconds from now to today's 17:35 (`new Date().setHours(17, 35, 0, 0)`).
- If that time is in the past, add 24h to schedule for tomorrow 17:35.
- Use `chrome.alarms.create('tasks-reminder', { when: <ms-since-epoch>, periodInMinutes: 1440 })`.
- On each alarm fire, the next fire is automatically 1440 minutes later (same time next day).

## Notification (background.js)

- `chrome.notifications.create()` with:
  - `type: 'basic'`
  - `title: '⏰ Nhắc nhở Task'`
  - `message: 'Đã 17h35, hãy xem xét lại bảng task hôm nay!'`
  - `iconUrl`: `chrome.runtime.getURL('icons/icon128.png')`
  - `requireInteraction: true` (notification stays until user interacts)
- `chrome.notifications.onClicked` listener: call `chrome.tabs.create({ url })` to open the newtab page with `?view=tasks` query parameter.

## Newtab Auto-switch (newtab/newtab.js)

- At the start of `initApp()`, parse `location.search` for `view=tasks` parameter.
- If present, call `switchView('tasks')` to automatically activate the Tasks tab.

## Files Changed

- `manifest.json` — add `"alarms"`, `"notifications"` to permissions
- `background.js` — add alarm creation, alarm listener, notification creation, and notification click handler
- `newtab/newtab.js` — add query param parsing and auto-switch to tasks view
