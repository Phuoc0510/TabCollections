# Edit Tab Name & URL

## Summary

Allow users to edit a tab's display title and URL directly from the group card on the newtab page via a modal dialog.

## Data Layer

### New storage function

```js
async function updateTab(tabId, updates) {
  return enqueueWrite(async () => {
    const data = await getAllData();
    if (!data.tabs[tabId]) throw new Error('Tab not found');
    data.tabs[tabId] = { ...data.tabs[tabId], ...updates };
    await saveAllData(data);
  });
}
```

- `updates` accepts `{ title, url }` — both optional.
- No duplicate URL check (unlike `addTabToGroup`).
- Wrapped in `enqueueWrite` to maintain write ordering.

### Background message

Add case `updateTab` to `chrome.runtime.onMessage` listener:

```js
case 'updateTab':
  await updateTab(msg.tabId, msg.updates);
  sendResponse({ ok: true });
  break;
```

## UI

### Tab entry (newtab.js)

Add an edit button (pencil icon) next to the existing delete button in `renderTabEntry`:

```html
<button class="tab-edit" data-id="${t.id}">${icon('edit')}</button>
<button class="tab-delete" data-id="${t.id}">${icon('x')}</button>
```

Edit button appears to the left of the delete button. Both share the same hover-reveal behavior (opacity 0 → visible on `.tab-entry:hover`).

When URL is changed, `faviconUrl()` will compute a new favicon from the new URL on re-render automatically.

### Modal (newtab.html)

New modal overlay following the existing pattern:

```html
<div id="tab-edit-overlay" class="modal-overlay" style="display:none" role="dialog" aria-modal="true" aria-labelledby="tab-edit-title">
  <div id="tab-edit-modal" class="modal">
    <h2 id="tab-edit-title">Edit Tab</h2>
    <label for="tab-edit-title-input">Title</label>
    <input type="text" id="tab-edit-title-input" class="modal-input">
    <label for="tab-edit-url-input">URL</label>
    <input type="text" id="tab-edit-url-input" class="modal-input">
    <div class="modal-actions">
      <button id="tab-edit-cancel-btn" class="btn-ghost">Cancel</button>
      <button id="tab-edit-save-btn" class="btn-primary">Save</button>
    </div>
  </div>
</div>
```

### Handler (newtab.js)

Click on `.tab-edit`:
1. Store current tabId in a variable.
2. Populate modal inputs with current title and URL.
3. Show overlay.

Click Save or Enter:
1. Call `chrome.runtime.sendMessage({ action: 'updateTab', tabId, updates: { title, url } })`.
2. Close modal.
3. Re-render.

Click Cancel, Escape, or overlay backdrop → close modal.

## CSS (newtab.css)

Style `.tab-edit` button matching `.tab-delete`:
- Same size, border-radius, position.
- `opacity: 0` → `opacity: 0.5` on `.tab-entry:hover` (visible but subtle).

### Escape key

The global Escape handler at newtab.js:914 already closes all overlays. The `#tab-edit-overlay` must be added to that list.

## Files Changed

| File | Change |
|---|---|
| `storage.js` | Add `updateTab(tabId, updates)` |
| `background.js` | Add `updateTab` message handler case |
| `newtab.html` | Add `#tab-edit-overlay` modal |
| `newtab.js` | Add edit button in template, modal logic, re-render |
| `newtab.css` | Style `.tab-edit` button |
| `eslint.config.mjs` | Add `updateTab` to globals |
| `storage.test.js` | Add tests for `updateTab` |
