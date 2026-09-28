const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const T = async s => (await p.textContent(s) || '').replace(/\s+/g,' ').trim();
  await p.goto('file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html'));
  await p.click('#houseBtn'); await p.waitForTimeout(1500);
  if (await p.$('#guide.open')) { await p.click('#gClose'); await p.waitForTimeout(400); }
  await p.click('#roomList .roomcard .nm'); await p.waitForTimeout(500);

  console.log('목록 도구 :', await p.$$eval('#listIn .fitem:first-child .ftools i',
    ns => ns.map(n => n.getAttribute('data-act') + '/' + (n.querySelector('use')||{getAttribute:()=>'?'}).getAttribute('href'))));
  console.log('삭제 버튼이 목록에 남았나 :', !!(await p.$('#listIn [data-act="del"]')));
  console.log('문·창문 기본 펼침 :', await p.$eval('#openFold', n => n.open));
  console.log('개구부 수정 버튼 :', await p.locator('#openList .opitem').first().locator('[data-act="edit"]').isVisible());

  console.log('\n회전 버튼(선택 전) disabled :', await p.$eval('#rotBtn', n => n.disabled));
  await p.click('#listIn .fitem .nm:text-is("책상")'); await p.waitForTimeout(300);
  console.log('회전 버튼(선택 후) disabled :', await p.$eval('#rotBtn', n => n.disabled));
  console.log('선택 패널 버튼 :', await p.$$eval('#selBox .selacts .btn', ns => ns.map(n => n.textContent.trim())));

  // 잠금 토글 (아이콘 클릭 → closest 로 잡히는지)
  await p.click('#listIn .fitem:first-child [data-act="lock"] svg'); await p.waitForTimeout(350);
  console.log('\nSVG 를 눌러도 잠금 동작 :', await T('#toast'));
  console.log('잠금 아이콘 바뀜 :', await p.$eval('#listIn .fitem:first-child [data-act="lock"] use', n => n.getAttribute('href')));
  await p.click('#listIn .fitem:first-child [data-act="lock"] svg'); await p.waitForTimeout(350);
  console.log('풀기 :', await T('#toast'));

  // 보관함으로 빼기
  await p.click('#listIn .fitem:first-child [data-act="move"] svg'); await p.waitForTimeout(400);
  console.log('보관함 :', await T('#toast'));
  await p.click('#undoBtn'); await p.waitForTimeout(400);

  // 선택 패널 삭제
  await p.click('#listIn .fitem .nm:text-is("선반")'); await p.waitForTimeout(250);
  await p.click('#selDel'); await p.waitForTimeout(400);
  console.log('\n삭제 확인창 :', await T('#confirmModal h2'), '/', (await T('#confirmModal p')).slice(0,40));
  await p.click('#cfCancel').catch(async () => { await p.keyboard.press('Escape'); });
  await p.waitForTimeout(300);

  const small = await p.evaluate(() => [...document.querySelectorAll('button,[data-act],summary')]
    .map(n => { const r = n.getBoundingClientRect();
      return { id: n.id || (n.getAttribute&&n.getAttribute('data-act')) || n.tagName, w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter(o => o.w > 0 && (o.w < 32 || o.h < 32)));
  console.log('\n32px 미만 :', JSON.stringify(small));
  console.log('툴바 :', await p.$eval('.bar', n => Math.round(n.getBoundingClientRect().height)));
  console.log('pageerror :', errs.length ? errs : 0);
  await b.close();
})();
