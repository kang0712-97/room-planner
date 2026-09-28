// p42: 폰 — 처음 열 때·집 전체로 나올 때 방 목록 시트를 저절로 열지 않는다
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const APP = 'file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html');
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  const sheets = () => p.$eval('body', n => [...n.classList].filter(k => k.startsWith('sh-')).join(',') || '없음');
  await p.goto(APP); await p.waitForTimeout(900);
  const ver = await p.$eval('#introVer', n => n.textContent);
  chk(+(ver.match(/p(\d+)/) || [0, 0])[1] >= 42, '판 번호 p42 이상 (' + ver + ')');
  chk(await sheets() === '없음', '처음 열었을 때(인트로 뒤) 열린 시트 없음');
  await p.click('#isPeek'); await p.waitForTimeout(1500);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  await p.tap('#tabbar [data-tab="more"]'); await p.waitForTimeout(400);
  chk((await sheets()).includes('sh-more'), '방에서 «도구» 시트 열림');
  await p.click('#goHome'); await p.waitForTimeout(700);
  const s = await sheets();
  chk(s === '없음', '집 전체로 나오면 방 목록도 도구 시트도 안 열림 (' + s + ')');
  const rb = await p.locator('.rg').first().boundingBox();
  const hit = await p.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return !!(e && e.closest('.rg')); },
    { x: rb.x + rb.width / 2, y: rb.y + rb.height / 2 });
  chk(hit, '집 도면의 방이 가려지지 않고 바로 눌림');
  await p.tap('#tabbar [data-tab="list"]'); await p.waitForTimeout(400);
  chk((await sheets()).includes('sh-list') && await p.$$eval('#roomList .roomcard', a => a.length) > 0, '«목록» 탭으로 방 목록은 그대로 열림');
  await p.click('#roomList .roomcard .nm'); await p.waitForTimeout(600);
  chk(await p.$eval('#crumbRoom', n => !n.hidden), '목록에서 방 눌러 들어감');
  console.log('\npageerror :', errs.length, errs.slice(0, 3));
  console.log(ok && !errs.length ? '전부 통과' : '실패 있음');
  await b.close(); process.exit(ok && !errs.length ? 0 : 1);
})();
