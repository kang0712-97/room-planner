const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const T = async s => (await p.textContent(s) || '').replace(/\s+/g,' ').trim();
  await p.goto('file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html'));
  await p.click('#houseBtn'); await p.waitForTimeout(1500);
  console.log('첫 방문 가이드 자동 :', await p.$eval('#guide', n => n.classList.contains('open')));
  console.log('1단계 :', await T('#gTitle'), '|', await T('#gNum'));
  console.log('그림 로드 :', await p.$eval('#gImg', n => n.complete && n.naturalWidth > 0), await p.$eval('#gImg', n => n.naturalWidth+'x'+n.naturalHeight));
  console.log('이전 비활성 :', await p.$eval('#gPrev', n => n.disabled));
  for (let i = 0; i < 10; i++) { await p.click('#gNext'); await p.waitForTimeout(120); }
  console.log('마지막 :', await T('#gTitle'), '|', await T('#gNum'), '| 버튼', await T('#gNext'));
  console.log('마지막 그림 :', await p.$eval('#gImg', n => n.naturalWidth+'x'+n.naturalHeight));
  await p.click('#gNext'); await p.waitForTimeout(300);
  console.log('닫힘 :', !(await p.$eval('#guide', n => n.classList.contains('open'))));

  await p.reload(); await p.click('#houseBtn'); await p.waitForTimeout(1500);
  console.log('두 번째 방문 자동 :', await p.$eval('#guide', n => n.classList.contains('open')));
  await p.click('#roomList .roomcard .nm'); await p.waitForTimeout(400);
  await p.click('#helpBtn'); await p.waitForTimeout(400);
  console.log('사용법 버튼으로 열림 :', await p.$eval('#guide', n => n.classList.contains('open')), '|', await T('#gTitle'));
  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(150);
  console.log('→ 키 :', await T('#gNum'));
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  console.log('Esc 닫힘 :', !(await p.$eval('#guide', n => n.classList.contains('open'))));

  // 추천 카드 줄바꿈 확인
  await p.click('#listIn .fitem .nm:text-is("독서실책상")'); await p.waitForTimeout(200);
  await p.click('#spotGo'); await p.waitForSelector('.spotcard'); await p.waitForTimeout(300);
  await p.locator('#spotBox').scrollIntoViewIfNeeded();
  await p.locator('#spotBox').screenshot({ path: 'spotcard.png' });
  console.log('\n툴바 :', await p.$eval('.bar', n => Math.round(n.getBoundingClientRect().height)));
  console.log('pageerror :', errs.length ? errs : 0);
  await b.close();
})();
