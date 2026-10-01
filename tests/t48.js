// p48: 방 크기를 줄이면 문·창문도 벽 안으로 — 밖으로 튀어나오지 않는다
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const WORK = process.env.WORK || '/home/claude/work';
const FILE = process.env.APP || WORK + '/app.html', APP = 'file://' + FILE;
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const st = p => p.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')));
  const span = (r, o) => (o.wall === 'top' || o.wall === 'bottom') ? r.w : r.d;
  const outside = r => [...r.doors, ...r.windows].filter(o => o.x0 < 0 || o.x0 + o.w > span(r, o)).map(o => o.id);
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(700); await p.click('#isPeek'); await p.waitForTimeout(1300);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  const ver = await p.$eval('#introVer', n => n.textContent);
  chk(+(ver.match(/p(\d+)/) || [0, 0])[1] >= 48, '판 번호 p48 이상 (' + ver + ')');
  let r = (await st(p)).rooms[0];
  const d0 = r.doors[0], w0 = r.windows[0];
  chk(d0.x0 + d0.w === r.w && w0.w > 2000, `처음: 문 ${d0.wall} ${d0.x0}+${d0.w} (오른쪽 끝) · 창 ${w0.wall} ${w0.x0}+${w0.w}`);
  await p.tap('#crumbRoom'); await p.waitForTimeout(300);
  await p.fill('#rmW', '2000'); await p.tap('#rmSave'); await p.waitForTimeout(400);
  r = (await st(p)).rooms[0];
  const d1 = r.doors.find(d => d.id === d0.id), w1 = r.windows.find(w => w.id === w0.id);
  chk(outside(r).length === 0, `가로 2000 → 벽 밖으로 나간 문·창 없음 (${outside(r).join(',') || '0'})`);
  chk(d1.x0 + d1.w === 2000 && d1.w === d0.w && d1.hinge === d0.hinge && d1.swing === d0.swing, `문은 폭·경첩·여는 방향 그대로 오른쪽 끝에 붙음 (${d1.x0}+${d1.w})`);
  chk(w1.w === 2000 && w1.sill === w0.sill && w1.head === w0.head, `벽보다 긴 창은 벽 길이로 (${w1.x0}+${w1.w}) · 높이 그대로`);
  await p.tap('#undoBtn'); await p.waitForTimeout(300);
  r = (await st(p)).rooms[0];
  chk(r.w === 2460 && r.doors[0].x0 === d0.x0 && r.windows[0].w === w0.w, '되돌리기 한 번 → 방·문·창 모두 원래대로');
  await p.tap('#crumbRoom'); await p.waitForTimeout(300);
  await p.fill('#rmW', '3000'); await p.tap('#rmSave'); await p.waitForTimeout(400);
  r = (await st(p)).rooms[0];
  chk(r.doors[0].x0 === d0.x0 && r.windows[0].x0 === w0.x0 && r.windows[0].w === w0.w, '넓힐 때는 문·창 자리 그대로');
  await c.close();
  console.log('\npageerror :', errs.length, errs.slice(0, 3));
  console.log(ok && !errs.length ? '전부 통과' : '실패 있음');
  await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
