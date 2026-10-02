// p51·p52: 문·창문은 «미리보기 → 끌어 맞추기 → 놓기», 콘센트는 «벽 누르기» — 숫자 없이 · 양 끝 손잡이로 폭 · 가장 가까운 벽 · 끌기 · 안·밖/반대쪽 · 바닥까지 창 · 가구 우선 보호
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // 크롬 전용(CDP 터치)
const WORK = process.env.WORK || '/home/claude/work';
const FILE = process.env.APP || WORK + '/app.html', APP = 'file://' + FILE;
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const room = p => p.evaluate(() => { const s = JSON.parse(localStorage.getItem('room-planner/3')); return s.rooms.find(r => r.name === '시험방'); });
  /* 방 mm → 화면 px */
  const geo = async p => {
    const r = await room(p);
    const bb = await p.evaluate(() => { const q = document.querySelector('#plan > rect').getBoundingClientRect(); return { x:q.x, y:q.y, w:q.width, h:q.height }; });
    return { r, X:mm => bb.x + mm * bb.w / r.w, Y:mm => bb.y + mm * bb.h / r.d, k:bb.w / r.w };
  };
  let taps = 0;
  const tap = async (p, sel) => { taps++; await p.tap(sel); await p.waitForTimeout(250); };
  const tapAt = async (p, x, y) => { taps++; await p.touchscreen.tap(x, y); await p.waitForTimeout(350); };
  const place = async (p, kind, x, y) => { await tap(p, '#tabbar [data-tab="add"]'); await tap(p, `#apModal [data-ap="${kind}"]`); await tapAt(p, x, y);
    if (kind !== 'out') await tap(p, '#pbGo'); };                      // p52 — 문·창문은 «놓기» 까지
  let cdp = null;
  const tp = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, radiusX: 6, radiusY: 6, force: 1 }] });
  const swipe = async (x0, y0, dx, dy, n) => { await tp('touchStart', x0, y0); for (let i = 1; i <= n; i++) { await tp('touchMove', x0 + dx * i, y0 + dy * i); await p.waitForTimeout(16); } await tp('touchEnd'); await p.waitForTimeout(350); };
  let p = null;

  /* ── 폰 ── */
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); cdp = await c.newCDPSession(p);
  await p.goto(APP); await p.waitForTimeout(700);
  await p.fill('#isW', '3000'); await p.fill('#isD', '3600'); await p.tap('#isGo'); await p.waitForTimeout(800);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  await p.tap('#crumbRoom'); await p.waitForTimeout(300); await p.fill('#rmName', '시험방'); await p.tap('#rmSave'); await p.waitForTimeout(400);
  const ver = await p.$eval('#introVer', n => n.textContent);
  chk(+(ver.match(/p(\d+)/) || [0, 0])[1] >= 52, '판 번호 p52 이상 (' + ver + ')');

  let g = await geo(p);
  taps = 0;
  await tap(p, '#tabbar [data-tab="add"]'); await tap(p, '#apModal [data-ap="door"]');
  chk(await p.isVisible('#placeBar') && (await p.textContent('#pbText')) === '문을 끌어 자리를 잡고 «놓기»' && !(await p.$eval('#openModal', n => n.classList.contains('open'))),
      '추가 → 문: 숫자 창 없이 «문을 끌어 자리를 잡고 «놓기»»');
  chk(await p.$$eval('#plan .ghost', n => n.length) === 1 && await p.$$eval('#plan .ophandle', n => n.length) === 2 && (await room(p)).doors.length === 0,
      '반투명 문 미리보기 + 양 끝 손잡이 · 아직 저장 안 됨');
  chk(await p.$$eval('#plan .ghost line, #plan .ghost path', ns => ns.some(n => n.getAttribute('stroke') === 'var(--preview)')) && !(await p.$('#plan .placewall')),
      'p53 — 미리보기는 파란색(--preview) · 문을 놓을 땐 벽 강조 없음');
  await tapAt(p, g.X(2200), g.Y(0) + 4);
  chk((await room(p)).doors.length === 0, '벽을 눌러도 미리보기만 그리로 옮겨짐(저장 안 됨)');
  chk((await p.textContent('#pbSwing')) === '밖으로', 'p54 — 안으로 열린 미리보기: 단추는 «밖으로»(누르면 될 쪽)');
  await tap(p, '#pbDoor [data-pd="swing"]');
  chk((await p.textContent('#pbSwing')) === '안으로' && (await room(p)).doors.length === 0, '«밖으로» 누름 → 단추 «안으로» — 미리보기만 바뀜');
  await tap(p, '#pbDoor [data-pd="swing"]');
  await tap(p, '#pbGo');
  let r = await room(p);
  chk(taps - 2 === 4 && r.doors.length === 1 && r.doors[0].wall === 'top' && r.doors[0].w === 800 && r.doors[0].swing === 'in',
      `«놓기» → 문 하나 = 추가·문·벽·놓기 ${taps - 2}번 · 숫자 0 → 위쪽 벽 · 폭 800 · 안으로`);
  chk(Math.abs(r.doors[0].x0 + 400 - 2200) <= 60 / g.k, '누른 자리가 문 가운데');
  chk(await p.isVisible('#opbar') && !(await p.isVisible('#selbar')) && await p.$eval('#placeBar', n => n.hidden) && !(await p.$('#plan .ghost')), '놓은 뒤: 띠·미리보기 사라짐 · 문 줄(#opbar)');
  chk((await p.textContent('#obSz')).includes('위쪽 벽 · 폭 800 · 안으로 열림'), '문 줄 설명: ' + await p.textContent('#obSz'));
  const ob = await p.$$eval('#opbar .sb-act', ns => ns.filter(n => !n.hidden).map(n => n.textContent.trim() + ':' + Math.round(n.getBoundingClientRect().width) + '×' + Math.round(n.getBoundingClientRect().height)));
  chk(ob.length === 4 && ob[0].startsWith('밖으로') && ob[1].startsWith('반대쪽') && ob[2].startsWith('수정') && ob.every(s => /:4\d×4\d$/.test(s)), '문 줄 단추 44px: ' + ob.join(' '));

  /* 자가 감수 A — 고른 문의 몸통(25% 지점)을 잡고 끌면 옮겨진다(폭이 바뀌면 안 된다) */
  { const a = (await room(p)).doors[0];
    await swipe(g.X(a.x0 + a.w * 0.25), g.Y(0) - 8, -5, 0, 8);
    const b2 = (await room(p)).doors[0];
    chk(b2.w === a.w && b2.x0 < a.x0, '고른 문 몸통 25% 를 끌면 옮겨짐 · 폭 그대로');
    await tap(p, '#undoBtn'); }

  /* 안·밖, 반대쪽 — 하나씩 */
  const h0 = r.doors[0].hinge;
  await tap(p, '#opbar [data-ob="swing"]');
  let dd = (await room(p)).doors[0];
  chk(dd.swing === 'out' && dd.hinge === h0 && (await p.textContent('#obSwingL')) === '안으로', '«밖으로» → 밖으로 열림(매달린 쪽 그대로) · 단추 «안으로»');
  chk(await p.$$eval('#plan #opLayer path', ns => ns.some(n => n.getAttribute('stroke-opacity') === '0.45')), '밖여닫이: 방 바깥 옅은 점선');
  await tap(p, '#opbar [data-ob="swing"]'); await tap(p, '#opbar [data-ob="hinge"]');
  dd = (await room(p)).doors[0];
  chk(dd.swing === 'in' && dd.hinge !== h0, '«반대쪽» → 매달린 쪽만 바뀜');
  await tap(p, '#opbar [data-ob="hinge"]');

  /* p55 — 콘센트를 놓는 중엔 벽 선만 진한 파랑 실선(띠·점선 없음) */
  await tap(p, '#tabbar [data-tab="add"]'); await tap(p, '#apModal [data-ap="out"]');
  chk(!(await p.$('#plan .placezone')) && await p.$eval('#plan .placewall', n => n.getAttribute('stroke') === 'var(--preview)' && !n.getAttribute('stroke-dasharray') && !n.getAttribute('stroke-opacity') && +n.getAttribute('stroke-width') >= 26), '콘센트 놓는 중: 벽 선 파랑 · 띠 없음');
  await tap(p, '#pbCancel');

  /* 가장 가까운 벽 — 콘센트로 네 벽 */
  const walls = [];
  for (const [x, y] of [[g.X(600), g.Y(0) + 5], [g.X(1500), g.Y(g.r.d) - 5], [g.X(0) + 5, g.Y(1800)], [g.X(g.r.w) - 5, g.Y(1800)]]) {
    await place(p, 'out', x, y); const o = (await room(p)).outlets; walls.push(o[o.length - 1].wall);
  }
  chk(walls.join(',') === 'top,bottom,left,right', '가장 가까운 벽: ' + walls.join(','));
  await place(p, 'out', g.X(1500), g.Y(1800));
  chk((await room(p)).outlets.length === 4 && (await p.textContent('#toast')).includes('벽 가까이'), '방 가운데를 누르면 안 놓고 «벽 가까이를 눌러 주세요»');
  await tap(p, '#pbCancel');
  await place(p, 'out', g.X(2600), g.Y(g.r.d) + 25);
  r = await room(p);
  chk(r.outlets.length === 5 && r.outlets[4].wall === 'bottom', '벽선 바깥 25px 를 눌러도 그 벽에 놓임');
  await tap(p, '#undoBtn');
  chk((await room(p)).outlets.length === 4, '되돌리기 한 번 → 방금 놓은 것만 사라짐');

  /* 두 번째 문: 미리보기는 비어 있는 벽에서 시작(위쪽 가운데는 첫 문과 겹침) */
  await tap(p, '#tabbar [data-tab="add"]'); await tap(p, '#apModal [data-ap="door"]');
  const gb = await p.$eval('#plan .ghost', n => { const b = n.getBoundingClientRect(); return { x:b.x, w:b.width }; });
  chk(gb.x < g.X(0) + 20, '두 번째 문 미리보기는 비어 있는 왼쪽 벽에서 시작');
  /* 자가 감수 C — 첫 문 위로 끌어 겹치면 빨간 띠·안내, 비키면 사라짐 */
  { const a = (await room(p)).doors[0];
    await p.touchscreen.tap(g.X(a.x0 + a.w / 2), g.Y(0) + 3); await p.waitForTimeout(300);
    const bad = await p.$eval('#pbHint', n => n.classList.contains('bad') && n.textContent.includes('겹쳐요'));
    chk(bad && await p.$$eval('#plan .opsel.clash', n => n.length) === 1, '미리보기가 다른 문과 겹치면 빨간 띠 · «다른 문·창과 겹쳐요»');
    await p.touchscreen.tap(g.X(0) + 3, g.Y(1800)); await p.waitForTimeout(300);
    chk(!(await p.$eval('#pbHint', n => n.classList.contains('bad'))), '비키면 안내가 원래대로'); }
  await tap(p, '#pbGo');
  chk((await room(p)).doors.length === 2 && (await room(p)).doors[1].wall === 'left', '«놓기» → 왼쪽 벽 문');
  await tap(p, '#opbar [data-ob="del"]'); await tap(p, '#cfOk');
  chk((await room(p)).doors.length === 1, '문 줄 «삭제» → 확인 창 → 지워짐');

  /* 창문: 보통 창 1000 · «거실 창» · 줄에서 바닥까지 · 양 끝 손잡이로 폭 · 콘센트는 창 아래 겹쳐도 됨 */
  await tap(p, '#tabbar [data-tab="add"]'); await tap(p, '#apModal [data-ap="win"]');
  chk(await p.isVisible('#pbWin') && await p.getAttribute('#pbWin [data-pw="0"]', 'aria-pressed') === 'true', '창문 띠: «보통 창» 이 기본');
  await tapAt(p, g.X(1500), g.Y(g.r.d) - 4); await tap(p, '#pbGo');
  let w = (await room(p)).windows[0];
  chk(w && w.wall === 'bottom' && w.w === 1200 && w.sill === 1000 && w.head === 2400, '보통 창: 아래쪽 벽 · 폭 1200 · 창 아래 1000 · 창 위 2400');
  await tap(p, '#opbar [data-ob="floor"]');
  chk((await room(p)).windows[0].sill === 0 && await p.getAttribute('#opbar [data-ob="floor"]', 'aria-pressed') === 'true', '줄 «바닥까지» → 창 아래 0');
  await tap(p, '#opbar [data-ob="floor"]');
  chk((await room(p)).windows[0].sill === 1000, '다시 누르면 보통 창(1000)');
  /* 놓인 창: 오른쪽 끝 손잡이를 끌면 폭이 늘고, 되돌리기 한 번 */
  w = (await room(p)).windows[0];
  await swipe(g.X(w.x0 + w.w), g.Y(g.r.d), 6, 0, 8);
  const w2 = (await room(p)).windows[0];
  chk(w2.x0 === w.x0 && w2.w > w.w + 200, '놓인 창: 끝 점을 끌면 폭이 늘어남(시작점 그대로)');
  await tap(p, '#undoBtn');
  chk((await room(p)).windows[0].w === w.w, '폭 바꾸기도 되돌리기 한 번');
  /* 거실 창 + 미리보기에서 폭 줄이기 */
  await tap(p, '#tabbar [data-tab="add"]'); await tap(p, '#apModal [data-ap="win"]'); await tap(p, '#pbWin [data-pw="1"]');
  await tapAt(p, g.X(g.r.w) - 4, g.Y(800));
  const hb = await p.$$eval('#plan .ophandle', ns => ns.map(n => { const b = n.getBoundingClientRect(); return [b.x + b.width / 2, b.y + b.height / 2, n.getAttribute('data-end')]; }));
  const hB = hb.find(h => h[2] === 'b');
  await swipe(hB[0], hB[1], 0, -6, 8);
  chk((await room(p)).windows.length === 1, '미리보기 폭 바꾸기도 저장 전');
  await tap(p, '#pbGo');
  w = (await room(p)).windows[1];
  chk(w && w.wall === 'right' && w.sill === 0 && w.w < 1200 - 200, '띠 «거실 창» + 미리보기 끝 점 → 바닥까지 · 폭 줄어든 채 놓임');
  const wb = (await room(p)).windows[0];
  await place(p, 'out', g.X(wb.x0 + 600), g.Y(g.r.d) - 4);
  const ol = (await room(p)).outlets; const o5 = ol[ol.length - 1];
  chk(o5.wall === 'bottom' && o5.x0 < wb.x0 + wb.w && o5.x0 + o5.w > wb.x0, '콘센트는 창 아래에 겹쳐 놓임(밀리지 않음)');
  chk(!(await p.isVisible('#opbar [data-ob="exact"]')) && await p.isVisible('#opbar [data-ob="del"]'), '콘센트 줄: «수정» 없음 · «삭제» 만');

  /* 거실이라는 이름이면 창문 기본이 바닥까지 */
  await p.tap('#crumbRoom'); await p.waitForTimeout(300); await p.fill('#rmName', '시험방 거실'); await p.tap('#rmSave'); await p.waitForTimeout(400);
  await tap(p, '#tabbar [data-tab="add"]'); await tap(p, '#apModal [data-ap="win"]');
  chk(await p.getAttribute('#pbWin [data-pw="1"]', 'aria-pressed') === 'true', '방 이름에 «거실» → 창문 기본 «바닥까지»');
  await tap(p, '#pbCancel');
  chk(await p.$eval('#placeBar', n => n.hidden) && !(await p.$('#plan .placewall')) && !(await p.$('#plan .ghost')) && (await p.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')).rooms.find(r => r.name === '시험방 거실').windows.length)) === 2, '«취소» → 띠·초록 벽·미리보기 사라짐 · 저장 없음');
  await p.tap('#crumbRoom'); await p.waitForTimeout(300); await p.fill('#rmName', '시험방'); await p.tap('#rmSave'); await p.waitForTimeout(400);

  /* 가구 우선 보호: 위쪽 벽에 붙은 침대 — 놓는 중엔 그 자리에 콘센트, 아닐 땐 같은 자리가 침대를 고른다 */
  await tap(p, '#tabbar [data-tab="add"]'); await tap(p, '#apModal [data-ap="furn"]');
  await p.click('#afPre button:has-text("싱글 침대")'); await p.tap('#afAdd'); await p.waitForTimeout(500);
  const bedAt = await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('room-planner/3')); return s.items[s.items.length - 1]; });
  chk(bedAt.x === 0 && bedAt.y === 0, '침대가 왼쪽 위 모서리');
  await place(p, 'out', g.X(300), g.Y(0) + 12);
  r = await room(p); const oBed = r.outlets[r.outlets.length - 1];
  chk(oBed.wall === 'top' && oBed.x0 < 1000, '놓는 중: 침대 위(벽에서 12px)를 눌러도 콘센트가 위쪽 벽에');
  await tapAt(p, g.X(500), g.Y(0) + 20);
  chk(await p.isVisible('#selbar') && !(await p.isVisible('#opbar')) && (await p.textContent('#sbNm')).includes('싱글 침대'), '놓기 아닐 때 벽에서 20px 안쪽 = 침대를 고름(가구 우선)');

  /* 끌기 — 흔들리는 손가락(CDP 터치). 벽 따라서만, 끄는 동안 가구 노드는 그대로(p40) */
  r = await room(p); const d0 = r.doors[0];
  const sx = g.X(d0.x0 + d0.w / 2), sy = g.Y(0) - 8;
  await tp('touchStart', sx, sy); await tp('touchMove', sx + 2, sy + 1); await tp('touchMove', sx - 1, sy + 2); await tp('touchMove', sx - 14, sy + 3);
  await p.waitForTimeout(80);
  await p.evaluate(() => document.querySelector('#plan .fg').setAttribute('data-mark', '1'));
  for (let i = 1; i <= 10; i++) { await tp('touchMove', sx - 14 - i * 9, sy + 30 + i * 3); await p.waitForTimeout(16); }
  const kept = await p.evaluate(() => !!document.querySelector('#plan .fg[data-mark]'));
  await tp('touchEnd', 0, 0); await p.waitForTimeout(400);
  r = await room(p); const d3 = r.doors[0];
  chk(d3.wall === 'top' && d3.x0 < d0.x0 - 200, '끌기: 위쪽 벽 따라 왼쪽으로 200 넘게(아래로 끌어도 벽 그대로)');
  chk(kept, '끄는 동안 도면 통째로 안 그림(가구 노드 그대로)');
  await tp('touchStart', g.X(d3.x0 + 400), sy); for (let i = 1; i <= 8; i++) { await tp('touchMove', g.X(d3.x0 + 400) + i * 25, sy); await p.waitForTimeout(16); }   // 화면 안에서만(밖으로 나가면 서버 크롬은 손 떼기를 안 보냈다)
  await tp('touchEnd', 0, 0); await p.waitForTimeout(400);
  const d4 = (await room(p)).doors[0];
  chk(d4.x0 + d4.w === g.r.w, `벽 끝에서 멈춤 (${d4.x0}+${d4.w} = ${g.r.w})`);
  await tap(p, '#undoBtn');
  { const u = await room(p), ok1 = u.doors[0].x0 === d3.x0;     // 실패할 때만 값을 적는다(기대 출력은 그대로)
    chk(ok1, '끌기도 되돌리기 한 번' + (ok1 ? '' : ` — 처음 ${d0.x0} · 끌기1 ${d3.x0} · 끌기2 ${d4.x0} · 되돌린 뒤 ${u.doors[0].x0} · 문 ${u.doors.length} · 콘센트 ${u.outlets.map(o => o.wall + o.x0).join(',')} · 배율 ${g.k.toFixed(4)}`)); }

  /* «수정»(숫자 창) — 쉬운 말 · 거리 비우면 막힘 */
  await tapAt(p, g.X(d3.x0 + 400), sy);
  await tap(p, '#opbar [data-ob="exact"]');
  chk(await p.textContent('#opPosLbl') === '왼쪽 벽에서 거리 / 폭 — mm' && await p.textContent('#opHinge [data-hinge="start"]') === '왼쪽', '숫자 창: «왼쪽 벽에서 거리» · 매달린 쪽 «왼쪽/오른쪽»');
  await p.click('#opWall [data-wall="left"]');
  chk(await p.textContent('#opPosLbl') === '위쪽 벽에서 거리 / 폭 — mm' && await p.textContent('#opHinge [data-hinge="end"]') === '아래', '왼쪽 벽으로 바꾸면 «위쪽 벽에서» · «위/아래»');
  await p.fill('#opX', ''); await p.tap('#opSave'); await p.waitForTimeout(300);
  chk(await p.$eval('#openModal', n => n.classList.contains('open')) && (await p.textContent('#toast')).includes('위쪽 벽에서 몇 mm'), '거리를 비우면 저장 안 하고 알려 줌');
  await p.tap('#opCancel'); await p.waitForTimeout(200);

  /* 자가 감수 B — 좁은 방: 1200 창 미리보기를 짧은 벽(1000)에 댔다가 긴 벽으로 → 1200 으로 되살아남 */
  await p.tap('#crumbRoom'); await p.waitForTimeout(300); await p.fill('#rmW', '1000'); await p.tap('#rmSave'); await p.waitForTimeout(500);
  g = await geo(p);
  await tap(p, '#tabbar [data-tab="add"]'); await tap(p, '#apModal [data-ap="win"]');
  await p.touchscreen.tap(g.X(500), g.Y(0) + 3); await p.waitForTimeout(250);
  await p.touchscreen.tap(g.X(0) + 3, g.Y(1800)); await p.waitForTimeout(250);
  await tap(p, '#pbGo');
  { const ws = (await room(p)).windows, wl = ws[ws.length - 1];
    chk(wl.wall === 'left' && wl.w === 1200, '좁은 방: 짧은 벽을 지나도 미리보기 폭 1200 그대로'); }
  await tap(p, '#undoBtn'); await tap(p, '#undoBtn');

  /* 집으로 나가면 놓기 끝 */
  await tap(p, '#tabbar [data-tab="add"]'); await tap(p, '#apModal [data-ap="door"]');
  await p.tap('#goHome'); await p.waitForTimeout(400);
  chk(await p.$eval('#placeBar', n => n.hidden) && !(await p.evaluate(() => document.body.classList.contains('placing'))), '집으로 나가면 놓기 끝');
  await c.close();

  /* ── 데스크톱 ── */
  const d = await b.newContext({ viewport: { width: 1600, height: 1000 } });
  const q = await d.newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.goto(APP); await q.waitForTimeout(700); await q.click('#isPeek'); await q.waitForTimeout(1300);
  if (await q.$('#guide.open')) { await q.keyboard.press('Escape'); await q.waitForTimeout(300); }
  await q.click('#addDoorBtn'); await q.waitForTimeout(300);
  chk(!(await q.$eval('#openModal', n => n.classList.contains('open'))) && await q.isVisible('#placeBar'), '데스크톱 툴바 «문» → 놓기 띠');
  await q.keyboard.press('Escape'); await q.waitForTimeout(300);
  chk(await q.$eval('#placeBar', n => n.hidden), 'Escape → 놓기 끝');
  const n0 = await q.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')).rooms[0].doors.length);
  const qd = await q.evaluate(() => { const s = JSON.parse(localStorage.getItem('room-planner/3')).rooms[0]; const b = document.querySelector('#plan > rect').getBoundingClientRect(); return { x:b.x, y:b.y, k:b.width / s.w, d:s.d }; });
  await q.click('#addDoorBtn'); await q.waitForTimeout(300);
  await q.mouse.click(qd.x + 3, qd.y + 2500 * qd.k); await q.waitForTimeout(300);
  await q.keyboard.press('Enter'); await q.waitForTimeout(400);
  const nd = await q.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')).rooms[0].doors);
  chk(nd.length === n0 + 1 && nd[nd.length - 1].wall === 'left', '데스크톱: 클릭으로 미리보기 옮기고 Enter = 놓기');
  await q.click('#addOutBtn2'); await q.waitForTimeout(300);
  const qb = await q.evaluate(() => { const s = JSON.parse(localStorage.getItem('room-planner/3')).rooms[0]; const b = document.querySelector('#plan > rect').getBoundingClientRect(); return { x:b.x, y:b.y, k:b.width / s.w, d:s.d }; });
  await q.mouse.click(qb.x + 1000 * qb.k, qb.y + qb.d * qb.k + 6); await q.waitForTimeout(400);
  chk((await q.textContent('#selBox')).includes('콘센트') && await q.isVisible('#selBox [data-ob="del"]') && !(await q.$('#selBox [data-ob="exact"]')), '데스크톱: 클릭으로 콘센트 · 오른쪽 칸에 «삭제» 만(수정 없음)');
  await d.close();

  console.log('\npageerror :', errs.length, errs.slice(0, 3));
  console.log(ok && !errs.length ? '전부 통과' : '실패 있음');
  await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
