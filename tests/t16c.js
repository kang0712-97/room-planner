const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
(async () => {
  const b = await chromium.launch();
  const errs = [];
  for (const W of [1600, 1440, 1180]) {
    const p = await b.newPage({ viewport: { width: W, height: 950 } });
    p.on('pageerror', e => errs.push(W + ': ' + e));
    await p.goto('file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html'));
    await p.click('#houseBtn'); await p.waitForTimeout(1500);
  if (await p.$('#guide.open')) { await p.click('#gClose'); await p.waitForTimeout(400); }
    await p.click('#roomList .roomcard .nm'); await p.waitForTimeout(300);
    console.log(`툴바 ${W}px :`, await p.$eval('.bar', n => Math.round(n.getBoundingClientRect().height)), 'px');
    if (W === 1600) {
      // 8. 도면 없을 때 축척·자동인식·직접그리기 숨김
      const hid = await p.$$eval('#scaleBtn, #autoBtn, #traceBtn',
        ns => ns.map(n => n.id + '=' + (getComputedStyle(n).display === 'none')));
      console.log('도면 버튼 숨김 :', hid.length ? hid : '(id 다름)');
      // 4. 문 사분원이 방 안
      console.log('문 사분원 path :', await p.$$eval('#plan path[d^="M "]', n => n.length));
      // 새 기능 텍스트
      await p.click('#listIn .fitem .nm:text-is("독서실책상")'); await p.waitForTimeout(150);
      await p.click('#spotGo'); await p.waitForSelector('.spotcard', { timeout: 15000 });
      await p.waitForTimeout(100);
      console.log('근거 줄 :', (await p.$eval('.spot-r i', n => n.textContent)).trim());
    }
    await p.close();
  }
  console.log('pageerror :', errs.length ? errs : 0);
  await b.close();
})();
