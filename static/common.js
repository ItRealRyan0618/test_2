/* ============ 游戏大厅公共模块：账户 + 排行榜 + 游戏运行时 ============ */
"use strict";
const $ = (id) => document.getElementById(id);

/* ---------- 网络 ---------- */
async function api(url, opts = {}) {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  return res.json();
}

/* ---------- 账户 ---------- */
let currentUser = null, myBests = {};

function authMsg(text, ok = true) {
  $("auth-msg").textContent = text;
  $("auth-msg").style.color = ok ? "#00e000" : "#ff3355";
  setTimeout(() => ($("auth-msg").textContent = ""), 3000);
}

function refreshUserUI() {
  const loggedIn = !!currentUser;
  $("auth-forms").style.display = loggedIn ? "none" : "";
  $("user-info").style.display = loggedIn ? "" : "none";
  if (loggedIn) {
    $("hello-user").textContent = "PLAYER: " + currentUser.username;
    $("my-best").textContent = "BEST: " + (myBests[hub.currentKey] || 0);
  }
}

async function doLogin() {
  const r = await api("/api/login", { method: "POST",
    body: JSON.stringify({ username: $("auth-username").value, password: $("auth-password").value }) });
  if (r.ok) { authMsg("登录成功！"); await checkSession(); }
  else authMsg(r.msg || "登录失败", false);
}

async function doRegister() {
  const r = await api("/api/register", { method: "POST",
    body: JSON.stringify({ username: $("auth-username").value, password: $("auth-password").value }) });
  if (r.ok) { authMsg("注册成功，已自动登录！"); await checkSession(); }
  else authMsg(r.msg || "注册失败", false);
}

async function doLogout() {
  await api("/api/logout", { method: "POST" });
  currentUser = null; myBests = {};
  authMsg("已退出登录");
  refreshUserUI();
}

async function checkSession() {
  const r = await api("/api/me");
  if (r.ok && r.user) {
    currentUser = r.user;
    // 按当前用户在各游戏的最佳分
    myBests = {};
    const games = Object.keys(hub.games);
    for (const g of games) {
      const res = await api("/api/leaderboard?game=" + g);
      const mine = res.list.find((e) => e.username === currentUser.username);
      myBests[g] = mine ? mine.best : 0;
    }
  }
  refreshUserUI();
}

/* ---------- 排行榜 ---------- */
async function loadBoard(game) {
  const r = await api("/api/leaderboard?game=" + game);
  $("board-title").textContent = "▶ " + (hub.games[game] ? hub.games[game].name : game);
  const tb = $("board-body");
  if (!r.list.length) {
    tb.innerHTML = '<tr><td colspan="4" class="dim">暂无记录，快来抢第一！</td></tr>';
    return;
  }
  tb.innerHTML = r.list.map((e, i) => `<tr>
    <td>${i + 1}</td><td>${escapeHtml(e.username)}</td><td>${e.best}</td><td>${e.plays}</td></tr>`).join("");
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ---------- 游戏运行时 ---------- */
const hub = {
  canvas: null, ctx: null,
  games: {}, currentKey: null, current: null,
  state: "menu", // menu | idle | playing | paused | over
  score: 0, best: 0, raf: 0, last: 0,

  register(key, def) { this.games[key] = def; },

  boot() {
    this.canvas = $("game");
    this.ctx = this.canvas.getContext("2d");
    // 卡带卡片
    const wrap = $("game-cards");
    wrap.innerHTML = "";
    Object.entries(this.games).forEach(([key, g]) => {
      const el = document.createElement("div");
      el.className = "game-card";
      el.innerHTML = `<span class="gc-icon">${g.icon}</span>
        <span class="gc-name">${g.name}</span>
        <span class="gc-sub">${g.sub || ""}</span>`;
      el.onclick = () => this.select(key);
      el.dataset.key = key;
      wrap.appendChild(el);
    });
    this.drawIdle();
    document.addEventListener("keydown", (e) => this.onKey(e));
    this.canvas.addEventListener("click", () => {
      if (this.state === "idle" || this.state === "over") this.start();
    });
    checkSession();
    loadBoard(Object.keys(this.games)[0]);
    requestAnimationFrame((t) => this.loop(t));
  },

  select(key) {
    if (this.current && this.current.stop) this.current.stop();
    this.currentKey = key;
    this.current = this.games[key];
    this.score = 0; this.best = myBests[key] || 0;
    this.state = "idle";
    this.current.reset();
    this.current.draw();
    $("hud-score").textContent = "0";
    $("hud-best").textContent = this.best;
    $("hud-extra").innerHTML = "";
    document.querySelectorAll(".game-card").forEach((el) =>
      el.classList.toggle("active", el.dataset.key === key));
    $("marquee").textContent = "★ " + this.current.name + " ★ 1 PLAYER ★";
    $("help-title").textContent = this.current.name + " · 操作";
    $("help-body").innerHTML = this.current.help.map((h) => "<p>" + h + "</p>").join("")
      + "<p class='dim'>回车 开始 · 空格 暂停</p>";
    refreshUserUI();
    loadBoard(key);
    this.showOverlay(this.current.name, "按 回车 / 点击屏幕 开始");
  },

  start() {
    if (!this.current) return;
    this.score = 0;
    $("hud-score").textContent = "0";
    this.state = "playing";
    this.hideOverlay();
    this.current.reset();
    this.current.start();
  },

  togglePause() {
    if (this.state === "playing") {
      this.state = "paused";
      this.showOverlay("PAUSE", "空格键 继续");
    } else if (this.state === "paused") {
      this.state = "playing";
      this.hideOverlay();
    }
  },

  /* 游戏结束：def 调用 hub.finish() */
  async finish() {
    if (this.state !== "playing") return;
    this.state = "over";
    const s = this.score, game = this.currentKey;
    if (currentUser) {
      const r = await api("/api/score", { method: "POST",
        body: JSON.stringify({ game, score: s }) });
      if (r.ok) { myBests[game] = r.best; $("hud-best").textContent = r.best; refreshUserUI(); }
      loadBoard(game);
    }
    this.showOverlay("GAME OVER",
      s + " 分 · " + (currentUser ? "成绩已保存 · " : "登录可保存成绩 · ") + "回车 重新开始");
  },

  addScore(n) {
    this.score += n;
    $("hud-score").textContent = this.score;
  },
  setExtra(html) { $("hud-extra").innerHTML = html; },

  onKey(e) {
    const tag = (document.activeElement || {}).tagName;
    if (tag === "INPUT") return;
    const k = e.key;
    if (k === "Enter" && (this.state === "idle" || this.state === "over")) {
      e.preventDefault(); this.start(); return;
    }
    if (k === " " && (this.state === "playing" || this.state === "paused")) {
      e.preventDefault(); this.togglePause(); return;
    }
    if (this.state === "playing" && this.current && this.current.onKey) this.current.onKey(e);
  },

  loop(t) {
    const dt = Math.min(50, t - (this.last || t));
    this.last = t;
    if (this.state === "playing" && this.current) {
      this.current.update(dt);
      this.current.draw();
    }
    requestAnimationFrame((tt) => this.loop(tt));
  },

  drawIdle() {
    const c = this.ctx;
    c.fillStyle = "#101020"; c.fillRect(0, 0, 480, 480);
  },

  showOverlay(title, hint) {
    $("overlay-text").textContent = title;
    $("overlay-hint").textContent = hint;
    $("overlay").classList.remove("hidden");
  },
  hideOverlay() { $("overlay").classList.add("hidden"); },
};
window.hub = hub;
