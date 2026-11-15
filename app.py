# -*- coding: utf-8 -*-
"""红白机游戏厅 - Flask + SQLite 后端"""
import os
import sqlite3
import secrets
from datetime import datetime

from flask import Flask, request, jsonify, session, send_from_directory, g
from werkzeug.security import generate_password_hash, check_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "game.db")

app = Flask(__name__, static_folder="static", static_url_path="/static")
app.secret_key = secrets.token_hex(32)


# ---------- 数据库 ----------
def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    db = sqlite3.connect(DB_PATH)
    db.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        game TEXT NOT NULL,
        score INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
    CREATE INDEX IF NOT EXISTS idx_scores_game ON scores(game, score DESC);
    """)
    db.commit()
    db.close()


def current_user():
    uid = session.get("user_id")
    if not uid:
        return None
    row = get_db().execute("SELECT id, username FROM users WHERE id=?", (uid,)).fetchone()
    return dict(row) if row else None


@app.after_request
def no_cache(resp):
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    resp.headers["Expires"] = "0"
    return resp


# ---------- 页面 ----------
@app.route("/")
def index():
    return send_from_directory("static", "index.html")


# ---------- 认证 API ----------
@app.route("/api/register", methods=["POST"])
def register():
    data = request.get_json(force=True, silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    if not (3 <= len(username) <= 20) or not username.isalnum():
        return jsonify(ok=False, msg="用户名需为 3-20 位字母或数字"), 400
    if len(password) < 6:
        return jsonify(ok=False, msg="密码至少 6 位"), 400
    db = get_db()
    try:
        cur = db.execute(
            "INSERT INTO users(username, password_hash, created_at) VALUES(?,?,?)",
            (username, generate_password_hash(password), datetime.now().isoformat()),
        )
        db.commit()
    except sqlite3.IntegrityError:
        return jsonify(ok=False, msg="用户名已被注册"), 409
    session["user_id"] = cur.lastrowid
    return jsonify(ok=True, username=username)


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(force=True, silent=True) or {}
    username = (data.get("username") or "").strip()
    password = data.get("password") or ""
    row = get_db().execute("SELECT * FROM users WHERE username=?", (username,)).fetchone()
    if not row or not check_password_hash(row["password_hash"], password):
        return jsonify(ok=False, msg="用户名或密码错误"), 401
    session["user_id"] = row["id"]
    return jsonify(ok=True, username=row["username"])


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify(ok=True)


@app.route("/api/me")
def me():
    user = current_user()
    return jsonify(ok=True, user=user)


# ---------- 分数 API ----------
@app.route("/api/score", methods=["POST"])
def submit_score():
    user = current_user()
    if not user:
        return jsonify(ok=False, msg="请先登录"), 401
    data = request.get_json(force=True, silent=True) or {}
    game = str(data.get("game") or "snake")[:20]
    try:
        score = int(data.get("score"))
    except (TypeError, ValueError):
        return jsonify(ok=False, msg="分数格式错误"), 400
    if not (0 <= score <= 10_000_000):
        return jsonify(ok=False, msg="分数超出范围"), 400
    db = get_db()
    db.execute(
        "INSERT INTO scores(user_id, game, score, created_at) VALUES(?,?,?,?)",
        (user["id"], game, score, datetime.now().isoformat()),
    )
    db.commit()
    best = db.execute(
        "SELECT MAX(score) AS m FROM scores WHERE user_id=? AND game=?",
        (user["id"], game),
    ).fetchone()["m"]
    return jsonify(ok=True, best=best)


@app.route("/api/leaderboard")
def leaderboard():
    game = request.args.get("game", "snake")
    rows = get_db().execute("""
        SELECT u.username, MAX(s.score) AS best, COUNT(s.id) AS plays,
               MAX(s.created_at) AS last_play
        FROM scores s JOIN users u ON u.id = s.user_id
        WHERE s.game = ?
        GROUP BY s.user_id
        ORDER BY best DESC
        LIMIT 10
    """, (game,)).fetchall()
    return jsonify(ok=True, list=[dict(r) for r in rows])


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=7151, debug=False)
