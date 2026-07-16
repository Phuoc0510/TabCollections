# Image File Import for Background

Import local image files as new tab page background via drag-and-drop.

## Status

Approved. Ready for implementation.

## Storage

- Same key `tabCollectorBg` in `chrome.storage.local`
- Image stored as base64 data URL (from `FileReader.readAsDataURL()`)
- Existing URL-based backgrounds continue to work unchanged

## Constraints

| Constraint | Value |
|---|---|
| Max file size | 5 MB |
| Allowed formats | `.jpg` `.jpeg` `.png` `.gif` `.webp` |

Exceeding size or wrong type → `showStatus()` error message, no storage write.

## HTML

Add drop zone inside `#bg-modal`, after `#bg-presets` and before the URL input:

```html
<div id="bg-drop-zone">
  <span>Drop image here</span>
</div>
```

## CSS

```css
#bg-drop-zone {
  border: 2px dashed var(--border-color, #ccc);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: background .15s, border-color .15s;
}
#bg-drop-zone.drag-over {
  border-color: #4285f4;
  background: rgba(66,133,244,.08);
}
```

Dark mode variant in existing `@media (prefers-color-scheme: dark)` block.

## JS — showBgModal()

Events attached to `#bg-drop-zone` inside `showBgModal()`:

### dragover
- `e.preventDefault()`
- Add `.drag-over` class

### dragleave
- Remove `.drag-over` class

### drop
1. `e.preventDefault()`, remove `.drag-over`
2. Read `e.dataTransfer.files[0]`
3. Validate MIME type — reject if not image
4. Validate size ≤ 5 MB — reject if over
5. `FileReader.readAsDataURL(file)` → base64 data URL
6. `await saveBg(dataUrl)`, `await applyBg(dataUrl)`
7. Set `inputEl.value = '📎 ' + file.name` (show filename, not raw base64)
8. Deselect all presets (clear `.selected`)
9. `showStatus('Background applied', 'success')`

## UX Flow

1. User opens bg modal (presets + URL input + drop zone)
2. Drags image from Finder into drop zone
3. Drop zone highlights during drag-over
4. On drop: image applied immediately, URL input shows filename
5. User can still switch to a preset or paste a URL to override
6. Click "Remove Background" or select preset "None" to clear
