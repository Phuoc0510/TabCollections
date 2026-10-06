/* exported renderTabEntry, renderGroupSection, renderSidebarItems, resolveInitialView, isSearchShortcut */

// Pure HTML builders for the new tab page: no DOM, no chrome.*, so newtab-view.test.js runs them in Node.
// Handler code in newtab.js finds elements by these class names — keep them stable.

const DEFAULT_GROUP_COLOR = '#4285f4';

function renderTabEntry(t) {
  const title = t.title || (() => { try { return new URL(t.url).hostname; } catch { return 'Untitled'; } })();
  const displayUrl = t.url.length > 60 ? t.url.slice(0, 57) + '...' : t.url;
  const imgSrc = faviconUrl(t);
  return `<div class="tab-entry" data-id="${esc(t.id)}" data-url="${esc(t.url)}" draggable="true">
    <span class="tab-drag-handle" draggable="true">${icon('dragHandle')}</span>
    ${imgSrc ? `<img src="${esc(imgSrc)}" alt="" onerror="this.style.display='none'">` : ''}
    <div class="tab-info">
      <div class="tab-title">${esc(title)}</div>
      <div class="tab-url">${esc(displayUrl)}</div>
    </div>
    <div class="tab-actions-wrapper">
      <button class="tab-actions-toggle" data-id="${esc(t.id)}" title="Actions">${icon('moreH')}</button>
      <div class="tab-actions-popup">
        <button class="tab-edit" data-id="${esc(t.id)}">${icon('edit')} Edit</button>
        <button class="tab-delete" data-id="${esc(t.id)}">${icon('trash')} Delete</button>
      </div>
    </div>
  </div>`;
}

function renderGroupSection(g, isExpanded) {
  const id = esc(g.id);
  const count = g.tabs ? g.tabs.length : 0;
  const tabsHtml = count
    ? `<div class="group-tabs">${g.tabs.map(renderTabEntry).join('')}</div>`
    : '<div class="group-tabs"><div class="group-tabs-empty">Thả URL vào đây hoặc bấm Thêm tab</div></div>';

  return `<section class="group-card${isExpanded ? ' is-expanded' : ''}" draggable="true" data-id="${id}" style="--group-color:${esc(g.color || DEFAULT_GROUP_COLOR)}">
    <div class="group-card-inner">
      <div class="group-header">
        <button class="group-toggle" data-id="${id}" aria-expanded="${isExpanded}" aria-controls="group-content-${id}">
          <span class="group-chevron" aria-hidden="true">${icon('chevronDown')}</span>
          <span class="group-dot"></span>
          <span class="group-icon">${esc(g.icon || '📁')}</span>
          <span class="group-name">${esc(g.name)}</span>
          <span class="group-meta">${count} tab</span>
        </button>
        <div class="group-actions">
          <button class="group-action group-add-tab-btn" data-id="${id}" title="Thêm tab">${icon('plus')}<span>Thêm tab</span></button>
          <button class="group-action group-open-all-btn" data-id="${id}" title="Mở tất cả">${icon('play')}<span>Mở tất cả</span></button>
          <button class="group-action group-actions-toggle" data-id="${id}" title="Thêm" aria-haspopup="menu">${icon('moreH')}</button>
          <div class="group-actions-menu" data-id="${id}" role="menu">
            <button class="group-edit-btn" data-id="${id}" role="menuitem">${icon('edit')} Sửa</button>
            <button class="group-delete-btn" data-id="${id}" role="menuitem">${icon('trash')} Xoá</button>
          </div>
        </div>
      </div>
      <div id="group-content-${id}" class="group-content"${isExpanded ? '' : ' hidden'}>
        ${tabsHtml}
      </div>
    </div>
  </section>`;
}

function renderSidebarItems(groups, activeId) {
  return groups.map(g => {
    const count = g.tabs ? g.tabs.length : 0;
    return `<button class="sidebar-item${g.id === activeId ? ' active' : ''}" data-id="${esc(g.id)}" style="--group-color:${esc(g.color || DEFAULT_GROUP_COLOR)}">
      <span class="group-dot"></span>
      <span class="sidebar-item-icon">${esc(g.icon || '📁')}</span>
      <span class="sidebar-item-name">${esc(g.name)}</span>
      <span class="sidebar-item-count">${count}</span>
    </button>`;
  }).join('');
}

/** Which view to open on. With Tasks hidden, every route (old ?view=tasks links, saved state) lands on Collections. */
function resolveInitialView(urlView, savedView, tasksEnabled) {
  if (!tasksEnabled) return 'collections';
  if (urlView === 'tasks' || urlView === 'collections') return urlView;
  return savedView === 'tasks' ? 'tasks' : 'collections';
}

/** ⌘K / Ctrl+K anywhere, or a bare "/" when the person is not typing into a field. */
function isSearchShortcut(e) {
  if (e.altKey) return false;
  if ((e.key || '').toLowerCase() === 'k' && (e.metaKey || e.ctrlKey) && !e.shiftKey) return true;
  if (e.key !== '/' || e.metaKey || e.ctrlKey) return false;
  const t = e.target || {};
  return !t.isContentEditable && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}
