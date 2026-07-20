let groups = [];
let modalCallback = null;
const expandedGroupIds = new Set();
let expandedInitialized = false;
let privacyMode = false;
const TITLE_KEY = 'tabCollectorTitle';

const $ = id => document.getElementById(id);

function showStatus(msg, type) {
  const bar = $('status-bar');
  bar.textContent = msg;
  bar.className = 'status-bar ' + type;
  bar.style.display = 'block';
  setTimeout(() => { bar.style.display = 'none'; }, 3000);
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function matchesSearch(item, term) {
  if (!term) return true;
  const lower = term.toLowerCase();
  return (item.name && item.name.toLowerCase().includes(lower))
    || (item.title && item.title.toLowerCase().includes(lower))
    || (item.url && item.url.toLowerCase().includes(lower));
}

function faviconUrl(t) {
  if (t.favicon) return t.favicon;
  try { return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(new URL(t.url).hostname)}&sz=16`; }
  catch { return ''; }
}

async function loadAll() {
  groups = await chrome.runtime.sendMessage({ action: 'getGroups' });
  const data = await chrome.runtime.sendMessage({ action: 'getAllData' });
  for (const g of groups) {
    g.tabs = Object.values(data.tabs).filter(t => t.groupId === g.id).sort((a, b) => (b.position ?? b.addedAt) - (a.position ?? a.addedAt));
  }
}

function renderTabEntry(t) {
  const title = t.title || (() => { try { return new URL(t.url).hostname; } catch { return 'Untitled'; } })();
  const displayUrl = t.url.length > 60 ? t.url.slice(0, 57) + '...' : t.url;
  const imgSrc = faviconUrl(t);
  return `<div class="tab-entry" data-id="${t.id}" data-url="${esc(t.url)}" draggable="true">
    <span class="tab-drag-handle" draggable="true">⠿</span>
    ${imgSrc ? `<img src="${imgSrc}" alt="" onerror="this.style.display='none'">` : ''}
    <div class="tab-info">
      <div class="tab-title">${esc(title)}</div>
      <div class="tab-url">${esc(displayUrl)}</div>
    </div>
    <button class="tab-delete" data-id="${t.id}">✕</button>
  </div>`;
}

async function render() {
  try {
    await loadAll();
  } catch (err) {
    console.error('Failed to load data:', err);
    showStatus('Failed to load data: ' + err.message, 'error');
    return;
  }
  if (!expandedInitialized) {
    groups.forEach(g => expandedGroupIds.add(g.id));
    expandedInitialized = true;
  }

  const searchTerm = ($('search-input')?.value || '').trim().toLowerCase();
  if (searchTerm) {
    groups = groups.map(g => {
      const matchingTabs = (g.tabs || []).filter(t => matchesSearch(t, searchTerm));
      const nameMatch = matchesSearch(g, searchTerm);
      if (nameMatch || matchingTabs.length > 0) {
        return { ...g, tabs: nameMatch ? g.tabs : matchingTabs };
      }
      return null;
    }).filter(Boolean);
  }

  const grid = $('groups-grid');
  const empty = $('empty-state');

  if (groups.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = groups.map(g => {
    const isExpanded = expandedGroupIds.has(g.id);
    const tabsHtml = g.tabs && g.tabs.length
      ? `<div class="group-tabs">${g.tabs.map(renderTabEntry).join('')}</div>`
      : `<div class="group-tabs group-tabs-empty">No tabs yet. Use the extension popup to add tabs.</div>`;

    return `<article class="group-card glass-card${isExpanded ? ' is-expanded' : ''}" draggable="true" data-id="${g.id}">
      <div class="group-color-bar" style="--bar-color:${g.color || '#4285f4'}"></div>
      <div class="group-card-inner">
        <button class="group-header group-toggle" data-id="${g.id}" aria-expanded="${isExpanded}" aria-controls="group-content-${g.id}">
          <span class="group-icon">${g.icon || '📁'}</span>
          <span class="group-name">${esc(g.name)}</span>
          <span class="group-meta">${g.tabs ? g.tabs.length : 0} tab${(g.tabs ? g.tabs.length : 0) !== 1 ? 's' : ''}</span>
          <button class="group-pin-btn" data-id="${g.id}" title="${g.pinned ? 'Unpin' : 'Pin to top'}">${g.pinned ? '📌' : '📍'}</button>
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
  }).join('');
}

$('groups-grid').addEventListener('click', async e => {
  const groupCard = e.target.closest('.group-card');
  if (!groupCard) return;

  const groupId = groupCard.dataset.id;

  const pinBtn = e.target.closest('.group-pin-btn');
  if (pinBtn) {
    e.stopPropagation();
    await chrome.runtime.sendMessage({ action: 'togglePinGroup', id: pinBtn.dataset.id });
    await render();
    return;
  }

  const toggle = e.target.closest('.group-toggle');
  if (toggle) {
    if (expandedGroupIds.has(groupId)) expandedGroupIds.delete(groupId);
    else expandedGroupIds.add(groupId);
    await render();
    return;
  }

  const tabDelete = e.target.closest('.tab-delete');
  if (tabDelete) {
    e.stopPropagation();
    const tabId = tabDelete.dataset.id;
    await chrome.runtime.sendMessage({ action: 'softDeleteTab', tabId });
    await render();
    showToast('Tab deleted', tabId, 'tab');
    return;
  }

  const tabEntry = e.target.closest('.tab-entry');
  if (tabEntry) {
    await chrome.tabs.create({ url: tabEntry.dataset.url });
    return;
  }

  const openAllBtn = e.target.closest('.group-open-all-btn');
  if (openAllBtn) {
    const g = groups.find(x => x.id === openAllBtn.dataset.id);
    if (!g || !g.tabs) return;
    for (const t of g.tabs) await chrome.tabs.create({ url: t.url });
    showStatus(`Opened ${g.tabs.length} tab${g.tabs.length !== 1 ? 's' : ''}`, 'success');
    return;
  }

  const editBtn = e.target.closest('.group-edit-btn');
  if (editBtn) {
    const g = groups.find(x => x.id === editBtn.dataset.id);
    if (g) showEditModal(g);
    return;
  }

  const deleteBtn = e.target.closest('.group-delete-btn');
  if (deleteBtn) {
    const g = groups.find(x => x.id === deleteBtn.dataset.id);
    if (!g) return;
    if (await showConfirm(`Delete "${g.name}" and all its tabs?`)) {
      await chrome.runtime.sendMessage({ action: 'softDeleteGroup', id: g.id });
      await render();
      showToast(`Deleted "${g.name}"`, g.id, 'group');
    }
    return;
  }
});

// Privacy toggle
function togglePrivacy() {
  privacyMode = !privacyMode;
  document.body.classList.toggle('privacy-mode', privacyMode);
  chrome.storage.local.set({ privacyMode });
  const hpBtn = document.getElementById('header-privacy-toggle');
  if (hpBtn) hpBtn.classList.toggle('active', privacyMode);
}

// ── Drag and drop reorder ──

let dragSrcId = null;
let dragSrcEl = null;
let isDragging = false;
let pendingRender = false;
let lastRefNode = undefined;
let tabDragSrcEl = null;
let dragSrcGroupId = null;
let dragTargetGroupId = null;

$('groups-grid').addEventListener('dragstart', e => {
  const card = e.target.closest('.group-card');
  if (!card) return;
  // Don't start card drag if dragging a tab entry
  if (e.target.closest('.tab-entry')) return;
  pendingRender = false;
  isDragging = true;
  dragSrcEl = card;
  dragSrcId = card.dataset.id;
  lastRefNode = undefined;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragSrcId);
  card.style.opacity = '0.35';
});

$('groups-grid').addEventListener('dragover', e => {
  e.preventDefault();
  if (!dragSrcEl || !dragSrcEl.isConnected) { dragSrcEl = null; return; }
  const target = e.target.closest('.group-card');
  if (!target || target === dragSrcEl) return;
  e.dataTransfer.dropEffect = 'move';

  const grid = target.parentNode;
  const cards = [...grid.querySelectorAll('.group-card')];
  const srcIdx = cards.indexOf(dragSrcEl);
  const tgtIdx = cards.indexOf(target);

  // Insert AFTER target when dragging downward, BEFORE when dragging upward
  const refNode = srcIdx < tgtIdx ? target.nextSibling : target;
  // Skip if insertion point hasn't changed or would be a no-op
  if (refNode === lastRefNode) return;
  if (refNode === dragSrcEl) return;
  if (refNode && dragSrcEl.nextSibling === refNode) return;

  lastRefNode = refNode;
  grid.insertBefore(dragSrcEl, refNode);
});

$('groups-grid').addEventListener('drop', e => {
  e.preventDefault();
});

$('groups-grid').addEventListener('dragend', async e => {
  if (dragSrcEl) dragSrcEl.style.opacity = '';
  const srcId = dragSrcId;
  dragSrcEl = null;
  dragSrcId = null;
  if (srcId) {
    const cards = [...$('groups-grid').querySelectorAll('.group-card')];
    const ids = cards.map(c => c.dataset.id);
    await chrome.runtime.sendMessage({ action: 'updateGroupPositions', orderedIds: ids });
  }
  isDragging = false;
  if (pendingRender) {
    pendingRender = false;
    render().catch(err => console.error('Delayed render after drag failed:', err));
  }
});

// ── Tab drag-and-drop reorder ──

$('groups-grid').addEventListener('dragstart', e => {
  const entry = e.target.closest('.tab-entry');
  if (!entry) return;
  const handle = e.target.closest('.tab-drag-handle');
  if (!handle) { e.preventDefault(); return; }

  tabDragSrcEl = entry;
  isDragging = true;
  const parentCard = entry.closest('.group-card');
  dragSrcGroupId = parentCard?.dataset.id || null;
  entry.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', entry.dataset.id);
});

$('groups-grid').addEventListener('dragover', e => {
  const entry = e.target.closest('.tab-entry');
  const targetCard = e.target.closest('.group-card');

  if (!tabDragSrcEl || !tabDragSrcEl.isConnected) {
    if (!targetCard) return;
    // External drag — allow copy onto card (validated at drop)
    if (!dragSrcEl) {
      dragTargetGroupId = targetCard.dataset.id;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      document.querySelectorAll('.group-card.drag-target').forEach(el => el.classList.remove('drag-target'));
      targetCard.classList.add('drag-target');
    }
    return;
  }
  if (!targetCard) return;

  if (targetCard.dataset.id !== dragSrcGroupId) {
    dragTargetGroupId = targetCard.dataset.id;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.group-card.drag-target').forEach(el => el.classList.remove('drag-target'));
    targetCard.classList.add('drag-target');
    return;
  }

  dragTargetGroupId = null;
  // Same group: existing tab reorder
  if (!entry || entry === tabDragSrcEl) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const container = entry.parentNode;
  const rect = entry.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;

  if (e.clientY < midY) {
    container.insertBefore(tabDragSrcEl, entry);
  } else {
    container.insertBefore(tabDragSrcEl, entry.nextSibling);
  }
});

$('groups-grid').addEventListener('drop', async e => {
  e.preventDefault();
  const targetCard = e.target.closest('.group-card');
  if (!targetCard) return;

  if (!tabDragSrcEl && !dragSrcEl) {
    document.querySelectorAll('.group-card.drag-target').forEach(el => el.classList.remove('drag-target'));
    dragTargetGroupId = null;
    try {
      let url = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
      if (!url && e.dataTransfer.items) {
        for (const item of e.dataTransfer.items) {
          if (item.kind === 'string') {
            url = await new Promise(r => item.getAsString(r));
            if (url) break;
          }
        }
      }
      if (!url) return;
      url = url.trim();
      let title = url;
      try { title = new URL(url).hostname; } catch {}
      await chrome.runtime.sendMessage({
        action: 'addTabToGroup',
        tab: { title, url, favicon: '' },
        groupId: targetCard.dataset.id
      });
    } catch (err) {
      console.warn('External drop failed:', err);
    }
  }
});

$('groups-grid').addEventListener('dragend', async e => {
  document.querySelectorAll('.group-card.drag-target').forEach(el => el.classList.remove('drag-target'));

  const src = tabDragSrcEl;
  tabDragSrcEl = null;
  if (!src) { isDragging = false; dragSrcGroupId = null; return; }
  src.classList.remove('dragging');

  const srcGroupId = dragSrcGroupId;
  const targetId = dragTargetGroupId;
  dragSrcGroupId = null;
  dragTargetGroupId = null;

  if (targetId && srcGroupId && targetId !== srcGroupId) {
    await chrome.runtime.sendMessage({
      action: 'moveTabToGroup',
      tabId: src.dataset.id,
      targetGroupId: targetId
    });
    isDragging = false;
    return;
  }

  // Same group reorder
  const container = src.parentNode;
  if (!container) { isDragging = false; return; }
  const groupCard = container.closest('.group-card');
  if (!groupCard) { isDragging = false; return; }

  const entries = [...container.querySelectorAll('.tab-entry')];
  const orderedIds = entries.map(el => el.dataset.id);
  await chrome.runtime.sendMessage({
    action: 'updateTabPositions',
    groupId: groupCard.dataset.id,
    orderedIds
  });
  isDragging = false;
});

function showConfirm(message) {
  return new Promise(resolve => {
    $('confirm-message').textContent = message;
    $('confirm-overlay').style.display = 'flex';
    $('confirm-ok-btn').onclick = () => { hideConfirm(); resolve(true); };
    $('confirm-cancel-btn').onclick = () => { hideConfirm(); resolve(false); };
    $('confirm-overlay').onclick = e => {
      if (e.target === $('confirm-overlay')) { hideConfirm(); resolve(false); }
    };
  });
}

function hideConfirm() {
  $('confirm-overlay').style.display = 'none';
  $('confirm-ok-btn').onclick = null;
  $('confirm-cancel-btn').onclick = null;
  $('confirm-overlay').onclick = null;
}

function renderIconGrid(scroll, term, selectedIcon) {
  const cats = term
    ? ICON_CATEGORIES.filter(c => c.name.toLowerCase().includes(term))
    : ICON_CATEGORIES;

  scroll.innerHTML = cats.map(cat =>
    `<div class="icon-cat">
      <div class="icon-cat-name">${cat.name}</div>
      <div class="icon-grid">
        ${cat.icons.map(i =>
          `<div class="icon-item${i === selectedIcon ? ' selected' : ''}" data-value="${i}">${i}</div>`
        ).join('')}
      </div>
    </div>`
  ).join('');

  scroll.querySelectorAll('.icon-item').forEach(el => {
    el.addEventListener('click', () => {
      scroll.querySelectorAll('.icon-item').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
    });
  });
}

function showModal(title, name, icon, color, onConfirm) {
  $('modal-title').textContent = title;
  $('group-name-input').value = name;
  $('modal-confirm-btn').textContent = title.startsWith('Edit') ? 'Save' : 'Create';
  modalCallback = onConfirm;

  const iconPicker = $('icon-picker');
  iconPicker.innerHTML =
    '<input type="text" class="icon-search" id="icon-search" placeholder="🔍 Search icons...">' +
    '<div class="icon-grid-scroll"></div>';

  let selectedIcon = icon;
  renderIconGrid($('icon-picker').querySelector('.icon-grid-scroll'), '', selectedIcon);

  // Track actual selection in the icon grid
  const scrollEl = $('icon-picker').querySelector('.icon-grid-scroll');
  scrollEl.addEventListener('click', e => {
    const item = e.target.closest('.icon-item');
    if (!item) return;
    selectedIcon = item.dataset.value;
  });

  document.getElementById('icon-search').addEventListener('input', () => {
    const t = document.getElementById('icon-search').value.toLowerCase().trim();
    renderIconGrid($('icon-picker').querySelector('.icon-grid-scroll'), t, selectedIcon);
  });

  const colorPicker = $('color-picker');
  colorPicker.innerHTML = COLORS.map(c =>
    `<div class="pick-option pick-color${c === color ? ' selected' : ''}" data-value="${c}" style="background:${c}"></div>`
  ).join('');
  colorPicker.querySelectorAll('.pick-option').forEach(el => {
    el.addEventListener('click', () => {
      colorPicker.querySelectorAll('.pick-option').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
    });
  });

  $('modal-overlay').style.display = 'flex';
  $('group-name-input').focus();
}

function hideModal() {
  $('modal-overlay').style.display = 'none';
  $('group-name-input').classList.remove('error');
  $('name-error').style.display = 'none';
  modalCallback = null;
}

$('new-group-btn').addEventListener('click', () => {
  showModal('New Collection', '', '📁', '#4285f4', async (name, icon, color) => {
    const response = await chrome.runtime.sendMessage({ action: 'createGroup', name, icon, color });
    if (response && response.error) { showStatus('Create failed: ' + response.error, 'error'); return; }
    await render();
    showStatus(`Created "${name}"`, 'success');
  });
});

$('modal-confirm-btn').addEventListener('click', () => {
  const name = $('group-name-input').value.trim();
  const nameErr = $('name-error');
  if (!name) {
    $('group-name-input').classList.add('error');
    nameErr.style.display = 'block';
    return;
  }
  nameErr.style.display = 'none';
  $('group-name-input').classList.remove('error');
  const iconEl = $('icon-picker').querySelector('.icon-item.selected');
  const icon = iconEl ? iconEl.dataset.value : '📁';
  const colorEl = $('color-picker').querySelector('.selected');
  const color = colorEl ? colorEl.dataset.value : '#4285f4';
  if (modalCallback) modalCallback(name, icon, color);
  hideModal();
});

$('modal-cancel-btn').addEventListener('click', hideModal);
$('modal-overlay').addEventListener('click', e => {
  if (e.target === $('modal-overlay')) hideModal();
});
$('group-name-input').addEventListener('input', () => {
  $('group-name-input').classList.remove('error');
  $('name-error').style.display = 'none';
});
$('group-name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') $('modal-confirm-btn').click();
  if (e.key === 'Escape') hideModal();
});

function showEditModal(g) {
  showModal('Edit Collection', g.name, g.icon || '📁', g.color || '#4285f4', async (name, icon, color) => {
    const response = await chrome.runtime.sendMessage({ action: 'updateGroup', id: g.id, data: { name, icon, color } });
    if (response && response.error) { showStatus('Update failed: ' + response.error, 'error'); return; }
    await render();
    showStatus('Updated', 'success');
  });
}

// ── Title editing ──

async function initTitle() {
  const result = await chrome.storage.local.get(TITLE_KEY);
  const saved = result[TITLE_KEY];
  const h1 = $('app-title');
  let currentTitle = saved || 'Tab Collections';
  h1.textContent = currentTitle;

  h1.addEventListener('click', function startEdit() {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'app-title-input';
    input.value = currentTitle;
    input.maxLength = 100;

    this.replaceWith(input);
    input.focus();
    input.select();

    function finishEdit() {
      const val = input.value.trim();
      const newTitle = val || 'Tab Collections';
      if (newTitle !== currentTitle) {
        currentTitle = newTitle;
        chrome.storage.local.set({ [TITLE_KEY]: newTitle });
      }
      const h1 = document.createElement('h1');
      h1.id = 'app-title';
      h1.className = 'app-title';
      h1.textContent = currentTitle;
      input.replaceWith(h1);
      h1.addEventListener('click', startEdit);
    }

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { input.blur(); }
      if (e.key === 'Escape') {
        const h1 = document.createElement('h1');
        h1.id = 'app-title';
        h1.className = 'app-title';
        h1.textContent = currentTitle;
        input.replaceWith(h1);
        h1.addEventListener('click', startEdit);
      }
    });
  });
}

// Background customization
const BG_KEY = 'tabCollectorBg';
const BG_COLLECTIONS = [
  {
    label: 'Nature',
    images: [
      { label: 'Mountains', url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80' },
      { label: 'Forest', url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80' },
      { label: 'Lake', url: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1920&q=80' },
      { label: 'Waterfall', url: 'https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?w=1920&q=80' },
      { label: 'Sunset', url: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=1920&q=80' },
      { label: 'Aurora', url: 'https://images.unsplash.com/photo-1483347756197-71ef80e8f73f?w=1920&q=80' },
    ]
  },
  {
    label: 'City',
    images: [
      { label: 'Skyline', url: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=1920&q=80' },
      { label: 'Night City', url: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1920&q=80' },
      { label: 'Tokyo', url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1920&q=80' },
      { label: 'New York', url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=1920&q=80' },
      { label: 'Paris', url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=1920&q=80' },
      { label: 'Venice', url: 'https://images.unsplash.com/photo-1523906834658-6e9efc3c8c5b?w=1920&q=80' },
    ]
  },
  {
    label: 'Ocean',
    images: [
      { label: 'Waves', url: 'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=1920&q=80' },
      { label: 'Beach', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80' },
      { label: 'Coastline', url: 'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=1920&q=80' },
      { label: 'Tropical', url: 'https://images.unsplash.com/photo-1540206395-68808572332f?w=1920&q=80' },
      { label: 'Cliff', url: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=1920&q=80' },
    ]
  },
  {
    label: 'Abstract',
    images: [
      { label: 'Flow', url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1920&q=80' },
      { label: 'Geometric', url: 'https://images.unsplash.com/photo-1550859492-d5da9d8e45f3?w=1920&q=80' },
      { label: 'Gradient', url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1920&q=80' },
      { label: 'Neon', url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1920&q=80' },
      { label: 'Fluid', url: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=1920&q=80' },
    ]
  },
  {
    label: 'Dark',
    images: [
      { label: 'Stars', url: 'https://images.unsplash.com/photo-1516339901601-2e1b62dc0c1e?w=1920&q=80' },
      { label: 'Galaxy', url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&q=80' },
      { label: 'Moon', url: 'https://images.unsplash.com/photo-1532767153582-b1a0e6145009?w=1920&q=80' },
      { label: 'Northern Lights', url: 'https://images.unsplash.com/photo-1531366936337-7c912a4589a7?w=1920&q=80' },
      { label: 'Misty', url: 'https://images.unsplash.com/photo-1504198453319-5ce911bafcde?w=1920&q=80' },
    ]
  },
  {
    label: 'Minimal',
    images: [
      { label: 'Clean', url: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=1920&q=80' },
      { label: 'Pastel', url: 'https://images.unsplash.com/photo-1557683311-eac922347aa1?w=1920&q=80' },
      { label: 'Gold', url: 'https://images.unsplash.com/photo-1557682260-96773eb01377?w=1920&q=80' },
      { label: 'Warm', url: 'https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=1920&q=80' },
    ]
  },
];

async function loadBg() {
  const result = await chrome.storage.local.get(BG_KEY);
  return result[BG_KEY] || '';
}

async function saveBg(url) {
  await chrome.storage.local.set({ [BG_KEY]: url });
}

async function applyBg(url) {
  if (url) {
    document.body.style.backgroundImage = `url(${url})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
    document.body.classList.add('has-bg');
  } else {
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundAttachment = '';
    document.body.classList.remove('has-bg');
  }
}

function showBgModal() {
  const overlay = $('bg-modal-overlay');
  const presetsEl = $('bg-presets');
  const inputEl = $('bg-url-input');
  let activeTab = 0;

  function renderGrid(currentUrl) {
    const grid = $('bg-grid');
    const collection = BG_COLLECTIONS[activeTab];
    grid.innerHTML = collection.images.map(img =>
      `<div class="bg-grid-item${img.url === currentUrl ? ' selected' : ''}" data-value="${img.url}" title="${img.label}" style="background-image:url(${encodeURI(img.url)})"></div>`
    ).join('');
    grid.querySelectorAll('.bg-grid-item').forEach(el => {
      if (el.dataset.value === currentUrl) el.classList.add('selected');
      el.addEventListener('click', () => {
        grid.querySelectorAll('.bg-grid-item').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected');
        inputEl.value = el.dataset.value;
      });
    });
  }

  presetsEl.innerHTML =
    `<div class="bg-tabs">${BG_COLLECTIONS.map((c, i) =>
      `<button class="bg-tab${i === 0 ? ' active' : ''}" data-index="${i}">${c.label}</button>`
    ).join('')}</div>` +
    `<div class="bg-grid" id="bg-grid"></div>`;

  loadBg().then(current => {
    inputEl.value = current;
    renderGrid(current);
    presetsEl.querySelectorAll('.bg-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeTab = parseInt(tab.dataset.index);
        presetsEl.querySelectorAll('.bg-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        renderGrid(inputEl.value);
      });
    });
  });

  overlay.style.display = 'flex';
}

const dropZone = $('bg-drop-zone');
dropZone.addEventListener('dragover', e => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showStatus('Unsupported file type. Use .jpg, .png, .gif, or .webp', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showStatus('File too large (max 5MB)', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const dataUrl = reader.result;
      await saveBg(dataUrl);
      await applyBg(dataUrl);
      $('bg-url-input').value = '📎 ' + file.name;
      $('bg-presets').querySelectorAll('.bg-grid-item').forEach(el => el.classList.remove('selected'));
      showStatus('Background applied', 'success');
    } catch (err) {
      showStatus('Failed to save background: ' + err.message, 'error');
    }
  };
  reader.onerror = () => {
    showStatus('Failed to read image file', 'error');
  };
  reader.readAsDataURL(file);
});

$('customize-btn').addEventListener('click', showBgModal);

$('bg-cancel-btn').addEventListener('click', () => { $('bg-modal-overlay').style.display = 'none'; });
$('bg-modal-overlay').addEventListener('click', e => {
  if (e.target === $('bg-modal-overlay')) $('bg-modal-overlay').style.display = 'none';
});

$('bg-confirm-btn').addEventListener('click', async () => {
  const url = $('bg-url-input').value.trim();
  if (url.startsWith('📎 ')) {
    $('bg-modal-overlay').style.display = 'none';
    return;
  }
  await saveBg(url);
  await applyBg(url);
  $('bg-modal-overlay').style.display = 'none';
  showStatus(url ? 'Background applied' : 'Background removed', 'success');
});

$('bg-remove-btn').addEventListener('click', async () => {
  $('bg-url-input').value = '';
  await saveBg('');
  await applyBg('');
  $('bg-modal-overlay').style.display = 'none';
  showStatus('Background removed', 'success');
});

// Init background on load
loadBg().then(applyBg);

// Init privacy mode
chrome.storage.local.get('privacyMode').then(result => {
  privacyMode = !!result.privacyMode;
  if (privacyMode) {
    document.body.classList.add('privacy-mode');
    const hpBtn = document.getElementById('header-privacy-toggle');
    if (hpBtn) hpBtn.classList.add('active');
  }
});

$('header-privacy-toggle').addEventListener('click', togglePrivacy);

$('export-btn').addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ action: 'exportData' });
  if (response && response.error) { showStatus('Export failed: ' + response.error, 'error'); return; }
  const json = response;
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tab-collection-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showStatus('Exported', 'success');
});

$('import-btn').addEventListener('click', () => $('import-input').click());

$('import-input').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const response = await chrome.runtime.sendMessage({ action: 'importData', json: text });
    if (response && response.error) throw new Error(response.error);
    await render();
    showStatus('Imported successfully', 'success');
  } catch (err) {
    showStatus('Import failed: ' + err.message, 'error');
  }
  e.target.value = '';
});

$('search-input')?.addEventListener('input', () => {
  render();
});

const VIEW_KEY = 'viewMode';

async function loadViewMode() {
  const result = await chrome.storage.local.get(VIEW_KEY);
  return result[VIEW_KEY] || 'grid';
}

async function toggleView() {
  const current = document.getElementById('groups-view').classList.contains('view-list') ? 'list' : 'grid';
  const next = current === 'grid' ? 'list' : 'grid';
  document.getElementById('groups-view').classList.toggle('view-list', next === 'list');
  document.getElementById('view-toggle-btn').textContent = next === 'grid' ? '▦ Grid' : '☰ List';
  await chrome.storage.local.set({ [VIEW_KEY]: next });
}

$('view-toggle-btn').addEventListener('click', toggleView);

// Init view mode on load
loadViewMode().then(mode => {
  if (mode === 'list') {
    document.getElementById('groups-view').classList.add('view-list');
    document.getElementById('view-toggle-btn').textContent = '☰ List';
  }
});

let toastTimer = null;

function showToast(message, id, type) {
  const toast = $('toast');
  const msgEl = $('toast-message');
  const undoBtn = $('toast-undo-btn');
  const progress = $('toast-progress');

  if (toastTimer) clearTimeout(toastTimer);

  msgEl.textContent = message;
  undoBtn.onclick = async () => {
    const action = type === 'group' ? 'restoreGroup' : 'restoreTab';
    const param = type === 'group' ? { id } : { tabId: id };
    await chrome.runtime.sendMessage({ action, ...param });
    await render();
    hideToast();
  };

  toast.style.display = 'flex';
  progress.style.width = '100%';
  progress.style.transition = 'none';

  requestAnimationFrame(() => {
    progress.style.transition = 'width 30s linear';
    progress.style.width = '0%';
  });

  toastTimer = setTimeout(hideToast, 30000);
}

function hideToast() {
  const toast = $('toast');
  toast.style.display = 'none';
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
}

initTitle();
render();

const STORAGE_KEY = 'tabCollector';
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    if (isDragging) { pendingRender = true; return; }
    render().catch(err => console.error('Storage change render failed:', err));
  }
});
