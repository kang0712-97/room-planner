const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
(async () => {
  const b = await chromium.launch();
  const T = async (p,s) => (await p.textContent(s) || '').replace(/\s+/g,' ').trim();
  const errs = [];

  // ── 폰: 유령 포인터 재현 시나리오 ──
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  p.on('pageerror', e => errs.push('P:'+e));
  await p.goto('file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html'));
  await p.waitForTimeout(600);
  console.log('판 번호 :', await T(p,'#introVer'));
  await p.click('#isPeek'); await p.waitForTimeout(1000);
  if (await p.$('#guide.open')) { await p.click('#gClose'); await p.waitForTimeout(400); }

  const ptsSize = () => p.evaluate(() => {
    // IIFE 라 내부를 못 본다 — 대신 «핀치가 켜졌는지» 를 겉으로 잰다
    return document.querySelector('#plan').getAttribute('viewBox');
  });
  // 빈 곳을 여러 번 탭 → 예전이면 두 번째부터 핀치가 켜져 확대됨
  const v0 = await ptsSize();
  for (let i = 0; i < 5; i++) { await p.touchscreen.tap(60 + i*8, 700); await p.waitForTimeout(120); }
  console.log('빈 곳 5번 탭 후 viewBox 그대로 :', v0 === await ptsSize(), '· 배율', await T(p,'#zLabel'));

  // 그 뒤에도 탭이 먹히는가 — 목록에서 가구를 고른다
  await p.click('#tabbar [data-tab="list"]'); await p.waitForTimeout(400);
  await p.click('#listIn .fitem .nm:text-is("책상")'); await p.waitForTimeout(500);
  console.log('그 뒤 가구 선택 :', await T(p,'#sbNm'), '· 고른 가구 줄', await p.$eval('#selbar', n => getComputedStyle(n).display));

  // 도면 위 가구 탭 → 선택되는가
  await p.click('#tabbar [data-tab="list"]').catch(()=>{});
  await p.waitForTimeout(300);
  const fg = await p.$eval('#plan .fg', n => { const r = n.getBoundingClientRect(); return [Math.round(r.x+r.width/2), Math.round(r.y+r.height/2)]; });
  await p.touchscreen.tap(fg[0], fg[1]); await p.waitForTimeout(400);
  console.log('도면에서 가구 탭 :', await T(p,'#sbNm') || '(안 됨)');

  // 집 → 방 다시 들어가기
  await p.click('#goHome'); await p.waitForTimeout(700);
  /* p42 — 집으로 나와도 방 목록 시트가 저절로 열리지 않는다(사용자 요청) → «목록» 탭으로 연다 */
  if (!(await p.evaluate(() => document.body.className.includes('sh-list')))) { await p.click('#tabbar [data-tab="list"]'); await p.waitForTimeout(400); }
  await p.click('#roomList .roomcard .nm:text-is("내 방")'); await p.waitForTimeout(800);
  console.log('집 → 방 재입장 :', await T(p,'#crumbRoom'));

  // ── 이미지로 저장 ──
  await p.click('#tabbar [data-tab="more"]'); await p.waitForTimeout(400);
  await p.click('#imgBtn2'); await p.waitForTimeout(2500);
  console.log('\n이미지 창 :', await p.$eval('#imgModal', n => n.classList.contains('open')));
  console.log('안내      :', await T(p,'#imgHint'));
  console.log('그림 크기 :', await p.$eval('#imgOut', n => n.naturalWidth + '×' + n.naturalHeight));
  await p.evaluate(() => { const a = document.querySelector('#imgOut');
    const c = document.createElement('canvas'); c.width = a.naturalWidth; c.height = a.naturalHeight;
    c.getContext('2d').drawImage(a,0,0); window.__png = c.toDataURL('image/png'); });
  const png = await p.evaluate(() => window.__png);
  require('fs').writeFileSync('v21_export.png', Buffer.from(png.split(',')[1], 'base64'));
  console.log('링크 버튼 없어짐 :', !(await p.$('#shareBtn')));
  await p.close();

  console.log('\npageerror :', errs.length ? errs : 0);
  await b.close();
})();
