// p39: 쉬운 말 · 내부 번호 숨기기 · «추정 포함»
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit
const APP = 'file://' + (process.env.APP || (process.env.WORK || '/home/claude/work') + '/app.html');
(async () => {
  const b = await chromium.launch(); let ok = true; const errs = [];
  const chk = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) ok = false; };
  const c = await b.newContext({ viewport:{ width:1600, height:900 } }); const p = await c.newPage();
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(700); await p.click('#isPeek'); await p.waitForTimeout(1500);
  if (await p.$('#guide.open')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  const sb = await p.evaluate(() => document.querySelector('.scorebox').innerText);
  chk(!/(^|\s)치수(\s|$)/m.test(sb) && !sb.includes('관용') && sb.includes('꼭 고칠 것'), '점수 배지: «꼭 고칠 것»·«흔한 권장» (치수·관용 없음)');
  const conf = await p.evaluate(() => JSON.parse(localStorage.getItem('room-planner/3')).rooms[0].conf);
  const hasGuess = conf && Object.values(conf).includes('추정');
  chk(!!(await p.$('#estChip')) === !!hasGuess, `샘플 방 추정 여부 ${hasGuess} ↔ 칩 ${!!(await p.$('#estChip'))}`);
  await p.click('#listIn .fitem .nm:text-is("책상")'); await p.waitForTimeout(400);
  const sel = await p.evaluate(() => document.getElementById('selBox').innerText.replace(/\s+/g, ' '));
  chk(!/F\d\d/.test(sel) && !sel.includes('좌표') && !sel.includes('W×D') && sel.includes('바닥 차지') && sel.includes('왼쪽 벽'),
      '고른 가구 칸: ' + sel.slice(0, 90));
  chk(sel.includes('작업'), '머리에 분류(작업)');
  // 새 방(문·천장 추정) → 칩, 누르면 안내
  await p.click('#goHome'); await p.waitForTimeout(300); await p.click('#addRoomBtn'); await p.waitForTimeout(400);
  const nm = await p.$('#rmName'); if (nm) { await p.fill('#rmName', '시험방'); }
  await p.fill('#rmW', '3000').catch(() => {}); await p.fill('#rmD', '3000').catch(() => {});
  await p.click('#rmSave').catch(() => {}); await p.waitForTimeout(700);
  const rooms = await p.$$('#roomList .roomcard .nm'); await rooms[rooms.length - 1].click(); await p.waitForTimeout(600);
  await p.click('#addBtn'); await p.waitForTimeout(200); await p.click('#afPre button:has-text("싱글 침대")'); await p.waitForTimeout(700);
  chk(!!(await p.$('#estChip')), '추정이 있는 새 방 → «추정 포함» 칩');
  await p.click('#estChip'); await p.waitForTimeout(300);
  const t = await p.textContent('#toast');
  chk(/짐작했어요/.test(t) && /(천장 높이|문 위치|창문 위치)/.test(t), '칩 안내: ' + t);
  await p.screenshot({ path:(process.env.WORK || '/home/claude/work') + '/p39.png' });
  console.log('\npageerror :', errs.length, errs, ok ? '\n전부 통과' : '\n실패 있음');
  await b.close();
})();
