function assert(condition, message) {
  if (!condition) {
    console.error('FAIL:', message);
    throw new Error(message);
  }
  console.log('PASS:', message);
}

function eq(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  assert(a === e, `${message} (expected ${e}, got ${a})`);
}

async function main() {
  const mod = await import('./tasks-logic.js');
  const {
    vnDayKey, vnToday, vnNowInputValue, vnShiftDay, safeColor, taskSpan, classifyTask,
    bucketTasks, applyTaskFilters, picBadgeText, rangeToApiParams, upcomingLimit,
    buildBoardDeepLink, TASK_MEMBERS, isRelease, picGroupKey, picGroupLabel, groupTasksByPic,
    toDateTimeInput,
  } = mod.default;

  // ── Vietnam timezone ──────────────────────────────────────────────────────
  // 2026-07-28T23:30Z is already 2026-07-29 06:30 in Vietnam.
  eq(vnDayKey(Date.UTC(2026, 6, 28, 23, 30)), '2026-07-29', 'vnDayKey rolls over at 17:00 UTC');
  eq(vnDayKey(Date.UTC(2026, 6, 28, 16, 59)), '2026-07-28', 'vnDayKey before 17:00 UTC stays put');

  // The bug this replaces: at 02:00 Vietnam time, toISOString() still reported yesterday.
  const earlyMorningVn = Date.UTC(2026, 6, 27, 19, 0); // 02:00 on 28/07 in Vietnam
  eq(vnToday(earlyMorningVn), '2026-07-28', 'vnToday is correct between midnight and 07:00 VN');
  assert(
    new Date(earlyMorningVn).toISOString().slice(0, 10) === '2026-07-27',
    'the old UTC-based expression really did report the previous day'
  );

  eq(vnNowInputValue(Date.UTC(2026, 6, 28, 2, 5)), '2026-07-28T09:05', 'vnNowInputValue uses VN time');
  eq(vnShiftDay('2026-07-28', 7), '2026-08-04', 'vnShiftDay crosses month boundaries');
  eq(vnShiftDay('2026-01-01', -1), '2025-12-31', 'vnShiftDay crosses year boundaries');

  // ── datetime-local values ─────────────────────────────────────────────────
  // All-day rows are stored as a bare date; the input rejects that and renders blank,
  // which made every all-day task look like it had no dates at all.
  eq(toDateTimeInput('2026-07-28'), '2026-07-28T00:00', 'a bare date is padded to midnight');
  eq(toDateTimeInput('2026-07-28T09:30'), '2026-07-28T09:30', 'a full value passes through');
  eq(toDateTimeInput('2026-07-28T09:30:15'), '2026-07-28T09:30', 'seconds are trimmed');
  eq(toDateTimeInput(''), '', 'empty stays empty');
  eq(toDateTimeInput(null), '', 'null stays empty');

  // ── safeColor ─────────────────────────────────────────────────────────────
  eq(safeColor('#ef4444', '#000'), '#ef4444', 'safeColor keeps valid hex');
  eq(safeColor('red', '#000'), '#000', 'safeColor rejects named colors');
  eq(safeColor('red" onload="x', '#000'), '#000', 'safeColor rejects attribute breakout');
  eq(safeColor(undefined, '#000'), '#000', 'safeColor falls back on undefined');

  // ── taskSpan / classifyTask ───────────────────────────────────────────────
  const today = '2026-07-28';
  eq(taskSpan({ title: 'x' }), null, 'taskSpan is null for a sticky task');
  eq(taskSpan({ start: '2026-07-25T09:00', due: '2026-07-30T17:00' }),
    { from: '2026-07-25', to: '2026-07-30' }, 'taskSpan covers a multi-day task');
  eq(taskSpan({ due: '2026-07-30T17:00' }),
    { from: '2026-07-30', to: '2026-07-30' }, 'taskSpan works with due only');

  eq(classifyTask({ title: 'Trực hệ thống' }, today), 'sticky', 'sticky task is classified sticky');
  eq(classifyTask({ start: '2026-07-20T09:00', due: '2026-07-21T09:00' }, today), 'overdue',
    'finished-in-the-past task is overdue');
  eq(classifyTask({ start: '2026-07-28T09:00' }, today), 'today', 'task starting today is today');
  eq(classifyTask({ start: '2026-08-01T09:00' }, today), 'upcoming', 'future task is upcoming');

  // The regression that mattered: a task that started days ago but is still running
  // must not be reported as overdue.
  eq(classifyTask({ start: '2026-07-25T09:00', due: '2026-07-30T17:00' }, today), 'today',
    'multi-day task still running counts as today, not overdue');

  // ── bucketTasks ───────────────────────────────────────────────────────────
  const items = [
    { id: 'a', title: 'Quá hạn 3 ngày', start: '2026-07-25T18:00', due: '2026-07-25T19:00' },
    { id: 'b', title: 'Quá hạn hôm qua', start: '2026-07-27T09:00', due: '2026-07-27T10:00' },
    { id: 'c', title: 'Hôm nay chiều', start: '2026-07-28T15:00' },
    { id: 'd', title: 'Hôm nay sáng', start: '2026-07-28T08:00' },
    { id: 'e', title: 'Thường trực' },
    { id: 'f', title: 'Tuần sau', start: '2026-08-03T09:00' },
  ];
  const buckets = bucketTasks(items, today);
  eq(buckets.overdue.map(t => t.id), ['a', 'b'], 'overdue sorts by full date, not time of day');
  eq(buckets.today.map(t => t.id), ['d', 'c'], 'today sorts by time');
  eq(buckets.sticky.map(t => t.id), ['e'], 'sticky tasks land in their own bucket');
  eq(buckets.upcoming.map(t => t.id), ['f'], 'future tasks land in upcoming');
  assert(
    buckets.overdue.length + buckets.today.length + buckets.sticky.length +
    buckets.upcoming.length === items.length,
    'every task ends up in exactly one bucket'
  );

  // ── applyTaskFilters ──────────────────────────────────────────────────────
  const mixed = [
    { id: '1', title: 'Viết báo cáo', note: 'gửi sếp', priority: 'high', done: false },
    { id: '2', title: 'Họp team', note: '', priority: 'normal', done: true },
    { id: '3', title: 'Dọn backlog', note: 'báo cáo tuần', priority: 'low', done: false },
  ];
  eq(applyTaskFilters(mixed, {}).length, 3, 'no filter keeps everything');
  eq(applyTaskFilters(mixed, { status: 'todo' }).map(t => t.id), ['1', '3'], 'status todo');
  eq(applyTaskFilters(mixed, { status: 'done' }).map(t => t.id), ['2'], 'status done');
  eq(applyTaskFilters(mixed, { priority: 'high' }).map(t => t.id), ['1'], 'priority filter');
  eq(applyTaskFilters(mixed, { search: 'báo cáo' }).map(t => t.id), ['1', '3'],
    'search matches title and note, with diacritics');
  eq(applyTaskFilters(mixed, { search: 'HỌP' }).map(t => t.id), ['2'], 'search is case-insensitive');
  eq(applyTaskFilters(mixed, { status: 'todo', priority: 'low' }).map(t => t.id), ['3'],
    'filters combine');

  // ── releases ──────────────────────────────────────────────────────────────
  const rel = { id: 'r1', kind: 'release', title: 'Release 3.2', start: '2026-07-28', done: false };
  const task = { id: 'k1', title: 'Việc thường', priority: 'high', pic: ['phuoc'], done: false };
  assert(isRelease(rel) && !isRelease(task), 'isRelease tells the two apart');

  const both = [task, rel];
  eq(applyTaskFilters(both, { type: 'all' }).map(t => t.id), ['k1', 'r1'], 'type all keeps both');
  eq(applyTaskFilters(both, { type: 'task' }).map(t => t.id), ['k1'], 'type task drops releases');
  eq(applyTaskFilters(both, { type: 'release' }).map(t => t.id), ['r1'], 'type release drops tasks');

  // A release belongs to a team, not a person, and carries no priority. Either filter
  // would otherwise let it slip through as if it matched.
  eq(applyTaskFilters(both, { pic: 'phuoc' }).map(t => t.id), ['k1'],
    'a PIC filter excludes releases');
  eq(applyTaskFilters(both, { priority: 'high' }).map(t => t.id), ['k1'],
    'a priority filter excludes releases');
  eq(applyTaskFilters(both, { status: 'todo' }).map(t => t.id), ['k1', 'r1'],
    'status still applies to releases');

  // ── grouping by person ────────────────────────────────────────────────────
  eq(picGroupKey({ pic: ['phuoc'] }), 'phuoc', 'single PIC groups under that member');
  eq(picGroupKey({ pic: ['dung', 'tuong'] }), 'tuong+dung', 'multi PIC key follows roster order');
  eq(picGroupKey({ pic: [] }), '__none', 'no PIC groups under unassigned');
  eq(picGroupKey({ pic: TASK_MEMBERS }), '__team', 'everyone groups under team');
  eq(picGroupKey(rel), '__release', 'releases get their own group');

  eq(picGroupLabel('tuong+dung'), 'Tường, Dung', 'multi PIC label spells out both names');
  eq(picGroupLabel('__none'), 'Chưa gán', 'unassigned label');
  eq(picGroupLabel('__release'), 'Release', 'release label');

  const grouped = groupTasksByPic([
    { id: 'g1', title: 'a', pic: ['hao'] },
    { id: 'g2', title: 'b', pic: [] },
    { id: 'g3', title: 'c', pic: ['tuong'] },
    { id: 'g4', title: 'd', kind: 'release' },
    { id: 'g5', title: 'e', pic: ['tuong'] },
    { id: 'g6', title: 'f', pic: TASK_MEMBERS },
    { id: 'g7', title: 'g', pic: ['dung', 'tuong'] },
  ]);
  eq(grouped.map(g => g.key), ['tuong', 'hao', 'tuong+dung', '__team', '__none', '__release'],
    'groups order: members by roster, then multi, team, unassigned, release');
  eq(grouped[0].items.map(t => t.id), ['g3', 'g5'], 'incoming order is preserved inside a group');
  assert(grouped.reduce((n, g) => n + g.items.length, 0) === 7,
    'grouping never duplicates or drops a row');

  // ── picBadgeText ──────────────────────────────────────────────────────────
  eq(picBadgeText([]), '', 'no PIC gives no badge');
  eq(picBadgeText(['phuoc']), 'Phước', 'single PIC shows the full name');
  eq(picBadgeText(['tuong', 'dung']), 'TD', 'two PICs show initials');
  eq(picBadgeText(TASK_MEMBERS), 'Cả team', 'everyone shows "Cả team"');
  eq(picBadgeText(['khong-ton-tai']), '', 'unknown keys are ignored');
  eq(picBadgeText(undefined), '', 'undefined PIC is safe');

  // ── upcoming cap ──────────────────────────────────────────────────────────
  eq(bucketTasks(items, today, '2026-08-01').upcoming.map(t => t.id), [],
    'upcoming beyond the cap is dropped');
  eq(bucketTasks(items, today, '2026-08-05').upcoming.map(t => t.id), ['f'],
    'upcoming inside the cap is kept');
  eq(upcomingLimit('week', today), '2026-08-04', 'week scope looks 7 days ahead');
  eq(upcomingLimit('all', today), null, 'all scope is unbounded');

  // ── rangeToApiParams ──────────────────────────────────────────────────────
  eq(rangeToApiParams('today', today), { to: '2026-08-27' }, 'today range still fetches a horizon');
  eq(rangeToApiParams('week', today), { to: '2026-08-27' }, 'week range uses the same horizon');
  eq(rangeToApiParams('all', today), {}, 'all range sends no bound');

  // Regression: the server bounds on `due`, so a bound of exactly today would hide a task
  // that started days ago and is still running. The horizon must clear its due date.
  const running = { id: 'r', title: 'Chuẩn bị dữ liệu release', start: '2026-07-25', due: '2026-07-30' };
  const bound = rangeToApiParams('today', today).to;
  assert(running.due <= bound, 'a task running until 30/07 survives the API bound');
  eq(classifyTask(running, today), 'today', 'and it is displayed under "Hôm nay"');

  // ── buildBoardDeepLink ────────────────────────────────────────────────────
  const link = buildBoardDeepLink('https://example.test/', {
    range: 'week', pic: 'phuoc', status: 'todo', today,
  });
  assert(link.startsWith('https://example.test/?'), 'deep link keeps the base URL');
  const q = new URL(link).searchParams;
  eq(q.get('view'), 'week', 'deep link maps range to view');
  eq(q.get('date'), today, 'deep link carries the date');
  eq(q.get('pic'), 'phuoc', 'deep link carries the PIC filter');
  eq(q.get('status'), 'todo', 'deep link carries the status filter');

  const plain = new URL(buildBoardDeepLink('https://example.test/', {
    range: 'today', pic: 'all', status: 'all', today,
  })).searchParams;
  eq(plain.get('view'), 'day', 'today range maps to the day view');
  eq(plain.get('pic'), null, 'default PIC is left out of the deep link');
  eq(plain.get('status'), null, 'default status is left out of the deep link');

  console.log('\nAll tasks-logic tests passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
