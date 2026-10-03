const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

  await p.goto('file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html'));
  await p.keyboard.press('Escape');                 // 인트로부터 닫는다(p57 — Esc)
  await p.waitForTimeout(1500);
  if (await p.$('#guide.open')) { await p.click('#gClose'); await p.waitForTimeout(400); }
  await p.click('#roomList .roomcard .nm'); // 방으로 들어간다
  await p.waitForTimeout(400);

  const T = async (s) => (await p.textContent(s) || '').replace(/\s+/g, ' ').trim();

  console.log('== 회귀 ==');
  console.log('점수블록 :', await T('.score-h'));
  console.log('첫 감점  :', await T('.lostlist dt'), '/', await T('.lostlist dd'));
  console.log('상태     :', (await T('#clashBox')).slice(0, 0) || '');
  const reads = await p.$$eval('#clashBox .read', ns => ns.map(n => n.textContent.replace(/\s+/g,' ').trim()));
  reads.forEach(r => console.log('  read  :', r));
  console.log('툴바높이 :', await p.$eval('.bar', n => Math.round(n.getBoundingClientRect().height)));

  console.log('\n== 새 기능 ==');
  console.log('선택 전 spotWrap hidden :', await p.$eval('#spotWrap', n => n.hidden));

  // 첫 가구 선택
  await p.click('#listIn .fitem:first-child .nm');
  await p.waitForTimeout(200);
  console.log('선택 후 spotWrap hidden :', await p.$eval('#spotWrap', n => n.hidden));
  console.log('선택 가구 :', await T('#selBox .read-h span'));
  console.log('버튼 있나 :', !!(await p.$('#spotGo')));

  const t0 = Date.now();
  await p.click('#spotGo');
  await p.waitForSelector('.spotcard, .spot-none', { timeout: 15000 });
  await p.waitForTimeout(150);
  console.log('탐색 시간 :', Date.now() - t0, 'ms (대기 포함)');
  console.log('헤더     :', await T('.spot-h'));

  const cards = await p.$$eval('.spotcard', ns => ns.map(n => n.textContent.replace(/\s+/g,' ').trim()));
  cards.forEach((c, i) => console.log(`  카드${i+1} : ${c}`));
  if (!cards.length) console.log('  없음   :', await T('.spot-none'));
  console.log('버린자리 :', await T('.spot-drop'));
  console.log('고스트 수 :', await p.$$eval('.spots rect', n => n.length));

  if (cards.length) {
    const before = await T('.score-h');
    await p.click('.spotcard:nth-of-type(2)').catch(() => {});
    await p.waitForTimeout(150);
    console.log('2번 선택 후 강조 :', await p.$$eval('.spotcard', ns => ns.map(n => n.classList.contains('on'))));

    await p.click('.spotcard.on .btn.go');
    await p.waitForTimeout(400);
    console.log('적용 전 점수 :', before);
    console.log('적용 후 점수 :', await T('.score-h'));
    console.log('제안 사라짐  :', !(await p.$('.spotcard')));
    console.log('되돌리기 가능:', !(await p.$eval('#undoBtn', n => n.disabled)));
    await p.click('#undoBtn');
    await p.waitForTimeout(400);
    console.log('되돌린 점수  :', await T('.score-h'));
  }

  // 잠금 존중 — 목록의 자물쇠 버튼으로 (앱이 IIFE 라 DOM 으로만 만진다)
  await p.click('#listIn .fitem:first-child [data-act="lock"]'); await p.waitForTimeout(300);
  console.log('\n잠금 시 문구 :', await T('#spotBox'));
  await p.click('#listIn .fitem:first-child [data-act="lock"]'); await p.waitForTimeout(300);

  // 작은 가구로도 한 번 — 큰 가구는 갈 데가 원래 적다
  const names = await p.$$eval('#listIn .fitem .nm', ns => ns.map(n => n.textContent));
  console.log('\n== 가구별 ==');
  for (const nm of names) {
    await p.click(`#listIn .fitem .nm:text-is("${nm}")`).catch(() => {});
    await p.waitForTimeout(150);
    if (!(await p.$('#spotGo'))) { console.log(nm, ': (버튼 없음)'); continue; }
    await p.click('#spotGo');
    await p.waitForSelector('.spotcard, .spot-none', { timeout: 15000 });
    await p.waitForTimeout(80);
    const hd = await T('.spot-h');
    const cs = await p.$$eval('.spotcard .spot-t', ns => ns.map(n => n.textContent.replace(/\s+/g,' ').trim()));
    console.log(`${nm.padEnd(8)} ${hd}  →  ${cs.length ? cs.join(' | ') : (await T('.spot-none')).slice(0, 46)}`);
  }

  // 비교 모달 localStorage 불변 (회귀 7)
  const snap1 = await p.evaluate(() => localStorage.getItem('room-planner/3'));
  await p.click('#cmpBtn');
  await p.waitForTimeout(500);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  const snap2 = await p.evaluate(() => localStorage.getItem('room-planner/3'));
  console.log('\n비교 모달 후 스냅샷 동일 :', snap1 === snap2);

  console.log('pageerror :', errs.length ? errs : 0);
  await b.close();
})();
