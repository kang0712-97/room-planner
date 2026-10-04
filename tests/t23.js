/* 창의 «확인·취소» 줄이 언제나 손에 닿는가.
   ⚠️ 화면이 낮을수록 잘 터진다. 안드로이드 크롬은 주소창이 보이는 동안
      실제 보이는 높이가 vh 보다 «작아서», 92vh 짜리 창의 아래가 잘려 나간다.
      헤드리스에는 주소창이 없으므로 여기서는 «낮은 화면» 으로 대신 잰다. */
const chromium = require('playwright')[process.env.BROWSER || 'chromium'];   // CI: BROWSER=webkit

const SIZES = [ [390, 844], [390, 640], [360, 560] ];

(async () => {
  const b = await chromium.launch();
  const errs = [];

  for (const [W, H] of SIZES) {
    const ctx = await b.newContext({ viewport: { width: W, height: H },
                                     deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(`${W}×${H} ${e}`));
    await p.goto('file://' + (process.env.APP22 || process.env.APP || (process.env.WORK || '/home/claude/work') + '/app22.html'));
    await p.waitForTimeout(700);
    await p.keyboard.press('Escape'); await p.waitForTimeout(1500);
    if (await p.$('#guide.open')) { await p.click('#gClose'); await p.waitForTimeout(400); }
    await p.click('#roomList .roomcard .nm').catch(async () => {
      await p.click('#tabbar [data-tab="list"]'); await p.waitForTimeout(300);
      await p.click('#roomList .roomcard .nm');
    });
    await p.waitForTimeout(500);

    console.log(`\n━━ ${W} × ${H} ━━`);

    /* 창 하나를 열고, 확인 줄의 버튼마다 «진짜로 그 자리에 있는지» 를 잰다.
       화면 안에 있느냐만 보면 부족하다 — 다른 것에 덮여 있으면 눌러도 안 눌린다.
       elementFromPoint 로 «그 점을 누르면 그 버튼이 잡히는지» 를 확인한다. */
    const check = async (label, open, close) => {
      await open();
      await p.waitForTimeout(500);
      const r = await p.evaluate(() => {
        const box = document.querySelector('.modal.open .sheetbox');
        if (!box) return { err: '창이 안 열렸다' };
        const acts = box.querySelector('.acts');
        if (!acts) return { err: '확인 줄이 없다' };
        const vh = window.innerHeight;
        const bb = box.getBoundingClientRect(), ab = acts.getBoundingClientRect();
        const btns = [...acts.querySelectorAll('button')].map(n => {
          const q = n.getBoundingClientRect();
          const x = q.left + q.width / 2, y = q.top + q.height / 2;
          const hit = document.elementFromPoint(x, y);
          return { t: (n.textContent || '').trim().slice(0, 6),
                   inView: q.top >= 0 && q.bottom <= vh + 0.5,
                   h: Math.round(q.height),
                   hit: !!(hit && (hit === n || n.contains(hit))) };
        });
        return { vh, boxH: Math.round(bb.height), boxBottom: Math.round(bb.bottom),
                 actsBottom: Math.round(ab.bottom),
                 scrolls: box.scrollHeight > box.clientHeight + 1, btns };
      });
      if (r.err) { console.log(`  ${label} : ❌ ${r.err}`); return; }
      const bad = r.btns.filter(x => !x.inView || !x.hit || x.h < 32);
      console.log(`  ${label} : 창 ${r.boxH}px / 화면 ${r.vh}px` +
                  (r.scrolls ? ' · 안에서 스크롤됨' : '') +
                  `  →  ${bad.length ? '❌ ' + bad.map(x => `${x.t}(${x.inView ? '' : '화면밖 '}${x.hit ? '' : '가려짐 '}${x.h}px)`).join(', ')
                                     : '✓ ' + r.btns.map(x => x.t).join(' · ') + ' 모두 닿는다'}`);

      /* 창을 맨 위로 굴려 놓아도 확인 줄은 바닥에 붙어 있어야 한다 */
      const stick = await p.evaluate(() => {
        const box = document.querySelector('.modal.open .sheetbox');
        box.scrollTop = 0;
        const a = box.querySelector('.acts').getBoundingClientRect();
        return { ok: a.bottom <= window.innerHeight + 0.5 && a.top >= 0 };
      });
      if (!stick.ok) console.log('        ❌ 맨 위로 굴리면 확인 줄이 사라진다');
      await close();
      await p.waitForTimeout(400);
    };

    /* 폰에서는 버튼들이 시트 안에 있다 — 탭으로 열고 들어간다 */
    const sheet = async name => { await p.click(`#tabbar [data-tab="${name}"]`);
                                  await p.waitForTimeout(400); };
    await check('놓기(가구 추가)',
      async () => { await sheet('add'); await p.click('#apModal [data-ap="furn"]'); await p.waitForTimeout(300); await p.click('#afOwn'); }, () => p.click('#afCancel'));   // p65 — «추가» 는 «직접 입력» 을 펼쳐야 보인다   // p37 부터 «추가» 탭은 먼저 가구·문·창문을 고른다
    await check('문 · 창문',
      async () => { await sheet('list');
                    await p.click('#openList .opitem [data-act="edit"]'); },
      () => p.click('#opCancel'));
    await check('방 수정',
      async () => { await sheet('more'); await p.click('#goHome');
                    await p.waitForTimeout(700);
                    /* goHome 은 폰에서 목록 시트를 «스스로» 연다 — 또 누르면 도로 닫힌다 */
                    if (!await p.$eval('body', n => n.classList.contains('sh-list'))) await sheet('list');
                    await p.click('#roomList .roomcard [data-act="edit"]'); },
      () => p.keyboard.press('Escape'));

    await ctx.close();
  }

  console.log('\npageerror :', errs.length ? errs : 0);
  await b.close();
})();
