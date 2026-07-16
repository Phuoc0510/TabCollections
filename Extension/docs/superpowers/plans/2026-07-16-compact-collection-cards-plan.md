# Compact Collection Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the always-expanded collection list with compact, independently expandable collection cards on the extension new-tab page.

**Architecture:** Keep existing groups, tabs, colors, icons, and background settings unchanged. `newtab.js` will maintain an in-memory `Set` of expanded group IDs and render each card's tab/action region only when expanded. `newtab.css` will provide the responsive grid, chevron transition, keyboard-focus states, and mobile action wrapping.

**Tech Stack:** Vanilla JavaScript, CSS Grid, Chrome Extensions Manifest V3 APIs, existing `chrome.runtime` messaging.

---

## File Structure

- Modify: `newtab/newtab.js` — Track expanded cards, render accessible toggle controls, and preserve existing tab/group action handlers.
- Modify: `newtab/newtab.css` — Make the collection view responsive, style collapsed/expanded cards, and provide mobile layout rules.
- No storage, manifest, popup, or background changes — this is a presentation-only change.

---

### Task 1: Render Independently Expandable Collection Cards

**Files:**
- Modify: `newtab/newtab.js:1-153`

- [ ] **Step 1: Add expanded-card state and render a collapsed card by default**

Add this module-level state after `let modalCallback = null;`:

```js
const expandedGroupIds = new Set();
```

In `render()`, replace the current `tabsHtml` and card template with an accessible toggle button and a conditionally rendered body:

```js
const isExpanded = expandedGroupIds.has(g.id);
const tabsHtml = g.tabs && g.tabs.length
  ? `<div class="group-tabs">${g.tabs.map(renderTabEntry).join('')}</div>`
  : `<div class="group-tabs group-tabs-empty">No tabs yet. Use the extension popup to add tabs.</div>`;

return `<article class="group-card${isExpanded ? ' is-expanded' : ''}" data-id="${g.id}">
  <div class="group-color-bar" style="background:${g.color || '#4285f4'}"></div>
  <div class="group-card-inner">
    <button class="group-header group-toggle" data-id="${g.id}" aria-expanded="${isExpanded}" aria-controls="group-content-${g.id}">
      <span class="group-icon">${g.icon || '📁'}</span>
      <span class="group-name">${esc(g.name)}</span>
      <span class="group-meta">${g.tabs ? g.tabs.length : 0} tab${(g.tabs ? g.tabs.length : 0) !== 1 ? 's' : ''}${timeAgo ? ' · ' + timeAgo : ''}</span>
      <span class="group-chevron" aria-hidden="true">⌄</span>
    </button>
    <div id="group-content-${g.id}" class="group-content"${isExpanded ? '' : ' hidden'}>
      <div class="group-actions">
        <button class="group-open-all-btn" data-id="${g.id}">Open All</button>
        <button class="group-edit-btn" data-id="${g.id}">Edit</button>
        <button class="group-delete-btn" data-id="${g.id}">Delete</button>
      </div>
      ${tabsHtml}
    </div>
  </div>
</article>`;
```

- [ ] **Step 2: Add the toggle event handler before the tab-delete event handler**

```js
document.querySelectorAll('.group-toggle').forEach(toggle => {
  toggle.addEventListener('click', () => {
    const { id } = toggle.dataset;
    if (expandedGroupIds.has(id)) {
      expandedGroupIds.delete(id);
    } else {
      expandedGroupIds.add(id);
    }
    render();
  });
});
```

The button element provides Enter and Space keyboard activation natively. Do not add a separate keydown listener.

- [ ] **Step 3: Preserve expanded state after tab deletion**

Keep the existing delete handler's `await render()` call. Because `expandedGroupIds` is module-level state, the relevant card remains open after a tab is removed.

- [ ] **Step 4: Check JavaScript syntax**

Run:

```bash
node -e "new Function(require('fs').readFileSync('newtab/newtab.js', 'utf8')); console.log('Syntax OK')"
```

Expected: `Syntax OK`

---

### Task 2: Add Compact Responsive Card Styling

**Files:**
- Modify: `newtab/newtab.css:39-68`

- [ ] **Step 1: Replace the single-column grid with a responsive compact grid**

Replace the `#groups-grid` rule with:

```css
#groups-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 16px;
  align-items: start;
}
```

- [ ] **Step 2: Style the header as a compact accessible toggle**

Replace the current `.group-header` rule and add the related rules:

```css
.group-header {
  align-items: center;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  display: flex;
  gap: 10px;
  padding: 14px 16px;
  text-align: left;
  width: 100%;
}
.group-header:hover { background: rgba(66, 133, 244, .06); }
.group-header:focus-visible { outline: 2px solid #4285f4; outline-offset: -2px; }
.group-meta { font-size: 12px; color: #888; margin-left: auto; white-space: nowrap; }
.group-chevron { color: #6b7280; font-size: 18px; line-height: 1; transition: transform .18s ease; }
.group-card.is-expanded .group-chevron { transform: rotate(180deg); }
```

- [ ] **Step 3: Style expanded content and move action controls inside it**

Add these rules and remove the previous always-visible `.group-actions` rule:

```css
.group-content { border-top: 1px solid #eee; }
.group-content.hidden { display: none; }
.group-actions {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  padding: 8px 12px;
}
.group-actions button { padding: 4px 10px; font-size: 12px; border-radius: 6px; }
.group-tabs { border-top: 1px solid #eee; }
.group-tabs-empty { color: #888; font-size: 13px; padding: 18px; text-align: center; }
```

- [ ] **Step 4: Add narrow-screen rules**

Append this media query:

```css
@media (max-width: 600px) {
  #app { padding: 20px 14px; }
  #groups-grid { grid-template-columns: 1fr; }
  .group-header { flex-wrap: wrap; }
  .group-meta { margin-left: 0; }
  .group-actions { justify-content: flex-start; flex-wrap: wrap; }
  .tab-entry { padding: 8px 12px; }
  .tab-open { display: none; }
}
```

- [ ] **Step 5: Verify the CSS and UI manually**

1. Reload the unpacked extension from `brave://extensions` or `chrome://extensions`.
2. Open a new tab at a desktop width.
3. Confirm two or more compact cards appear in a row when the viewport allows it.
4. Click two different card headers; confirm both remain expanded.
5. Press `Tab` to focus a card header and press `Enter`; confirm it toggles.
6. Narrow the window below 600px; confirm cards use one column and controls do not overflow.

Expected: Cards are compact by default, each card expands independently, and all actions remain reachable.

---

### Task 3: Regression Check Existing Behaviors

**Files:**
- Verify: `newtab/newtab.js`
- Verify: `storage.test.js`

- [ ] **Step 1: Run storage regression tests**

Run:

```bash
node storage.test.js
```

Expected: Every `PASS:` line prints followed by `All tests passed.`

- [ ] **Step 2: Verify expanded card actions**

On an expanded card:

1. Click a saved tab entry and confirm it opens its URL in a new browser tab.
2. Click `Open All` and confirm every saved URL in that group opens.
3. Click `Edit`, change the icon or color, save, and confirm the card updates.
4. Click a tab delete control and confirm only that entry disappears while the group stays expanded.
5. Click `Delete`, confirm the browser confirmation dialog, and verify the full group disappears.

Expected: The compact layout changes no storage behavior or group/tab action behavior.

- [ ] **Step 3: Commit if Git is initialized**

Run:

```bash
git rev-parse --is-inside-work-tree
```

If it prints `true`, run:

```bash
git add newtab/newtab.js newtab/newtab.css docs/superpowers/specs/2026-07-16-compact-collection-cards-design.md docs/superpowers/plans/2026-07-16-compact-collection-cards-plan.md
```

If Git is not initialized, do not attempt a commit.
