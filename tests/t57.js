// p57: 첫 방문 인트로 «M6 · 손이 잰다» — 재생 → 끝 장면 · 누르면 건너뛰기 · 칸 = 도면 치수 · 만들기 · 다시 온 사람 · Esc · 움직임 줄이기 · 다크·폰
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const APP = 'file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html');
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const open = async (o = {}) => {
    const c = await b.newContext({ viewport: o.vp || { width: 1600, height: 900 }, colorScheme: o.dark ? 'dark' : 'light',
      reducedMotion: o.rm ? 'reduce' : 'no-preference', isMobile: !!o.mob, hasTouch: !!o.mob });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(APP); return [c, p]; };
  const T = (p, s) => p.$eval(s, n => n.textContent.replace(/\s+/g, ' ').trim());
  const cls = p => p.$eval('#introScene', n => n.getAttribute('class'));
  const scene = async p => `${await T(p, '#introScene .count')} × ${await T(p, '#introScene .dlt')} · ${await T(p, '#introScene .pl')} ${await T(p, '#introScene .ps')}`;

  /* ① 처음 온 사람: 재생 → 2초 뒤 끝 장면 */
  let [c, p] = await open();
  chk(!(await p.$eval('#intro', n => n.hidden)) && (await cls(p)).includes('run'), '처음 온 사람: 인트로가 뜨고 장면 재생 중');
  chk(await T(p, '.intro-title') === '이걸 어디다 두지?' && (await T(p, '.intro-line')) === '줄자로 잰 방에 가구를 놓아 보세요.통로가 나오는지, 문에 걸리는지 바로 알려 줘요.', '제목 · 한 줄 설명');
  chk(await p.$$eval('#introStart button', ns => ns.map(n => n.textContent.trim()).join(' | ')) === '이 크기로 방 만들기 | 줄자가 없어요 · 예시 방으로 둘러보기', '버튼: «이 크기로 방 만들기» 하나 + 둘러보기 글자');
  chk(!(await p.$('#isPre')) && await p.$eval('#isW', n => n.value) === '3500' && await p.$eval('#isD', n => n.value) === '3000', '크기 칩 없음 · 칸 기본값 3500 × 3000');
  await p.waitForTimeout(2400);
  chk(await cls(p) === 'isc idle', '2초 뒤 끝 장면 · 문 대기 움직임');
  console.log('끝 장면 :', await scene(p));
  chk(await p.$eval('#introScene .hl', n => getComputedStyle(n).filter) === 'none', '손그림에 반전 필터 없음');
  await c.close();

  /* ② 누르면 끝 장면으로(입력 칸은 제외) */
  [c, p] = await open(); await p.waitForTimeout(300);
  await p.click('#isW');
  chk((await cls(p)).includes('run'), '입력 칸을 눌러도 재생은 계속');
  await p.mouse.click(20, 20);
  chk(await cls(p) === 'isc idle' && await T(p, '#introScene .count') === '3,500 mm', '빈 곳을 누르면 바로 끝 장면(3,500 mm)');
  chk(!(await p.$eval('#intro', n => n.hidden)), '건너뛰어도 인트로에 그대로 남음');

  /* ③ 칸 = 도면 치수 */
  await p.fill('#isW', '2400'); await p.fill('#isD', '3600'); await p.press('#isD', 'Enter'); await p.waitForTimeout(500);
  console.log('2400×3600 :', await scene(p));
  const ratio = await p.$eval('#introScene', n => Math.round(n.querySelector('.wb').getBBox().width / n.querySelector('.wl').getBBox().height * 100) / 100);
  chk(ratio === 0.67, `도면 가로:세로 = 칸의 비율 (${ratio})`);
  chk(!(await p.$eval('#intro', n => n.hidden)), 'Enter 는 그려 보기만(방은 안 생김)');

  /* ④ 이 크기로 방 만들기 → 집 화면에 앉음(p58) · ⑤ 다시 오면 인트로 없음 */
  await p.click('#isGo'); await p.waitForTimeout(60);
  chk(await p.$eval('#intro', n => n.classList.contains('leave')) && await p.$eval('#introScene', n => n.classList.contains('leave')), '만들기: 예시 가구·제목·칸이 먼저 흐려짐');
  await p.waitForTimeout(300);
  chk(await p.$$eval('.ifly', n => n.length) === 1, '방 윤곽이 집 화면으로 날아가는 중');
  await p.waitForTimeout(450);
  chk(await p.$eval('#intro', n => n.hidden) && await p.$eval('#crumbRoom', n => n.hidden) && await p.$$eval('.ifly', n => n.length) === 0, '집 화면에 앉음(방으로 바로 들어가지 않음)');
  chk(await p.$$eval('#plan .rg .rglow', n => n.length) === 1, '새 방이 한 번 빛남');
  await p.waitForTimeout(400);
  console.log('안내 :', await T(p, '#toast'), '· 새 방 :', await p.$$eval('#plan .rg', ns => ns[ns.length - 1].getAttribute('aria-label')));
  chk(!(await p.$eval('#guide', n => n.classList.contains('open'))), '방을 만든 사람에겐 사용법을 띄우지 않음');
  await p.waitForTimeout(1000);
  chk(await p.$$eval('#plan .rglow', ns => ns.every(n => getComputedStyle(n).opacity === '0')), '1.2초 뒤 빛남 끝');
  await p.locator('#plan .rg').last().click(); await p.waitForTimeout(500);
  console.log('방을 누르면 :', await T(p, '#crumbRoom'));
  /* p59 — 다시 온 사람: 제목 → 위 줄 앱 이름 자리로 → 방이 차례로 그려짐 · 마지막으로 본 방 */
  await p.click('#goHome'); await p.waitForTimeout(300);
  await p.reload(); await p.waitForTimeout(150);
  chk(await p.$eval('#intro', n => n.hidden), '다시 온 사람(내 방 있음): 인트로 없음');
  chk(!(await p.$eval('#homeTitle', n => n.hidden)) && await p.evaluate(() => document.body.classList.contains('hret')), '제목이 먼저 뜨고 위 줄은 아직 숨음');
  chk(await p.$$eval('#plan .rg.drawing', n => n.length) === 2 && await p.$$eval('#plan .rg.drawing .hw', n => n.length) === 6, '방 2개가 그려지는 중(벽 세 줄씩)');
  const d = await p.$$eval('#plan .rg.drawing', ns => ns.map(n => parseFloat(n.style.getPropertyValue('--d'))));
  chk(Math.abs((d[1] - d[0]) - 0.08) < 0.005, '방 사이 간격 0.08초');
  await p.waitForTimeout(1300);
  chk(await p.$eval('#homeTitle', n => n.hidden) && await p.$$eval('#plan .rg.drawing', n => n.length) === 0 && await p.$eval('#brand span', n => n.style.visibility === ''), '약 1.2초 뒤 끝: 제목은 위 줄 앱 이름으로');
  console.log('마지막으로 본 방 :', await p.$$eval('#plan .rg', ns => ns.filter(n => n.querySelector('.lastchip')).map(n => n.getAttribute('aria-label') + ' · ' + n.querySelector('.lastchip').textContent)));
  await p.reload(); await p.waitForTimeout(150); await p.mouse.click(1500, 450);
  chk(await p.$eval('#homeTitle', n => n.hidden) && await p.$$eval('#plan .rg.drawing', n => n.length) === 0 && !(await p.evaluate(() => document.body.classList.contains('hret'))), '누르면 바로 끝');
  /* p62 — 그날 첫 방문(어제 본 것으로 돌려 둠): 입력 칸 없는 인트로 → 저절로 «마지막으로 본 방» 으로 */
  const yest = () => p.evaluate(() => { const o = JSON.parse(localStorage.getItem('room-planner/opt')); o.introDay = '2000-01-01'; localStorage.setItem('room-planner/opt', JSON.stringify(o)); });
  await yest(); await p.reload(); await p.waitForTimeout(300);
  chk(!(await p.$eval('#intro', n => n.hidden)) && await p.$eval('#introStart', n => n.hidden) && (await cls(p)).includes('run'), '다시 온 사람의 그날 첫 방문: 입력 칸 없는 인트로');
  await p.waitForTimeout(2350);
  chk(await p.$$eval('.ifly', n => n.length) === 1 && await p.$$eval('.ititle-fly', n => n.length) === 1, '장면이 끝나면 저절로: 방 윤곽·제목이 날아감');
  await p.waitForTimeout(700);
  chk(await p.$eval('#intro', n => n.hidden) && await p.$$eval('.ifly,.ititle-fly', n => n.length) === 0 && !(await p.$eval('#introStart', n => n.hidden)), '집 화면에 앉음(입력 칸은 다음 처음 방문용으로 되돌림)');
  chk(await p.$$eval('#plan .rg', ns => ns.filter(n => n.querySelector('.rglow')).map(n => !!n.querySelector('.lastchip')).join()) === 'true', '«마지막으로 본 방» 이 빛남');
  await p.reload(); await p.waitForTimeout(150);
  chk(await p.$eval('#intro', n => n.hidden) && !(await p.$eval('#homeTitle', n => n.hidden)), '같은 날 다시 열면 짧은 장면(제목 → 위 줄)');
  await yest(); await p.reload(); await p.waitForTimeout(700); await p.mouse.click(1500, 450); await p.waitForTimeout(100);
  chk(await p.$eval('#intro', n => n.hidden) && await p.$$eval('.ifly,.ititle-fly', n => n.length) === 0 && await p.$eval('#brand span', n => n.style.visibility === ''), '그날 첫 인트로도 누르면 바로 집 화면');
  await c.close();
  [c, p] = await open({ rm: 1 });
  await p.click('#isGo'); await p.waitForTimeout(100); await p.locator('#plan .rg').last().click(); await p.waitForTimeout(300);
  await p.click('#goHome');
  await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('room-planner/opt')); o.introDay = '2000-01-01'; localStorage.setItem('room-planner/opt', JSON.stringify(o)); });
  await p.reload(); await p.waitForTimeout(100);
  chk(await p.$eval('#homeTitle', n => n.hidden) && await p.$$eval('#plan .rg.drawing', n => n.length) === 0 && await p.$$eval('#plan .lastchip', n => n.length) === 1, '움직임 줄이기(다시 온 사람, 그날 첫 방문이어도): 완성된 집 화면 바로 · 칩은 보임');
  await c.close();

  /* ⑥ Esc = 인트로 닫고 집 화면 + 첫 방문 사용법 */
  [c, p] = await open(); await p.waitForTimeout(200);
  await p.keyboard.press('Escape'); await p.waitForTimeout(700);
  chk(await p.$eval('#intro', n => n.hidden) && await p.$eval('#guide', n => n.classList.contains('open')) && await p.isVisible('#homePanel'), 'Esc: 인트로 닫힘 → 집 화면 · 사용법');
  await c.close();

  /* p60 — 방 추가 시트: 손그림 줄자가 가로만큼 당겨짐 → 새 방이 그려지고 빛남 */
  [c, p] = await open(); await p.waitForTimeout(200);
  await p.keyboard.press('Escape'); await p.waitForTimeout(600);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  await p.click('#addRoomBtn'); await p.waitForTimeout(60);
  const tx = () => p.$eval('#rmPull', n => Math.round(new DOMMatrix(getComputedStyle(n).transform).e));
  chk(await p.$eval('#rmTape', n => !n.hasAttribute('hidden')) && await p.$eval('#rmSave', n => n.textContent) === '방 만들기'
      && await p.$eval('#rmW', n => n.value) === '3000' && await p.$eval('#rmD', n => n.value) === '2700', '방 추가: 손그림 줄자 · 칸 3000 × 2700 · «방 만들기»');
  const t1 = await tx(); await p.waitForTimeout(900); const t2 = await tx();
  chk(t1 < t2 && t2 === 123 && await T(p, '#rmCnt') === '3,000 mm', '줄자가 3,000mm 만큼 당겨짐');
  await p.fill('#rmW', '9000'); await p.waitForTimeout(900);
  chk(await tx() === 246 && await T(p, '#rmCnt') === '9,000 mm', '가로를 바꾸면 줄자도 그 길이로(6,000mm 넘으면 끝까지)');
  await p.fill('#rmW', '3600'); await p.fill('#rmName', '작업실'); await p.click('#rmSave'); await p.waitForTimeout(150);
  chk(await p.$$eval('#plan .rg.drawing', ns => ns.map(n => n.getAttribute('aria-label')).join()) === '작업실 3600×2700' && await p.$$eval('#plan .rglow', n => n.length) === 1, '방 만들기: 새 방 하나만 그려지고 빛남');
  await p.waitForTimeout(900);
  chk(await p.$$eval('#plan .rg.drawing', n => n.length) === 0 && await p.$$eval('#plan .hw', n => n.length) === 0, '0.8초 뒤 그려지기 끝(보통 도면으로)');
  await p.locator('#plan .rg').last().click(); await p.waitForTimeout(400);
  await p.click('#crumbRoom'); await p.waitForTimeout(300);
  chk(await p.$eval('#rmTape', n => n.hasAttribute('hidden')) && await p.$eval('#rmSave', n => n.textContent) === '저장', '방 수정 창: 줄자 없음 · «저장»');
  await c.close();
  [c, p] = await open({ rm: 1 }); await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(200); }
  await p.click('#addRoomBtn'); await p.waitForTimeout(200);
  chk(await tx() === 123 && await T(p, '#rmCnt') === '3,000 mm', '움직임 줄이기: 줄자가 바로 그 길이');
  await p.click('#rmSave'); await p.waitForTimeout(60);
  chk(await p.$$eval('#plan .rg.drawing', n => n.length) === 0 && await p.$$eval('#plan .rglow', n => n.length) === 0, '움직임 줄이기: 새 방이 바로(그려지기·빛남 없음)');
  await c.close();

  /* ⑦ 움직임 줄이기: 처음부터 끝 장면, 움직임 없음 */
  [c, p] = await open({ rm: 1 }); await p.waitForTimeout(150);
  chk(await cls(p) === 'isc' && await T(p, '#introScene .ps') === '지나갈 수 있어요', '움직임 줄이기: 처음부터 끝 장면 · 문 움직임 없음');
  chk(await p.$eval('#introScene', n => n.getAnimations({ subtree: true }).length) === 0, '움직임 줄이기: 도는 애니메이션 0');
  await p.click('#isGo'); await p.waitForTimeout(60);
  chk(await p.$eval('#intro', n => n.hidden) && await p.$$eval('.ifly', n => n.length) === 0 && await p.$$eval('#plan .rglow', n => n.length) === 0
      && (await T(p, '#toast')) === '방을 누르면 가구를 놓을 수 있어요', '움직임 줄이기: 날기·빛남 없이 집 화면 바로 + 안내');
  await c.close();

  /* ⑧ 다크·폰 360×640: 한 화면에 다 들어감 */
  [c, p] = await open({ dark: 1, mob: 1, vp: { width: 360, height: 640 } }); await p.waitForTimeout(2400);
  const bot = await p.$eval('#isPeek', n => Math.round(n.getBoundingClientRect().bottom));
  chk(bot <= 640, '폰 360×640: 둘러보기 글자까지 한 화면');
  chk(await p.$eval('#intro', n => getComputedStyle(n).backgroundColor) === 'rgb(11, 18, 16)', '다크: 어두운 종이색 바탕');
  await c.close();

  console.log('pageerror :', errs.length, errs);
  console.log(ok ? '전부 통과' : '실패 있음');
  await b.close(); process.exit(ok ? 0 : 1);
})();
