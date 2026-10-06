// Loads the classic browser scripts into this realm, the same way <script> tags share globals.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
for (const f of ['../constants.js', '../icons.js', 'newtab-view.js']) {
  vm.runInThisContext(fs.readFileSync(path.join(__dirname, f), 'utf8'), { filename: f });
}

function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    throw new Error(message);
  }
  console.log('PASS:', message);
}

const tab = { id: 't1', url: 'https://github.com', title: 'GitHub' };
const group = { id: 'g1', name: 'Work', icon: '💼', color: '#4285f4', tabs: [tab] };

// ── renderGroupSection ──
const html = renderGroupSection(group, true);
for (const cls of ['group-card', 'group-toggle', 'group-add-tab-btn', 'group-open-all-btn',
  'group-actions-toggle', 'group-edit-btn', 'group-delete-btn', 'group-content', 'group-tabs', 'tab-entry']) {
  assert(html.includes(cls), `section keeps handler class .${cls}`);
}
assert(html.includes('is-expanded') && !/group-content"[^>]*hidden/.test(html), 'expanded section is open');
const collapsed = renderGroupSection(group, false);
assert(!collapsed.includes('is-expanded') && /class="group-content" hidden/.test(collapsed), 'collapsed section hides content');
assert(html.includes('1 tab'), 'section shows tab count');
const empty = renderGroupSection({ ...group, tabs: [] }, true);
assert(empty.includes('group-tabs-empty') && empty.includes('Thả URL vào đây'), 'empty section shows drop hint');

const evil = { id: 'g"2', name: '<img src=x onerror=alert(1)>', icon: '"><b>', color: 'red;"><script>', tabs: [] };
const evilHtml = renderGroupSection(evil, true);
assert(!evilHtml.includes('<img src=x') && evilHtml.includes('&lt;img src=x'), 'section escapes name');
assert(!evilHtml.includes('"><b>') && !evilHtml.includes('<script>'), 'section escapes icon and color');
assert(evilHtml.includes('data-id="g&quot;2"'), 'section escapes id');

// ── renderSidebarItems ──
const side = renderSidebarItems([group, { id: 'g3', name: 'Dev', tabs: [] }], 'g3');
assert((side.match(/class="sidebar-item( active)?"/g) || []).length === 2, 'one sidebar item per group');
assert(/sidebar-item active" data-id="g3"/.test(side), 'active group is marked');
assert(side.includes('>1<') && side.includes('>0<'), 'sidebar shows tab counts');
const evilSide = renderSidebarItems([evil], null);
assert(!evilSide.includes('<img src=x') && !evilSide.includes('<script>'), 'sidebar escapes user data');
assert(renderSidebarItems([], null) === '', 'no groups → empty sidebar');

// ── resolveInitialView ──
assert(resolveInitialView('tasks', 'tasks', false) === 'collections', 'tasks disabled ignores ?view=tasks');
assert(resolveInitialView(null, 'tasks', false) === 'collections', 'tasks disabled ignores saved tasks view');
assert(resolveInitialView('tasks', 'collections', true) === 'tasks', 'url view wins when enabled');
assert(resolveInitialView(null, 'tasks', true) === 'tasks', 'saved view used when enabled');
assert(resolveInitialView('bogus', 'bogus', true) === 'collections', 'unknown values fall back to collections');

// ── isSearchShortcut ──
const body = { tagName: 'BODY' };
assert(isSearchShortcut({ key: 'k', metaKey: true, target: body }), '⌘K triggers');
assert(isSearchShortcut({ key: 'K', ctrlKey: true, target: body }), 'Ctrl+K triggers');
assert(isSearchShortcut({ key: 'k', ctrlKey: true, target: { tagName: 'INPUT' } }), 'Ctrl+K triggers even inside inputs');
assert(!isSearchShortcut({ key: 'k', target: body }), 'plain k does not trigger');
assert(!isSearchShortcut({ key: 'k', metaKey: true, shiftKey: true, target: body }), '⌘⇧K does not trigger');
assert(isSearchShortcut({ key: '/', target: body }), '/ triggers on page');
for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
  assert(!isSearchShortcut({ key: '/', target: { tagName } }), `/ typed in ${tagName} is left alone`);
}
assert(!isSearchShortcut({ key: '/', target: { tagName: 'DIV', isContentEditable: true } }), '/ in contenteditable is left alone');
assert(!isSearchShortcut({ key: '/', ctrlKey: true, target: body }), 'Ctrl+/ does not trigger');

console.log('\nAll newtab-view tests passed.');
