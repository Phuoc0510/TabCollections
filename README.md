# Tab Collection

> A Chrome/Brave extension for collecting, organizing, and managing browser tabs — right from your new tab page.

[![Version](https://img.shields.io/badge/version-2.0.0-blue)](https://github.com/Phuoc0510/TabCollections/releases)
[![Manifest](https://img.shields.io/badge/manifest-v3-green)](https://developer.chrome.com/docs/extensions/reference/manifest)

---

## Features

### Collection Management
- **Save tabs** via popup or right-click context menu
- **Organize by topic** — create groups with custom icons (350+ emoji) and accent colors
- **Inline view** — saved tabs displayed directly on your new tab page
- **Expandable cards** — compact group cards with collapsible content
- **Open All** — restore an entire collection in one click

### Drag & Drop
- **Reorder groups** — drag cards to rearrange, positions persist automatically
- **Reorder tabs** — rearrange tabs within a group using drag handles
- **Move tabs between groups** — cross-group tab drag-and-drop
- **Drop URLs from browser** — drag any URL from the address bar onto a group card to save it

### Customization
- **Background images** — presets, paste URL, or drop an image file
- **350+ icons** across 12 categories with live search
- **10 accent colors** per collection
- **Automatic dark mode** — follows system preference

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

### Organizing

| Action | How |
|--------|-----|
| Create collection | Click **+ New Collection** |
| Edit collection | Expand card → **Edit** |
| Delete collection | Expand card → **Delete** |
| Reorder cards | Drag card by its header |
| Reorder tabs | Drag `⠿` handle on any tab entry |
| Move tab between groups | Drag tab `⠿` handle onto another card |

---

## Project Structure

```
TabCollection/
├── manifest.json            # Extension manifest V3
├── background.js            # Service worker — handles messages & context menus
├── storage.js               # Storage layer — CRUD for groups & tabs
├── storage.test.js          # Unit tests for storage
├── constants.js             # Shared constants (icon categories, colors)
├── popup/                   # Extension popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
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
           ▼                                ▼
┌──────────────────┐           ┌──────────────────────┐
│   Popup (popup/) │           │ New Tab Page (newtab/)│
│  Save tabs from  │           │  View, manage, drag   │
│  current window  │           │  collections & tabs   │
└──────────────────┘           └──────────────────────┘
```

Data flows through `chrome.storage.local`. The background service worker acts as the single source of truth — both the popup and new tab page send messages via `chrome.runtime.sendMessage` for all mutations.

---

## Changelog

### v2.0.0
- Drag URL from browser address bar onto group cards
- Drag-and-drop tabs between groups
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
