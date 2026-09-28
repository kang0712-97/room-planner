// p31 신규 시험: ① 되돌리기 메모리·도면 복원 ② 예전 저장본·저장 실패 경고 ③ 백업 저장/불러오기
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const APP = 'file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport:{ width:1600, height:1000 }, acceptDownloads:true });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  const open = async () => { await p.goto(APP); await p.waitForTimeout(700);
    if (await p.isVisible('#houseBtn')) { await p.click('#houseBtn'); await p.waitForTimeout(1200); }
    if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); } };
  const img = () => p.evaluate(() => { const i = document.querySelector('#plan image:not(.inv)');
    const h = i && i.getAttribute('href'); return h && h.startsWith('data:image/jpeg') ? h.length : 0; });
  const cdp = await ctx.newCDPSession(p); await cdp.send('Performance.enable');
  const heap = async () => { await cdp.send('HeapProfiler.collectGarbage');
    const m = (await cdp.send('Performance.getMetrics')).metrics; return m.find(x => x.name === 'JSHeapUsedSize').value / 1048576; };
  const z = async () => { await p.keyboard.press('Control+z'); await p.waitForTimeout(600); };
  const y = async () => { await p.keyboard.press('Control+Shift+z'); await p.waitForTimeout(600); };
  let ok = true; const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };

  console.log('[①] 되돌리기 — 도면 분리');
  await open();
  await p.setInputFiles('#planIn', 'photo.jpg'); await p.waitForTimeout(2500);
  const L = await img(); chk(L > 100000, `도면 올림 (${L}자)`);
  await z(); chk(await img() === 0, '되돌리기 → 도면 사라짐');
  await y(); chk(await img() === L, '다시하기 → 도면 돌아옴');
  const h0 = await heap();
  await p.click('#roomList .roomcard .nm'); await p.waitForTimeout(500);
  for (let k = 0; k < 40; k++){
    const g = await p.$$('#plan g.fg'); const bb = await g[k % g.length].boundingBox(); if (!bb) continue;
    const x = bb.x + bb.width/2, yy = bb.y + bb.height/2;
    await p.mouse.move(x, yy); await p.mouse.down(); await p.mouse.move(x+15, yy+8, {steps:3}); await p.mouse.move(x+30, yy+15, {steps:3}); await p.mouse.up();
  }
  const h1 = await heap(); chk(h1 - h0 < 5, `가구 40번 이동 후 힙 증가 ${(h1-h0).toFixed(1)}MB (기준 5MB 미만)`);
  await p.click('#goHome'); await p.waitForTimeout(400);
  await p.click('#dropPlanBtn'); await p.waitForTimeout(300); await p.click('#cfOk'); await p.waitForTimeout(500);
  chk(await img() === 0, '도면 지우기');
  await z(); chk(await img() === L, '도면 지우기 되돌리기 → 도면 돌아옴');
  const sz = await p.evaluate(() => [ (localStorage.getItem('room-planner/3')||'').length, (localStorage.getItem('room-planner/plan')||'').length ]);
  chk(sz[0] < 20000 && sz[1] === L, `저장소: 배치 ${sz[0]}자 · 도면 따로 ${sz[1]}자`);
  await open(); chk(await img() === L, '새로고침 후 도면 유지');

  console.log('[②] 예전(p30) 저장본 · 저장 실패 경고');
  await p.evaluate(() => { const o = JSON.parse(localStorage.getItem('room-planner/3'));
    o.plan.src = localStorage.getItem('room-planner/plan');
    localStorage.setItem('room-planner/3', JSON.stringify(o)); localStorage.removeItem('room-planner/plan'); });
  await open();
  chk(await img() === L, 'p30 형식(도면이 안에 든 저장본)도 도면까지 읽힘');
  chk(await p.evaluate(() => (localStorage.getItem('room-planner/3')||'').length < 20000 && !!localStorage.getItem('room-planner/plan')), '읽은 뒤 새 형식으로 나눠 저장');
  chk(await p.isHidden('#saveWarn'), '평소엔 경고 띠 숨김');
  await p.evaluate(() => { window.__set = Storage.prototype.setItem;
    Storage.prototype.setItem = function(){ throw new DOMException('full', 'QuotaExceededError'); }; });
  await p.click('#roomList .roomcard .nm'); await p.waitForTimeout(400);
  await p.click('#plan g.fg[data-uid="I_F06"]'); await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(900);
  chk(await p.isVisible('#saveWarn'), '저장 실패 → 경고 띠 보임');
  const top = await p.evaluate(() => { const r = document.getElementById('saveWarn').getBoundingClientRect();
    return document.elementFromPoint(r.x + r.width - 20, r.y + r.height/2).closest('#saveWarn') !== null; });
  chk(top, '경고 띠 버튼이 맨 위에서 눌림');
  await p.evaluate(() => { Storage.prototype.setItem = window.__set; });
  await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(900);
  chk(await p.isHidden('#saveWarn'), '저장 회복 → 다음 변경에서 경고 띠 사라짐');

  console.log('[③] 백업 파일');
  await p.click('#goHome'); await p.waitForTimeout(400);
  await p.click('#bkBtn'); await p.waitForTimeout(300);
  console.log('    안내:', await p.textContent('#bkInfo'));
  const [dl] = await Promise.all([ p.waitForEvent('download'), p.click('#bkSave') ]);
  const f = (process.env.WORK || '/home/claude/work') + '/backup.json'; await dl.saveAs(f);
  const J = JSON.parse(fs.readFileSync(f, 'utf8'));
  chk(J.app === 'room-planner' && J.rooms.length === 1 && J.plan && J.plan.src.length === L, `파일 ${dl.suggestedFilename()} · 방 ${J.rooms.length} · 도면 포함`);
  await p.click('#bkClose');
  await p.click('#resetBtn'); await p.waitForTimeout(300); await p.click('#cfOk'); await p.waitForTimeout(500);
  chk(await img() === 0, '처음으로 → 도면 없음');
  await p.click('#bkBtn'); await p.setInputFiles('#bkIn', f); await p.waitForTimeout(500);
  chk(await p.isVisible('#confirmModal'), '불러오기 확인 창: ' + (await p.textContent('#cfText')));
  await p.click('#cfOk'); await p.waitForTimeout(800);
  chk(await img() === L, '불러온 뒤 도면 돌아옴');
  await z(); chk(await img() === 0, '불러오기도 되돌리기 가능');
  fs.writeFileSync((process.env.WORK || '/home/claude/work') + '/bad.json', '{"hello":1}');
  await p.click('#bkBtn'); await p.setInputFiles('#bkIn', (process.env.WORK || '/home/claude/work') + '/bad.json'); await p.waitForTimeout(500);
  chk((await p.textContent('#toast')).includes("백업 파일이 아닙니다") && await p.isHidden('#confirmModal'), '엉뚱한 파일은 안내만');
  await p.screenshot({ path:(process.env.WORK || '/home/claude/work') + '/t31_after.png' });
  console.log('\npageerror :', errs.length, errs, ok ? '\n전부 통과' : '\n실패 있음');
  await b.close();
})();
