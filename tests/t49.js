// p49: P3-6 콘센트 벽 표시 — 추가·수정·삭제, 가구가 앞을 막으면 «가려짐»(정보만, 점수 그대로), 방 줄이기·저장·링크
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const WORK = process.env.WORK || '/home/claude/work';
const FILE = process.env.APP || WORK + '/app.html', APP = 'file://' + FILE;
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const st = p => p.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')));
  const span = (r, wall) => (wall === 'top' || wall === 'bottom') ? r.w : r.d;
  /* 앱과 같은 셈: 콘센트 앞 150mm 띠와 가구 사각형 */
  const band = (r, wall, x0, w) => wall === 'top' ? { x0, x1:x0 + w, y0:0, y1:150 }
    : wall === 'bottom' ? { x0, x1:x0 + w, y0:r.d - 150, y1:r.d }
    : wall === 'left' ? { x0:0, x1:150, y0:x0, y1:x0 + w } : { x0:r.w - 150, x1:r.w, y0:x0, y1:x0 + w };
  const rects = s => { const r = s.rooms[0];
    return s.items.filter(i => i.room === r.id).map(i => { const c = s.catalog.find(k => k.id === i.cat);
      const fw = i.rot % 180 === 0 ? c.w : c.d, fd = i.rot % 180 === 0 ? c.d : c.w;
      return { name:c.name, x0:i.x, y0:i.y, x1:i.x + fw, y1:i.y + fd }; }); };
  const hit = (a, q) => a.x0 < q.x1 - 1 && q.x0 + 1 < a.x1 && a.y0 < q.y1 - 1 && q.y0 + 1 < a.y1;
  const panelText = p => p.$eval('#clashBox', n => { const c = n.cloneNode(true); const o = c.querySelector('#outInfo'); if (o) o.remove(); return c.textContent; });
  /* p51 — 추가는 «벽을 누르세요» → 벽 가운데를 누르고 → «숫자로 입력» 에서 정확한 자리 */
  const wallMid = (p, wall) => p.evaluate(w => { const b = document.querySelector('#plan > rect').getBoundingClientRect();
    return { top:[b.x + b.width / 2, b.y + 3], bottom:[b.x + b.width / 2, b.y + b.height - 3], left:[b.x + 3, b.y + b.height / 2], right:[b.x + b.width - 3, b.y + b.height / 2] }[w]; }, wall);
  const addOutlet = async (p, wall, x0, btn) => {
    await p.click(btn); await p.waitForTimeout(250);
    const q = await wallMid(p, wall); await p.mouse.click(q[0], q[1]); await p.waitForTimeout(400);
    await p.click('#selBox [data-ob="exact"]'); await p.waitForTimeout(250);
    await p.click(`#opWall [data-wall="${wall}"]`); await p.fill('#opX', String(x0));
    await p.click('#opSave'); await p.waitForTimeout(400);
  };

  const c = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(700); await p.click('#isPeek'); await p.waitForTimeout(1300);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  const ver = await p.$eval('#introVer', n => n.textContent);
  chk(+(ver.match(/p(\d+)/) || [0, 0])[1] >= 49, '판 번호 p49 이상 (' + ver + ')');

  let s = await st(p), r = s.rooms[0];
  chk((r.outlets || []).length === 0 && !(await p.$('#plan rect.outlet')), '샘플 방: 콘센트 없음');
  chk((await p.$eval('#openFold summary', n => n.textContent)).includes('콘센트') && await p.isVisible('#addOutBtn2'), '패널 «문 · 창문 · 콘센트» · «콘센트 추가» 단추');
  const before = await panelText(p);

  /* 빈 자리(앞에 가구 없음)와 가구가 막는 자리를 앱 바깥 셈으로 고른다 */
  const R0 = rects(s); let free = null, blocked = null;
  for (const wall of ['top', 'left', 'right', 'bottom']) {
    for (let x = 0; x + 120 <= span(r, wall) && !free; x += 50)
      if (!R0.some(q => hit(q, band(r, wall, x, 120)))) free = { wall, x };
    for (let x = 0; x + 120 <= span(r, wall) && !blocked; x += 50) {
      const by = R0.filter(q => hit(q, band(r, wall, x, 120)));
      if (by.length === 1) blocked = { wall, x, name:by[0].name };
    }
  }
  chk(free && blocked, `시험 자리: 빈 곳 ${free && free.wall + ' ' + free.x} · 막힌 곳 ${blocked && blocked.wall + ' ' + blocked.x + ' (' + blocked.name + ')'}`);

  await p.click('#addOutBtn2'); await p.waitForTimeout(250);
  chk(!(await p.$eval('#openModal', n => n.classList.contains('open'))) && (await p.textContent('#pbText')) === '콘센트를 놓을 벽을 누르세요', '«콘센트 추가» → 숫자 창 없이 «콘센트를 놓을 벽을 누르세요»');   // p51
  await p.click('#pbCancel'); await p.waitForTimeout(200);

  await addOutlet(p, free.wall, free.x, '#addOutBtn2');
  s = await st(p); r = s.rooms[0];
  const o1 = (r.outlets || [])[0];
  chk(r.outlets.length === 1 && o1.wall === free.wall && o1.x0 === free.x && o1.w === 120 && o1.id === 'O1', `저장: ${JSON.stringify(o1)}`);
  chk((await p.$$('#plan rect.outlet')).length === 1 && !(await p.$('#plan rect.outlet.blk')), '도면: 콘센트 판 1 · 가려짐 아님');
  chk(!(await p.$('#outInfo')) && (await p.$$('#openList .opitem.out')).length === 1, '상태 패널에 «가려짐» 없음 · 목록에 콘센트 1');
  chk(await panelText(p) === before, '빈 자리 콘센트 → 상태·점수 글자 그대로');

  await p.click('#openList .opitem.out [data-act="edit"]'); await p.waitForTimeout(250);
  chk(await p.$eval('#opTitle', n => n.textContent) === '콘센트 수정', '목록에서 수정 → «콘센트 수정»');
  await p.click(`#opWall [data-wall="${blocked.wall}"]`); await p.fill('#opX', String(blocked.x));
  await p.click('#opSave'); await p.waitForTimeout(400);
  s = await st(p); r = s.rooms[0];
  chk(r.outlets.length === 1 && r.outlets[0].wall === blocked.wall && r.outlets[0].x0 === blocked.x, '수정 → 같은 콘센트가 옮겨짐(1개)');
  chk((await p.$$('#plan rect.outlet.blk')).length === 1, '도면: 가려진 콘센트는 황토색(.blk)');
  const info = await p.$eval('#outInfo', n => n.textContent).catch(() => '');
  chk(info.includes('콘센트 가려짐') && info.includes(blocked.name) && info.includes('점수와는 상관없어요'), `상태 패널: «${info.slice(0, 60)}…»`);
  chk((await p.$$('#openList .opitem.out.lockd')).length === 1
      && (await p.$eval('#openList .opitem.out', n => n.textContent)).includes('가구가 가림'), '목록: «가구가 가림»');
  chk(await panelText(p) === before, '막힌 콘센트 → 점수·통로·«확인 필요» 그대로(정보만)');

  await p.click('#undoBtn'); await p.waitForTimeout(400);
  r = (await st(p)).rooms[0];
  chk(r.outlets[0].wall === free.wall && r.outlets[0].x0 === free.x && !(await p.$('#outInfo')), '되돌리기 한 번 → 빈 자리로');

  /* 방 줄이기: 위쪽 벽 오른쪽 끝 콘센트가 벽 안으로 따라온다 */
  await addOutlet(p, 'top', r.w - 120, '#addOutBtn2');
  await p.click('#crumbRoom'); await p.waitForTimeout(300);
  await p.fill('#rmW', '2000'); await p.click('#rmSave'); await p.waitForTimeout(400);
  r = (await st(p)).rooms[0];
  const o2 = r.outlets.find(o => o.id === 'O2');
  chk(o2 && o2.x0 + o2.w === 2000 && o2.w === 120, `가로 2000 → 콘센트도 벽 안 (${o2 && o2.x0}+${o2 && o2.w})`);
  await p.click('#undoBtn'); await p.waitForTimeout(400);

  await p.reload(); await p.waitForTimeout(900); await p.click('#isPeek'); await p.waitForTimeout(1300);   // 인트로는 열 때마다 뜬다 → 둘러보기 = 샘플 방
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  r = (await st(p)).rooms[0];
  chk(r.outlets.length === 2, '새로고침 뒤에도 콘센트 2개 그대로');

  /* 링크로 보내기 → 다른 브라우저에서 받기 */
  await p.evaluate(() => { const u = document.getElementById('utilBar'); if (u) u.classList.add('open'); });
  await p.click('#shareBtn'); await p.waitForTimeout(500);
  const url = await p.inputValue('#shUrl');
  chk(/#r=/.test(url), `링크 만들어짐 (# 뒤 ${url.split('#')[1].length}자)`);
  const c2 = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  const q = await c2.newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.goto(url); await q.waitForTimeout(1200);
  await q.click('#cfOk'); await q.waitForTimeout(600);
  const s2 = await st(q), got = s2.rooms[s2.rooms.length - 1];
  chk(JSON.stringify(got.outlets.map(o => [o.wall, o.x0, o.w])) === JSON.stringify(r.outlets.map(o => [o.wall, o.x0, o.w])),
      `받은 방에 콘센트 그대로 ${JSON.stringify(got.outlets.map(o => [o.wall, o.x0, o.w]))}`);
  await c2.close();
  await p.click('#shClose'); await p.waitForTimeout(200);

  /* 삭제 */
  const n0 = (await st(p)).rooms[0].outlets.length;
  await p.click('#openList .opitem.out [data-act="del"]'); await p.waitForTimeout(300);
  chk((await p.$eval('#cfText', n => n.textContent)).includes('콘센트'), '삭제 확인 창 «이 콘센트를 지웁니다»');
  await p.click('#cfOk'); await p.waitForTimeout(400);
  chk((await st(p)).rooms[0].outlets.length === n0 - 1, `삭제 → ${n0 - 1}개`);
  await c.close();

  /* 폰: «추가» 탭 → 가구·문·창문·콘센트 */
  const c3 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const m = await c3.newPage(); m.on('pageerror', e => errs.push(e.message));
  await m.goto(APP); await m.waitForTimeout(700); await m.tap('#isPeek'); await m.waitForTimeout(1300);
  if (await m.$('#guide.open')) { await m.keyboard.press('Escape'); await m.waitForTimeout(300); }
  await m.tap('#tabbar [data-tab="add"]'); await m.waitForTimeout(400);
  const ap = await m.$$eval('#apModal [data-ap]', e => e.map(n => [n.getAttribute('data-ap'), Math.round(n.getBoundingClientRect().height), Math.round(n.getBoundingClientRect().width)]));
  chk(ap.length === 4 && ap[3][0] === 'out' && ap.every(a => a[1] >= 44 && a[2] >= 44), `추가 고르기 4칸 ${JSON.stringify(ap)}`);
  await m.tap('#apModal [data-ap="out"]'); await m.waitForTimeout(400);
  chk(await m.isVisible('#placeBar') && (await m.textContent('#pbText')) === '콘센트를 놓을 벽을 누르세요', '폰: 콘센트 → «벽을 누르세요» 띠');   // p51
  const mb = await m.evaluate(w => { const s = JSON.parse(localStorage.getItem('room-planner/3')); const r = s.rooms[0]; const b = document.querySelector('#plan > rect').getBoundingClientRect(); return { x:b.x, y:b.y, k:b.width / r.w, w:r.w, d:r.d }; });
  const bx = blocked.x + 60, at = { top:[mb.x + bx * mb.k, mb.y + 4], bottom:[mb.x + bx * mb.k, mb.y + mb.d * mb.k - 4], left:[mb.x + 4, mb.y + bx * mb.k], right:[mb.x + mb.w * mb.k - 4, mb.y + bx * mb.k] }[blocked.wall];
  await m.touchscreen.tap(at[0], at[1]); await m.waitForTimeout(400);
  chk((await st(m)).rooms[0].outlets.length === 1 && (await m.$$('#plan rect.outlet.blk')).length === 1, '폰: 막힌 자리에 추가 → 황토색');
  await c3.close();

  console.log('\npageerror :', errs.length, errs.slice(0, 3));
  console.log(ok && !errs.length ? '전부 통과' : '실패 있음');
  await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
