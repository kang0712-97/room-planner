const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const T = async s => (await p.textContent(s) || '').replace(/\s+/g,' ').trim();
  await p.goto('file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html'));
  await p.waitForTimeout(600);

  // ① 방 만들고 → 집으로 → 다시 방으로 들어가지는가
  await p.click('#isPre .prechip:has-text("원룸")'); await p.waitForTimeout(120);
  await p.click('#isGo'); await p.waitForTimeout(1000);
  console.log('방 만들고 바로 입장 :', await T('#crumbRoom'));
  console.log('시트 닫혔나 :', !(await p.evaluate(() => document.body.className.includes('sh-'))));
  console.log('토스트 :', await T('#toast'), '· 높이', await p.$eval('#toast', n => Math.round(n.getBoundingClientRect().height)),
              '· 폭', await p.$eval('#toast', n => Math.round(n.getBoundingClientRect().width)));

  await p.click('#goHome'); await p.waitForTimeout(700);
  /* p42 — 집으로 나와도 방 목록 시트가 저절로 열리지 않는다(사용자 요청) → «목록» 탭으로 연다 */
  if (!(await p.evaluate(() => document.body.className.includes('sh-list')))) { await p.click('#tabbar [data-tab="list"]'); await p.waitForTimeout(400); }
  console.log('\n집으로 → 방 목록 시트 자동 :', await p.evaluate(() => document.body.className));
  console.log('탭 이름 :', await p.$$eval('#tabbar button', ns => ns.map(n => n.textContent.trim()).join(' | ')));
  const cards = await p.$$eval('#roomList .roomcard', ns => ns.map(n => {
    const r = n.getBoundingClientRect(); return n.querySelector('.nm').textContent + ' y=' + Math.round(r.y) + ' vis=' + (r.y > 0 && r.y < 844); }));
  console.log('방 카드 :', cards);
  await p.click('#roomList .roomcard .nm:text-is("내 방")'); await p.waitForTimeout(800);
  console.log('카드 눌러 입장 :', await T('#crumbRoom'), '· 시트 닫힘 :', !(await p.evaluate(() => document.body.className.includes('sh-'))));

  // ② 상태 시트 — 집 화면에서도 내용이 있는가
  await p.click('#goHome'); await p.waitForTimeout(600);
  await p.click('#tabbar [data-tab="stat"]'); await p.waitForTimeout(400);
  console.log('\n집 화면 상태 시트 :', (await T('#clashBox')).slice(0, 60));
  await p.click('#tabbar [data-tab="list"]'); await p.waitForTimeout(300);
  await p.click('#roomList .roomcard .nm:text-is("내 방")'); await p.waitForTimeout(800);
  await p.click('#tabbar [data-tab="stat"]'); await p.waitForTimeout(400);
  console.log('방 화면 상태 시트 :', (await T('#clashBox')).slice(0, 40));
  await p.click('#tabbar [data-tab="stat"]'); await p.waitForTimeout(300);

  // ③ 한 손가락 팬 — 전체 보기에서는 안 움직인다
  const vb = async () => await p.$eval('#plan', n => n.getAttribute('viewBox'));
  const v0 = await vb();
  await p.touchscreen.tap(200, 300);
  await p.mouse.move(200, 300); await p.mouse.down(); await p.mouse.move(120, 500, { steps: 8 }); await p.mouse.up();
  await p.waitForTimeout(300);
  console.log('\n전체 보기에서 끌기 → viewBox 그대로 :', v0 === await vb());
  console.log('배율 :', await T('#zLabel'));
  await p.screenshot({ path: 'v19b.png' });
  console.log('pageerror :', errs.length ? errs : 0);
  await b.close();
})();
