// p38: 고정물(기둥·붙박이장·라디에이터·에어컨 스탠드)
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const APP = 'file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html');
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  let c = await b.newContext({ viewport:{ width:1600, height:900 } }); await c.grantPermissions(['clipboard-read','clipboard-write']);
  let p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')));
  const clash = () => p.evaluate(() => document.getElementById('clashBox').innerText.replace(/\s+/g, ' '));
  const walk = async () => +(((await clash()).match(/최소 통로폭 (\d+)/) || [])[1]);
  const score = async () => +(((await p.textContent('.scorebox')).match(/(\d+)/) || [])[1]);
  const reload = async () => { await p.reload(); await p.waitForTimeout(900);
    if (await p.$('#intro:not([hidden])')) { await p.keyboard.press('Escape'); await p.waitForTimeout(1300); }
    if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    await p.click('#roomList .roomcard .nm'); await p.waitForTimeout(700); };
  const put = async (nm, v) => { await p.evaluate(([nm, v]) => { const s = JSON.parse(localStorage.getItem('room-planner/3'));
      const cid = s.catalog.find(k => k.name === nm).id; Object.assign(s.items.find(i => i.cat === cid), v);
      localStorage.setItem('room-planner/3', JSON.stringify(s)); }, [nm, v]); await reload(); };
  const addPreset = async nm => { await p.click('#addBtn'); await p.waitForTimeout(300);
    await p.click(`#afPre button:has-text("${nm}")`); await p.waitForTimeout(600); return true; };   // p65 — 칩 하나로 방에
  await p.goto(APP); await p.waitForTimeout(700); await p.click('#isPeek'); await p.waitForTimeout(1500);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  const w0 = await walk(), sc0 = await score();
  chk(w0 === 771 && sc0 === 61, `기준값 ${w0} · ${sc0}`);
  chk(await p.$$eval('#afPre .pregrp', e => e.some(x => x.textContent.includes('고정물'))), '«흔한 크기» 에 고정물 묶음');
  const fx = await addPreset('기둥');
  let s = await st(); const col = s.catalog.find(k => k.name === '기둥');
  chk(fx && col && col.fixed === true, '기둥 누르면 바로 놓이고 카탈로그 fixed');
  chk((await p.$$('#plan .fg.fixed rect.hatch')).length === 1, '도면에 빗금 고정물 1개');
  // 싱글 침대(일반 가구)는 고정물 아님
  await p.click('#addBtn'); await p.waitForTimeout(200); await p.click('#afOwn');
  chk(!(await p.isChecked('#afFix')), '«직접 입력» 칸은 고정물 체크 해제'); await p.click('#afCancel');
  // 기둥을 통로 한가운데로
  await put('기둥', { x:1500, y:2350, rot:0 });
  const w1 = await walk(); chk(w1 < 771, `통로 한가운데 기둥 → 최소 통로 771 → ${w1}`);
  // 기둥 고르면 더 나은 자리 없음
  await p.click('#listIn .fitem .nm:text-is("기둥")'); await p.waitForTimeout(400);
  chk((await p.textContent('#spotBox')).includes('고정물은 추천이 옮기지 않습니다') && !(await p.$('#spotGo')), '기둥: «고정물은 추천이 옮기지 않습니다»');
  // 다른 가구 추천이 기둥을 옮기지 않는다
  const pos0 = (await st()).items.find(i => i.cat === col.id);
  await p.click('#listIn .fitem .nm:text-is("독서실책상")'); await p.waitForTimeout(300);
  await p.click('#spotGo'); await p.waitForSelector('.spotcard', { timeout:15000 }).catch(() => {}); await p.waitForTimeout(400);
  const card = await p.$('.spotcard [data-act="apply"], .spotcard button');
  if (card){ await card.click(); await p.waitForTimeout(600); }
  const pos1 = (await st()).items.find(i => i.cat === col.id);
  chk(pos0.x === pos1.x && pos0.y === pos1.y, `추천을 적용해도 기둥 제자리 (${pos1.x}, ${pos1.y})`);
  await p.keyboard.press('Control+z'); await p.waitForTimeout(300);
  // 창 앞 에어컨 스탠드 — 창 가림 규칙에서 빠진다
  await put('기둥', { room:null });
  await addPreset('에어컨 스탠드');
  await put('에어컨 스탠드', { x:880, y:4750, rot:0 });
  const t = await clash();
  chk(!/창 앞을 막는 가구[^−]*에어컨/.test(t), '창 앞 에어컨 스탠드는 «창 가림» 감점에 안 들어감');
  chk(!t.includes('에어컨 스탠드 위쪽') && !t.includes('문에서 못 감'), '사용 여유·못 가는 가구에도 안 들어감');
  // 수정 창에서 고정물 체크 유지
  await p.click('#listIn .fitem .nm:text-is("에어컨 스탠드")'); await p.waitForTimeout(300);
  await p.click('#selEdit'); await p.waitForTimeout(300);
  chk(await p.isChecked('#afFix'), '수정 창: 고정물 체크됨'); await p.click('#afCancel'); await p.waitForTimeout(200);
  // 공유해도 고정물 유지
  await p.click('#shareBtn'); await p.waitForTimeout(500); const url = await p.inputValue('#shUrl'); await p.click('#shClose');
  const c2 = await b.newContext({ viewport:{ width:1600, height:900 } }); const q = await c2.newPage(); q.on('pageerror', e => errs.push(e.message));
  await q.goto(url); await q.waitForTimeout(1200); await q.click('#cfOk'); await q.waitForTimeout(800);
  const s2 = await q.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')));
  chk(s2.catalog.some(k => k.name === '에어컨 스탠드' && k.fixed) && (await q.$$('#plan .fg.fixed')).length === 1, '링크로 받아도 고정물 그대로');
  await c2.close();
  await p.screenshot({ path:(process.env.WORK || '/home/claude/work') + '/p38_desk.png' });
  await c.close();
  // 폰: 고정물 고르면 «자리 찾기» 없음
  c = await b.newContext({ viewport:{ width:360, height:740 }, isMobile:true, hasTouch:true }); p = await c.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(700); await p.tap('#isPeek'); await p.waitForTimeout(1500);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  await p.tap('#tabbar [data-tab="add"]'); await p.waitForTimeout(300); await p.tap('#apModal [data-ap="furn"]'); await p.waitForTimeout(400);
  await p.locator('#afPre button:has-text("기둥")').scrollIntoViewIfNeeded(); await p.tap('#afPre button:has-text("기둥")'); await p.waitForTimeout(700);
  const vis = await p.$$eval('#selbar .sb-act', ns => ns.filter(n => !n.hidden).map(n => n.textContent.trim()));
  chk(vis.join() === '회전,수정,보관,삭제', '폰 고정물 고르면 줄: ' + vis.join(' · '));   // p47 — 자리 찾기는 이제 모두에게 없음   // p46 — 보관·삭제 되살림(자리 찾기는 고정물이라 숨김)
  await p.tap('#sbInfo'); await p.waitForTimeout(400);
  chk(!(await p.isVisible('#selEdit')) && !(await p.isVisible('#selRot')), '폰 상태 시트: 고른 가구 칸 버튼 없음');
  await p.screenshot({ path:(process.env.WORK || '/home/claude/work') + '/p38_phone.png' });
  await c.close();
  console.log('\npageerror :', errs.length, errs, ok ? '\n전부 통과' : '\n실패 있음');
  await b.close();
})();
