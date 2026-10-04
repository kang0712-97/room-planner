// p47: 방 이름 눌러 크기 수정 · 폰 고른 가구 줄 단순화 · 폰 줄자 단추(도면 왼쪽 위) · 보관함/배치 창은 바깥을 누르면 닫힘 · 측정 켬
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const fs = require('fs');
const WORK = process.env.WORK || '/home/claude/work';
const FILE = process.env.APP || WORK + '/app.html', APP = 'file://' + FILE;
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const st = p => p.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')));
  const open = async (vp, extra = {}) => {
    const c = await b.newContext(Object.assign({ viewport: vp }, extra)); const p = await c.newPage();
    p.on('pageerror', e => errs.push(e.message));
    const gc = []; await c.route(/goatcounter\.com/, r => { gc.push(r.request().url()); r.fulfill({ status: 204, body: '' }); });
    await p.goto(APP); await p.waitForTimeout(700); await p.click('#isPeek'); await p.waitForTimeout(1300);
    if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    return { c, p, gc };
  };
  chk(/const GC = "eodidaduji";/.test(fs.readFileSync(FILE, 'utf8')), '측정 코드 eodidaduji 가 들어감');

  /* ── 데스크톱 ── */
  let { c, p, gc } = await open({ width: 1600, height: 900 });
  const ver = await p.$eval('#introVer', n => n.textContent);
  chk(+(ver.match(/p(\d+)/) || [0, 0])[1] >= 47, '판 번호 p47 이상 (' + ver + ')');
  chk(gc.length === 0, 'file:// 에서는 측정 신호 없음');
  /* 방 크기 수정 */
  await p.click('#crumbRoom'); await p.waitForTimeout(300);
  const m = await p.evaluate(() => ({ open: document.getElementById('roomModal').classList.contains('open'), w: document.getElementById('rmW').value,
    d: document.getElementById('rmD').value, drop: document.getElementById('rmDrop').hidden, title: document.getElementById('rmTitle').textContent }));
  chk(m.open && m.title === '방 수정' && m.w === '2460' && m.d === '5100' && m.drop, `방 이름(내 방 ✎) 누르면 «방 수정» — ${m.w}×${m.d}, 방 삭제 단추는 숨김`);
  await p.fill('#rmW', '2000'); await p.fill('#rmName', '작은 내 방'); await p.click('#rmSave'); await p.waitForTimeout(400);
  let s = await st(p); const r = s.rooms[0];
  const out = s.items.filter(i => i.room === r.id).filter(i => { const cat = s.catalog.find(k => k.id === i.cat); const w = i.rot % 180 ? cat.d : cat.w; return i.x + w > r.w; });
  chk(r.w === 2000 && (await p.textContent('#crumbRoom')).trim() === '작은 내 방' && out.length === 0, `저장 → 가로 2000 · 이름 바뀜 · 가구는 방 안으로 당겨짐(밖 ${out.length})`);
  await p.click('#undoBtn'); await p.waitForTimeout(300);
  chk((await st(p)).rooms[0].w === 2460, '되돌리기 한 번에 2460');
  /* 보관함·배치 창 — 바깥을 누르면 닫힘 */
  const plan = await (await p.$('#plan')).boundingBox();
  await p.click('#drawerBtn'); await p.waitForTimeout(300);
  const d1 = await p.$eval('#drawer', n => n.classList.contains('open'));
  await p.mouse.click(plan.x + plan.width * 0.75, plan.y + plan.height * 0.5); await p.waitForTimeout(400);
  chk(d1 && !(await p.$eval('#drawer', n => n.classList.contains('open'))), '보관함 창 → 바깥 도면 누르면 닫힘');
  await p.click('#layBtn'); await p.waitForTimeout(300);
  const l1 = await p.$eval('#layDrawer', n => n.classList.contains('open'));
  await p.mouse.click(plan.x + plan.width * 0.3, plan.y + plan.height * 0.5); await p.waitForTimeout(400);
  chk(l1 && !(await p.$eval('#layDrawer', n => n.classList.contains('open'))), '배치 창 → 바깥 도면 누르면 닫힘');
  chk(await p.$eval('#tapeFab', n => getComputedStyle(n).display === 'none') && await p.isVisible('#tapeBtn'), '데스크톱: 줄자는 툴바 그대로(도면 단추 없음)');
  await c.close();

  /* ── 폰 ── */
  ({ c, p } = await open({ width: 390, height: 844 }, { deviceScaleFactor: 2, isMobile: true, hasTouch: true }));
  const uid = await p.evaluate(() => { for (const g of document.querySelectorAll('#plan .fg')) if (g.getAttribute('aria-label').startsWith('옷서랍 ')) return g.getAttribute('data-uid'); });
  const bb = await (await p.$(`#plan .fg[data-uid="${uid}"] rect.body`)).boundingBox();
  await p.tap(`#plan .fg[data-uid="${uid}"] rect.body`, { position: { x: bb.width / 2, y: bb.height / 2 }, force: true }); await p.waitForTimeout(400);
  const bar = await p.evaluate(() => ({ acts: [...document.querySelectorAll('#selbar .sb-act')].filter(n => !n.hidden && getComputedStyle(n).display !== 'none').map(n => n.textContent.trim()),
    sz: getComputedStyle(document.getElementById('sbSz')).display, nm: document.getElementById('sbNm').textContent }));
  chk(bar.acts.join('·') === '회전·수정·보관·삭제' && bar.sz === 'none', `고른 가구 줄: «${bar.nm}» + [${bar.acts.join(' · ')}] — 치수 줄·자리 찾기 없음`);
  await p.screenshot({ path: WORK + '/p47_phone.png' });
  const fb = await p.evaluate(() => { const f = document.getElementById('tapeFab'), r = f.getBoundingClientRect(), bar = document.getElementById('plan').getBoundingClientRect();
    return { vis: !f.hidden && getComputedStyle(f).display !== 'none', x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), barB: Math.round(Math.max(0, bar.top)),
      hit: (e => !!(e && e.closest('#tapeFab')))(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)) }; });
  chk(fb.vis && fb.x <= 16 && fb.y >= fb.barB && fb.y <= fb.barB + 20 && fb.w >= 44 && fb.hit, `줄자 단추: 도면 왼쪽 위 (${fb.x},${fb.y}) · ${fb.w}px · 눌림`);
  chk(!(await p.isVisible('#tapeBtn')), '도구 시트의 «줄자» 는 폰에서 숨김(한 군데로)');
  await p.tap('#tapeFab'); await p.waitForTimeout(300);
  chk(!!(await p.$('#plan g.tape')) && await p.$eval('#tapeFab', n => n.classList.contains('armed')), '단추 누름 → 줄자 켜짐(단추 빨강)');
  await p.tap('#tapeFab'); await p.waitForTimeout(300);
  chk(!(await p.$('#plan g.tape')) && !(await p.$eval('#tapeFab', n => n.classList.contains('armed'))), '한 번 더 → 꺼짐');
  await p.tap('#crumbRoom'); await p.waitForTimeout(400);
  chk(await p.$eval('#roomModal', n => n.classList.contains('open')), '폰: 방 이름 누르면 방 수정 창');
  await p.tap('#rmCancel'); await p.waitForTimeout(300);
  await p.tap('#tabbar [data-tab="more"]'); await p.waitForTimeout(400);
  await p.tap('#drawerBtn'); await p.waitForTimeout(400);
  const dr = await p.evaluate(() => ({ open: document.getElementById('drawer').classList.contains('open'), sheet: [...document.body.classList].filter(k => k.startsWith('sh-')).join() }));
  chk(dr.open && !dr.sheet, '폰: 도구 → 보관함 → 도구 시트는 닫히고 보관함 창이 보임');
  await p.tap('#plan', { position: { x: 300, y: 400 } }); await p.waitForTimeout(400);
  chk(!(await p.$eval('#drawer', n => n.classList.contains('open'))), '폰: 바깥 도면을 누르면 보관함 창 닫힘');
  await p.tap('#goHome'); await p.waitForTimeout(600);
  chk(await p.$eval('#tapeFab', n => n.hidden), '집 화면에서는 줄자 단추 없음');
  await c.close();

  console.log('\npageerror :', errs.length, errs.slice(0, 3));
  console.log(ok && !errs.length ? '전부 통과' : '실패 있음');
  await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
