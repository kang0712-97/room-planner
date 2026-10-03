// p34: 새 방 이름 · 폰 자동 키보드 · 방향키 되돌리기 묶기 · 문·창 두 줄 · 토스트 층
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const APP = 'file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html');
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  let c = await b.newContext({ viewport:{ width:1600, height:900 } }); let p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(800);
  await p.fill('#isW', '3500'); await p.fill('#isD', '3000'); await p.click('#isGo'); await p.waitForTimeout(1300); await p.locator('#plan .rg').last().click(); await p.waitForTimeout(1200);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  chk((await p.textContent('#crumbRoom')).trim() === '원룸', 'P1-6 원룸 프리셋 → 이름 «원룸»');
  await p.click('#addRoomBtn').catch(()=>{});
  await p.click('#goHome'); await p.waitForTimeout(400);
  // 샘플 방에서 방향키
  await p.click('#roomList .roomcard .nm:text-is("내 방")'); await p.waitForTimeout(500);
  await p.click('#plan g.fg[data-uid="I_F06"]', { force:true }); await p.waitForTimeout(300);
  const x0 = await p.getAttribute('#plan g.fg[data-uid="I_F06"] rect.body', 'x');
  for (let i = 0; i < 20; i++) await p.keyboard.press('ArrowUp');
  await p.waitForTimeout(700);
  const x1 = await p.getAttribute('#plan g.fg[data-uid="I_F06"] rect.body', 'y');
  await p.keyboard.press('Control+z'); await p.waitForTimeout(400);
  const y2 = await p.getAttribute('#plan g.fg[data-uid="I_F06"] rect.body', 'y');
  chk(y2 === '4300' && x1 !== '4300', `P1-8 ↑ 20번(${x1}) → 되돌리기 한 번에 4300: ${y2}`);
  const lines = await p.$$eval('#openList .opitem', e => e.map(o => [...o.querySelectorAll('.sz .l')].map(l => l.textContent)));
  chk(lines.length && lines.every(l => l.length === 2), 'P1-9 문·창 카드 두 줄: ' + JSON.stringify(lines[0]));
  const ts = await p.evaluate(() => { const s = getComputedStyle(document.getElementById('toast')); return [s.position, s.zIndex]; });
  chk(ts[0] === 'fixed' && +ts[1] > 52, 'P1-9 토스트 fixed·z ' + ts[1]);
  await p.screenshot({ path:'t34b_desk.png' });
  await c.close();
  c = await b.newContext({ viewport:{ width:360, height:740 }, isMobile:true, hasTouch:true, deviceScaleFactor:2 }); p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(800);
  await p.fill('#isW', '3000'); await p.fill('#isD', '3000'); await p.tap('#isGo'); await p.waitForTimeout(1300); await p.locator('#plan .rg').last().tap(); await p.waitForTimeout(1200);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  chk((await p.textContent('#crumbRoom')).trim() === '새 방', 'P1-6 직접 입력 → «새 방»');
  await p.tap('#tabbar [data-tab="add"]'); await p.waitForTimeout(400); await p.tap('#apModal [data-ap="furn"]'); await p.waitForTimeout(500);
  chk(await p.evaluate(() => document.activeElement.id) !== 'afName', 'P1-7 폰: 가구 추가 창에 자동 커서 없음');
  await p.tap('#afCancel'); await p.waitForTimeout(300);
  await p.screenshot({ path:'t34b_phone.png' });
  console.log('\npageerror :', errs.length, errs, ok ? '\n전부 통과' : '\n실패 있음');
  await b.close();
})();
