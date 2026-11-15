/* ============ 小蜜蜂（太空侵略者） ============ */
(function () {
  const W = 480, H = 480;
  const ctx = () => hub.ctx;
  let ship, bullets, ebullets, aliens, dir, stepAcc, fireAcc, efireAcc, wave, alive;

  function reset() {
    wave = 1; bullets = []; ebullets = [];
    ship = { x: W / 2, w: 34, y: H - 30 };
    newWave();
    stepAcc = 0; fireAcc = 0; efireAcc = 0;
    hub.setExtra("<span>WAVE <b id='hud-wave'>1</b></span> <span>ALIENS <b id='hud-left'>0</b></span>");
  }
  function start() {}
  function stop() {}
  function newWave() {
    aliens = [];
    const cols = 8, rows = 4, aw = 34, ah = 22, gx = 14, gy = 14;
    const ox = (W - cols * (aw + gx) + gx) / 2, oy = 60;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        aliens.push({ x: ox + c * (aw + gx), y: oy + r * (ah + gy), w: aw, h: ah,
          row: r, alive: true });
    dir = 1; alive = aliens.length;
    const el = document.getElementById("hud-left");
    if (el) el.textContent = alive;
    const wv = document.getElementById("hud-wave");
    if (wv) wv.textContent = wave;
  }

  function alienSpeed() { return Math.max(120, 520 - wave * 60 - (40 - alive) * 8); }

  function update(dt) {
    stepAcc += dt; fireAcc += dt; efireAcc += dt;
    // 外星人整体移动
    if (stepAcc >= alienSpeed()) {
      stepAcc = 0;
      const dx = 12 * dir;
      const minX = Math.min(...aliens.filter((a) => a.alive).map((a) => a.x));
      const maxX = Math.max(...aliens.filter((a) => a.alive).map((a) => a.x + a.w));
      if ((dir > 0 && maxX + dx > W - 6) || (dir < 0 && minX + dx < 6)) {
        dir = -dir;
        aliens.forEach((a) => (a.y += 16));
      } else aliens.forEach((a) => (a.x += dx));
      // 入侵到底线
      if (aliens.some((a) => a.alive && a.y + a.h >= ship.y - 6)) hub.finish();
    }
    // 玩家子弹
    for (const b of bullets) b.y -= 9;
    bullets = bullets.filter((b) => b.y > -10);
    for (const b of bullets) {
      for (const a of aliens) {
        if (!a.alive) continue;
        if (b.x > a.x && b.x < a.x + a.w && b.y > a.y && b.y < a.y + a.h) {
          a.alive = false; alive--;
          hub.addScore((4 - a.row) * 10);
          b.dead = true;
          const el = document.getElementById("hud-left");
          if (el) el.textContent = alive;
          break;
        }
      }
    }
    bullets = bullets.filter((b) => !b.dead);
    // 敌弹
    if (efireAcc > Math.max(300, 1400 - wave * 150)) {
      efireAcc = 0;
      const shooters = aliens.filter((a) => a.alive);
      if (shooters.length) {
        const s = shooters[(Math.random() * shooters.length) | 0];
        ebullets.push({ x: s.x + s.w / 2, y: s.y + s.h });
      }
    }
    for (const b of ebullets) b.y += 4 + wave * 0.6;
    ebullets = ebullets.filter((b) => b.y < H + 10);
    for (const b of ebullets) {
      if (b.x > ship.x - ship.w / 2 && b.x < ship.x + ship.w / 2 && b.y > ship.y - 8 && b.y < ship.y + 10) {
        hub.finish(); return;
      }
    }
    // 过关
    if (alive === 0) {
      wave++;
      hub.addScore(200);
      bullets = []; ebullets = [];
      newWave();
    }
  }

  function drawAlien(c, a) {
    const flick = Math.floor(performance.now() / alienSpeed()) % 2;
    c.fillStyle = ["#e00000", "#e08000", "#00e000", "#00e0e0"][a.row];
    const x = a.x, y = a.y, w = a.w, h = a.h;
    c.fillRect(x + 6, y, w - 12, 6);
    c.fillRect(x, y + 6, w, h - 10);
    c.fillStyle = "#101020";
    c.fillRect(x + 8, y + 8, 5, 5); c.fillRect(x + w - 13, y + 8, 5, 5);
    c.fillStyle = ["#e00000", "#e08000", "#00e000", "#00e0e0"][a.row];
    const legY = y + h - 4;
    if (flick) { c.fillRect(x + 2, legY, 8, 4); c.fillRect(x + w - 10, legY, 8, 4); }
    else { c.fillRect(x + 10, legY, 8, 4); c.fillRect(x + w - 18, legY, 8, 4); }
  }

  function draw() {
    const c = ctx();
    c.fillStyle = "#101020"; c.fillRect(0, 0, W, H);
    // 星星
    c.fillStyle = "#333355";
    for (let i = 0; i < 30; i++)
      c.fillRect((i * 97) % W, (i * 61) % H, 2, 2);
    aliens.forEach((a) => { if (a.alive) drawAlien(c, a); });
    c.fillStyle = "#e0e000";
    bullets.forEach((b) => c.fillRect(b.x - 1.5, b.y - 6, 3, 10));
    c.fillStyle = "#ff3355";
    ebullets.forEach((b) => c.fillRect(b.x - 1.5, b.y - 4, 3, 8));
    // 飞船
    const sx = ship.x, sy = ship.y;
    c.fillStyle = "#00e000";
    c.fillRect(sx - 6, sy - 12, 12, 10);
    c.fillRect(sx - 17, sy - 4, 34, 8);
    c.fillStyle = Math.floor(performance.now() / 120) % 2 ? "#e08000" : "#e0e000";
    c.fillRect(sx - 3, sy + 4, 6, 6);
  }

  function shoot() {
    if (fireAcc < 260) return;
    fireAcc = 0;
    bullets.push({ x: ship.x, y: ship.y - 12 });
  }
  function onKey(e) {
    const k = e.key.toLowerCase();
    if (k === "arrowleft" || k === "a") ship.x = Math.max(20, ship.x - 26);
    else if (k === "arrowright" || k === "d") ship.x = Math.min(W - 20, ship.x + 26);
    else if (k === " " || k === "arrowup" || k === "w") shoot();
    e.preventDefault();
  }

  hub.register("invaders", {
    name: "小蜜蜂", icon: "👾", sub: "SPACE INVADERS",
    help: ["←→ / AD 移动飞船", "空格 / ↑ 射击（有冷却）", "击毁外星人得分，越靠上越值钱", "被击中或外星人压到防线 GAME OVER"],
    reset, start, stop, update, draw, onKey,
  });
  document.addEventListener("mousemove", (e) => {
    if (hub.currentKey !== "invaders" || hub.state !== "playing") return;
    const r = hub.canvas.getBoundingClientRect();
    ship.x = Math.max(20, Math.min(W - 20, (e.clientX - r.left) * (W / r.width)));
  });
  document.addEventListener("click", () => {
    if (hub.currentKey === "invaders" && hub.state === "playing") shoot();
  });
})();
