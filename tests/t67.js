// p67 (ci 는 크롬만 — CDP 손가락): 문 열림 자리(빗금)와 겹친 가구를 그 겹친 곳에서 눌러 끌면 가구가 움직인다(폰 손가락 · 데스크톱 마우스).
//      문 자리만 누르면(가구 없음) 아무 가구도 안 잡힘 · 문 선(벽)은 여전히 문을 고른다.
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CDP 손가락이라 크롬 전용
const APP = 'file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html');
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const st = p => p.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')));
  const dresser = s => s.items.find(i => i.room === s.rooms[0].id && s.catalog.find(k => k.id === i.cat).name === '옷서랍');
  const setup = async (p, mob) => {               // 샘플 방 위쪽 벽 문(1710~2460, 안여닫이 750) 반경 안으로 옷서랍(400×450)
    await p.goto(APP); await p.waitForTimeout(700); await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
    for (let i = 0; i < 3 && await p.$('#guide.open'); i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('room-planner/3')); const r = s.rooms[0];
      const it = s.items.find(i => i.room === r.id && s.catalog.find(k => k.id === i.cat).name === '옷서랍'); it.x = 1800; it.y = 100; it.rot = 0;
      localStorage.setItem('room-planner/3', JSON.stringify(s)); });
    await p.reload(); await p.waitForTimeout(700); await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
    for (let i = 0; i < 3 && await p.$('#guide.open'); i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    if (mob && !(await p.evaluate(() => document.body.className.includes('sh-list')))) { await p.tap('#tabbar [data-tab="list"]'); await p.waitForTimeout(400); }
    await p.click('#roomList .roomcard .nm'); await p.waitForTimeout(800); };
  /* 옷서랍 한가운데(문 빗금과 겹친 곳) · 문 빗금만 있는 곳 · 문 선 */
  const spots = p => p.evaluate(() => {
    const g = [...document.querySelectorAll('#plan .fg')].find(n => n.textContent.includes('옷서랍')), r = g.querySelector('rect.body').getBoundingClientRect();
    const c = [r.x + r.width / 2, r.y + r.height / 2], top = document.elementFromPoint(c[0], c[1]);
    const fr = document.querySelector('#plan > rect').getBoundingClientRect(), mmx = fr.width / 2460;
    return { c, covered: !top.closest('.fg'), wedge: [fr.x + 2300 * mmx, fr.y + 600 * mmx], wall: [fr.x + 2085 * mmx, fr.y - 12] /* 문 선 판정(.ophit)은 벽 바깥쪽 30px */ }; });

  /* ① 폰 390 — CDP 손가락(흔들림 포함) */
  let c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  let p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  const cdp = await c.newCDPSession(p);
  const touch = (q, type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: q ? [{ x: q[0], y: q[1], id: 0, radiusX: 12, radiusY: 12 }] : [] });
  const dragBy = async (x, y, dx, dy, n = 8) => {
    await touch([x, y], 'touchStart'); await p.waitForTimeout(30);
    for (let i = 1; i <= n; i++) { await touch([x + dx * i / n, y + dy * i / n], 'touchMove'); await p.waitForTimeout(25); }
    await touch(null, 'touchEnd'); await p.waitForTimeout(400); };
  const tapJ = async (x, y) => { await touch([x, y], 'touchStart'); await p.waitForTimeout(30); await touch([x + 3, y + 3], 'touchMove'); await p.waitForTimeout(20); await touch(null, 'touchEnd'); await p.waitForTimeout(400); };
  await setup(p, true);
  console.log('[폰 390 손가락]');
  let s0 = dresser(await st(p)), sp = await spots(p);
  chk(sp.covered, '겹친 곳 맨 위는 문 표시(가구가 아님) — 고치기 전 문제 상황');
  await dragBy(sp.c[0], sp.c[1], -40, 60);
  let s1 = dresser(await st(p));
  chk(s1.x < s0.x && s1.y > s0.y, '문 빗금과 겹친 곳을 끌면 옷서랍이 움직임' + (s1.x < s0.x && s1.y > s0.y ? '' : ` (${s0.x},${s0.y} → ${s1.x},${s1.y})`));
  await p.tap('#undoBtn'); await p.waitForTimeout(500);
  await tapJ(sp.wedge[0], sp.wedge[1]);
  chk(!(await p.evaluate(() => document.body.classList.contains('has-sel'))), '문 빗금만 있는 곳을 누르면 가구가 안 골라짐');
  await tapJ(sp.wall[0], sp.wall[1]);
  chk(await p.evaluate(() => document.body.classList.contains('has-op')) && (await p.textContent('#obNm')).includes('문'), '문 선(벽)을 누르면 여전히 문을 고름');
  await c.close();

  /* ② 데스크톱 1600 — 마우스 */
  c = await b.newContext({ viewport: { width: 1600, height: 900 } });
  p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await setup(p, false);
  console.log('[데스크톱 1600 마우스]');
  s0 = dresser(await st(p)); sp = await spots(p);
  await p.mouse.move(sp.c[0], sp.c[1]); await p.mouse.down();
  for (let i = 1; i <= 8; i++) { await p.mouse.move(sp.c[0] - 6 * i, sp.c[1] + 9 * i); await p.waitForTimeout(20); }
  await p.mouse.up(); await p.waitForTimeout(400);
  s1 = dresser(await st(p));
  chk(s1.x < s0.x && s1.y > s0.y, '문 빗금과 겹친 곳을 끌면 옷서랍이 움직임' + (s1.x < s0.x && s1.y > s0.y ? '' : ` (${s0.x},${s0.y} → ${s1.x},${s1.y})`));
  chk((await p.textContent('#selBox .read-h span')) === '옷서랍', '옷서랍이 골라짐');
  await c.close();

  console.log('pageerror :', errs.length, errs);
  console.log(ok ? '전부 통과' : '실패 있음');
  await b.close(); process.exit(ok ? 0 : 1);
})();
