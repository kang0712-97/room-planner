const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
(async () => {
  const b = await chromium.launch();
  const T = async (p, s) => (await p.textContent(s) || '').replace(/\s+/g,' ').trim();

  // ① 처음 온 사람 — localStorage 비어 있음
  let p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html'));
  await p.waitForTimeout(400);
  console.log('== 처음 온 사람 ==');
  console.log('제목  :', await T(p, '.intro-title'));
  console.log('입력줄 보임 :', !(await p.$eval('#introStart', n => n.hidden)));
  await p.mouse.click(10, 10); await p.waitForTimeout(100);      // p57 — 빈 곳을 누르면 끝 장면
  console.log('끝 장면 :', await T(p, '#introScene .count'), '×', await T(p, '#introScene .dlt'), '·', await T(p, '#introScene .pl'), await T(p, '#introScene .ps'));

  const t0 = Date.now();
  console.log('칸 기본값 :', await p.$eval('#isW', n => n.value), '×', await p.$eval('#isD', n => n.value));
  await p.click('#isGo'); await p.waitForTimeout(1300); await p.locator('#plan .rg').last().click(); await p.waitForTimeout(700);
  console.log('방 만들고 집 화면에서 누르면 입장 :', await T(p, '#crumbRoom'), '·', Date.now() - t0, 'ms');
  console.log('상태 패널 :', (await T(p, '#clashBox .read')).slice(0, 30));
  console.log('선택 전 안내 :', await T(p, '.selhint'));

  // 가구 하나 놓기 (프리셋)
  await p.click('#addBtn'); await p.waitForTimeout(350);
  await p.click('.prechip:has-text("슈퍼싱글 침대")'); await p.waitForTimeout(120);
  await p.click('#afAdd'); await p.waitForTimeout(400);
  console.log('가구 추가 :', await T(p, '#toast'));
  console.log('방 안 가구 :', await p.$$eval('#listIn .fitem .nm', ns => ns.map(n => n.textContent)));
  console.log('점수      :', await T(p, '.score-h'));
  console.log('총 걸린 시간 :', Date.now() - t0, 'ms (사람 손 제외)');

  // ② 다시 열면 «내 집» 으로 바뀌는가
  await p.reload(); await p.waitForTimeout(600);
  console.log('\n== 두 번째 방문 ==');
  console.log('인트로 없이 집 화면 :', await p.$eval('#intro', n => n.hidden));
  const cards = await p.$$eval('#roomList .roomcard', ns => ns.map(n => n.textContent.replace(/\s+/g,' ').trim()));
  console.log('방 목록 :', cards);
  console.log('카드에 삭제 남았나 :', !!(await p.$('#roomList [data-act="del"]')));
  await p.click('#roomList [data-act="edit"]'); await p.waitForTimeout(400);
  console.log('수정 창 삭제 버튼 :', !(await p.$eval('#rmDrop', n => n.hidden)));
  await p.click('#rmCancel'); await p.waitForTimeout(300);
  console.log('줌 버튼 수 :', await p.$$eval('.zoomer button', n => n.length),
              '· 배율 :', await T(p, '#zLabel'));
  await p.close();

  // ③ 둘러보기
  p = await b.newPage({ viewport: { width: 1500, height: 900 } });
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html'));
  await p.waitForTimeout(600);
  await p.click('#isPeek'); await p.waitForTimeout(900);
  console.log('\n== 둘러보기 ==');
  console.log('가이드 자동 :', await p.$eval('#guide', n => n.classList.contains('open')));
  if (await p.$('#guide.open')) { await p.click('#gClose'); await p.waitForTimeout(400); }
  console.log('들어간 방 :', await T(p, '#crumbRoom'), '· 점수 :', await T(p, '.score-h'));
  console.log('pageerror :', errs.length ? errs : 0);
  await b.close();
})();
