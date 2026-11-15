/* ============ 贪吃蛇 ============ */
(function () {
  const CELL = 24, COLS = 20, ROWS = 20;
  const canvas = () => hub.canvas, ctx = () => hub.ctx;
  let snake, dir, nextDir, food, acc, tickMs;

  function reset() {
    snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
    dir = { x: 1, y: 0 }; nextDir = dir;
    acc = 0; tickMs = 150;
    placeFood();
    hub.setExtra("<span>SPEED <b id='hud-speed'>1</b></span>");
  }
  function start() {}
  function stop() {}

  function placeFood() {
    do {
      food = { x: (Math.random() * COLS) | 0, y: (Math.random() * ROWS) | 0 };
    } while (snake.some((s) => s.x === food.x && s.y === food.y));
  }

  function speedLv() { return Math.min(9, 1 + ((150 - tickMs) / 12 | 0)); }

  function update(dt) {
    acc += dt;
    if (acc < tickMs) return;
    acc = 0;
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
    if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS ||
        snake.some((s) => s.x === head.x && s.y === head.y)) {
      hub.finish(); return;
    }
    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      hub.addScore(10);
      if (hub.score % 50 === 0 && tickMs > 60) {
        tickMs -= 12;
        const el = document.getElementById("hud-speed");
        if (el) el.textContent = speedLv();
      }
      placeFood();
    } else snake.pop();
  }

  function draw() {
    const c = ctx();
    c.fillStyle = "#101020"; c.fillRect(0, 0, 480, 480);
    c.fillStyle = "#181830";
    for (let x = 0; x < COLS; x++)
      for (let y = 0; y < ROWS; y++)
        if ((x + y) % 2 === 0) c.fillRect(x * CELL, y * CELL, CELL, CELL);
    c.fillStyle = Math.floor(performance.now() / 250) % 2 ? "#e40058" : "#ff5c8a";
    c.fillRect(food.x * CELL + 4, food.y * CELL + 4, CELL - 8, CELL - 8);
    snake.forEach((s, i) => {
      c.fillStyle = i === 0 ? "#8ee000" : i % 2 ? "#00a800" : "#00c018";
      c.fillRect(s.x * CELL + 2, s.y * CELL + 2, CELL - 4, CELL - 4);
    });
    const h = snake[0];
    c.fillStyle = "#101020";
    const ex = h.x * CELL + (dir.x === 1 ? 14 : dir.x === -1 ? 4 : 8);
    const ey = h.y * CELL + (dir.y === 1 ? 14 : dir.y === -1 ? 4 : 8);
    c.fillRect(ex, ey, 4, 4);
    c.fillRect(ex + (dir.y !== 0 ? 8 : 0), ey + (dir.x !== 0 ? 8 : 0), 4, 4);
  }

  function onKey(e) {
    const map = {
      arrowup: [0, -1], w: [0, -1], arrowdown: [0, 1], s: [0, 1],
      arrowleft: [-1, 0], a: [-1, 0], arrowright: [1, 0], d: [1, 0],
    };
    const d = map[e.key.toLowerCase()];
    if (!d) return;
    e.preventDefault();
    if (!(d[0] === -dir.x && d[1] === -dir.y)) nextDir = { x: d[0], y: d[1] };
  }

  hub.register("snake", {
    name: "贪吃蛇", icon: "🐍", sub: "SNAKE",
    help: ["↑↓←→ / WASD 移动", "吃食物 +10 分", "每 50 分提速", "撞墙或咬到自己 GAME OVER"],
    reset, start, stop, update, draw, onKey,
  });
})();
