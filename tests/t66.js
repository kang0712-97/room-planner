// p66: 빈 방 «다음 할 일» — [① 문 놓기][② 가구 넣기] · 문이 있으면 ① 체크 · 가구 하나면 사라짐 · 되돌리면 다시 · 집 화면엔 없음
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const APP = 'file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html');
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const st = p => p.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')));
  const vis = (p, s) => p.isVisible(s);
  /* 단추가 화면 안 · 44px 이상 · 그 자리를 누르면 그 단추가 받는지 */
  const reach = p => p.evaluate(() => ['nbDoor', 'nbFurn'].map(id => { const n = document.getElementById(id), r = n.getBoundingClientRect();
    const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.height >= 44 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && !!h && (h === n || n.contains(h)); }));
  const labels = p => p.$$eval('#nextBar button', ns => ns.map(n => [...n.children].map(x => x.textContent.trim()).join(' ')).join(' | '));
  const enterNew = async (p, tap) => {            // 인트로에서 3000×2700 방을 만들고 들어간다
    await p.goto(APP); await p.waitForTimeout(700);
    await p.fill('#isW', '3000'); await p.fill('#isD', '2700'); await tap('#isGo'); await p.waitForTimeout(1500);
    await p.locator('#plan .rg').last().click(); await p.waitForTimeout(1500);
    for (let i = 0; i < 3 && await p.$('#guide.open'); i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); } };

  /* ① 폰 360 */
  let c = await b.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  let p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  const tap = s => p.tap(s);
  await enterNew(p, tap);
  console.log('[폰 360] 빈 방');
  chk(await vis(p, '#nextBar') && !(await vis(p, '#miniStat')), '빈 방: «다음 할 일» 줄이 보이고 알약은 숨김');
  chk(await labels(p) === '1 문 놓기 | 2 가구 넣기', '단추: ' + await labels(p));
  chk((await reach(p)).every(Boolean), '두 단추 모두 44px 이상 · 화면 안 · 가려지지 않음');
  await tap('#nbDoor'); await p.waitForTimeout(500);
  chk(await vis(p, '#placeBar') && !(await vis(p, '#nextBar')), '① 누름 → 문 놓기 띠 · 다음 할 일 줄은 숨김');
  await tap('#pbGo'); await p.waitForTimeout(500);
  chk((await st(p)).rooms.find(r => r.name === '새 방').doors.length === 1, '«놓기» → 문 1개 저장');
  const fl = await p.$eval('#plan > rect', n => { const r = n.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; });
  await p.touchscreen.tap(fl[0], fl[1]); await p.waitForTimeout(500);
  chk(await vis(p, '#nextBar') && await p.$eval('#nbDoor', n => n.classList.contains('done') && !!n.querySelector('use[href="#ic-check"]')), '문을 놓으면 ① 에 체크');
  await tap('#nbFurn'); await p.waitForTimeout(500);
  chk(await vis(p, '#addModal.open'), '② 누름 → 가구 창');
  await tap('#afPre button:has-text("싱글 침대")'); await p.waitForTimeout(700);
  const s1 = await st(p), rid = s1.rooms.find(r => r.name === '새 방').id;
  chk(!(await vis(p, '#addModal.open')) && s1.items.filter(i => i.room === rid).length === 1, '칩 한 번 → 이 방에 침대 1개');
  const fl2 = await p.$eval('#plan > rect', n => { const r = n.getBoundingClientRect(); return [r.x + r.width * 0.55, r.y + r.height * 0.9]; });   // 침대(왼쪽 위)·오른쪽 단추와 먼 빈 바닥
  await p.touchscreen.tap(fl2[0], fl2[1]); await p.waitForTimeout(500);
  chk(!(await vis(p, '#nextBar')) && await vis(p, '#miniStat'), '가구 하나 → 다음 할 일 줄 사라지고 알약');
  await tap('#undoBtn'); await p.waitForTimeout(600);
  chk(await vis(p, '#nextBar'), '되돌리기로 가구가 빠지면 다시 보임');
  await c.close();

  /* ② 데스크톱 1600 */
  c = await b.newContext({ viewport: { width: 1600, height: 900 } });
  p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await enterNew(p, s => p.click(s));
  console.log('[데스크톱 1600] 빈 방');
  const pos = await p.evaluate(() => { const n = document.getElementById('nextBar').getBoundingClientRect(), s = document.getElementById('nextBar').parentElement.getBoundingClientRect();
    return { mid: Math.abs((n.left + n.right) / 2 - (s.left + s.right) / 2) < 2, low: n.bottom <= s.bottom && n.top > s.top + s.height / 2 }; });
  chk(await vis(p, '#nextBar') && pos.mid && pos.low, '도면 아래 가운데');
  chk((await reach(p)).every(Boolean), '두 단추 모두 44px 이상 · 가려지지 않음');
  await p.click('#nbFurn'); await p.waitForTimeout(400);
  chk(await vis(p, '#addModal.open'), '② 누름 → 가구 창');
  await p.click('#afCancel'); await p.waitForTimeout(300);
  await p.click('#goHome'); await p.waitForTimeout(800);
  chk(!(await vis(p, '#nextBar')), '집 화면에는 없음');
  await c.close();

  console.log('pageerror :', errs.length, errs);
  console.log(ok ? '전부 통과' : '실패 있음');
  await b.close(); process.exit(ok ? 0 : 1);
})();
