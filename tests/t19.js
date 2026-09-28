const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
                              isMobile: true, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const T = async s => (await p.textContent(s) || '').replace(/\s+/g,' ').trim();
  const box = async s => await p.$eval(s, n => { const r = n.getBoundingClientRect();
    return { x:Math.round(r.x), y:Math.round(r.y), w:Math.round(r.width), h:Math.round(r.height) }; });

  await p.goto('file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html'));
  await p.waitForTimeout(600);
  console.log('== 첫 화면 (폰) ==');
  console.log('입력 줄 보임 :', !(await p.$eval('#introStart', n => n.hidden)));
  await p.click('#isPeek'); await p.waitForTimeout(1000);
  if (await p.$('#guide.open')) { await p.click('#gClose'); await p.waitForTimeout(400); }

  console.log('\n== 방 화면 골격 ==');
  console.log('상단 바 :', JSON.stringify(await box('.bar')));
  console.log('도면    :', JSON.stringify(await box('#stage')));
  console.log('탭 바   :', JSON.stringify(await box('#tabbar')));
  const tabs = await p.$$eval('#tabbar button', ns => ns.map(n => n.textContent.trim() + ' ' + Math.round(n.getBoundingClientRect().height)));
  console.log('탭      :', tabs.join(' | '));
  console.log('도면이 화면의 :', Math.round((await box('#stage')).h / 844 * 100) + '%');
  console.log('가로 스크롤 :', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));

  console.log('\n== 시트 ==');
  for (const [t, sel] of [['stat','.side.r'], ['list','.side.l'], ['more','.bar .tools#roomTools']]) {
    await p.click(`#tabbar [data-tab="${t}"]`); await p.waitForTimeout(320);
    const r = await box(sel === '.bar .tools#roomTools' ? '.bar' : sel);
    console.log(`${t.padEnd(5)} 열림 y=${r.y} h=${r.h} · 화면 안 : ${r.y < 844 && r.y > 0}`);
  }
  await p.click('#tabbar [data-tab="more"]'); await p.waitForTimeout(320);
  console.log('토글로 닫힘 :', !(await p.evaluate(() => document.body.className.includes('sh-'))));

  console.log('\n== 고른 가구 줄 ==');
  console.log('선택 전 :', await p.$eval('#selbar', n => getComputedStyle(n).display));
  await p.click('#tabbar [data-tab="list"]'); await p.waitForTimeout(320);
  await p.click('#listIn .fitem .nm:text-is("책상")'); await p.waitForTimeout(400);
  console.log('고르면 시트가 닫히나 :', !(await p.evaluate(() => document.body.className.includes('sh-'))));
  console.log('선택 후 :', await p.$eval('#selbar', n => getComputedStyle(n).display),
              '·', await T('#sbNm'), '·', await T('#sbSz'));
  console.log('줄 높이 :', await p.$eval('#selbar', n => Math.round(n.getBoundingClientRect().height)) + 'px',
              '(밀기 줄은 78px 이었다)');
  console.log('버튼 크기 :', await p.$$eval('#selbar .sb-act', ns => ns.map(n => { const r = n.getBoundingClientRect(); return Math.round(r.width)+'×'+Math.round(r.height); }).join(' ')));

  /* 회전 → 보관 → 목록에서 다시 꺼내기까지 한 바퀴 */
  await p.click('#selbar [data-sb="edit"]'); await p.waitForTimeout(400); await p.click('#afRot'); await p.waitForTimeout(400);
  console.log('회전 :', await T('#toast'), '·', await T('#sbSz'));
  await p.click('#selbar [data-sb="edit"]'); await p.waitForTimeout(400); await p.click('#afStore'); await p.waitForTimeout(500);
  console.log('보관 :', await T('#toast'));
  await p.click('#tabbar [data-tab="list"]'); await p.waitForTimeout(400);
  console.log('목록 머리 :', await T('#cntIn'));
  console.log('칸막이 :', await T('.fsep'));
  console.log('보관 행 :', await p.$$eval('.fitem.stored .nm', ns => ns.map(n => n.textContent).join(',')));
  await p.click('.fitem.stored [data-act="take"]'); await p.waitForTimeout(500);
  console.log('꺼내기 :', await T('#toast'), '· 보관 행 남았나 :', !!(await p.$('.fitem.stored')));

  console.log('되돌리기 버튼 폰에서도 보임(줌 % 옆으로 이동) :',
    await p.$eval('#undoBtn', n => getComputedStyle(n).display !== 'none'));

  // 핀치 줌
  const z0 = await T('#zLabel');
  await p.touchscreen.tap(195, 400);
  console.log('배율 :', z0);

  console.log('\n== 32px 미만 표적 ==');
  console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('button,[data-act],summary')]
    .map(n => { const r = n.getBoundingClientRect();
      return { id: n.id || (n.getAttribute&&n.getAttribute('data-act')) || n.className || n.tagName, w:Math.round(r.width), h:Math.round(r.height) }; })
    .filter(o => o.w > 0 && (o.w < 32 || o.h < 32)))));
  await p.screenshot({ path: 'v19_phone.png' });
  console.log('pageerror :', errs.length ? errs : 0);
  await b.close();
})();
