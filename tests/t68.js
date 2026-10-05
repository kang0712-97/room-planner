// p68: ㄱ자 방 — 방 창에서 [네모][ㄱ자] · 들어간 모서리·크기 · 바깥선 ㄱ자 · 가구는 들어간 곳에 못 들어감(끌기·새로 넣기·모양 바꾸기)
//      · 문은 남은 벽 구간에만 · 콘센트는 들어간 쪽 벽 토막에 안 놓임 · 넓이 · 링크 공유로 모양이 같이 감 · 폰 창 모양
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const APP = 'file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html');
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const st = p => p.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')));
  const over = (a, q) => a.x < q.x1 && a.x + a.w > q.x0 && a.y < q.y1 && a.y + a.d > q.y0;
  const nrect = r => { const n = r.notch, L = n.corner[1] === 'l', T = n.corner[0] === 't';
    return { x0:L ? 0 : r.w - n.w, x1:L ? n.w : r.w, y0:T ? 0 : r.d - n.d, y1:T ? n.d : r.d }; };
  const foot = (s, it) => { const k = s.catalog.find(c => c.id === it.cat), v = it.rot % 180 === 0; return { x:it.x, y:it.y, w:v ? k.w : k.d, d:v ? k.d : k.w }; };
  const peek = async p => { await p.goto(APP); await p.waitForTimeout(700); await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
    for (let i = 0; i < 3 && await p.$('#guide.open'); i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); } };

  /* ① 데스크톱: 새 ㄱ자 방 */
  let c = await b.newContext({ viewport: { width: 1600, height: 900 } });
  let p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await peek(p);
  console.log('[데스크톱] 새 방');
  await p.click('#addRoomBtn'); await p.waitForTimeout(500);
  chk(await p.isVisible('#rmShape') && !(await p.isVisible('#rmNotch')), '방 창: «모양» 네모가 기본, 들어간 칸은 숨김');
  await p.fill('#rmName', 'ㄱ자방');
  await p.click('#rmShape [data-shape="l"]'); await p.waitForTimeout(200);
  chk(await p.isVisible('#rmNotch') && await p.inputValue('#rmNW') === '1000' && await p.inputValue('#rmND') === '900'
      && await p.getAttribute('#rmCorner [data-corner="tr"]', 'aria-pressed') === 'true', 'ㄱ자 → 들어간 모서리(오른쪽 위)·크기 1000×900(방의 1/3)');
  await p.click('#rmCorner [data-corner="br"]');
  await p.fill('#rmNW', '2800'); await p.click('#rmSave'); await p.waitForTimeout(500);
  chk(await p.isVisible('#roomModal.open') && (await p.textContent('#toast')).includes('들어간 크기'), '들어간 크기가 너무 크면 안내하고 창 유지');
  await p.fill('#rmNW', '1000'); await p.click('#rmSave'); await p.waitForTimeout(900);
  let s = await st(p), r = s.rooms.find(x => x.name === 'ㄱ자방');
  chk(r && JSON.stringify(r.notch) === '{"corner":"br","w":1000,"d":900}', '저장: 들어간 모서리 ' + (r && r.notch ? `${r.notch.corner} ${r.notch.w}×${r.notch.d}` : '없음'));
  await p.locator('#plan .rg').last().click(); await p.waitForTimeout(900);
  const d = await p.getAttribute('#plan .roomwall', 'd');
  chk((d.match(/L/g) || []).length === 5 && await p.$('#plan rect.notch'), '도면 바깥선 꼭짓점 6개 · 들어간 곳 표시');
  chk((await p.textContent('#rArea')).startsWith('7.20'), '바닥 넓이 3000×2700 − 1000×900 = 7.20 m² (' + await p.textContent('#rArea') + ')');
  // 가구: 칩으로 넣고(빈자리) → 들어간 곳으로 끌면 밖에 멈춤
  for (const nm of ['싱글 침대', '책상 1200', '옷장 4자']) { await p.click('#addBtn'); await p.waitForTimeout(300); await p.click(`#afPre button:has-text("${nm}")`); await p.waitForTimeout(500); }
  s = await st(p); r = s.rooms.find(x => x.name === 'ㄱ자방');
  let q = nrect(r), mine = s.items.filter(i => i.room === r.id);
  chk(mine.length === 3 && mine.every(i => !over(foot(s, i), q)), '흔한 크기 3개 — 모두 들어간 곳 밖에 놓임');
  const desk = mine.find(i => s.catalog.find(k => k.id === i.cat).name === '책상 1200');
  const g = await p.$(`#plan .fg[data-uid="${desk.uid}"] rect.body`), bb = await g.boundingBox();
  const fr = await (await p.$('#plan .roomfloor')).boundingBox(), sc = fr.width / 3000;
  const tx = fr.x + 2500 * sc, ty = fr.y + 2300 * sc;
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down();
  for (let i = 1; i <= 10; i++) { await p.mouse.move(bb.x + bb.width / 2 + (tx - bb.x - bb.width / 2) * i / 10, bb.y + bb.height / 2 + (ty - bb.y - bb.height / 2) * i / 10); await p.waitForTimeout(20); }
  await p.mouse.up(); await p.waitForTimeout(500);
  s = await st(p); const dk = s.items.find(i => i.uid === desk.uid);
  chk(!over(foot(s, dk), q) && (dk.x !== desk.x || dk.y !== desk.y), '책상을 들어간 곳으로 끌어도 그 밖에 멈춤');
  chk(!(await p.$('#plan .fg.clash')), '겹침 표시 없음');
  // 문: 오른쪽 벽 아래쪽(들어간 토막)으로 끌어도 남은 구간 안
  await p.click('#addDoorBtn'); await p.waitForTimeout(400);
  await p.mouse.click(fr.x + 2995 * sc, fr.y + 2500 * sc); await p.waitForTimeout(300);
  await p.click('#pbGo'); await p.waitForTimeout(400);
  s = await st(p); r = s.rooms.find(x => x.name === 'ㄱ자방');
  const dr = r.doors[r.doors.length - 1];
  chk(dr && dr.wall === 'right' && dr.x0 + dr.w <= 2700 - 900, `문은 오른쪽 벽 남은 구간 안(${dr && dr.wall} ${dr && dr.x0}+${dr && dr.w} ≤ 1800)`);
  // 콘센트: 아래 벽의 들어간 토막을 누르면 안 놓임
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('#addOutBtn2').catch(async () => { await p.click('#addBtn'); });
  await p.waitForTimeout(300);
  const n0 = (r.outlets || []).length;
  await p.mouse.click(fr.x + 2600 * sc, fr.y + 2702 * sc); await p.waitForTimeout(400);
  s = await st(p); r = s.rooms.find(x => x.name === 'ㄱ자방');
  chk((r.outlets || []).length === n0, '들어간 쪽 아래 벽 토막을 누르면 콘센트가 안 놓임');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  // 링크 공유 → 받는 쪽도 ㄱ자
  await p.click('#shareBtn'); await p.waitForTimeout(500);
  const url = await p.inputValue('#shUrl'); await p.click('#shClose').catch(() => {});
  const c2 = await b.newContext({ viewport: { width: 1600, height: 900 } }), q2 = await c2.newPage(); q2.on('pageerror', e => errs.push(e.message));
  await q2.goto(url); await q2.waitForTimeout(1200); await q2.click('#cfOk'); await q2.waitForTimeout(900);
  const s2 = await st(q2), r2 = s2.rooms[s2.rooms.length - 1];
  chk(JSON.stringify(r2.notch) === JSON.stringify(r.notch) && r2.doors.length === r.doors.length, '링크로 받은 방도 같은 ㄱ자·문');
  await c2.close();
  await c.close();

  /* ② 데스크톱: 둘러보기 방을 ㄱ자로 고침 → 가구는 밖으로, 문은 남은 구간으로 */
  c = await b.newContext({ viewport: { width: 1600, height: 900 } });
  p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await peek(p);
  console.log('[데스크톱] 있던 방 고치기');
  await p.click('#roomList .roomcard [data-act="edit"]'); await p.waitForTimeout(400);
  await p.click('#rmShape [data-shape="l"]'); await p.click('#rmCorner [data-corner="tr"]');
  await p.fill('#rmNW', '900'); await p.fill('#rmND', '1600'); await p.click('#rmSave'); await p.waitForTimeout(700);
  s = await st(p); r = s.rooms[0]; q = nrect(r);
  mine = s.items.filter(i => i.room === r.id);
  chk(mine.every(i => !over(foot(s, i), q)), '모양을 바꾸면 들어간 곳에 있던 가구는 밖으로');
  chk(r.doors.every(o => o.wall !== 'top' || o.x0 + o.w <= 2460 - 900), '위쪽 벽 문은 남은 구간 안으로(' + r.doors.map(o => o.wall + ' ' + o.x0 + '+' + o.w).join(', ') + ')');
  await p.click('#roomList .roomcard [data-act="edit"]'); await p.waitForTimeout(400);
  chk(await p.isVisible('#rmNotch') && await p.inputValue('#rmNW') === '900' && await p.getAttribute('#rmCorner [data-corner="tr"]', 'aria-pressed') === 'true', '다시 열면 ㄱ자·크기 그대로');
  await p.click('#rmShape [data-shape="rect"]'); await p.click('#rmSave'); await p.waitForTimeout(600);
  chk(!(await st(p)).rooms[0].notch, '«네모» 로 되돌리면 notch 없음');
  await c.close();

  /* ③ 폰 360: 창이 화면 안 · 단추 크기 */
  c = await b.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await peek(p);
  console.log('[폰 360] 방 창');
  await p.tap('#tabbar [data-tab="add"]'); await p.waitForTimeout(500);   // 집 화면 «추가» 탭 = 방 추가
  await p.tap('#rmShape [data-shape="l"]'); await p.waitForTimeout(200);
  const sz = await p.$$eval('#rmShape button, #rmCorner button', ns => ns.map(n => { const r = n.getBoundingClientRect(); return r.height >= 32 && r.right <= innerWidth && r.left >= 0; }));
  chk(sz.every(Boolean), '모양·모서리 단추 32px 이상 · 화면 안');
  chk(await p.evaluate(() => { const a = document.querySelector('#roomModal .acts').getBoundingClientRect(); return a.bottom <= innerHeight + 0.5; }), '«방 만들기» 줄은 화면 안');
  await p.screenshot({ path: (process.env.WORK || '/home/claude/work') + '/p68_phone_modal.png' });
  await c.close();

  console.log('pageerror :', errs.length, errs);
  console.log(ok ? '전부 통과' : '실패 있음');
  await b.close(); process.exit(ok ? 0 : 1);
})();
