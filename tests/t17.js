const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html'));
  await p.click('#houseBtn'); await p.waitForTimeout(1500);
  if (await p.$('#guide.open')) { await p.click('#gClose'); await p.waitForTimeout(400); }
  await p.click('#roomList .roomcard .nm'); await p.waitForTimeout(400);
  const T = async s => (await p.textContent(s) || '').replace(/\s+/g,' ').trim();

  console.log('점수 버튼 :', await p.$eval('#scoreBtn', n => n.getAttribute('aria-pressed')));
  console.log('점수 보임 :', !!(await p.$('.scorebox')));
  await p.click('#listIn .fitem .nm:text-is("책상")'); await p.waitForTimeout(200);
  console.log('추천 패널 :', !(await p.$eval('#spotWrap', n => n.hidden)));

  await p.click('#scoreBtn'); await p.waitForTimeout(300);
  console.log('\n끈 뒤 점수 :', !!(await p.$('.scorebox')), '· 추천 패널 :', !(await p.$eval('#spotWrap', n => n.hidden)));
  console.log('끈 뒤 통로 :', (await T('#clashBox .read')).slice(0, 40));
  console.log('토스트     :', await T('#toast'));

  // 새로고침 후에도 꺼져 있나
  await p.reload(); await p.click('#houseBtn'); await p.waitForTimeout(1500);
  if (await p.$('#guide.open')) { await p.click('#gClose'); await p.waitForTimeout(400); }
  await p.click('#roomList .roomcard .nm'); await p.waitForTimeout(400);
  console.log('새로고침 후 점수 버튼 :', await p.$eval('#scoreBtn', n => n.getAttribute('aria-pressed')),
              '· 점수 보임 :', !!(await p.$('.scorebox')));
  await p.click('#scoreBtn'); await p.waitForTimeout(300);
  console.log('다시 켠 뒤 :', !!(await p.$('.scorebox')));

  // 프리셋
  await p.click('#addBtn'); await p.waitForTimeout(300);
  const chips = await p.$$eval('.prechip', ns => ns.map(n => n.textContent.replace(/\s+/g,' ').trim()));
  const grps = await p.$$eval('.pregrp', ns => ns.map(n => n.textContent));
  console.log('\n프리셋 묶음 :', grps.join(' / '), '· 개수', chips.length);
  console.log('보기 :', chips.slice(0, 4).join(' | '));
  await p.click('.prechip:has-text("퀸 침대")'); await p.waitForTimeout(150);
  console.log('퀸 침대 채움 :', await p.$eval('#afName', n => n.value),
    await p.$eval('#afW', n => n.value), await p.$eval('#afD', n => n.value),
    await p.$eval('#afH', n => n.value), '· 앞여유', await p.$eval('#afF', n => n.value));
  await p.click('#afAdd'); await p.waitForTimeout(400);
  console.log('추가 후 토스트 :', await T('#toast'));
  console.log('보관함 :', (await p.$$eval('#drawerList .fitem .nm, #drawerList *[class*=nm]', ns => ns.map(n => n.textContent))).join(','));

  console.log('\n툴바 높이 :', await p.$eval('.bar', n => Math.round(n.getBoundingClientRect().height)));
  console.log('pageerror :', errs.length ? errs : 0);
  await b.close();
})();
