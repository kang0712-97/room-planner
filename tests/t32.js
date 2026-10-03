// p32: 빈 방 통로·점수 숨김, 도면 글자 겹침 0
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const APP = 'file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html');
(async () => {
  const b = await chromium.launch(); let ok = true;
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const overlaps = p => p.evaluate(() => {
    const T = [...document.querySelectorAll('#plan text')].map(t => ({ s:t.textContent, r:t.getBoundingClientRect() })).filter(o => o.r.width > 0);
    const bad = [];
    for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++){
      const a = T[i].r, c = T[j].r;
      const w = Math.min(a.right, c.right) - Math.max(a.left, c.left), h = Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top);
      if (w > 2 && h > 2) bad.push(T[i].s + ' ⟂ ' + T[j].s);
    }
    return bad; });
  // ① 빈 방 (폰)
  let c = await b.newContext({ viewport:{ width:412, height:880 }, isMobile:true, hasTouch:true, deviceScaleFactor:2 });
  let p = await c.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(900);
  await p.fill('#isW', '2000'); await p.fill('#isD', '1500'); await p.tap('#isGo'); await p.waitForTimeout(1300); await p.locator('#plan .rg').last().tap(); await p.waitForTimeout(1500);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  console.log('[①] 빈 방 2000×1500');
  chk(await p.$$eval('#plan .walkband', e => e.length) === 0, '통로 표시 없음');
  chk((await p.textContent('#miniStat')).includes('가구를 놓으면'), '알약: ' + await p.textContent('#miniStat'));
  const box = await p.evaluate(() => document.getElementById('clashBox').innerText.replace(/\n+/g, ' | '));
  chk(!/100\s*\|\s*훌륭/.test(box) && box.includes('아직 가구가 없어요'), '상태: ' + box.slice(0, 90));
  await p.screenshot({ path:'p32_empty.png' });
  await p.tap('#tabbar [data-tab="add"]'); await p.waitForTimeout(400); await p.tap('#apModal [data-ap="furn"]'); await p.waitForTimeout(500);
  const pre = await p.$$('#afPre button'); await pre[1].tap(); await p.tap('#afAdd'); await p.waitForTimeout(800);
  chk(await p.$$eval('#plan .walkband', e => e.length) >= 1, '가구 하나 놓으면 통로 원이 나온다');
  chk(!(await p.textContent('#miniStat')).includes('가구를 놓으면'), '알약: ' + await p.textContent('#miniStat'));
  chk((await overlaps(p)).length === 0, '글자 겹침 0 (가구 1개)');
  await p.screenshot({ path:'p32_one.png' });
  await c.close();
  // ② 샘플 방, 세 화면, 책상 고른 상태
  for (const [W, H, mob] of [[360, 740, true], [1280, 900, false], [1600, 900, false]]){
    c = await b.newContext(mob ? { viewport:{ width:W, height:H }, isMobile:true, hasTouch:true, deviceScaleFactor:2 } : { viewport:{ width:W, height:H } });
    p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(800);
    await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
    if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    /* p42 — 폰은 집 화면에서 목록 시트가 저절로 안 열린다. 시트가 닫혀 있어도 isVisible 은 참이라 body 클래스로 본다 */
    if (mob && !(await p.evaluate(() => document.body.className.includes('sh-list')))) { await p.tap('#tabbar [data-tab="list"]'); await p.waitForTimeout(500); }
    await p.click('#roomList .roomcard .nm'); await p.waitForTimeout(700);
    const o1 = await overlaps(p);
    await p.click('#plan g.fg[data-uid="I_F06"]', { force:true }); await p.waitForTimeout(600);
    const o2 = await overlaps(p);
    console.log(`[②] 샘플 방 ${W}px`);
    chk(o1.length === 0, '글자 겹침 0 (선택 없음) ' + o1.join(', '));
    chk(o2.length === 0, '글자 겹침 0 (책상 선택) ' + o2.join(', '));
    const labs = await p.$$eval('#plan text', e => e.map(t => t.textContent).filter(s => /통로|사용 중/.test(s)));
    console.log('    도면 통로 글자:', labs.join(' / ') || '(자리 없어 생략 — 알약에 있음)');
    await p.screenshot({ path:`p32_sample_${W}.png` });
    await c.close();
  }
  console.log('\npageerror :', errs.length, errs, ok ? '\n전부 통과' : '\n실패 있음');
  await b.close();
})();
