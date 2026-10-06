# Thiết kế lại trang New Tab — Design Spec

## Mục tiêu

Làm mới UI trang new tab theo bố cục "workspace": sidebar collection + các section xếp dọc với tab dạng ô. Ẩn tính năng Tasks khỏi UI và tắt thông báo nhắc việc. Popup và side panel chỉnh nhẹ cho đồng bộ.

**Thành công khi:**
- New tab hiển thị bố cục 2 cột như mockup đã duyệt (`.superpowers/brainstorm/6592-1791260796/content/full-layout-b.html`).
- Mọi tính năng collection hiện có vẫn chạy: tạo/sửa/xoá, thêm tab, mở tất cả, kéo thả (sắp xếp group, sắp xếp tab, chuyển tab giữa group, thả URL), tìm kiếm, privacy, import/export, hình nền, 7 theme, sửa tiêu đề trang.
- Không còn lối vào Tasks trên UI, không còn thông báo 17:35.

## Ngoài phạm vi

- Không xoá code tasks (`tasks/`, handler `tasks:*` trong `background.js`, `host_permissions`). Chỉ tắt bằng cờ.
- Không đổi màu/biến của 7 theme, không thêm theme mới.
- Không đổi data model, `storage.js`, message API của background.
- Không làm command palette; ⌘K chỉ focus ô tìm kiếm.

## Bố cục New Tab

```
┌────────────┬──────────────────────────────────────────┐
│ Tiêu đề    │ Ngày   [ 🔍 Tìm tab, collection    ⌘K ] [▦|≡]│
│ COLLECTIONS├──────────────────────────────────────────┤
│ ● Work   12│ ˅ ● 💼 Work · 12 tab   + Thêm tab ▶ Mở tất cả ⋯│
│ ● Dev     8│ [ô tab] [ô tab] [ô tab] [ô tab]          │
│ + Mới      │ ˅ ● 🛠 Dev · 8 tab   ...                  │
│ ⚙ Cài đặt  │ › ● 📚 Docs · 5 tab (thu gọn)             │
└────────────┴──────────────────────────────────────────┘
```

### Sidebar (`<aside class="app-sidebar">`)
- Đầu: tiêu đề trang (`#app-title`, giữ logic sửa tên của `initTitle()`).
- Nhãn "COLLECTIONS" + danh sách mục: chấm màu (`g.color`), icon, tên, số tab.
  - Render cùng lúc với `render()` từ cùng mảng `groups` (sau khi lọc tìm kiếm).
  - Click → `scrollIntoView({ behavior: 'smooth', block: 'start' })` tới section `[data-id]`, đánh dấu mục đó active. Không theo dõi scroll để đổi active.
  - Sidebar không có kéo thả.
- Nút "+ Collection mới" → cùng handler `showModal('New Collection', ...)` hiện tại. Bỏ card "New Collection" trong lưới.
- Cuối: nút "Cài đặt" mở menu popover, các mục gọi đúng hàm hiện có của FAB:
  - Hình nền & Theme → `showBgModal()`
  - Sáng / Tối: <chế độ đang dùng> → logic của `#fab-theme` (xoay vòng, cập nhật nhãn)
  - Chế độ riêng tư → `togglePrivacy()` (trạng thái active hiển thị trên mục menu)
  - Export / Import / Hướng dẫn → logic của `#fab-export`, `#fab-import`, `showHelp()`
  - Đóng menu khi click ra ngoài hoặc nhấn Esc.
- Xoá markup và CSS FAB (`#fab`, `.fab-*`, `closeFab`). Các chỗ `getElementById('fab-privacy')` / `#fab-theme` chuyển sang id mục menu mới.

### Thanh trên (`<header class="app-header">`)
- Ngày hiện tại, định dạng `toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' })`, tính một lần lúc load.
- Ô tìm kiếm `#search-input` (giữ id và logic lọc) với gợi ý phím `⌘K` (macOS) / `Ctrl K` (khác).
- Phím tắt: `⌘K`/`Ctrl+K` và `/` (khi focus không nằm trong input/textarea) → focus + select ô tìm kiếm, `preventDefault()`.
- Nút segmented ô/dòng thay cho `#view-toggle-btn`, dùng lại `toggleView()` / `loadViewMode()` và key `viewMode`.
- Bỏ `.nav-tabs` và `#tasks-header-actions` khỏi header khi Tasks tắt (xem phần Tasks).

### Vùng chính (`#groups-grid` → danh sách section)
- Mỗi group render thành `<section class="group-card glass-card" draggable="true" data-id>`. **Giữ nguyên các class mà handler đang dùng**: `.group-card`, `.group-toggle`, `.group-actions-toggle`, `.group-add-tab-btn`, `.group-open-all-btn`, `.group-edit-btn`, `.group-delete-btn`, `.group-content`, `.group-tabs`, `.tab-entry`, `.tab-drag-handle`, `.tab-actions-*`. Event delegation trên `#groups-grid` và logic drag giữ nguyên, chỉ sửa nếu selector cấu trúc (vd. `closest`/`parentElement`) bị đổi.
- Header section: chevron thu gọn (logic `expandedGroupIds` hiện có), chấm màu, icon, tên, "N tab". Bên phải hiện trực tiếp: "Thêm tab", "Mở tất cả", nút ⋯ (menu Sửa/Xoá). Không còn ẩn hành động sau `.group-actions-menu` cho Thêm tab/Mở tất cả.
- Kéo section (header) để sắp xếp group — dùng logic drag group hiện có.
- Tab (`renderTabEntry`) giữ markup, đổi trình bày bằng CSS theo mode:
  - **Dạng ô** (`.groups-grid.is-tiles`): lưới `repeat(auto-fill, minmax(170px, 1fr))`, ô gồm favicon + tiêu đề 1 dòng, ẩn `.tab-url`; drag handle và nút ⋯ chỉ hiện khi hover/focus.
  - **Dạng dòng** (`.groups-grid.is-rows`): mỗi tab một dòng, hiện URL như hiện tại.
- Section rỗng: ô viền nét đứt "Thả URL vào đây hoặc bấm Thêm tab".
- Không có group nào: `#empty-state` ở vùng chính, hướng dẫn bấm "Collection mới" ở sidebar (cập nhật câu chữ đang nhắc tới FAB).

### Responsive
- `< 800px`: sidebar ẩn, header có nút ☰ mở sidebar dạng ngăn trượt (overlay, đóng khi chọn mục / click ra ngoài / Esc).
- `< 480px`: lưới ô còn 1–2 cột theo `auto-fill`.

### Phong cách
- Nền trung tính, bề mặt sidebar/header đặc (`--bg-secondary` / `--glass-strong-bg`), ô tab dùng `--glass-card-bg`, `--glass-card-border`, `--glass-card-shadow`, bo góc `--radius-md`. Spacing theo `--space-*`.
- Chỉ dùng biến CSS có sẵn + class `.glass-card` để 7 theme áp dụng tự động. Nếu cần biến mới (vd. `--sidebar-bg`), khai báo mặc định trong `variables.css` và thêm vào cả 7 file theme.
- Hình nền (nếu có) hiển thị sau vùng chính; sidebar/header giữ nền đặc.
- Icon UI dùng SVG từ `icons.js` (thêm icon thiếu: `search`, `settings`, `menu`, `play`, `list`, `grid` nếu chưa có). Emoji chỉ còn ở icon collection.

## Ẩn Tasks

- Thêm `const TASKS_ENABLED = false;` vào `constants.js` (thêm vào `/* exported */`).
- `newtab`:
  - Khi `!TASKS_ENABLED`: không render nút chuyển view, không gọi `initTasksEventHandlers()`, bỏ qua `?view=tasks` và giá trị `tasks` từ `loadActiveView()` → luôn ở Collections.
  - Markup tasks (`#tasks-view`, `#task-modal-overlay`, filter) giữ trong HTML nhưng ẩn; code tasks trong `newtab.js` giữ nguyên.
  - **Sửa listener `chrome.storage.onChanged`**: hiện chỉ render khi `.nav-tab.active` là collections — sau khi bỏ nav tab sẽ không bao giờ render lại. Đổi sang biến trạng thái view hiện tại (mặc định `'collections'`).
- `background.js`:
  - `importScripts('constants.js')` (file không đụng DOM, an toàn cho service worker).
  - Khi `!TASKS_ENABLED`: `ensureTasksReminder()` không tạo alarm mà gọi `chrome.alarms.clear(TASKS_ALARM)` để xoá alarm đã tạo ở bản cũ; listener `onAlarm` bỏ qua `TASKS_ALARM`.
  - Handler `tasks:*` giữ nguyên.
- Giữ `host_permissions`, quyền `alarms`, `notifications` trong manifest.
- Bật lại = đổi cờ thành `true` (UI tasks khi đó sẽ cần chỉnh cho hợp bố cục mới — ngoài phạm vi spec này).

## Popup & Side panel

- Đồng bộ với new tab: font, khoảng cách theo `--space-*`, bo góc `--radius-*`, dòng tab cùng kiểu (favicon 16px + tiêu đề, hover nhẹ), chấm màu collection giống sidebar.
- Không đổi cấu trúc hay hành vi. Hai màn hình đã dùng SVG icon.
- Side panel chưa load `animations.css`/`reset.css` như popup — chỉ thêm nếu cần cho kiểu dáng thống nhất.

## File bị ảnh hưởng

| File | Thay đổi |
|---|---|
| `newtab/newtab.html` | Khung sidebar + header mới, bỏ FAB, ẩn nav/tasks |
| `newtab/newtab.js` | `render()` xuất section + sidebar, menu Cài đặt, phím tắt, cờ Tasks, sửa `onChanged` |
| `newtab/newtab.css` | Layout grid 2 cột, section, ô/dòng tab, menu, responsive; xoá CSS FAB |
| `styles/variables.css`, `styles/themes/*.css` | Chỉ khi cần biến mới |
| `icons.js` | Thêm icon SVG còn thiếu |
| `constants.js` | `TASKS_ENABLED` |
| `background.js` | Import constants, gate + clear alarm |
| `popup/popup.css`, `sidepanel/sidepanel.css` | Đồng bộ kiểu dáng |
| `README.md`, `manifest.json`, `package.json` | Cập nhật mô tả, bump version 2.8.0 |

## Kiểm thử

- `npm test` và `npm run lint` pass.
- Checklist thủ công (load unpacked):
  - 7 theme × sáng/tối/hệ thống: sidebar, header, section, ô tab, menu Cài đặt hiển thị đúng màu, không vỡ bố cục.
  - Có / không có hình nền.
  - Tạo, sửa, xoá collection; thêm tab qua picker; mở tất cả; sửa/xoá tab.
  - Kéo thả: sắp xếp section, sắp xếp tab, chuyển tab giữa section, thả URL từ thanh địa chỉ vào section.
  - Tìm kiếm lọc cả sidebar lẫn vùng chính; ⌘K / Ctrl+K / `/` focus ô tìm kiếm.
  - Chuyển ô ↔ dòng, reload vẫn giữ mode.
  - Privacy mode làm mờ tiêu đề/URL trong cả ô và dòng.
  - Import/export, hướng dẫn, sửa tiêu đề trang.
  - Thêm tab từ popup / context menu khi new tab đang mở → new tab tự render lại.
  - Cửa sổ < 800px: sidebar ẩn, nút ☰ hoạt động.
  - Không còn lối vào Tasks; mở `newtab.html?view=tasks` vẫn ra Collections.
  - Sau khi update extension: `chrome.alarms.getAll()` trong service worker không còn `tasks-reminder`.
  - Popup và side panel: hiển thị đồng bộ, chức năng không đổi.
