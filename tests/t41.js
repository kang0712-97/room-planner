// p41: 줄자 — 모양으로 잡기(글자 칸·줄 옆도 옮기기, 짧아도 가운데는 옮기기) · × 로 치우기 · 방을 나가면 치움
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
  /* 줄자의 화면 좌표: 두 끝, 글자 칸 가운데, × 가운데, 줄 방향의 수직 단위벡터 */
  const T = p => p.evaluate(() => {
    const g = document.querySelector('#plan g.tape'); if (!g) return null;
    const svg = document.getElementById('plan'), M = svg.getScreenCTM();
    const sp = (x, y) => { const q = svg.createSVGPoint(); q.x = x; q.y = y; const r = q.matrixTransform(M); return { x: r.x, y: r.y }; };
    const ln = g.querySelectorAll(':scope > line')[1];
    const A = sp(+ln.getAttribute('x1'), +ln.getAttribute('y1')), B = sp(+ln.getAttribute('x2'), +ln.getAttribute('y2'));
    const lr = g.querySelector(':scope > rect').getBBox(), L = sp(lr.x + lr.width / 2, lr.y + lr.height / 2);
    const xc = g.querySelector('.tape-x circle'), X = sp(+xc.getAttribute('cx'), +xc.getAttribute('cy'));
    const len = Math.hypot(B.x - A.x, B.y - A.y);
    return { A, B, L, X, len, mm: g.querySelector('text').textContent };
  });
  const drag = async (p, from, dx, dy) => {
    await p.mouse.move(from.x, from.y); await p.mouse.down();
    await p.mouse.move(from.x + dx, from.y + dy, { steps: 6 }); await p.mouse.up(); await p.waitForTimeout(250);
  };
  const near = (a, b, tol = 3) => Math.abs(a - b) <= tol;

  /* ── ① 데스크톱 ── */
  let { c, p } = await open({ width: 1600, height: 900 });
  const ver = await p.$eval('#introVer', n => n.textContent); chk(+(ver.match(/p(\d+)/) || [0, 0])[1] >= 41, '판 번호 p41 이상 (' + ver + ')');
  await p.click('#tapeBtn'); await p.waitForTimeout(300);
  let t0 = await T(p);
  chk(!!t0 && !!(await p.$('#plan .tape-x')), `줄자 + × 단추 (${t0 && t0.mm})`);

  await drag(p, t0.L, -40, 60); let t1 = await T(p);
  chk(near(t1.A.x - t0.A.x, -40) && near(t1.A.y - t0.A.y, 60) && near(t1.len, t0.len), '빨간 길이 글자 칸을 잡아도 통째로 옮겨짐');

  const mid = { x: (t1.A.x + t1.B.x) / 2, y: (t1.A.y + t1.B.y) / 2 + 18 };   // 줄에서 18px 아래(글자 반대쪽)
  await drag(p, mid, 30, 20); let t2 = await T(p);
  chk(near(t2.A.x - t1.A.x, 30) && near(t2.len, t1.len), '줄을 정확히 안 눌러도(18px 옆) 옮겨짐');

  await drag(p, t2.B, 50, 0); let t3 = await T(p);
  chk(near(t3.A.x, t2.A.x) && near(t3.A.y, t2.A.y) && !near(t3.len, t2.len, 5), `긴 줄자: 끝을 잡으면 늘어남(${Math.round(t2.len)}→${Math.round(t3.len)}px, 반대 끝 제자리)`);

  /* 짧게 — 오른쪽 끝을 왼쪽 끝 48px 옆으로 */
  await drag(p, t3.B, (t3.A.x + 48) - t3.B.x, t3.A.y - t3.B.y); let s0 = await T(p);
  chk(s0.len < 60, `짧게 만듦(${Math.round(s0.len)}px, ${s0.mm})`);
  const sm = { x: (s0.A.x + s0.B.x) / 2, y: (s0.A.y + s0.B.y) / 2 };
  await drag(p, sm, 80, 50); let s1 = await T(p);
  chk(near(s1.A.x - s0.A.x, 80) && near(s1.B.x - s0.B.x, 80) && near(s1.len, s0.len), '짧은 줄자: 가운데를 잡으면 늘어나지 않고 옮겨짐');
  await drag(p, { x: s1.B.x + 3, y: s1.B.y }, 60, 0); let s2 = await T(p);
  chk(near(s2.A.x, s1.A.x) && s2.len > s1.len + 40, `짧은 줄자: 끝 바로 위를 잡으면 늘어남(${Math.round(s1.len)}→${Math.round(s2.len)}px)`);

  await p.mouse.click(s2.X.x, s2.X.y); await p.waitForTimeout(250);
  const off = await p.evaluate(() => ({ g: !!document.querySelector('#plan g.tape'), lb: document.querySelector('#tapeBtn span').textContent, armed: document.getElementById('tapeBtn').classList.contains('armed') }));
  chk(!off.g && off.lb === '줄자' && !off.armed, '× 누르면 줄자 사라지고 도구 버튼도 «줄자» 로');
  chk(await p.$eval('#plan', s => s.innerHTML.includes('최소 통로 771')), '× 는 가구·통로를 건드리지 않음(통로 771)');

  await p.click('#tapeBtn'); await p.waitForTimeout(250);
  await p.click('#goHome'); await p.waitForTimeout(600);
  chk(!(await p.$('#plan g.tape')), '집 전체로 나가면 줄자 사라짐');
  await p.click('#roomList .roomcard .nm'); await p.waitForTimeout(600);
  const back = await p.evaluate(() => ({ g: !!document.querySelector('#plan g.tape'), lb: document.querySelector('#tapeBtn span').textContent }));
  chk(!back.g && back.lb === '줄자', '다시 방에 들어가도 줄자 없음 · 버튼 «줄자»');
  await c.close();

  /* ── ② 폰(터치, 흔들림 포함) ── */
  ({ c, p } = await open({ width: 390, height: 844 }, { deviceScaleFactor: 2, isMobile: true, hasTouch: true }));
  const cd = await c.newCDPSession(p);
  const touch = (pts, type) => cd.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((q, i) => ({ x: q.x, y: q.y, id: i, radiusX: 12, radiusY: 12 })) });
  const tdrag = async (q, dx, dy, n = 8) => {
    await touch([q], 'touchStart'); await p.waitForTimeout(30);
    for (let i = 1; i <= n; i++) { await touch([{ x: q.x + dx * i / n + (i % 2), y: q.y + dy * i / n }], 'touchMove'); await p.waitForTimeout(15); }
    await touch([{ x: q.x + dx, y: q.y + dy }], 'touchEnd'); await p.waitForTimeout(350);
  };
  const tap = async q => { await touch([q], 'touchStart'); await p.waitForTimeout(30); await touch([{ x: q.x + 3, y: q.y + 3 }], 'touchMove');
    await p.waitForTimeout(20); await touch([{ x: q.x + 3, y: q.y + 3 }], 'touchEnd'); await p.waitForTimeout(400); };
  await p.click('#tabbar [data-tab="more"]'); await p.waitForTimeout(400);
  await p.click('#tapeBtn'); await p.waitForTimeout(300);
  if (await p.$eval('body', n => [...n.classList].some(k => k.startsWith('sh-')))) { await p.click('#tabbar [data-tab="more"]'); await p.waitForTimeout(400); }
  const f0 = await T(p);
  chk(!!f0 && f0.X.x < 390 && f0.X.y < 844, `폰: 줄자·× 가 화면 안 (× ${Math.round(f0.X.x)},${Math.round(f0.X.y)})`);
  await tdrag({ x: (f0.A.x + f0.B.x) / 2, y: (f0.A.y + f0.B.y) / 2 + 14 }, 20, 90); const f1 = await T(p);
  chk(near(f1.A.y - f0.A.y, 90, 4) && near(f1.len, f0.len, 2), '폰: 손가락으로 줄 옆을 잡아 옮김');
  await tap(f1.X);
  chk(!(await p.$('#plan g.tape')), '폰: × 를 탭하면 줄자 사라짐(도구 시트 안 열고)');
  await c.close();

  console.log('\npageerror :', errs.length, errs.slice(0, 3));
  console.log(ok && !errs.length ? '전부 통과' : '실패 있음');
  await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
