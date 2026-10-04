// p64: 화면 밝기 — 기기가 다크여도 기본은 밝게 · «어둡게» 누르면 어둡게 · 다시 열어도 유지 · 폰 «도구» 시트 · 기기 밝음 + 고른 어둡게
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const APP = 'file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html');
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const open = async (o = {}) => {
    const c = await b.newContext({ viewport: o.vp || { width: 1600, height: 900 }, colorScheme: o.dark ? 'dark' : 'light',
      isMobile: !!o.mob, hasTouch: !!o.mob });
    const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(APP); return [c, p]; };
  const theme = p => p.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const bg = (p, s) => p.$eval(s, n => getComputedStyle(n).backgroundColor);
  const btn = p => p.$eval('#themeBtn', n => n.textContent.trim() + ' · ' + n.getAttribute('aria-label') + ' · ' + n.querySelector('use').getAttribute('href'));
  const saved = p => p.evaluate(() => (JSON.parse(localStorage.getItem('room-planner/opt') || '{}').theme) || '없음');
  const home = async p => {                       // 인트로 Esc → 집 화면, 첫 방문 사용법이 뜨면 닫는다
    await p.keyboard.press('Escape'); await p.waitForTimeout(700);
    for (let i = 0; i < 3 && await p.$('#guide.open'); i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); } };
  const LIGHT = 'rgb(238, 242, 240)', DARK = 'rgb(11, 18, 16)';

  /* ① 데스크톱 · 기기 다크: 그래도 밝게 시작 */
  let [c, p] = await open({ dark: 1 });
  chk(await theme(p) === null && await bg(p, '#intro') === LIGHT, '기기 다크: 인트로가 밝은 종이색');
  await home(p);
  chk(await bg(p, 'body') === LIGHT, '기기 다크: 집 화면도 밝게');
  console.log('단추 :', await btn(p));
  chk(await p.$eval('#themeBtn', n => n.getBoundingClientRect().width > 0), '1600: 위 줄에 «어둡게» 단추가 보임');
  const bar = await p.$eval('.bar', n => Math.round(n.getBoundingClientRect().height));
  chk(bar <= 60, '1600: 위 줄 한 줄 유지(60px 이하)');

  /* ② 누르면 어둡게 + 저장 */
  await p.click('#themeBtn'); await p.waitForTimeout(100);
  chk(await theme(p) === 'dark' && await bg(p, 'body') === DARK, '«어둡게» 누르면 어두운 종이색');
  chk(await p.evaluate(() => getComputedStyle(document.documentElement).colorScheme) === 'dark', '어둡게: color-scheme dark');
  console.log('단추 :', await btn(p), '· 저장 :', await saved(p));

  /* ③ 다시 열어도 어둡게(그리기 전에 붙음) */
  await p.reload(); await p.waitForTimeout(300);
  chk(await theme(p) === 'dark' && await bg(p, 'body') === DARK, '다시 열어도 어둡게');
  chk(await p.evaluate(() => !!document.head.querySelector('script')), '<head> 스크립트가 그리기 전에 붙인다');

  /* ④ 다시 누르면 밝게 + 저장 */
  await home(p);
  await p.click('#themeBtn'); await p.waitForTimeout(100);
  chk(await theme(p) === null && await bg(p, 'body') === LIGHT, '«밝게» 누르면 다시 밝게');
  console.log('단추 :', await btn(p), '· 저장 :', await saved(p));
  await p.reload(); await p.waitForTimeout(300);
  chk(await theme(p) === null && await bg(p, 'body') === LIGHT, '다시 열어도 밝게');
  await c.close();

  /* ⑤ 폰 360 · 기기 다크: «도구» 시트에서 바꾸기 */
  [c, p] = await open({ dark: 1, mob: 1, vp: { width: 360, height: 740 } });
  chk(await bg(p, '#intro') === LIGHT, '폰 · 기기 다크: 인트로 밝게');
  await home(p);
  await p.click('#tabbar [data-tab="more"]'); await p.waitForTimeout(400);
  const r = await p.$eval('#themeBtn', n => { const b = n.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; });
  chk(r[0] >= 32 && r[1] >= 32, '폰 «도구» 시트에 단추(32px 이상)');
  await p.click('#themeBtn'); await p.waitForTimeout(100);
  chk(await theme(p) === 'dark' && await bg(p, 'body') === DARK, '폰: 누르면 어둡게');
  await p.reload(); await p.waitForTimeout(300);
  chk(await bg(p, '#intro') === DARK, '폰: 다시 열면 인트로부터 어둡게');
  await c.close();

  /* ⑥ 기기 밝음 + 예전에 고른 어둡게 → 고른 것이 이긴다 */
  [c, p] = await open();
  await p.evaluate(() => localStorage.setItem('room-planner/opt', JSON.stringify({ theme: 'dark' })));
  await p.reload(); await p.waitForTimeout(300);
  chk(await theme(p) === 'dark' && await bg(p, '#intro') === DARK, '기기 밝음이어도 고른 «어둡게» 유지');
  await c.close();

  console.log('pageerror :', errs.length, errs);
  console.log(ok ? '전부 통과' : '실패 있음');
  await b.close(); process.exit(ok ? 0 : 1);
})();
