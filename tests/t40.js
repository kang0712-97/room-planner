// p40: P2-5 끌기 최적화 — 한 프레임에 한 번 그리기 · 끄는 동안 통로 재계산 없음(흐리게) · 가벼운 그리기(dragPatch)
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const APP = 'file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html');
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const open = async (vp, extra = {}) => {
    const c = await b.newContext(Object.assign({ viewport: vp }, extra)); const p = await c.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(700); await p.click('#isPeek'); await p.waitForTimeout(1500);
    if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    return { c, p };
  };
  const uidOf = (p, n) => p.evaluate(n => { for (const g of document.querySelectorAll('#plan .fg'))
    if (g.getAttribute('aria-label').startsWith(n + ' ')) return g.getAttribute('data-uid'); }, n);
  const box = async (p, uid) => (await p.$(`#plan .fg[data-uid="${uid}"] rect.body`)).boundingBox();
  const rectXY = (p, uid) => p.evaluate(u => { const r = document.querySelector(`#plan .fg[data-uid="${u}"] rect.body`);
    return { x: +r.getAttribute('x'), y: +r.getAttribute('y') }; }, uid);
  const saved = (p, uid) => p.evaluate(u => JSON.parse(localStorage.getItem('room-planner/3')).items.find(i => i.uid === u), uid);

  /* ── ① 데스크톱: 판 번호 · 끄는 동안 ────────────────────────── */
  let { c, p } = await open({ width: 1600, height: 900 });
  const ver = await p.$eval('#introVer', n => n.textContent); chk(+(ver.match(/p(\d+)/) || [0, 0])[1] >= 40, '판 번호 p40 이상 (' + ver + ')');
  const walk0 = await p.$eval('#plan', s => s.innerHTML.includes('최소 통로 771'));
  chk(walk0, '샘플 방 통로 771 (시작)');
  const desk = await uidOf(p, '책상'), bed = await uidOf(p, '침대');
  const b0 = await box(p, desk), s0 = await saved(p, desk);
  const x0 = b0.x + b0.width / 2, y0 = b0.y + b0.height / 2;
  const circ0 = await p.$eval('#plan .walkband circle', n => n.getAttribute('cx') + ',' + n.getAttribute('cy'));
  await p.mouse.move(x0, y0); await p.mouse.down();
  await p.mouse.move(x0 - 8, y0 - 10); await p.waitForTimeout(60);   // 첫 프레임은 통째로 그린다(여기서 통로가 흐려짐)
  await p.evaluate(u => { window.__bedNode = document.querySelector(`#plan .fg[data-uid="${u}"]`); }, bed);
  for (let i = 2; i <= 8; i++) { await p.mouse.move(x0 - i * 8, y0 - i * 10); await p.waitForTimeout(30); }
  await p.waitForTimeout(250);
  const mid = await p.evaluate(() => ({
    stale: document.querySelectorAll('#plan .walkstale').length,
    circ: (n => n && n.getAttribute('cx') + ',' + n.getAttribute('cy'))(document.querySelector('#plan .walkband circle')),
    dyn: document.querySelectorAll('#plan line.dyn').length,
    same: document.contains(window.__bedNode) }));
  chk(mid.stale > 0, `끄는 동안 통로는 흐리게(.walkstale ${mid.stale}개)`);
  chk(mid.circ === circ0, `끄는 동안 통로 원은 제자리(다시 재지 않음) ${mid.circ}`);
  chk(mid.dyn > 0, `거리선은 끄는 동안에도 새로 그림(.dyn ${mid.dyn}개)`);
  chk(mid.same, '둘째 프레임부터 다른 가구 그림은 다시 만들지 않음(같은 노드)');
  const r1 = await rectXY(p, desk);
  chk(r1.x !== s0.x || r1.y !== s0.y, `끄는 가구는 따라옴 (${s0.x},${s0.y}) → (${r1.x},${r1.y})`);
  const dd = await p.$$eval('#selBox dd[data-wall]', a => a.map(n => n.textContent.replace(/\D/g, '')));
  chk(dd[0] === String(r1.x) && dd[2] === String(r1.y), `고른 가구 칸 벽까지 거리도 따라옴 (왼쪽 ${dd[0]} · 위쪽 ${dd[2]})`);

  /* 한 프레임에 여러 번 온 move → 그리기는 한 번 */
  const co = await p.evaluate(({ u, x, y }) => new Promise(res => {
    const r = document.querySelector(`#plan .fg[data-uid="${u}"] rect.body`); let n = 0;
    const mo = new MutationObserver(l => { n += l.filter(m => m.attributeName === 'x').length; });
    mo.observe(r, { attributes: true });
    for (let i = 1; i <= 20; i++) window.dispatchEvent(new PointerEvent('pointermove', { clientX: x - 64 - i * 3, clientY: y - 80, bubbles: true }));
    const sync = r.getAttribute('x');
    requestAnimationFrame(() => requestAnimationFrame(() => { mo.disconnect(); res({ n, sync, after: r.getAttribute('x') }); }));
  }), { u: desk, x: x0, y: y0 });
  chk(co.n === 1 && co.after !== co.sync, `move 20번 → 그리기 ${co.n}번 (한 프레임에 한 번)`);

  /* 끄는 동안 겹침 표시 — 침대 위로 */
  const bb = await box(p, bed);
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 6 }); await p.waitForTimeout(250);
  const cl = await p.evaluate(u => ({ hot: !!document.querySelector(`#plan .fg.clash[data-uid="${u}"]`),
    red: document.querySelectorAll('#plan rect.dyn[fill="var(--bad)"]').length }), bed);
  chk(cl.hot && cl.red > 0, `끄는 동안 겹침이 바로 보임(침대 .clash, 빨간 사각형 ${cl.red})`);
  /* 제자리로 돌아와 놓기 */
  await p.mouse.move(x0, y0, { steps: 6 }); await p.waitForTimeout(100);
  await p.mouse.move(x0 - 40, y0 - 300, { steps: 6 }); await p.waitForTimeout(100);
  await p.mouse.up(); await p.waitForTimeout(500);
  const up = await p.evaluate(() => ({ stale: document.querySelectorAll('#plan .walkstale, #plan .dyn.walkstale').length,
    circ: (n => n && n.getAttribute('cx') + ',' + n.getAttribute('cy'))(document.querySelector('#plan .walkband circle')) }));
  const s1 = await saved(p, desk), r2 = await rectXY(p, desk);
  chk(up.stale === 0, '손을 떼면 흐림이 사라짐');
  chk(s1.x === r2.x && s1.y === r2.y && (s1.x !== s0.x || s1.y !== s0.y), `저장된 자리 = 그려진 자리 (${s1.x},${s1.y})`);
  const sc1 = await p.$eval('.scorebox', n => n.innerText.match(/\d+/)[0]);
  await p.click('#undoBtn'); await p.waitForTimeout(500);
  const s2 = await saved(p, desk);
  const walk2 = await p.$eval('#plan', s => s.innerHTML.includes('최소 통로 771'));
  const sc2 = await p.$eval('.scorebox', n => n.innerText.match(/\d+/)[0]);
  chk(s2.x === s0.x && s2.y === s0.y && walk2 && sc2 === '61', `되돌리기 한 번에 원래 자리·통로 771·점수 61 (놓았을 때 ${sc1}점)`);

  /* 프레임 — CPU 6배 감속에서 하위 10% 프레임 20ms 이하 */
  const cdp = await c.newCDPSession(p);
  const b2 = await box(p, desk);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
  await p.evaluate(() => { window.__f = []; let last = performance.now(); window.__on = true;
    const tick = t => { window.__f.push(t - last); last = t; if (window.__on) requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  const X = b2.x + b2.width / 2, Y = b2.y + b2.height / 2;
  await p.mouse.move(X, Y); await p.mouse.down();
  for (let i = 1; i <= 90; i++) { const a = i / 90 * Math.PI * 2; await p.mouse.move(X + Math.sin(a) * 160 + i, Y + (1 - Math.cos(a)) * 90); }
  await p.mouse.up(); await p.waitForTimeout(400);
  const f = (await p.evaluate(() => { window.__on = false; return window.__f; })).slice(3).sort((a, b) => a - b);
  const p90 = f[Math.floor(f.length * 0.9)];
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  chk(p90 <= 20, `CPU 6배 감속 끌기 프레임 하위 10% ${p90.toFixed(1)}ms (≤ 20ms, p39 66.7ms)`);
  if (await p.$eval('#undoBtn', n => !n.disabled)) { await p.click('#undoBtn'); await p.waitForTimeout(400); }

  /* 줄자 끝 끌기 — 손을 떼도 마지막 자리가 그려져야 한다 */
  await p.click('#tapeBtn'); await p.waitForTimeout(300);
  const hb = await (await p.$('#plan .tape-h[data-end="b"]')).boundingBox();
  const hx = hb.x + hb.width / 2, hy = hb.y + hb.height / 2;
  await p.mouse.move(hx, hy); await p.mouse.down(); await p.mouse.move(hx + 60, hy + 70, { steps: 5 }); await p.mouse.up();
  await p.waitForTimeout(300);
  const hb2 = await (await p.$('#plan .tape-h[data-end="b"]')).boundingBox();
  chk(Math.abs(hb2.x - hb.x - 60) < 12 && Math.abs(hb2.y - hb.y - 70) < 12, `줄자 끝이 손을 뗀 자리에 (${Math.round(hb2.x - hb.x)}, ${Math.round(hb2.y - hb.y)})`);
  await p.click('#tapeBtn');
  await c.close();

  /* ── ② 폰: 손가락 끌기(흔들림 포함) · 방 옮기기 ───────────────── */
  ({ c, p } = await open({ width: 390, height: 844 }, { deviceScaleFactor: 2, isMobile: true, hasTouch: true }));
  const cd = await c.newCDPSession(p);
  const touch = (pts, type) => cd.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q.x, y: q.y, id: i, radiusX: 12, radiusY: 12 })) });
  const drag = async (x, y, dx, dy, n = 10) => {
    await touch([{ x, y }], 'touchStart'); await p.waitForTimeout(30);
    for (let i = 1; i <= n; i++) { await touch([{ x: x + dx * i / n + (i % 2), y: y + dy * i / n }], 'touchMove'); await p.waitForTimeout(12); }
    await touch([{ x: x + dx, y: y + dy }], 'touchEnd'); await p.waitForTimeout(500);
  };
  const pd = await uidOf(p, '독서실책상'), pb = await box(p, pd), ps0 = await saved(p, pd);
  await drag(pb.x + pb.width / 2, pb.y + pb.height / 2, 0, -60);
  const ps1 = await saved(p, pd), pr = await rectXY(p, pd);
  chk(ps1.y < ps0.y && pr.y === ps1.y, `폰 손가락 끌기: 독서실책상 y ${ps0.y} → ${ps1.y}, 그림도 같은 자리`);
  chk(await p.$$eval('#plan .walkstale', a => a.length) === 0, '폰: 손을 떼면 통로 다시 잼(흐림 없음)');
  await p.click('#tabbar [data-tab="more"]'); await p.waitForTimeout(400);
  await p.click('#goHome'); await p.waitForTimeout(700);
  if (await p.$eval('body', n => n.classList.contains('sh-list'))) { await p.click('#tabbar [data-tab="list"]'); await p.waitForTimeout(400); }
  const rx0 = await p.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')).rooms[0].x);
  const rb = await p.locator('.rg').first().boundingBox();
  await drag(rb.x + rb.width / 2, rb.y + rb.height / 2, 50, 0);
  const rx1 = await p.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')).rooms[0].x);
  const still = await p.$eval('#crumbRoom', n => n.hidden);
  chk(rx1 !== rx0 && still, `폰: 집 화면에서 방 옮기기 x ${rx0} → ${rx1} (방에 들어가지 않음)`);
  await c.close();

  console.log('\npageerror :', errs.length, errs.slice(0, 3));
  console.log(ok && !errs.length ? '전부 통과' : '실패 있음');
  await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
