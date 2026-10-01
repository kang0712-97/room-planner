// p37: 문에서 출발하는 통로(문 막힘·못 가는 가구) · 폰 고른 가구 줄(수정·복제·자리 찾기) · «추가» 탭에 문·창문
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const APP = 'file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html');
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  let c = await b.newContext({ viewport:{ width:1600, height:900 } }); let p = await c.newPage();
  p.on('pageerror', e => errs.push(e.message));
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')));
  const clash = () => p.evaluate(() => document.getElementById('clashBox').innerText.replace(/\s+/g, ' '));
  const score = async () => ((await p.textContent('.scorebox')).match(/(\d+)/) || [])[1];
  const move = async (moves) => {                       // { 이름: {x,y,rot} }
    await p.evaluate(mv => { const s = JSON.parse(localStorage.getItem('room-planner/3'));
      for (const [nm, v] of Object.entries(mv)){ const cid = s.catalog.find(k => k.name === nm).id;
        const it = s.items.find(i => i.cat === cid); Object.assign(it, v); }
      localStorage.setItem('room-planner/3', JSON.stringify(s)); }, moves);
    await p.reload(); await p.waitForTimeout(900);
    if (await p.$('#intro:not([hidden])')) { await p.click('#houseBtn'); await p.waitForTimeout(1300); }
    if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    await p.click('#roomList .roomcard .nm'); await p.waitForTimeout(700);
  };
  await p.goto(APP); await p.waitForTimeout(700);
  await p.click('#isPeek'); await p.waitForTimeout(1500);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  let t = await clash();
  chk(t.includes('771') && await score() === '61' && !(await p.$('#plan .doorblock')), '샘플 방 기준값 그대로 (통로 771 · 61점 · 문 막힘 없음)');
  const s0 = await st(); const drawer = s0.items.find(i => i.cat === s0.catalog.find(k => k.name === '옷서랍').id);
  // ① 문 앞 막기 — 옷서랍을 문 바로 앞으로
  await move({ '옷서랍': { x:2060, y:0, rot:0 } });
  t = await clash();
  chk(!!(await p.$('#plan .doorblock')), '문 앞 띠가 빨갛게 표시');
  chk(t.includes('문 막힘') && t.includes('문 앞 막힘'), '상태 패널: ' + t.slice(t.indexOf('통로'), t.indexOf('통로') + 60));
  chk((await p.textContent('#miniStat')).includes('문 앞 막힘'), '알약: ' + await p.textContent('#miniStat'));
  const sc1 = await score(); chk(+sc1 < 61 && t.includes('문 앞이 막혀 있음'), `점수 61 → ${sc1}, 감점 이유 «문 앞이 막혀 있음»`);
  chk((await p.textContent('#plan')).includes('문 앞이 막혔어요'), '도면 글자 «문 앞이 막혔어요»');
  await p.screenshot({ path:(process.env.WORK || '/home/claude/work') + '/p37_door.png' });
  // ② 되돌려 놓으면 원래대로
  await move({ '옷서랍': { x:drawer.x, y:drawer.y, rot:drawer.rot } });
  chk((await clash()).includes('771') && await score() === '61' && !(await p.$('#plan .doorblock')), '옷서랍을 제자리로 → 771 · 61점');
  // ③ 방을 가로로 막아 아래쪽 가구에 못 가게
  await move({ '책장': { x:0, y:3400, rot:0 }, '옷걸이대': { x:1200, y:3400, rot:0 } });
  t = await clash();
  chk(t.includes('문에서 못 감') && t.includes('책상'), '상태: ' + t.slice(t.indexOf('통로'), t.indexOf('통로') + 70));
  chk((await p.$$('#plan .unreach')).length >= 2, `못 가는 가구 표시 ${(await p.$$('#plan .unreach')).length}개`);
  chk(+(await score()) < 61, '점수 ' + await score());
  await p.screenshot({ path:(process.env.WORK || '/home/claude/work') + '/p37_unreach.png' });
  // ④ 데스크톱 수정 창 — 추가 모드에서는 회전·보관·삭제 숨김
  await p.click('#addBtn'); await p.waitForTimeout(300);
  chk(await p.$eval('#afMore', e => e.hidden), '가구 추가 창: 회전·보관·삭제 없음');
  await p.click('#afCancel'); await p.waitForTimeout(200);
  await p.click('#listIn .fitem .nm:text-is("침대")'); await p.waitForTimeout(300);
  await p.click('#selEdit'); await p.waitForTimeout(300);
  chk(!(await p.$eval('#afMore', e => e.hidden)) && (await p.textContent('#selEdit')).includes('이름·치수'), '수정 창: 회전·보관·삭제 있음 · 버튼 이름 «이름·치수 수정»');
  await p.click('#afCancel');
  await c.close();

  // ⑤ 폰
  c = await b.newContext({ viewport:{ width:360, height:740 }, isMobile:true, hasTouch:true }); p = await c.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(700); await p.tap('#isPeek'); await p.waitForTimeout(1500);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  await p.tap('#tabbar [data-tab="more"]'); await p.waitForTimeout(400);
  chk(!(await p.isVisible('#addDoorBtn')) && !(await p.isVisible('#addWinBtn')), '폰 «도구» 에는 문·창문 추가 없음');
  await p.tap('#tabbar [data-tab="more"]'); await p.waitForTimeout(300);
  await p.tap('#tabbar [data-tab="add"]'); await p.waitForTimeout(400);
  chk(await p.$eval('#apModal', e => e.classList.contains('open')) && (await p.$$('#apModal [data-ap]')).length === 4, '«추가» 탭 → 가구·문·창문·콘센트 고르기');   // p49 콘센트 추가
  await p.screenshot({ path:(process.env.WORK || '/home/claude/work') + '/p37_addpick.png' });
  await p.tap('#apModal [data-ap="door"]'); await p.waitForTimeout(500);
  chk(await p.$eval('#openModal', e => e.classList.contains('open')), '«문» → 문 창');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);
  await p.tap('#tabbar [data-tab="list"]'); await p.waitForTimeout(400);
  await p.tap('#listIn .fitem .nm:text-is("독서실책상")'); await p.waitForTimeout(500);
  const acts = await p.$$eval('#selbar .sb-act', ns => ns.filter(n => !n.hidden).map(n => n.textContent.trim() + ':' + Math.round(n.getBoundingClientRect().width) + '×' + Math.round(n.getBoundingClientRect().height)));
  chk(acts.length === 4 && acts[0].startsWith('수정') && acts[1].startsWith('복제') && acts[2].startsWith('보관') && acts[3].startsWith('삭제'), '고른 가구 줄: ' + acts.join(' '));   // p47 — «자리 찾기» 뺌(사용자 요청)   // p46 — 사용자 요청으로 보관·삭제 되살림
  await p.screenshot({ path:(process.env.WORK || '/home/claude/work') + '/p37_selbar.png' });
  await p.tap('#sbInfo'); await p.waitForTimeout(600); await p.tap('#spotGo').catch(() => {}); await p.waitForTimeout(2000);   // p47 — 이름 → 상태 시트 → «더 나은 자리»
  const sp = await p.evaluate(() => document.getElementById('spotBox').innerText.replace(/\s+/g, ' '));
  chk(await p.evaluate(() => document.body.classList.contains('sh-stat')) && /점|자리/.test(sp), '이름 → 상태 시트에서 «더 나은 자리»: ' + sp.slice(0, 50));
  await p.screenshot({ path:(process.env.WORK || '/home/claude/work') + '/p37_spot.png' });
  await p.tap('#tabbar [data-tab="stat"]'); await p.waitForTimeout(300);
  await p.tap('#selbar [data-sb="edit"]'); await p.waitForTimeout(500);
  chk(await p.isVisible('#afName') && await p.isVisible('#afRot') && await p.isVisible('#afStore') && await p.isVisible('#afDel'), '«수정» → 이름·치수 + 회전·보관·삭제');
  await p.screenshot({ path:(process.env.WORK || '/home/claude/work') + '/p37_edit.png' });
  await p.tap('#afDel'); await p.waitForTimeout(400);
  chk(await p.$eval('#confirmModal', e => e.classList.contains('open')), '삭제는 확인 창을 거친다');
  await p.tap('#cfNo');
  await c.close();
  console.log('\npageerror :', errs.length, errs, ok ? '\n전부 통과' : '\n실패 있음');
  await b.close();
})();
