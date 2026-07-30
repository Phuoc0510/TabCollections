# UI Theme Switcher — Design Spec

## Overview
Allow users to switch between 7 distinct visual design styles for the Tab Collection Chrome extension — stored locally, applied instantly without reload.

## Architecture

### Theme Engine
- CSS `@layer` (base, themes) — component styles use `var(--...)` exclusively
- `data-ui-theme` attribute on `<html>` — swapping it changes all variables
- Each theme is a CSS file under `styles/themes/<name>.css`
- Theme files only contain: `[data-ui-theme="<name>"] { --var: value; }` + `@layer themes` overrides

### Files
```
styles/
└── themes/
    ├── glass.css          # Current design (upgraded)
    ├── minimal.css
    ├── material.css       # Material Design 3
    ├── neubrutalism.css
    ├── dark-premium.css
    ├── macos.css          # macOS Vision Pro style
    └── terminal.css       # Terminal/hacker vibe
```

## Theme Definitions

| Variable | Glass | Minimal | Material | Neubrutalism | Dark Premium | macOS | Terminal |
|---|---|---|---|---|---|---|---|
| `--bg-primary` | `#f5f7fa` | `#ffffff` | `#fef7ff` | `#fafafa` | `#0d1117` | `#f5f5f7` | `#0a0a0a` |
| `--bg-secondary` | `#ffffff` | `#f8f8f8` | `#f3edf7` | `#f0f0f0` | `#161b22` | `#ffffff` | `#111111` |
| `--text-primary` | `#1a1a2e` | `#111111` | `#1c1b1f` | `#000000` | `#e6edf3` | `#1d1d1f` | `#00ff41` |
| `--text-secondary` | `#4a4a6a` | `#555555` | `#49454f` | `#333333` | `#8b949e` | `#86868b` | `#888888` |
| `--font-family` | Inter | Inter | Inter | Inter | Inter | SF Pro / -apple-system | `'Courier New', monospace` |
| `--accent` | `#4285f4` | `#000000` | `#6750a4` | `#FF6B6B` | `#58a6ff` | `#0071e3` | `#00ff41` |
| `--radius-sm` | 8px | 4px | 12px | 0 | 6px | 8px | 0 |
| `--radius-md` | 10px | 6px | 16px | 0 | 8px | 10px | 0 |
| `--radius-lg` | 14px | 8px | 28px | 4px | 8px | 14px | 0 |
| `--radius-xl` | 18px | 12px | 28px | 4px | 12px | 18px | 0 |
| `--glass-bg` | `rgba(255,255,255,0.55)` | transparent | transparent | transparent | transparent | `rgba(255,255,255,0.7)` | transparent |
| `--glass-blur` | 20px | 0 | 0 | 0 | 0 | 40px | 0 |
| `--border-color` | `rgba(255,255,255,0.4)` | `#e0e0e0` | `#eaddff` | `#000000` | `#30363d` | `rgba(255,255,255,0.5)` | `#333333` |
| `--glass-card-shadow` | `0 8px 32px rgba(0,0,0,0.06)` | `0 1px 3px rgba(0,0,0,0.08)` | `0 1px 3px rgba(0,0,0,0.12)` | `3px 3px 0 #000` | `0 1px 3px rgba(0,0,0,0.3)` | `0 4px 20px rgba(0,0,0,0.08)` | `none` |
| `--glass-card-border` | `rgba(255,255,255,0.45)` | `transparent` | `transparent` | `2px solid #000` | `#30363d` | `rgba(255,255,255,0.5)` | `1px solid #333` |

### Per-theme special overrides (beyond variables)

**Terminal:**
- Box shadows removed entirely
- `.btn-primary` → green-on-black terminal aesthetic
- `.search-input` → no border radius, monospace
- Cards → `border: 1px solid #333` with `font-family: monospace`
- Blinking cursor effect on search

**Neubrutalism:**
- All `.btn-*` → `border: 2px solid #000`, `box-shadow: 3px 3px 0 #000`
- All `.glass-card` → `border: 2px solid #000`, `border-radius: 4px`
- Bold high-contrast colors & thick borders on everything

**macOS:**
- `.glass-strong` → `backdrop-filter: blur(40px)` (stronger blur)
- Header → traffic light dots (CSS-only, decorative)

**Dark Premium:**
- Card backgrounds: `#161b22` with `#21262d` hover
- Borders: `#30363d` (GitHub-style)

**Material:**
- `.btn-primary` → `border-radius: 100px` (pill shape)
- Card shadows: Material elevation tiers
- `.modal` → `border-radius: 28px 28px 0 0`

## Implementation Plan

### Phase 1 — Theme infrastructure (1 file)
1. Create `styles/themes/` directory with all 7 theme CSS files
2. Import all themes in each HTML page via `<link>` (or inline in `newtab.html` head)
3. Add `data-ui-theme` detection + application in `newtab.js`, `popup.js`, `sidepanel.js`:

```js
// In each page's init:
chrome.storage.local.get('uiTheme').then(result => {
  const theme = result.uiTheme || 'glass';
  document.documentElement.setAttribute('data-ui-theme', theme);
});
```

### Phase 2 — Theme picker UI
1. Add "UI Theme" button to FAB menu in `newtab.html`
2. Create theme-picker modal overlay in `newtab.html`
3. Add theme picker rendering + selection logic to `newtab.js`
4. Style the picker in `newtab.css`

### Phase 3 — Popup & Sidepanel sync
1. Add theme detection + apply to `popup.js`
2. Add theme detection + apply to `sidepanel.js`
3. Ensure same storage key

## User Flow
1. User opens new tab → sees current theme (default: glass)
2. Opens FAB → clicks "UI Theme"
3. Modal shows 7 theme cards with visual preview
4. Clicks a card → data-ui-theme changes instantly on <html>
5. Selection saved to chrome.storage.local
6. On next open, theme persists

## Edge Cases
- **No storage value**: default to `glass`
- **Invalid theme name** in storage: fallback to `glass`
- **Theme during search/tasks**: theme applies to both collections and tasks views
- **Popup**: uses same storage key, follows same theme
