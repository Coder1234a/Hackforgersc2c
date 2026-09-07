const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 620 } });
  const errs = [];
  p.on('pageerror', e => errs.push('ERR ' + e.message));
  await p.goto('file://' + __dirname + '/game/index.html');
  await p.waitForTimeout(900);
  for (const ch of 'ANIKEIT') await p.keyboard.press(ch);
  await p.keyboard.press('Enter'); await p.waitForTimeout(300);

  const call = async (arena) => {
    await p.evaluate(a => { levelIndex = a; newAttempt(); tutorialStep = -1; introTimer = 0; screen = 'WON'; }, arena);
    await p.waitForTimeout(150);
    await p.keyboard.press('c'); await p.waitForTimeout(200);
    // pick whatever the real rule is, so we get a CORRECT card at least once
    await p.evaluate(() => { pick(activeRule); });
    await p.waitForTimeout(100);
    await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  };

  await call(1);
  console.log('reveal up?  ', JSON.stringify(await p.evaluate(() => ({
    screen, shown: !document.getElementById('reveal').hidden,
    verdict: (document.querySelector('.verdict') || {}).textContent,
    btns: [...document.querySelectorAll('.acts .btn')].map(b => b.textContent)
  }))));
  await p.screenshot({ path: 'f3_reveal.png' });

  // click "Next arena"
  await p.click('#btnNext'); await p.waitForTimeout(600);
  console.log('after button', JSON.stringify(await p.evaluate(() => ({ screen, arena: level.name }))));

  await call(3);   // last arena
  console.log('last card   ', JSON.stringify(await p.evaluate(() => ({
    btns: [...document.querySelectorAll('.acts .btn')].map(b => b.textContent)
  }))));
  await p.click('#btnNext'); await p.waitForTimeout(700);
  console.log('end screen  ', JSON.stringify(await p.evaluate(() => ({
    screen, revealShown: !document.getElementById('reveal').hidden,
    boardRows: (typeof leaderboard === 'function' ? leaderboard(6).length : -1)
  }))));
  await p.screenshot({ path: 'f3_end.png' });
  console.log(errs.length ? errs.join('\n') : 'no page errors');
  await b.close();
})();
