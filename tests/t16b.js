const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));

  await p.goto('file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html'));
  await p.click('#houseBtn'); await p.waitForTimeout(1500);
  if (await p.$('#guide.open')) { await p.click('#gClose'); await p.waitForTimeout(400); }
  await p.click('#roomList .roomcard .nm'); await p.waitForTimeout(400);
  const T = async s => (await p.textContent(s) || '').replace(/\s+/g, ' ').trim();

  // 개선폭이 가장 큰 가구로 전 과정을 밟는다
  await p.click('#listIn .fitem .nm:text-is("독서실책상")');
  await p.waitForTimeout(200);
  await p.click('#spotGo');
  await p.waitForSelector('.spotcard', { timeout: 15000 });
  await p.waitForTimeout(120);

  console.log('헤더     :', await T('.spot-h'));
  const cards = await p.$$eval('.spotcard', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));
  cards.forEach((c, i) => console.log(`카드${i + 1}   : ${c}`));
  console.log('버린자리 :', await T('.spot-drop'));
  console.log('고스트 사각형 :', await p.$$eval('.spots rect', n => n.length),
              '· 번호 :', await p.$$eval('.spots text', ns => ns.map(n => n.textContent).join(',')));
  console.log('1번만 실선 :',
    await p.$$eval('.spots rect', ns => ns.map(n => n.getAttribute('stroke-dasharray'))));

  if (cards.length > 1) {
    await p.click('.spotcard:nth-of-type(2)');
    await p.waitForTimeout(200);
    console.log('2번 클릭 후 on :', await p.$$eval('.spotcard', ns => ns.map(n => n.classList.contains('on'))));
    await p.click('.spotcard:nth-of-type(1)');
    await p.waitForTimeout(200);
  }

  const before = await T('.score-h');
  const xy0 = await T('#selBox dl');
  await p.click('.spotcard.on .btn.go');
  await p.waitForTimeout(500);
  console.log('\n적용 전 점수 :', before);
  console.log('적용 후 점수 :', await T('.score-h'));
  console.log('제안 사라짐  :', !(await p.$('.spotcard')), '· 고스트 남았나 :', !!(await p.$('.spots')));
  console.log('감점 1위     :', await T('.lostlist dt'), await T('.lostlist dd'));

  await p.click('#undoBtn'); await p.waitForTimeout(500);
  console.log('되돌린 점수  :', await T('.score-h'), '· 좌표 복구 :', (await T('#selBox dl')) === xy0);

  // 잠금 — 제안이 무효가 되는지
  await p.click('#spotGo'); await p.waitForSelector('.spotcard', { timeout: 15000 });
  await p.waitForTimeout(120);
  await p.click('#listIn .fitem .nm:text-is("독서실책상")');
  await p.waitForTimeout(100);
  const lock = await p.$$('#listIn .fitem');
  for (const el of lock) {
    const nm = await el.$eval('.nm', n => n.textContent);
    if (nm === '독서실책상') { await el.$eval('[data-act="lock"]', n => n.click()); break; }
  }
  await p.waitForTimeout(400);
  console.log('\n잠근 뒤 spotBox :', await T('#spotBox'));
  console.log('«이 자리로» 버튼 남았나 :', !!(await p.$('.spotcard .btn.go')));

  console.log('\npageerror :', errs.length ? errs : 0);
  await b.close();
})();
