// p34: 방보다 큰 가구 — 돌려서 넣기 / 보관함 / 회전 거부 / 방 줄이면 «방 밖»
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const APP = 'file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html');
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const c = await b.newContext({ viewport:{ width:1600, height:900 } }); const p = await c.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(800);
  await p.fill('#isW', '2000'); await p.fill('#isD', '1500'); await p.click('#isGo'); await p.waitForTimeout(1300);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  const add = async nm => { await p.click('#addBtn'); await p.waitForTimeout(300); await p.click(`#afPre button:has-text("${nm}")`); await p.click('#afAdd'); await p.waitForTimeout(500); return p.textContent('#toast'); };
  const inside = () => p.evaluate(() => { const r = document.querySelector('#plan rect'); const W = +r.getAttribute('width'), H = +r.getAttribute('height');
    return [...document.querySelectorAll('#plan g.fg rect.body')].every(q => +q.getAttribute('x') >= 0 && +q.getAttribute('y') >= 0 && +q.getAttribute('x') + +q.getAttribute('width') <= W + 1 && +q.getAttribute('y') + +q.getAttribute('height') <= H + 1); });
  console.log('[①] 2000×1500 방');
  let t = await add('싱글 침대'); chk(t.includes('90° 돌렸습니다') && await inside(), '싱글 침대 1000×2000 → 돌려서 방 안: ' + t);
  t = await add('킹 침대'); chk(t.includes('보관함에 넣었습니다') && await inside(), '킹 침대 1600×2000 → 보관함: ' + t);
  chk(await p.$$eval('#plan .walkband', e => e.length) >= 1, '침대 옆 통로 원이 나온다');
  await p.click('#plan g.fg', { force:true }); await p.waitForTimeout(300);
  await p.click('#rotBtn'); await p.waitForTimeout(400);
  t = await p.textContent('#toast'); chk(t.includes('돌릴 수 없습니다') && await inside(), '돌리면 커지는 가구는 회전 거부: ' + t);
  const take = await p.$('.fitem.stored [data-act="take"]');
  if (take){ await take.click(); await p.waitForTimeout(400); t = await p.textContent('#toast'); chk(t.includes('꺼낼 수 없습니다'), '킹 침대 꺼내기 거부: ' + t); }
  else chk(false, '보관함 행 없음');
  console.log('\npageerror :', errs.length, errs, ok ? '\n전부 통과' : '\n실패 있음');
  await b.close();
})();
