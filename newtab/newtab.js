let groups = [];
let modalCallback = null;
const expandedGroupIds = new Set();
let expandedInitialized = false;
let privacyMode = false;

// ── Tasks State ──
const TASKS_FILTERS_KEY = 'tasksFilters';

const DEFAULT_TASK_FILTERS = {
  pic: 'all',
  range: 'today',
  status: 'todo',
  priority: 'all',
  search: ''
};

async function loadTaskFilters() {
  const r = await chrome.storage.local.get(TASKS_FILTERS_KEY);
  return { ...DEFAULT_TASK_FILTERS, ...(r[TASKS_FILTERS_KEY] || {}) };
}

function saveTaskFilters(filters) {
  return chrome.storage.local.set({ [TASKS_FILTERS_KEY]: filters });
}

const tasksState = {
  loggedIn: false,
  items: [],
  filters: { ...DEFAULT_TASK_FILTERS },
  editingId: null,
  loading: false,
  error: null,
  loadToken: 0
};

const TASK_SECTIONS = [
  { id: 'overdue', label: 'Quá hạn', icon: '🔴', bar: 'task-bar-overdue' },
  { id: 'today', label: 'Hôm nay', icon: '⬜', bar: 'task-bar-today' },
  { id: 'sticky', label: 'Thường trực', icon: '📌', bar: 'task-bar-sticky' },
  { id: 'upcoming', label: 'Sắp tới', icon: '🗓️', bar: 'task-bar-upcoming' },
];

const TITLE_KEY = 'tabCollectorTitle';

const $ = id => document.getElementById(id);

function showStatus(msg, type) {
  const bar = $('status-bar');
  bar.textContent = msg;
  bar.className = 'status-bar ' + type;
  bar.style.display = 'block';
  setTimeout(() => { bar.style.display = 'none'; }, 3000);
}



function matchesSearch(item, term) {
  if (!term) return true;
  const lower = term.toLowerCase();
  return (item.name && item.name.toLowerCase().includes(lower))
    || (item.title && item.title.toLowerCase().includes(lower))
    || (item.url && item.url.toLowerCase().includes(lower));
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
    <span class="tab-drag-handle" draggable="true">${icon('dragHandle')}</span>
    ${imgSrc ? `<img src="${imgSrc}" alt="" onerror="this.style.display='none'">` : ''}
    <div class="tab-info">
      <div class="tab-title">${esc(title)}</div>
      <div class="tab-url">${esc(displayUrl)}</div>
    </div>
    <div class="tab-actions-wrapper">
      <button class="tab-actions-toggle" data-id="${t.id}" title="Actions">${icon('moreH')}</button>
      <div class="tab-actions-popup">
        <button class="tab-edit" data-id="${t.id}">${icon('edit')} Edit</button>
        <button class="tab-delete" data-id="${t.id}">${icon('trash')} Delete</button>
      </div>
    </div>
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
          <span class="group-actions-toggle" data-id="${g.id}" title="Actions">${icon('moreH')}</span>
          <span class="group-chevron" aria-hidden="true">${icon('chevronDown')}</span>
        </button>
        <div class="group-actions-menu" data-id="${g.id}">
          <div class="icon-btn-wrap"><button class="group-add-tab-btn icon-btn" data-id="${g.id}" title="Add Tab">${icon('plus')}</button><span class="tooltip">Add Tab</span></div>
          <div class="icon-btn-wrap"><button class="group-open-all-btn icon-btn" data-id="${g.id}" title="Open All">${icon('externalLink')}</button><span class="tooltip">Open All</span></div>
          <div class="icon-btn-wrap"><button class="group-edit-btn icon-btn" data-id="${g.id}" title="Edit">${icon('edit')}</button><span class="tooltip">Edit</span></div>
          <div class="icon-btn-wrap"><button class="group-delete-btn icon-btn" data-id="${g.id}" title="Delete">${icon('trash')}</button><span class="tooltip">Delete</span></div>
        </div>
        <div id="group-content-${g.id}" class="group-content"${isExpanded ? '' : ' hidden'}>
          ${tabsHtml}
        </div>
      </div>
    </article>`;
  }).join('') + `<article class="group-card add-card glass-card" id="new-group-card">
    <div class="group-card-inner">
      <button class="group-header add-card-btn" id="new-group-btn">
        <span class="group-icon">${icon('plusCircle')}</span>
        <span class="group-name">New Collection</span>
      </button>
    </div>
  </article>`;
}

$('groups-grid').addEventListener('click', async e => {
  const groupCard = e.target.closest('.group-card');
  if (!groupCard) return;

  const groupId = groupCard.dataset.id;

  const toggle = e.target.closest('.group-toggle');
  if (toggle && !e.target.closest('.group-actions-toggle')) {
    if (expandedGroupIds.has(groupId)) expandedGroupIds.delete(groupId);
    else expandedGroupIds.add(groupId);
    await render();
    return;
  }

  const tabDelete = e.target.closest('.tab-delete');
  if (tabDelete) {
    e.stopPropagation();
    await chrome.runtime.sendMessage({ action: 'removeTab', tabId: tabDelete.dataset.id });
    await render();
    return;
  }

  const tabActionsToggle = e.target.closest('.tab-actions-toggle');
  if (tabActionsToggle) {
    const popup = tabActionsToggle.parentElement.querySelector('.tab-actions-popup');
    if (!popup) return;
    const wasOpen = popup.classList.contains('open');
    document.querySelectorAll('.tab-actions-popup.open').forEach(el => el.classList.remove('open'));
    if (!wasOpen) popup.classList.add('open');
    return;
  }

  if (e.target.closest('.tab-edit') || e.target.closest('.tab-actions-popup')) return;

  const tabEntry = e.target.closest('.tab-entry');
  if (tabEntry) {
    await chrome.tabs.update({ url: tabEntry.dataset.url });
    return;
  }

  const addTabBtn = e.target.closest('.group-add-tab-btn');
  if (addTabBtn) {
    showTabPicker(addTabBtn.dataset.id);
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
      await chrome.runtime.sendMessage({ action: 'deleteGroup', id: g.id });
      await render();
      showStatus(`Deleted "${g.name}"`, 'success');
    }
    return;
  }

  if (e.target.closest('#new-group-card') || e.target.closest('#new-group-btn')) {
    showModal('New Collection', '', '📁', '#4285f4', async (name, icon, color) => {
      const response = await chrome.runtime.sendMessage({ action: 'createGroup', name, icon, color });
      if (response && response.error) { showStatus('Create failed: ' + response.error, 'error'); return; }
      await render();
      showStatus(`Created "${name}"`, 'success');
    });
  }
});

// Privacy toggle
function togglePrivacy() {
  privacyMode = !privacyMode;
  document.body.classList.toggle('privacy-mode', privacyMode);
  chrome.storage.local.set({ privacyMode });
  document.getElementById('fab-privacy')?.classList.toggle('active', privacyMode);
  const iconEl = document.querySelector('#fab-privacy .btn-icon');
  if (iconEl) iconEl.innerHTML = privacyMode ? icon('eyeOff') : icon('eye');
}

// ── Drag and drop (merged: card reorder + tab reorder + external drop) ──

let dragSrcId = null;
let dragSrcEl = null;
let isDragging = false;
let pendingRender = false;
let lastRefNode = undefined;
let tabDragSrcEl = null;
let dragSrcGroupId = null;
let dragTargetGroupId = null;

$('groups-grid').addEventListener('dragstart', e => {
  const entry = e.target.closest('.tab-entry');
  if (entry) {
    const handle = e.target.closest('.tab-drag-handle');
    if (!handle) { e.preventDefault(); return; }
    tabDragSrcEl = entry;
    isDragging = true;
    dragSrcGroupId = entry.closest('.group-card')?.dataset.id || null;
    entry.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', entry.dataset.id);
    return;
  }
  const card = e.target.closest('.group-card');
  if (!card) return;
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
  const targetCard = e.target.closest('.group-card:not(.add-card)');
  if (!targetCard) return;

  if (tabDragSrcEl && tabDragSrcEl.isConnected) {
    if (targetCard.dataset.id !== dragSrcGroupId) {
      dragTargetGroupId = targetCard.dataset.id;
      e.dataTransfer.dropEffect = 'move';
      document.querySelectorAll('.group-card.drag-target').forEach(el => el.classList.remove('drag-target'));
      targetCard.classList.add('drag-target');
      return;
    }
    dragTargetGroupId = null;
    const entry = e.target.closest('.tab-entry');
    if (!entry || entry === tabDragSrcEl) return;
    e.dataTransfer.dropEffect = 'move';
    const container = entry.parentNode;
    const midY = entry.getBoundingClientRect().top + entry.getBoundingClientRect().height / 2;
    container.insertBefore(tabDragSrcEl, e.clientY < midY ? entry : entry.nextSibling);
    return;
  }

  if (!dragSrcEl || !dragSrcEl.isConnected) { dragSrcEl = null; return; }
  if (targetCard === dragSrcEl) return;
  e.dataTransfer.dropEffect = 'move';
  const grid = targetCard.parentNode;
  const cards = [...grid.querySelectorAll('.group-card')];
  const refNode = cards.indexOf(dragSrcEl) < cards.indexOf(targetCard) ? targetCard.nextSibling : targetCard;
  if (refNode === lastRefNode || refNode === dragSrcEl || (refNode && dragSrcEl.nextSibling === refNode)) return;
  lastRefNode = refNode;
  grid.insertBefore(dragSrcEl, refNode);

  if (!tabDragSrcEl && !dragTargetGroupId && targetCard) {
    dragTargetGroupId = targetCard.dataset.id;
    e.dataTransfer.dropEffect = 'copy';
    document.querySelectorAll('.group-card.drag-target').forEach(el => el.classList.remove('drag-target'));
    targetCard.classList.add('drag-target');
  }
});

$('groups-grid').addEventListener('drop', async e => {
  e.preventDefault();
  const targetCard = e.target.closest('.group-card');
  if (!targetCard) return;
  document.querySelectorAll('.group-card.drag-target').forEach(el => el.classList.remove('drag-target'));

  if (tabDragSrcEl || dragSrcEl) return;

  if (!targetCard.dataset.id) return;
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
});

$('groups-grid').addEventListener('dragend', async _e => {
  document.querySelectorAll('.group-card.drag-target').forEach(el => el.classList.remove('drag-target'));

  const tabSrc = tabDragSrcEl;
  tabDragSrcEl = null;
  if (tabSrc) {
    tabSrc.classList.remove('dragging');
    const srcGroupId = dragSrcGroupId;
    const targetId = dragTargetGroupId;
    dragSrcGroupId = null;
    dragTargetGroupId = null;

    if (targetId && srcGroupId && targetId !== srcGroupId) {
      await chrome.runtime.sendMessage({ action: 'moveTabToGroup', tabId: tabSrc.dataset.id, targetGroupId: targetId });
    } else {
      const container = tabSrc.parentNode;
      if (container) {
        const groupCard = container.closest('.group-card');
        if (groupCard) {
          const orderedIds = [...container.querySelectorAll('.tab-entry')].map(el => el.dataset.id);
          await chrome.runtime.sendMessage({ action: 'updateTabPositions', groupId: groupCard.dataset.id, orderedIds });
        }
      }
    }
  }

  if (dragSrcEl) dragSrcEl.style.opacity = '';
  const srcId = dragSrcId;
  dragSrcEl = null;
  dragSrcId = null;
  dragSrcGroupId = null;
  dragTargetGroupId = null;
  if (srcId) {
    const ids = [...$('groups-grid').querySelectorAll('.group-card')].filter(c => c.dataset.id).map(c => c.dataset.id);
    await chrome.runtime.sendMessage({ action: 'updateGroupPositions', orderedIds: ids });
  }

  isDragging = false;
  if (pendingRender) {
    pendingRender = false;
    render().catch(err => console.error('Delayed render after drag failed:', err));
  }
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

async function showTabPicker(groupId) {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const list = $('tab-picker-list');
  const overlay = $('tab-picker-overlay');

  if (tabs.length === 0) {
    list.innerHTML = '<div class="tab-picker-empty">No open tabs in this window.</div>';
    overlay.style.display = 'flex';
    return;
  }

  list.innerHTML = tabs.map(t => `
    <label class="tab-picker-entry">
      <input type="checkbox" class="tab-picker-cb" data-title="${esc(t.title)}" data-url="${esc(t.url)}" data-favicon="${esc(t.favIconUrl || '')}">
      ${t.favIconUrl ? `<img src="${esc(t.favIconUrl)}" alt="" onerror="this.style.display='none'">` : ''}
      <div class="tab-picker-info">
        <div class="tab-picker-title">${esc(t.title || t.url)}</div>
      </div>
    </label>
  `).join('');

  overlay.dataset.groupId = groupId;
  overlay.style.display = 'flex';
}

$('tab-picker-cancel-btn').addEventListener('click', () => {
  $('tab-picker-overlay').style.display = 'none';
});

$('tab-picker-overlay').addEventListener('click', e => {
  if (e.target === $('tab-picker-overlay')) $('tab-picker-overlay').style.display = 'none';
});

$('tab-picker-add-btn').addEventListener('click', async () => {
  const overlay = $('tab-picker-overlay');
  const groupId = overlay.dataset.groupId;
  const checked = overlay.querySelectorAll('.tab-picker-cb:checked');
  if (checked.length === 0) return;
  for (const cb of checked) {
    await chrome.runtime.sendMessage({
      action: 'addTabToGroup',
      tab: {
        title: cb.dataset.title,
        url: cb.dataset.url,
        favicon: cb.dataset.favicon
      },
      groupId
    });
  }
  overlay.style.display = 'none';
  await render();
  showStatus(`Added ${checked.length} tab${checked.length !== 1 ? 's' : ''}`, 'success');
});

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
    const safeUrl = url.replace(/[()]/g, c => '%' + c.charCodeAt(0).toString(16));
    document.body.style.backgroundImage = `url("${safeUrl}")`;
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

// ── FAB ──

function closeFab() {
  document.getElementById('fab').classList.remove('open');
}

$('fab-toggle').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('fab').classList.toggle('open');
});

document.addEventListener('click', e => {
  if (!e.target.closest('#fab')) closeFab();
});

$('fab-customize').addEventListener('click', () => { closeFab(); showBgModal(); });

const THEME_KEY = 'themeMode';
const THEME_ICONS = { system: icon('monitor'), light: icon('sun'), dark: icon('moon') };
const THEME_LABELS = { system: 'System', light: 'Light', dark: 'Dark' };
const THEME_CYCLE = ['system', 'light', 'dark'];

async function loadTheme() {
  const result = await chrome.storage.local.get(THEME_KEY);
  const theme = result[THEME_KEY] || 'system';
  applyTheme(theme);
  return theme;
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  const btn = document.getElementById('fab-theme');
  if (btn) {
    btn.querySelector('.fab-label').textContent = 'Theme: ' + THEME_LABELS[theme];
    btn.title = 'Theme: ' + THEME_LABELS[theme];
    btn.querySelector('.btn-icon').innerHTML = THEME_ICONS[theme];
  }
}

$('fab-theme').addEventListener('click', async () => {
  closeFab();
  const result = await chrome.storage.local.get(THEME_KEY);
  const current = result[THEME_KEY] || 'system';
  const idx = THEME_CYCLE.indexOf(current);
  const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
  await chrome.storage.local.set({ [THEME_KEY]: next });
  applyTheme(next);
});

function showHelp() {
  const overlay = $('help-overlay');
  const content = $('help-content');
  content.innerHTML = `
<section class="help-section">
  <h3>📚 Getting Started</h3>
  <p>Tab Collection lets you save, organize, and quickly access your browser tabs. All data is stored locally in your browser and never sent anywhere. Switch between <b>Collections</b> (tab management) and <b>Tasks</b> (to-do board) using the tabs at the top.</p>
</section>

<section class="help-section">
  <h3>💾 Saving Tabs</h3>
  <table class="help-table">
    <tr><td><b>Popup</b></td><td>Click the extension icon → check tabs → pick a group → <b>Add to Group</b></td></tr>
    <tr><td><b>Right-click</b></td><td>Right-click any tab → <b>Add to Tab Collection</b> → choose a group</td></tr>
    <tr><td><b>Drag URL</b></td><td>Drag a URL from the address bar onto any group card on this page</td></tr>
    <tr><td><b>Side panel</b></td><td>Press <kbd>Cmd+Shift+S</kbd> → click the <b>Add Tab</b> button on any collection</td></tr>
    <tr><td><b>Quick Save</b></td><td>Press <kbd>Cmd+Shift+Y</kbd> to save the current tab via a popup</td></tr>
  </table>
</section>

<section class="help-section">
  <h3>📁 Managing Collections</h3>
  <table class="help-table">
    <tr><td><b>Create</b></td><td>Click <b>New Collection</b> card at the bottom of the grid</td></tr>
    <tr><td><b>Rename</b></td><td>Click the page title <b>"Tab Collections"</b> to edit it</td></tr>
    <tr><td><b>Expand</b></td><td>Click a collection header to show/hide its tabs</td></tr>
    <tr><td><b>Actions</b></td><td>Expand a card → click <b>Actions</b> → choose action (add tab / open all / edit / delete)</td></tr>
    <tr><td><b>Edit</b></td><td>Click <b>Actions</b> → <b>Edit</b> to change name, icon, or color</td></tr>
    <tr><td><b>Delete</b></td><td>Click <b>Actions</b> → <b>Delete</b> to remove a collection and all its tabs</td></tr>
    <tr><td><b>Reorder</b></td><td>Drag any collection card by its header to rearrange</td></tr>
    <tr><td><b>Add tabs</b></td><td>Click <b>Actions</b> → <b>Add Tab</b> → pick tabs from the current window</td></tr>
    <tr><td><b>Open all</b></td><td>Click <b>Actions</b> → <b>Open All</b> to open every tab in a collection</td></tr>
    <tr><td><b>Click a tab</b></td><td>Click any tab entry to navigate the current page to that URL</td></tr>
  </table>
</section>

<section class="help-section">
  <h3>🔄 Rearranging Tabs</h3>
  <p>Drag the handle on any tab to reorder within its group. Drag a tab onto another collection card to move it there.</p>
</section>

<section class="help-section">
  <h3>🔍 Search & View</h3>
  <table class="help-table">
    <tr><td><b>Search</b></td><td>Type in the search bar to filter collections and tabs by name, title, or URL</td></tr>
    <tr><td><b>Grid / List</b></td><td>Click the <b>Grid/List toggle</b> in the header to switch view</td></tr>
  </table>
</section>

<section class="help-section">
  <h3>🖼️ Customization</h3>
  <table class="help-table">
    <tr><td><b>Background</b></td><td>Open FAB → Customize → pick a preset, paste a URL, or drop an image file</td></tr>
    <tr><td><b>Icons & Colors</b></td><td>When creating/editing a collection, choose from 350+ emoji icons and 10 accent colors</td></tr>
    <tr><td><b>Theme</b></td><td>Open FAB → <b>Theme</b> toggle to cycle System / Light / Dark</td></tr>
  </table>
</section>

<section class="help-section">
  <h3>📋 Tasks Board</h3>
  <p>Manage your daily tasks synced with <b>tasks.minhtuong.io.vn</b>.</p>
  <table class="help-table">
    <tr><td><b>Login</b></td><td>Open the <b>Tasks</b> tab → click <b>Login</b> → a web page opens → log in → the tab closes automatically</td></tr>
    <tr><td><b>Create</b></td><td>Click <b>+ Tạo việc</b> → fill in title, note, dates, priority, PIC → <b>Thêm</b></td></tr>
    <tr><td><b>Edit / Delete</b></td><td>Click a task title to open the edit modal</td></tr>
    <tr><td><b>Checkbox</b></td><td>Check the box to mark a task as done (syncs to web instantly)</td></tr>
    <tr><td><b>PIC filter</b></td><td>Use the dropdown to filter tasks by person in charge</td></tr>
    <tr><td><b>Priority</b></td><td>Tasks show color-coded priority dots: 🟢 Thấp / 🔵 Vừa / 🔴 Cao</td></tr>
    <tr><td><b>Board</b></td><td>Click <b>📋 Board</b> to open the full web board in a new tab</td></tr>
    <tr><td><b>Daily reminder</b></td><td>Daily at 17:35, a notification reminds you to review your tasks</td></tr>
  </table>
</section>

<section class="help-section">
  <h3>📊 Data Management</h3>
  <table class="help-table">
    <tr><td><b>Export</b></td><td>Open FAB → <b>Export</b> to download all collections as a JSON file</td></tr>
    <tr><td><b>Import</b></td><td>Open FAB → <b>Import</b> to restore collections from a JSON file</td></tr>
    <tr><td><b>Privacy</b></td><td>Open FAB → Privacy toggle to blur tab titles and URLs on screen</td></tr>
  </table>
</section>

<section class="help-section">
  <h3>🪟 Side Panel</h3>
  <p>Press <kbd>Ctrl+Shift+S</kbd> (<kbd>Cmd+Shift+S</kbd> on Mac) to open the Side Panel. Browse all collections, click the <b>+</b> button to add the current tab, or click any tab to open it in a new tab (the panel closes automatically).</p>
</section>

<section class="help-section">
  <h3>⌨️ Keyboard Shortcuts</h3>
  <table class="help-table">
    <tr><td><kbd>Cmd+Shift+Y</kbd></td><td>Quick Save current tab</td></tr>
    <tr><td><kbd>Cmd+Shift+S</kbd></td><td>Open Side Panel</td></tr>
  </table>
  <p style="margin-top:8px;color:var(--text-muted);font-size:12px">Customize shortcuts at <code>chrome://extensions/shortcuts</code></p>
</section>
`;
  overlay.style.display = 'flex';
}

$('fab-help').addEventListener('click', () => { closeFab(); showHelp(); });

$('help-close-btn').addEventListener('click', () => { $('help-overlay').style.display = 'none'; });
$('help-overlay').addEventListener('click', e => {
  if (e.target === $('help-overlay')) $('help-overlay').style.display = 'none';
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['help-overlay', 'bg-modal-overlay', 'tab-picker-overlay', 'modal-overlay', 'tab-edit-overlay'].forEach(id => {
      const el = $(id);
      if (el && el.style.display === 'flex') el.style.display = 'none';
    });
  }
});

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
loadBg().then(applyBg).catch(() => {});

// Init privacy mode
chrome.storage.local.get('privacyMode').then(result => {
  privacyMode = !!result.privacyMode;
  if (privacyMode) {
    document.body.classList.add('privacy-mode');
    document.getElementById('fab-privacy')?.classList.add('active');
    const iconEl = document.querySelector('#fab-privacy .btn-icon');
    if (iconEl) iconEl.innerHTML = icon('eyeOff');
  }
});

$('fab-privacy').addEventListener('click', () => { closeFab(); togglePrivacy(); });

$('fab-export').addEventListener('click', async () => {
  closeFab();
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

$('fab-import').addEventListener('click', () => { closeFab(); $('import-input').click(); });

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

// Tab edit modal
const tabEditOverlay = $('tab-edit-overlay');
const tabEditTitleInput = $('tab-edit-title-input');
const tabEditUrlInput = $('tab-edit-url-input');
let editingTabId = null;

$('groups-grid').addEventListener('click', e => {
  const editBtn = e.target.closest('.tab-edit');
  if (!editBtn) return;
  e.stopPropagation();
  const tabEntry = editBtn.closest('.tab-entry');
  if (!tabEntry) return;
  editingTabId = tabEntry.dataset.id;
  const titleEl = tabEntry.querySelector('.tab-title');
  tabEditTitleInput.value = titleEl.textContent;
  tabEditUrlInput.value = tabEntry.dataset.url;
  tabEditOverlay.style.display = 'flex';
  tabEditTitleInput.focus();
});

$('tab-edit-cancel-btn').addEventListener('click', () => {
  tabEditOverlay.style.display = 'none';
  editingTabId = null;
});

$('tab-edit-overlay').addEventListener('click', e => {
  if (e.target === tabEditOverlay) {
    tabEditOverlay.style.display = 'none';
    editingTabId = null;
  }
});

$('tab-edit-save-btn').addEventListener('click', async () => {
  const title = tabEditTitleInput.value.trim();
  const url = tabEditUrlInput.value.trim();
  if (!title || !url) return;
  const response = await chrome.runtime.sendMessage({ action: 'updateTab', tabId: editingTabId, updates: { title, url } });
  if (response && response.error) {
    showStatus('Failed to update tab: ' + response.error, 'error');
    return;
  }
  tabEditOverlay.style.display = 'none';
  editingTabId = null;
  await render();
});

tabEditTitleInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') $('tab-edit-save-btn').click();
});
tabEditUrlInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') $('tab-edit-save-btn').click();
});

let searchTimeout;
$('search-input')?.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(render, 200);
});

$('groups-grid').addEventListener('click', e => {
  const toggle = e.target.closest('.group-actions-toggle');
  if (toggle) {
    const groupId = toggle.dataset.id;
    const menu = document.querySelector(`.group-actions-menu[data-id="${groupId}"]`);
    if (!menu) return;
    const wasOpen = menu.classList.contains('open');
    document.querySelectorAll('.group-actions-menu.open').forEach(el => el.classList.remove('open'));
    if (!wasOpen) menu.classList.add('open');
  }
});

document.addEventListener('click', e => {
  if (!e.target.closest('.group-card-inner')) {
    document.querySelectorAll('.group-actions-menu.open').forEach(el => el.classList.remove('open'));
  }
  if (!e.target.closest('.tab-entry')) {
    document.querySelectorAll('.tab-actions-popup.open').forEach(el => el.classList.remove('open'));
  }
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
  const btn = document.getElementById('view-toggle-btn');
  btn.querySelector('.btn-icon').textContent = next === 'grid' ? '▦' : '☰';
  btn.title = next === 'grid' ? 'Switch to List' : 'Switch to Grid';
  btn.querySelector('.btn-label').textContent = next === 'grid' ? 'Grid view' : 'List view';
  await chrome.storage.local.set({ [VIEW_KEY]: next });
}

$('view-toggle-btn').addEventListener('click', toggleView);

// Init view mode on load
loadViewMode().then(mode => {
  if (mode === 'list') {
    document.getElementById('groups-view').classList.add('view-list');
    const btn = document.getElementById('view-toggle-btn');
    btn.querySelector('.btn-icon').textContent = '☰';
    btn.title = 'Switch to Grid';
    btn.querySelector('.btn-label').textContent = 'List view';
  }
});

// ── Tasks API proxies ──
async function tasksSend(action, extra = {}) {
  const res = await chrome.runtime.sendMessage({ action, ...extra });
  if (res && res.error) throw new Error(res.error);
  return res;
}

const LOGIN_CACHE_KEY = 'tasksLoginCache';
const TASKS_CACHE_KEY = 'tasksListCache';
const TASKS_CACHE_TTL = 60000;

/** Cheap auth probe. Shares the session cookie with every other tasks:* call. */
async function checkTasksAuth() {
  try {
    const res = await tasksSend('tasks:me');
    return res && res.user ? res.user : null;
  } catch { return null; }
}

function cacheKeyFor(filters) {
  return `${filters.pic}|${filters.range}`;
}

/**
 * Loads from the API. `force` skips the short-lived cache that keeps switching between
 * Collections and Tasks from refetching the whole board every time.
 */
async function loadTasks({ force = false } = {}) {
  const token = ++tasksState.loadToken;
  const filters = tasksState.filters;
  const key = cacheKeyFor(filters);

  if (!force) {
    const cached = (await chrome.storage.session.get(TASKS_CACHE_KEY))[TASKS_CACHE_KEY];
    if (cached && cached.key === key && Date.now() - cached.at < TASKS_CACHE_TTL) {
      tasksState.items = cached.items;
      tasksState.error = null;
      tasksState.loading = false;
      renderTasksView();
      return;
    }
  }

  tasksState.loading = true;
  tasksState.error = null;
  renderTasksView();

  try {
    const params = rangeToApiParams(filters.range, vnToday());
    if (filters.pic !== 'all') params.pic = filters.pic;
    const items = await tasksSend('tasks:list', { params });
    if (token !== tasksState.loadToken) return; // a newer load already started

    tasksState.items = Array.isArray(items) ? items : [];
    tasksState.loggedIn = true;
    tasksState.error = null;
    chrome.storage.local.set({ [LOGIN_CACHE_KEY]: { ok: true, at: Date.now() } });
    chrome.storage.session.set({
      [TASKS_CACHE_KEY]: { key, items: tasksState.items, at: Date.now() }
    });
  } catch (err) {
    if (token !== tasksState.loadToken) return;
    tasksState.items = [];
    if (err.message === 'SESSION_EXPIRED') {
      tasksState.loggedIn = false;
      tasksState.error = null;
      chrome.storage.local.set({ [LOGIN_CACHE_KEY]: { ok: false, at: Date.now() } });
      chrome.storage.session.remove(TASKS_CACHE_KEY);
    } else {
      // Previously any non-401 error rendered as "no tasks", which reads as an empty day.
      tasksState.error = err.message || 'Không kết nối được tới máy chủ';
    }
  }
  tasksState.loading = false;
  renderTasksView();
}

// ── Tasks Rendering ──
// TASK_PRIO_COLORS / TASK_MEMBER_LABEL and the date helpers live in tasks/tasks-logic.js.

function getPicBadge(pic) {
  const text = picBadgeText(pic);
  return text ? `<span class="task-pic-badge">${esc(text)}</span>` : '';
}

/** "2026-07-28T09:00" -> "09:00"; multi-day tasks also show the day range. */
function taskTimeLabel(t, today) {
  const span = taskSpan(t);
  if (!span) return '📌 Thường trực';

  const dayLabel = (key) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;
  const parts = [];
  if (span.from !== span.to) {
    parts.push(`${dayLabel(span.from)} → ${dayLabel(span.to)}`);
  } else if (span.from !== today) {
    parts.push(dayLabel(span.from));
  }

  if (!t.allDay) {
    const time = (t.start || t.due || '').slice(11, 16);
    if (time) parts.push(time);
  } else {
    parts.push('Cả ngày');
  }
  return parts.join(' · ');
}

function renderTaskItem(t, today) {
  const prioColor = safeColor(t.color, TASK_PRIO_COLORS[t.priority] || TASK_PRIO_COLORS.normal);
  const meta = taskTimeLabel(t, today);

  return `<div class="task-item${t.done ? ' done' : ''}" data-id="${esc(t.id)}">
    <input type="checkbox" class="task-checkbox" data-id="${esc(t.id)}"${t.done ? ' checked' : ''}
           aria-label="Đánh dấu hoàn thành">
    <div class="task-priority-dot" style="background:${esc(prioColor)}"></div>
    <div class="task-item-body">
      <div class="task-title">${esc(t.title)}</div>
      <div class="task-meta">${getPicBadge(t.pic)} ${esc(meta)}</div>
    </div>
  </div>`;
}

function renderTasksSkeleton() {
  const row = '<div class="task-skeleton-row"></div>';
  return `<div class="tasks-columns">
    <div class="tasks-section"><div class="task-bar task-bar-today"></div>
      <div class="tasks-section-inner">${row.repeat(4)}</div></div>
    <div class="tasks-section"><div class="task-bar task-bar-overdue"></div>
      <div class="tasks-section-inner">${row.repeat(2)}</div></div>
  </div>`;
}

function renderTasksView() {
  const loginGate = $('tasks-login-gate');
  const content = $('tasks-content');

  if (!tasksState.loggedIn) {
    loginGate.style.display = 'block';
    content.style.display = 'none';
    return;
  }

  loginGate.style.display = 'none';
  content.style.display = 'block';

  const errorBox = $('tasks-error');
  if (tasksState.error) {
    errorBox.style.display = 'flex';
    errorBox.innerHTML =
      `<span>⚠️ ${esc(tasksState.error)}</span>` +
      '<button id="tasks-retry-btn" class="btn-primary tasks-empty-btn">Thử lại</button>';
  } else {
    errorBox.style.display = 'none';
    errorBox.innerHTML = '';
  }

  if (tasksState.loading) {
    $('tasks-list').innerHTML = renderTasksSkeleton();
    return;
  }
  if (tasksState.error) {
    $('tasks-list').innerHTML = '';
    return;
  }

  const today = vnToday();
  const filtered = applyTaskFilters(tasksState.items, tasksState.filters);
  const buckets = bucketTasks(filtered, today, upcomingLimit(tasksState.filters.range, today));

  // "Sắp tới" only makes sense once the range reaches past today.
  const visible = TASK_SECTIONS.filter(
    (s) => s.id !== 'upcoming' || tasksState.filters.range !== 'today'
  );

  const hasAny = visible.some((s) => buckets[s.id].length);
  const isFiltered = tasksState.filters.search.trim() ||
    tasksState.filters.priority !== 'all' ||
    tasksState.filters.status !== 'all';

  const columns = visible.map((s) => {
    const list = buckets[s.id];
    const count = list.length ? `<span class="tasks-section-count">${list.length}</span>` : '';
    const addBtn = s.id === 'today'
      ? '<button class="btn-primary tasks-section-add-btn" id="tasks-add-btn">+ Tạo việc</button>'
      : '';
    const body = list.length
      ? list.map((t) => renderTaskItem(t, today)).join('')
      : `<div class="task-list-empty">${s.id === 'today' && !isFiltered
          ? 'Chưa có task nào <button class="btn-primary tasks-empty-btn" id="tasks-empty-create-btn">+ Tạo việc</button>'
          : 'Không có task nào'}</div>`;

    return `<div class="tasks-section">
      <div class="task-bar ${s.bar}"></div>
      <div class="tasks-section-inner">
        <div class="tasks-section-header"><span>${s.icon} ${esc(s.label)} ${count}</span>${addBtn}</div>
        ${body}
      </div>
    </div>`;
  }).join('');

  const banner = !hasAny && isFiltered
    ? '<div class="tasks-filter-note">Không có task nào khớp bộ lọc. ' +
      '<button class="btn-ghost tasks-empty-btn" id="tasks-clear-filters-inline">Xoá bộ lọc</button></div>'
    : '';

  $('tasks-list').innerHTML = banner + `<div class="tasks-columns">${columns}</div>`;
}

// ── Task Modal ──
function openTaskModal(task) {
  const overlay = $('task-modal-overlay');
  const titleEl = $('task-modal-title');
  const saveBtn = $('task-modal-save-btn');
  const deleteBtn = $('task-modal-delete-btn');
  const doneBtn = $('task-modal-done-btn');

  $('task-title-input').value = '';
  $('task-note-input').value = '';
  $('task-sticky-input').checked = false;
  $('task-date-fields').style.display = 'block';
  $('task-allday-input').checked = false;
  $('task-start-input').value = vnNowInputValue();
  $('task-due-input').value = vnNowInputValue();
  $('task-modal-error').textContent = '';

  document.querySelectorAll('.task-prio-option').forEach(el => el.classList.remove('active'));
  document.querySelector('.task-prio-option[data-prio="normal"]').classList.add('active');
  document.querySelector('.task-prio-option[data-prio="normal"] input').checked = true;

  document.querySelectorAll('.task-pic-chip').forEach(el => el.classList.remove('active'));
  const defaultPic = tasksState.filters.pic !== 'all' ? tasksState.filters.pic : 'phuoc';
  const defaultChip = document.querySelector(`.task-pic-chip[data-pic="${defaultPic}"]`);
  if (defaultChip) defaultChip.classList.add('active');

  tasksState.editingId = null;

  if (task) {
    titleEl.textContent = 'Sửa công việc';
    saveBtn.textContent = 'Lưu';
    tasksState.editingId = task.id;
    $('task-title-input').value = task.title || '';
    $('task-note-input').value = task.note || '';
    $('task-sticky-input').checked = !task.start && !task.due;
    $('task-date-fields').style.display = $('task-sticky-input').checked ? 'none' : 'block';
    $('task-allday-input').checked = !!task.allDay;
    if (task.start) $('task-start-input').value = task.start.slice(0, 16);
    if (task.due) $('task-due-input').value = task.due.slice(0, 16);

    document.querySelectorAll('.task-prio-option').forEach(el => el.classList.remove('active'));
    const prio = document.querySelector(`.task-prio-option[data-prio="${task.priority || 'normal'}"]`);
    if (prio) { prio.classList.add('active'); prio.querySelector('input').checked = true; }

    document.querySelectorAll('.task-pic-chip').forEach(el => el.classList.remove('active'));
    const pics = Array.isArray(task.pic) ? task.pic : [];
    if (pics.length >= TASK_MEMBERS.length) {
      document.querySelector('.task-pic-chip[data-pic="__team"]').classList.add('active');
    }
    pics.forEach(k => {
      const chip = document.querySelector(`.task-pic-chip[data-pic="${k}"]`);
      if (chip) chip.classList.add('active');
    });

    deleteBtn.style.display = 'inline-block';
    doneBtn.style.display = task.done ? 'none' : 'inline-block';
  } else {
    titleEl.textContent = 'Thêm công việc';
    saveBtn.textContent = 'Thêm';
    deleteBtn.style.display = 'none';
    doneBtn.style.display = 'none';
  }

  overlay.style.display = 'flex';
  $('task-title-input').focus();
}

function closeTaskModal() {
  $('task-modal-overlay').style.display = 'none';
  tasksState.editingId = null;
}

async function saveTask() {
  const title = $('task-title-input').value.trim();
  if (!title) {
    $('task-modal-error').textContent = 'Tiêu đề không được để trống';
    return;
  }
  $('task-modal-error').textContent = '';

  const isSticky = $('task-sticky-input').checked;
  const payload = { title };

  const note = $('task-note-input').value.trim();
  if (note) payload.note = note;

  const activePrio = document.querySelector('.task-prio-option.active');
  if (activePrio) payload.priority = activePrio.dataset.prio;

  // The "Cả team" chip carries a sentinel value the API does not know; expand it here,
  // otherwise the server silently drops it and the task ends up with no PIC at all.
  const activePics = [...document.querySelectorAll('.task-pic-chip.active')].map(el => el.dataset.pic);
  const pics = activePics.includes('__team')
    ? [...TASK_MEMBERS]
    : activePics.filter(p => TASK_MEMBERS.includes(p));
  if (pics.length) payload.pic = pics;

  if (isSticky) {
    // no dates needed
  } else {
    payload.allDay = $('task-allday-input').checked || false;
    const start = $('task-start-input').value;
    const due = $('task-due-input').value;
    if (start) payload.start = start;
    if (due) payload.due = due;
  }

  try {
    if (tasksState.editingId) {
      await tasksSend('tasks:update', { id: tasksState.editingId, payload });
    } else {
      await tasksSend('tasks:create', { payload });
    }
    closeTaskModal();
    await loadTasks({ force: true });
  } catch (err) {
    $('task-modal-error').textContent = 'Lỗi: ' + err.message;
  }
}

async function deleteTask() {
  if (!tasksState.editingId) return;
  if (!await showConfirm('Xoá công việc này?')) return;
  try {
    await tasksSend('tasks:delete', { id: tasksState.editingId });
    closeTaskModal();
    await loadTasks({ force: true });
  } catch (err) {
    $('task-modal-error').textContent = 'Lỗi: ' + err.message;
  }
}

async function toggleTaskDone() {
  if (!tasksState.editingId) return;
  const task = tasksState.items.find(t => t.id === tasksState.editingId);
  if (!task) return;
  try {
    await tasksSend('tasks:toggle', { id: tasksState.editingId, done: !task.done });
    closeTaskModal();
    await loadTasks({ force: true });
  } catch (err) {
    $('task-modal-error').textContent = 'Lỗi: ' + err.message;
  }
}

// ── Tab Switching ──
function switchView(view) {
  const collectionsView = $('collections-view');
  const tasksView = $('tasks-view');
  const collectionsSearch = $('search-input');
  const collectionsActions = $('collections-header-actions');
  const tasksActions = $('tasks-header-actions');

  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.view === view));

  if (view === 'tasks') {
    collectionsView.style.display = 'none';
    tasksView.style.display = 'block';
    collectionsSearch.style.display = 'none';
    if (collectionsActions) collectionsActions.style.display = 'none';
    if (tasksActions) tasksActions.style.display = 'flex';
    initTasksView();
  } else {
    collectionsView.style.display = 'block';
    tasksView.style.display = 'none';
    collectionsSearch.style.display = 'block';
    if (collectionsActions) collectionsActions.style.display = 'flex';
    if (tasksActions) tasksActions.style.display = 'none';
  }
}

async function initTasksView() {
  tasksState.filters = await loadTaskFilters();
  syncFilterInputs();
  const cache = (await chrome.storage.local.get(LOGIN_CACHE_KEY))[LOGIN_CACHE_KEY];
  if (cache && cache.ok && Date.now() - cache.at < 3600000) {
    tasksState.loggedIn = true;
  }
  await loadTasks();
}

function syncFilterInputs() {
  const f = tasksState.filters;
  $('tasks-pic-filter').value = f.pic;
  $('tasks-range-filter').value = f.range;
  $('tasks-status-filter').value = f.status;
  $('tasks-prio-filter').value = f.priority;
  $('tasks-search').value = f.search;
  updateTasksTitle();
}

function updateTasksTitle() {
  const f = tasksState.filters;
  const scope = f.range === 'week' ? 'Task 7 ngày tới' : f.range === 'all' ? 'Tất cả task' : 'Task hôm nay';
  const who = f.pic === 'all' ? '' : ' của ' + (TASK_MEMBER_LABEL[f.pic] || f.pic);
  $('tasks-date-title').textContent = scope + who;

  const dirty = f.status !== DEFAULT_TASK_FILTERS.status ||
    f.priority !== DEFAULT_TASK_FILTERS.priority ||
    f.range !== DEFAULT_TASK_FILTERS.range ||
    f.pic !== DEFAULT_TASK_FILTERS.pic ||
    f.search.trim() !== '';
  $('tasks-reset-filters').style.display = dirty ? 'inline-flex' : 'none';
}

/** `refetch` is only needed for filters the server applies (pic, range). */
async function setTaskFilter(patch, { refetch }) {
  Object.assign(tasksState.filters, patch);
  await saveTaskFilters(tasksState.filters);
  updateTasksTitle();
  if (refetch) await loadTasks();
  else renderTasksView();
}

// ── Event Handlers Init ──
function initTasksEventHandlers() {
  let loginPollTimer = null;
  let loginPollStopAt = 0;

  function stopLoginPoll() {
    if (loginPollTimer) clearInterval(loginPollTimer);
    loginPollTimer = null;
  }

  $('tasks-login-btn').addEventListener('click', async () => {
    stopLoginPoll(); // a second click must not leave the first interval running forever
    const tab = await chrome.tabs.create({ url: TASKS_WEB_BASE });
    loginPollStopAt = Date.now() + 300000; // give up after 5 minutes

    loginPollTimer = setInterval(async () => {
      if (Date.now() > loginPollStopAt) { stopLoginPoll(); return; }

      // Stop as soon as the user closes the login tab.
      const stillOpen = await chrome.tabs.get(tab.id).catch(() => null);
      if (!stillOpen) { stopLoginPoll(); return; }

      const user = await checkTasksAuth();
      if (!user) return;

      stopLoginPoll();
      chrome.tabs.remove(tab.id, () => chrome.runtime.lastError);
      tasksState.loggedIn = true;
      await loadTasks({ force: true });
    }, 2000);
  });

  $('tasks-board-link').addEventListener('click', () => {
    chrome.tabs.create({
      url: buildBoardDeepLink(TASKS_WEB_BASE, { ...tasksState.filters, today: vnToday() })
    });
  });

  $('tasks-pic-filter').addEventListener('change', e =>
    setTaskFilter({ pic: e.target.value }, { refetch: true }));

  $('tasks-range-filter').addEventListener('change', e =>
    setTaskFilter({ range: e.target.value }, { refetch: true }));

  $('tasks-status-filter').addEventListener('change', e =>
    setTaskFilter({ status: e.target.value }, { refetch: false }));

  $('tasks-prio-filter').addEventListener('change', e =>
    setTaskFilter({ priority: e.target.value }, { refetch: false }));

  let searchTimer = null;
  $('tasks-search').addEventListener('input', e => {
    const value = e.target.value;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => setTaskFilter({ search: value }, { refetch: false }), 200);
  });

  async function resetTaskFilters() {
    const needsRefetch = tasksState.filters.pic !== DEFAULT_TASK_FILTERS.pic ||
      tasksState.filters.range !== DEFAULT_TASK_FILTERS.range;
    tasksState.filters = { ...DEFAULT_TASK_FILTERS };
    await saveTaskFilters(tasksState.filters);
    syncFilterInputs();
    if (needsRefetch) await loadTasks();
    else renderTasksView();
  }

  $('tasks-reset-filters').addEventListener('click', resetTaskFilters);

  $('tasks-error').addEventListener('click', e => {
    if (e.target.id === 'tasks-retry-btn') loadTasks({ force: true });
  });

  $('tasks-list').addEventListener('change', async e => {
    if (!e.target.matches('.task-checkbox')) return;
    const id = e.target.dataset.id;
    const done = e.target.checked;
    const task = tasksState.items.find(t => t.id === id);
    if (!task) return;

    // Optimistic: flip locally and re-render, instead of refetching the whole board
    // for a one-bit change. Roll back if the server rejects it.
    const previous = task.done;
    task.done = done;
    renderTasksView();
    try {
      await tasksSend('tasks:toggle', { id, done });
      chrome.storage.session.remove(TASKS_CACHE_KEY);
    } catch (err) {
      task.done = previous;
      renderTasksView();
      showStatus('Lỗi: ' + err.message, 'error');
    }
  });

  $('tasks-list').addEventListener('click', async e => {
    if (e.target.matches('.task-checkbox')) return;

    if (e.target.id === 'tasks-clear-filters-inline') { await resetTaskFilters(); return; }
    if (e.target.id === 'tasks-empty-create-btn' || e.target.id === 'tasks-add-btn') {
      openTaskModal();
      return;
    }

    const item = e.target.closest('.task-item');
    if (item) {
      const task = tasksState.items.find(t => t.id === item.dataset.id);
      if (task) openTaskModal(task);
    }
  });

  $('task-modal-cancel-btn').addEventListener('click', closeTaskModal);
  $('task-modal-overlay').addEventListener('click', e => {
    if (e.target === $('task-modal-overlay')) closeTaskModal();
  });
  $('task-modal-save-btn').addEventListener('click', saveTask);
  $('task-modal-delete-btn').addEventListener('click', deleteTask);
  $('task-modal-done-btn').addEventListener('click', toggleTaskDone);

  $('task-sticky-input').addEventListener('change', () => {
    const sticky = $('task-sticky-input').checked;
    $('task-date-fields').style.display = sticky ? 'none' : 'block';
  });

  document.querySelectorAll('.task-prio-option').forEach(el => {
    el.addEventListener('click', () => {
      document.querySelectorAll('.task-prio-option').forEach(x => x.classList.remove('active'));
      el.classList.add('active');
      el.querySelector('input').checked = true;
    });
  });

  document.querySelectorAll('.task-pic-chip').forEach(el => {
    el.addEventListener('click', () => {
      const chips = [...document.querySelectorAll('.task-pic-chip')];
      const teamChip = chips.find(c => c.dataset.pic === '__team');
      const memberChips = chips.filter(c => c.dataset.pic !== '__team');

      if (el.dataset.pic === '__team') {
        const on = !el.classList.contains('active');
        el.classList.toggle('active', on);
        memberChips.forEach(c => c.classList.toggle('active', on));
        return;
      }

      el.classList.toggle('active');
      // Keep "Cả team" in sync so it never claims a selection that is not whole-team.
      teamChip.classList.toggle('active', memberChips.every(c => c.classList.contains('active')));
    });
  });

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchView(tab.dataset.view));
  });

  $('tasks-refresh-btn')?.addEventListener('click', async () => {
    if (tasksState.loggedIn) await loadTasks({ force: true });
  });
}

// ── Init ──
async function initApp() {
  initTitle();
  await loadTheme();
  await render();
  initTasksEventHandlers();
  const params = new URLSearchParams(location.search);
  if (params.get('view') === 'tasks') {
    switchView('tasks');
  }
}

initApp();

const STORAGE_KEY = 'tabCollector';
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    if (isDragging) { pendingRender = true; return; }
    const activeTab = document.querySelector('.nav-tab.active');
    if (activeTab && activeTab.dataset.view === 'collections') {
      render().catch(err => console.error('Storage change render failed:', err));
    }
  }
});
