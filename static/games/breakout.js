/* ============ 打砖块 ============ */
(function () {
  const W = 480, H = 480;
  const ctx = () => hub.ctx;
  const ROW_COLORS = ["#e00000", "#e08000", "#e0e000", "#00e000", "#00e0e0"];
  let paddle, ball, bricks, lives, level, acc, stuck, vx, vy;

  function reset() {
    level = 1; lives = 3;
    paddle = { w: 90, h: 12, x: (W - 90) / 2, y: H - 30 };
    newBall();
    buildBricks();
    acc = 0;
    hub.setExtra("<span>LIVES <b id='hud-lives'>3</b></span> <span>LEVEL <b id='hud-lv'>1</b></span>");
  }
  function start() {}
  function stop() {}
  function newBall() { ball = { x: W / 2, y: H - 50, r: 7 }; stuck = true; vx = 0; vy = 0; }
  function buildBricks() {
    bricks = [];
    const cols = 10, bw = 44, bh = 18, gap = 4, ox = (W - cols * (bw + gap) + gap) / 2;
    const rows = Math.min(5 + level, 8);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++)
        bricks.push({ x: ox + c * (bw + gap), y: 50 + r * (bh + gap), w: bw, h: bh, color: ROW_COLORS[r % 5], alive: true });
  }
  function launch() {
    if (!stuck) return;
    stuck = false;
    const a = (Math.random() * 0.5 + 0.5) * Math.PI; // 朝上扇形
    const sp = 5 + level * 0.4;
    vx = Math.cos(a) * sp * (Math.random() < 0.5 ? -1 : 1);
    vy = -Math.abs(Math.sin(a)) * sp;
  }
  function setLives() { const el = document.getElementById("hud-lives"); if (el) el.textContent = lives; }
  function setLv() { const el = document.getElementById("hud-lv"); if (el) el.textContent = level; }

  function update(dt) {
    acc += dt;
    const step = 16;
    while (acc >= step) { acc -= step; move(step); if (hub.state !== "playing") return; }
  }
  function move() {
    if (stuck) { ball.x = paddle.x + paddle.w / 2; ball.y = paddle.y - 10; return; }
    ball.x += vx; ball.y += vy;
    // 墙壁
    if (ball.x < ball.r) { ball.x = ball.r; vx = -vx; }
    if (ball.x > W - ball.r) { ball.x = W - ball.r; vx = -vx; }
    if (ball.y < ball.r) { ball.y = ball.r; vy = -vy; }
    // 掉到底
    if (ball.y > H + ball.r) {
      lives--; setLives();
      if (lives <= 0) { hub.finish(); return; }
      newBall();
    }
    // 挡板
    if (vy > 0 && ball.y + ball.r >= paddle.y && ball.y - ball.r <= paddle.y + paddle.h &&
        ball.x >= paddle.x && ball.x <= paddle.x + paddle.w) {
      const ratio = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); // -1..1
      const sp = Math.min(9, Math.hypot(vx, vy) * 1.02);
      const a = -Math.PI / 2 + ratio * 1.1;
      vx = Math.cos(a) * sp; vy = Math.sin(a) * sp;
      ball.y = paddle.y - ball.r;
    }
    // 砖块
    for (const b of bricks) {
      if (!b.alive) continue;
      if (ball.x + ball.r > b.x && ball.x - ball.r < b.x + b.w &&
          ball.y + ball.r > b.y && ball.y - ball.r < b.y + b.h) {
        b.alive = false;
        hub.addScore(10);
        // 反弹：按穿透较浅方向
        const ox1 = ball.x + ball.r - b.x, ox2 = b.x + b.w - (ball.x - ball.r);
        const oy1 = ball.y + ball.r - b.y, oy2 = b.y + b.h - (ball.y - ball.r);
        const m = Math.min(ox1, ox2, oy1, oy2);
        if (m === ox1 || m === ox2) vx = -vx; else vy = -vy;
        break;
      }
    }
    if (bricks.every((b) => !b.alive)) {
      level++; setLv();
      hub.addScore(100);
      newBall();
      buildBricks();
    }
  }

  function draw() {
    const c = ctx();
    c.fillStyle = "#101020"; c.fillRect(0, 0, W, H);
    for (const b of bricks) {
      if (!b.alive) continue;
      c.fillStyle = b.color; c.fillRect(b.x, b.y, b.w, b.h);
      c.fillStyle = "rgba(255,255,255,.3)"; c.fillRect(b.x, b.y, b.w, 3);
    }
    c.fillStyle = "#e0e0e0"; c.fillRect(paddle.x, paddle.y, paddle.w, paddle.h);
    c.fillStyle = "#fff";
    c.beginPath(); c.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2); c.fill();
    if (stuck) {
      c.fillStyle = "#cfcfe0"; c.font = "12px monospace"; c.textAlign = "center";
      c.fillText("点击 / 空格 发球", W / 2, H / 2);
    }
  }

  function onKey(e) {
    const k = e.key.toLowerCase();
    if (k === " " || k === "enter") launch();
    else if (k === "arrowleft" || k === "a") paddle.x = Math.max(0, paddle.x - 34);
    else if (k === "arrowright" || k === "d") paddle.x = Math.min(W - paddle.w, paddle.x + 34);
    e.preventDefault();
  }

  hub.register("breakout", {
    name: "打砖块", icon: "🧊", sub: "BREAKOUT",
    help: ["←→ / AD 移动挡板", "空格 / 回车 发球", "砖块 +10 分 · 通关 +100", "球落到底部 损失一命"],
    reset, start, stop, update, draw, onKey,
  });
  // 鼠标控制挡板
  document.addEventListener("mousemove", (e) => {
    if (hub.currentKey !== "breakout" || hub.state !== "playing") return;
    const r = hub.canvas.getBoundingClientRect();
    const x = (e.clientX - r.left) * (W / r.width);
    paddle.x = Math.max(0, Math.min(W - paddle.w, x - paddle.w / 2));
  });
  document.addEventListener("click", () => {
    if (hub.currentKey === "breakout" && hub.state === "playing") launch();
  });
})();
