/* ⚠️ 이 테스트가 있는 이유.
   Playwright 의 click() 과 touchscreen.tap() 은 down 과 up 사이에 move 가 «없다».
   진짜 손가락은 반드시 몇 px 흔들린다. 그 차이 하나 때문에
   「폰에서 방에 안 들어가짐」 이 테스트 10벌을 전부 통과하고도 살아남았다.
   그래서 여기서는 CDP 로 touchStart → touchMove → touchEnd 를 직접 쏜다. */
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 },
                                   deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const cdp = await ctx.newCDPSession(p);

  const touch = (pts, type) =>
    cdp.send('Input.dispatchTouchEvent', {
      type, touchPoints: pts.map((q, i) => ({ x: q.x, y: q.y, id: i, radiusX: 12, radiusY: 12 })) });

  /* 손가락 하나로 «탭» — 흔들림 포함 */
  const tapJitter = async (x, y, jit = 3) => {
    await touch([{ x, y }], 'touchStart');       await p.waitForTimeout(30);
    await touch([{ x: x + jit, y: y + jit }], 'touchMove');   // ← 여기가 핵심
    await p.waitForTimeout(20);
    await touch([{ x: x + jit, y: y + jit }], 'touchEnd');    await p.waitForTimeout(400);
  };
  /* 손가락 하나로 «끌기» */
  const dragBy = async (x, y, ddx, ddy, n = 8) => {
    await touch([{ x, y }], 'touchStart'); await p.waitForTimeout(30);
    for (let i = 1; i <= n; i++) {
      await touch([{ x: x + ddx * i / n, y: y + ddy * i / n }], 'touchMove');
      await p.waitForTimeout(25);
    }
    await touch([{ x: x + ddx, y: y + ddy }], 'touchEnd'); await p.waitForTimeout(400);
  };
  /* 손가락 둘로 벌리기 */
  const pinchOut = async (cx, cy) => {
    let d = 40;
    await touch([{ x: cx - d, y: cy }, { x: cx + d, y: cy }], 'touchStart');
    await p.waitForTimeout(40);
    for (d = 55; d <= 145; d += 18) {
      await touch([{ x: cx - d, y: cy }, { x: cx + d, y: cy }], 'touchMove');
      await p.waitForTimeout(35);
    }
    await touch([{ x: cx - d, y: cy }, { x: cx + d, y: cy }], 'touchEnd');
    await p.waitForTimeout(250);
  };

  const vb = () => p.$eval('#plan', n => n.getAttribute('viewBox'));
  const vbw = async () => Number((await vb()).split(/\s+/)[2]);
  const undoOff = () => p.$eval('#undoBtn', n => n.disabled);
  const T = async s => (await p.textContent(s) || '').replace(/\s+/g, ' ').trim();
  /* 없어졌을 수도 있는 것을 읽을 때 — textContent 는 없으면 30초 기다린다 */
  const T0 = async s => { const h = await p.$(s); return h ? (await h.textContent()).trim() : ''; };
  const ok = (c, y, n) => console.log(' ', c ? '✓ ' + y : '❌ ' + n);

  /* 가구도 방도 없는 «맨 바닥» 한 점을 찾는다 — 눈이 아니라 elementFromPoint 로. */
  const emptySpot = () => p.evaluate(() => {
    const r = document.getElementById('stage').getBoundingClientRect();
    for (let y = r.top + 8; y < r.bottom - 8; y += 11)
      for (let x = r.left + 8; x < r.right - 8; x += 11) {
        const e = document.elementFromPoint(x, y);
        if (!e || !e.closest) continue;
        if (e.closest('.fg') || e.closest('.rg') || e.closest('.cand')) continue;
        if (!e.closest('#plan')) continue;
        /* p47: 도면 위에 뜬 단추(줄자 등) 옆은 피한다 — 손가락 탭은 반경 12px 안의 단추로 빨려 들어간다 */
        if ([[-20, -20], [20, -20], [-20, 20], [20, 20]].some(([dx, dy]) => { const q = document.elementFromPoint(x + dx, y + dy);
          return q && !q.closest('#plan'); })) continue;
        return { x, y };
      }
    return null;
  });

  await p.goto('file://' + (process.env.APP22 || process.env.APP || (process.env.WORK || '/home/claude/work') + '/app22.html'));
  await p.waitForTimeout(800);
  console.log('판 번호 :', await T('#introVer'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(1500);
  if (await p.$('#guide.open')) { await p.click('#gClose'); await p.waitForTimeout(400); }
  await p.waitForTimeout(300);

  /* ── ① 두 손가락 확대 ─────────────────────────────── */
  console.log('\n[①] 두 손가락 확대');
  const st = await p.$eval('#stage', n => { const r = n.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; });
  const z0 = await vbw();
  await pinchOut(st.cx, st.cy);
  const z1 = await vbw();
  ok(z1 < z0 - 1, `viewBox ${z0.toFixed(0)} → ${z1.toFixed(0)} — 커졌다`, '확대가 안 된다');

  /* ── ② 도면의 방을 «흔들리는 손가락» 으로 탭 ─────── */
  console.log('\n[②] 흔들리는 손가락으로 방 탭');
  const rb = await p.locator('.rg').first().boundingBox();
  await tapJitter(rb.x + rb.width / 2, rb.y + rb.height / 2, 3);
  const nm = await p.$eval('#crumbRoom', n => !n.hidden && n.textContent.trim());
  ok(!!nm, `방에 들어감 → ${nm}`, '못 들어감');
  ok(await undoOff(), '탭은 기록으로 남지 않는다', '탭이 «방 옮김» 으로 기록됐다');

  /* ── ③ 방 안 맨 바닥 — 탭이면 «고르기 풀기», 끌면 «대지 밀기» ──
     p23 에서 되살렸다. 폰에서도 한 손가락으로 민다 — 탭과 헷갈리던 건 SLOP 이 막는다. */
  console.log('\n[③] 빈 바닥 — 탭과 끌기가 갈리는가');
  const es = await emptySpot();
  if (!es) console.log('  (빈 바닥을 못 찾음 — 건너뜀)');
  else {
    const v0 = await vb();
    await tapJitter(es.x, es.y, 3);
    ok((await vb()) === v0, '흔들며 탭해도 화면이 안 움직인다', '탭인데 화면이 밀렸다');

    await dragBy(es.x, es.y, 84, 54);
    ok((await vb()) !== v0, '끌면 대지가 따라온다', '한 손으로 대지가 안 밀린다');
    ok(await undoOff(), '밀기는 기록으로 안 남는다', '대지 밀기가 기록됐다');
  }

  /* ── ④ 가구를 흔들며 탭 → 고르기만, 이동 아님 ──────
     ⚠️ «첫 번째 .fg» 로 재면 안 된다. 고르면 그리는 차례가 바뀌어 다른 가구를 재게 된다. */
  console.log('\n[④] 흔들리는 손가락으로 가구 탭');
  const uid = await p.$eval('.fg', n => n.getAttribute('data-uid'));
  /* 자리는 g 의 transform 이 아니라 «안쪽 rect 의 x·y» 에 적혀 있다 — 거기를 읽어야 한다. */
  const at = () => p.$eval(`.fg[data-uid="${uid}"] rect.body`,
                           n => n.getAttribute('x') + ',' + n.getAttribute('y'));
  const box = () => p.locator(`.fg[data-uid="${uid}"]`).boundingBox();
  let fb = await box();
  const before = await at();
  await tapJitter(fb.x + fb.width / 2, fb.y + fb.height / 2, 4);
  console.log('  고른 가구 :', await T('#selBox .read-h span') || '(없음)');
  ok((await at()) === before, '가구가 안 밀렸다', '탭만 했는데 밀렸다');
  ok(await undoOff(), '탭은 기록으로 남지 않는다', '탭이 «가구 옮김» 으로 기록됐다');

  /* 고른 채로 대지를 밀어도 선택이 살아 있어야 한다 — 보던 가구를 놓치면 안 된다 */
  const es2 = await emptySpot();
  if (es2) {
    await dragBy(es2.x, es2.y, -70, -46);
    ok(!!(await T0('#selBox .read-h span')), '밀어도 선택이 살아 있다', '밀었더니 선택이 풀렸다');
    await tapJitter(es2.x, es2.y, 3);
    ok(!(await T0('#selBox .read-h span')), '빈 곳을 탭하면 선택이 풀린다', '탭해도 안 풀린다');
  }

  /* ── ⑤ 진짜로 끌면 움직여야 한다 (문턱이 너무 높지 않은지)
     방 «안쪽» 으로 끈다 — 벽에 붙은 가구를 벽 쪽으로 밀면 잘려서 안 움직인 것처럼 보인다. */
  console.log('\n[⑤] 진짜로 끌기 (문턱이 너무 높지 않은지)');
  await p.waitForTimeout(500);            // 두 번 누름(회전)으로 세어지지 않게 띄운다
  fb = await box();
  await dragBy(fb.x + fb.width / 2, fb.y + fb.height / 2, 0, 72);
  console.log('  자리 :', before, '→', await at());
  ok((await at()) !== before, '72px 끌었더니 움직였다', '문턱이 너무 높다');
  ok(!(await undoOff()), '되돌릴 수 있다', '기록이 안 남았다');

  /* ── ⑥ 집으로 나갔다가 흔들며 다시 들어가기 ──────── */
  console.log('\n[⑥] 집 → 방 재입장');
  await p.click('#goHome');
  await p.waitForTimeout(600);
  const rb2 = await p.locator('.rg').first().boundingBox();
  await tapJitter(rb2.x + rb2.width / 2, rb2.y + rb2.height / 2, 6);
  const nm2 = await p.$eval('#crumbRoom', n => !n.hidden && n.textContent.trim());
  ok(!!nm2, `다시 들어감 → ${nm2}`, '재입장 실패');

  console.log('\npageerror :', errs.length ? errs : 0);
  await b.close();
})();
