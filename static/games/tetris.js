/* ============ 俄罗斯方块 ============ */
(function () {
  const COLS = 10, ROWS = 20, CELL = 20, OX = 140, OY = 40;
  const SHAPES = {
    I: [[1,1,1,1]],
    O: [[1,1],[1,1]],
    T: [[0,1,0],[1,1,1]],
    S: [[0,1,1],[1,1,0]],
    Z: [[1,1,0],[0,1,1]],
    J: [[1,0,0],[1,1,1]],
    L: [[0,0,1],[1,1,1]],
  };
  const COLORS = { I:"#00e0e0", O:"#e0e000", T:"#b000e0", S:"#00e000", Z:"#e00000", J:"#0030e0", L:"#e08000" };
  const ctx = () => hub.ctx;
  let grid, cur, next, acc, dropMs, level, lines;

  function reset() {
    grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    next = rand();
    spawn();
    acc = 0; dropMs = 600; level = 1; lines = 0;
    hub.setExtra("<span>LEVEL <b id='hud-level'>1</b></span> <span>LINES <b id='hud-lines'>0</b></span>");
  }
  function start() {}
  function stop() {}
  function rand() {
    const ks = Object.keys(SHAPES);
    const k = ks[(Math.random() * ks.length) | 0];
    return { k, m: SHAPES[k].map((r) => r.slice()) };
  }
  function spawn() {
    cur = next; next = rand();
    cur.x = ((COLS - cur.m[0].length) / 2) | 0; cur.y = 0;
    if (collide(cur.m, cur.x, cur.y)) hub.finish();
  }
  function collide(m, px, py) {
    for (let y = 0; y < m.length; y++)
      for (let x = 0; x < m[y].length; x++) {
        if (!m[y][x]) continue;
        const gx = px + x, gy = py + y;
        if (gx < 0 || gx >= COLS || gy >= ROWS) return true;
        if (gy >= 0 && grid[gy][gx]) return true;
      }
    return false;
  }
  function rotate(m) {
    return m[0].map((_, i) => m.map((r) => r[i]).reverse());
  }

  function update(dt) {
    acc += dt;
    if (acc < dropMs) return;
    acc = 0;
    if (!collide(cur.m, cur.x, cur.y + 1)) cur.y++;
    else lock();
  }

  function lock() {
    for (let y = 0; y < cur.m.length; y++)
      for (let x = 0; x < cur.m[y].length; x++) {
        if (!cur.m[y][x]) continue;
        const gy = cur.y + y;
        if (gy < 0) { hub.finish(); return; }
        grid[gy][cur.x + x] = cur.k;
      }
    let cleared = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      if (grid[y].every((v) => v)) {
        grid.splice(y, 1);
        grid.unshift(Array(COLS).fill(null));
        cleared++; y++;
      }
    }
    if (cleared) {
      hub.addScore([0, 40, 100, 300, 1200][cleared] * level);
      lines += cleared;
      const nl = 1 + ((lines / 10) | 0);
      if (nl !== level) { level = nl; dropMs = Math.max(120, 600 - (level - 1) * 55); }
      const le = document.getElementById("hud-level"), li = document.getElementById("hud-lines");
      if (le) le.textContent = level;
      if (li) li.textContent = lines;
    }
    spawn();
  }

  function ghostY() {
    let y = cur.y;
    while (!collide(cur.m, cur.x, y + 1)) y++;
    return y;
  }

  function draw() {
    const c = ctx();
    c.fillStyle = "#101020"; c.fillRect(0, 0, 480, 480);
    c.strokeStyle = "#2a2a45";
    for (let x = 0; x <= COLS; x++) line(c, OX + x * CELL, OY, OX + x * CELL, OY + ROWS * CELL);
    for (let y = 0; y <= ROWS; y++) line(c, OX, OY + y * CELL, OX + COLS * CELL, OY + y * CELL);
    // 幽灵投影
    c.globalAlpha = 0.22;
    drawM(c, cur.m, cur.x, ghostY(), COLORS[cur.k]);
    c.globalAlpha = 1;
    for (let y = 0; y < ROWS; y++)
      for (let x = 0; x < COLS; x++)
        if (grid[y][x]) block(c, OX + x * CELL, OY + y * CELL, COLORS[grid[y][x]]);
    drawM(c, cur.m, cur.x, cur.y, COLORS[cur.k]);
    // 侧边信息
    c.fillStyle = "#cfcfe0"; c.font = "12px monospace"; c.textAlign = "left";
    c.fillText("NEXT", 30, 70);
    drawM(c, next.m, 1, 2, COLORS[next.k], 16, 16, 30, 72);
    c.fillText("LEVEL " + level, 30, 180);
    c.fillText("LINES " + lines, 30, 205);
    c.fillText("SCORE " + hub.score, 30, 245);
  }
  function drawM(c, m, gx, gy, color, cw, ch, px, py) {
    cw = cw || CELL; ch = ch || CELL;
    for (let y = 0; y < m.length; y++)
      for (let x = 0; x < m[y].length; x++)
        if (m[y][x]) block(c, (px !== undefined ? px : OX) + x * cw + (px !== undefined ? 0 : gx * CELL),
          (py !== undefined ? py : OY) + y * ch + (py !== undefined ? 0 : gy * CELL), color, cw, ch);
  }
  function block(c, x, y, color, w, h) {
    w = w || CELL; h = h || CELL;
    c.fillStyle = color; c.fillRect(x + 1, y + 1, w - 2, h - 2);
    c.fillStyle = "rgba(255,255,255,.35)"; c.fillRect(x + 1, y + 1, w - 2, 3);
  }
  function line(c, x1, y1, x2, y2) {
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
  }

  function onKey(e) {
    const k = e.key;
    if (k === "ArrowLeft" || k === "a") { if (!collide(cur.m, cur.x - 1, cur.y)) cur.x--; }
    else if (k === "ArrowRight" || k === "d") { if (!collide(cur.m, cur.x + 1, cur.y)) cur.x++; }
    else if (k === "ArrowDown" || k === "s") { if (!collide(cur.m, cur.x, cur.y + 1)) cur.y++; }
    else if (k === "ArrowUp" || k === "w") {
      const r = rotate(cur.m);
      for (const dx of [0, -1, 1, -2, 2])
        if (!collide(r, cur.x + dx, cur.y)) { cur.m = r; cur.x += dx; break; }
    } else if (k === " ") {
      e.preventDefault();
      while (!collide(cur.m, cur.x, cur.y + 1)) cur.y++;
      lock();
    }
    e.preventDefault();
  }

  hub.register("tetris", {
    name: "俄罗斯方块", icon: "🧱", sub: "TETRIS",
    help: ["←→ 移动 · ↓ 加速下落", "↑ 旋转 · 空格 硬降", "消行得分 × 等级", "方块堆到顶部 GAME OVER"],
    reset, start, stop, update, draw, onKey,
  });
})();
