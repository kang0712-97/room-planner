// p69: ① ㄱ자 방 — 같은 날 다시 열 때 «벽 그려지기» 선이 ㄱ자 바깥선(네모 선이 남아 덮지 않음)
//      ② 가구를 90° 돌려도 글자 크기가 같다(돌리기 전 모양으로 정함)
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const APP = 'file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html');
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const c = await b.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true });
  const p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(700); await p.keyboard.press('Escape'); await p.waitForTimeout(1200);
  for (let i = 0; i < 3 && await p.$('#guide.open'); i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  /* 둘러보기 방을 «내 방» 으로(ㄱ자) + 오늘 이미 본 사람 → 다시 열면 짧은 장면(homeReturn) */
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('room-planner/3'));
    s.rooms[0].notch = { corner:'tr', w:900, d:1600 }; s.rooms[0].sample = false;
    localStorage.setItem('room-planner/3', JSON.stringify(s));
    const o = JSON.parse(localStorage.getItem('room-planner/opt') || '{}'); o.introDay = new Date().toLocaleDateString('sv');
    localStorage.setItem('room-planner/opt', JSON.stringify(o)); });
  await p.reload(); await p.waitForTimeout(2500);
  console.log('[다시 열기 — ㄱ자 방]');
  const hw = await p.$$eval('#plan .rg .hw', ns => ns.map(n => n.getAttribute('d')));
  chk(hw.length === 1 && (hw[0].match(/L/g) || []).length === 5, `벽 그려지기 선 = ㄱ자 바깥선 하나 (선 ${hw.length}개)`);
  console.log('[돌려도 같은 글자 크기]');
  if (!(await p.evaluate(() => document.body.className.includes('sh-list')))) { await p.tap('#tabbar [data-tab="list"]'); await p.waitForTimeout(400); }
  await p.tap('#roomList .roomcard .nm'); await p.waitForTimeout(900);
  const fs = () => p.$$eval('#plan .fg', ns => ns.map(n => n.querySelector('text').textContent + ':' + Math.round(Number(n.querySelector('text').getAttribute('font-size')))));
  const f0 = await fs();
  await p.evaluate(() => { const s = JSON.parse(localStorage.getItem('room-planner/3')); for (const it of s.items) it.rot = (it.rot + 90) % 360; localStorage.setItem('room-planner/3', JSON.stringify(s)); });
  await p.reload(); await p.waitForTimeout(2500);
  if (!(await p.evaluate(() => document.body.className.includes('sh-list')))) { await p.tap('#tabbar [data-tab="list"]'); await p.waitForTimeout(400); }
  await p.tap('#roomList .roomcard .nm'); await p.waitForTimeout(900);
  const f1 = await fs();
  chk(f0.length === 8 && f0.join() === f1.join(), '샘플 가구 8개 모두 90° 돌려도 글자 크기 같음: ' + f0.join(' '));
  await c.close();
  console.log('pageerror :', errs.length, errs);
  console.log(ok ? '전부 통과' : '실패 있음');
  await b.close(); process.exit(ok ? 0 : 1);
})();
