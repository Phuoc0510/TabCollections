# Tab Collection

A Chrome/Brave extension that helps you collect tabs into organized groups and manage them directly from your new tab page.

## Features

- **Collect tabs manually** — select tabs from the popup and add them to any group
- **Organize by topic** — create multiple collections (Work, Dev, Reading, etc.) with custom icons and colors
- **Inline view** — saved tabs are displayed directly on your new tab page, no extra clicks needed
- **Compact cards** — groups are shown as compact expandable cards
- **Context menu** — right-click any tab → "Add to Tab Collection" for quick saving
- **Customizable** — choose from dev-themed emoji icons and accent colors for each collection
- **Background image** — set a custom background image on the new tab page
- **Export / Import** — backup your collections as JSON files
- **Dark mode** — follows your system's color scheme automatically

## Installation

1. Open Chrome/Brave and go to `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select this folder
4. The extension icon appears in the toolbar

## Usage

### Saving tabs
- Click the extension icon → check the tabs you want to save → pick a group → **Add to Group**
- Or right-click any tab → **Add to Tab Collection** → choose a group

### Managing collections
- Open a new tab to see your collections
- Click a collection header to expand/collapse its saved tabs
- Use **Open All**, **Edit**, or **Delete** inside each expanded collection
- Click any saved tab entry to open it in a new tab

### Customization
- Click **🎨** (top right) to set a background image
- When creating or editing a collection, choose an icon and color

## Development

### File structure

```
├── manifest.json          # Extension manifest V3
├── background.js          # Service worker
├── storage.js             # Storage layer
├── storage.test.js        # Storage tests
├── popup/                 # Popup UI
│   ├── popup.html
│   ├── popup.css
│   └── popup.js
├── newtab/                # New tab page
│   ├── newtab.html
│   ├── newtab.css
│   └── newtab.js
├── icons/
│   └── icon128.png
└── docs/
    └── superpowers/
        ├── specs/         # Design specs
        └── plans/         # Implementation plans
```

### Tests

```bash
node storage.test.js
```
