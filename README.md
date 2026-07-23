# Tab Collection

> A Chrome/Brave extension for collecting, organizing, and managing browser tabs — right from your new tab page.

[![Version](https://img.shields.io/badge/version-2.5.0-blue)](https://github.com/Phuoc0510/TabCollections/releases)
[![Manifest](https://img.shields.io/badge/manifest-v3-green)](https://developer.chrome.com/docs/extensions/reference/manifest)

---

## Features

### Collection Management
- **Save tabs** via popup, right-click context menu, or side panel
- **Organize by topic** — create groups with custom icons (350+ emoji) and accent colors
- **Inline view** — saved tabs displayed directly on your new tab page
- **Expandable cards** — compact group cards with collapsible content
- **Open All** — restore an entire collection in one click
- **Privacy mode** — blur tab titles and URLs with one toggle
- **Edit tab name & URL** — click **⋯** → **Edit** on any tab to update its title or URL

### Drag & Drop
- **Reorder groups** — drag cards to rearrange, positions persist automatically
- **Reorder tabs** — rearrange tabs within a group using drag handles
- **Cross-group moves** — drag a tab from one group to another
- **Drop URLs from browser** — drag any URL from the address bar onto a group card to save it

### Search & View
- **Realtime search** — filter collections and tabs by name, title, or URL
- **Grid / List toggle** — switch between compact grid and detailed list view

### Tab Picker
- **Add from open tabs** — click **+** on any card to pick from all open tabs
- **Multi-select** — choose multiple tabs at once with checkboxes

### Side Panel
- **Quick access** — view-only collection browser in the Chrome side panel
- **Keyboard shortcut** — `Ctrl+Shift+S` (`Cmd+Shift+S` on macOS)
- **Quick add** — `+` button to save the current tab to any collection
- **Auto-close** — opens links in a new tab and closes the panel

### Theme
- **Light / Dark / System** — choose your preference via the floating action button
- **Improved dark mode** — optimized contrast and glass transparency for readability

### Customization
- **Background images** — presets, paste URL, or drop an image file
- **350+ icons** across 12 categories with live search
- **10 accent colors** per collection
- **Editable title** — click the page title to rename

### Data Management
- **Export / Import** — backup and restore collections as JSON
- **Persistent storage** — all data saved to `chrome.storage.local`

---

## Installation

### From Source (Developer Mode)

```bash
git clone https://github.com/Phuoc0510/TabCollections.git
```

1. Open `chrome://extensions` in Chrome or Brave
2. Enable **Developer mode** (toggle top right)
3. Click **Load unpacked**
4. Select the cloned folder

### From Chrome Web Store

*Coming soon.*

---

## Usage

### Saving Tabs

| Method | Steps |
|--------|-------|
| **Popup** | Click extension icon → check tabs → select group → **Add to Group** |
| **Context menu** | Right-click any tab → **Add to Tab Collection** → choose group |
| **Drag URL** | Drag URL from address bar onto any group card on the new tab page |
| **Side panel** | Open with `Cmd+Shift+S` → click **+** on any collection |
| **Quick Save** | `Cmd+Shift+Y` to save current tab via popup |

### Managing Collections

| Action | How |
|--------|-----|
| Create collection | Click **New Collection** card at the end of the grid |
| Edit collection | Expand card → click **Actions** → **Edit** |
| Delete collection | Expand card → click **Actions** → **Delete** |
| Reorder cards | Drag card by its header |
| Add tabs | Expand card → click **Actions** → **Add Tab** → choose from open tabs |
| Open all tabs | Expand card → click **Actions** → **Open All** |
| Edit tab name & URL | Hover tab → click **⋯** → **Edit** |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+Y` / `Cmd+Shift+Y` | Quick Save current tab |
| `Ctrl+Shift+S` / `Cmd+Shift+S` | Open Side Panel |

### Floating Action Button (FAB)

The gear button at the bottom-right gives quick access to:

| Button | Action |
|--------|--------|
| Export | Export collections as JSON |
| Import | Import collections from JSON |
| Customize | Customize background image |
| Theme | Toggle theme (System / Light / Dark) |
| Privacy | Toggle privacy mode |

---

## Project Structure

```
TabCollection/
├── manifest.json            # Extension manifest V3
├── background.js            # Service worker — handles messages & context menus
├── storage.js               # Storage layer — CRUD for groups & tabs
├── storage.test.js          # Unit tests for storage
├── constants.js             # Shared constants (icon categories, colors)
├── icons.js                 # SVG icon definitions for UI actions
├── popup/                   # Extension popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── sidepanel/               # Side panel (collection browser)
│   ├── sidepanel.html
│   ├── sidepanel.css
│   └── sidepanel.js
├── newtab/                  # New tab page (chrome_url_overrides)
│   ├── newtab.html
│   ├── newtab.css
│   └── newtab.js
├── styles/                  # Shared stylesheets
│   ├── reset.css
│   ├── glass.css
│   ├── components.css
│   ├── animations.css
│   ├── variables.css
│   └── responsive.css
├── icons/                   # Extension icons
└── docs/
    └── superpowers/
        ├── specs/
        └── plans/
```

---

## Development

### Prerequisites

- Node.js (for ESLint and Prettier)
- Chrome or Brave browser

### Commands

```bash
node storage.test.js         # Run storage tests
npm run lint                 # Lint all JS files
npm run format               # Format with Prettier
```

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Background (SW)                    │
│  ┌────────────┐  ┌────────────┐  ┌───────────────┐  │
│  │  storage   │  │ Context    │  │ Message       │  │
│  │  layer     │  │ Menus      │  │ Handler       │  │
│  └────────────┘  └────────────┘  └───────────────┘  │
└──────────┬────────────────────────────────┬──────────┘
           │ chrome.runtime.sendMessage     │
           ▼                    ▼                    ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────┐
│   Popup (popup/) │  │ Side Panel       │  │ New Tab Page (newtab/)│
│  Save tabs from  │  │  Browse & add    │  │  View, manage, drag   │
│  current window  │  │  collections     │  │  collections & tabs   │
└──────────────────┘  └──────────────────┘  └──────────────────────┘
```

Data flows through `chrome.storage.local`. The background service worker acts as the single source of truth — the popup, side panel, and new tab page all send messages via `chrome.runtime.sendMessage` for all mutations.

---

## Changelog

### v2.5.0
- Edit tab name & URL — click **⋯** → **Edit** on any tab to modify its title or URL
- SVG glass-effect icons replacing UI emoji (keep group icon picker as emoji)
- Floating action popup for tab actions (Edit / Delete)
- Solid FAB background — no glass transparency on hover
- Accessibility improvements: `lang="en"`, `role="dialog"`, `aria-modal`, global Escape key
- CSS variables for accent colors and borders — hardcoded values removed
- Write queue serialization for storage operations — eliminates race conditions
- Hover-reveal tab actions (delete, drag handle) hidden until mouse over

### v2.3.0
- Theme picker — toggle between Light / Dark / System from the FAB
- Tab picker — multi-select from open tabs when adding to a collection
- Floating Action Button (FAB) — export, import, customize, theme, privacy
- Icon-only action buttons with ⋯ dropdown menu on each card
- Redesigned header — search bar expands between title and controls
- New Collection card at the end of the grid (replaces header button)
- Improved dark mode readability (opaque glass, brighter text)

### v2.2.0
- Realtime search — filter collections and tabs by name, title, or URL
- Grid / List view toggle on the new tab page
- Side Panel — view-only collection browser (`Ctrl+Shift+S` / `Cmd+Shift+S`)

### v2.1.0
- Inline collection-title editing and compact collection cards
- Background image collections with tabbed selection
- Improved glass UI and popup error/status feedback
- Quick Save keyboard shortcut (`Ctrl+Shift+Y` / `Cmd+Shift+Y`)

### v2.0.0
- Drag URL from browser address bar onto group cards
- Enhanced drag-target visual feedback
- Improved ESLint configuration

### v1.0.0
- Initial release — basic tab collection and management
- Group creation with icons and colors
- Context menu integration
- Export / Import
- Custom background images

---

## License

MIT
