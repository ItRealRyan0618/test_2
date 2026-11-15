#!/usr/bin/env python3
"""部署前自检：python check.py [项目目录]

只做静态检查，不联网、不安装依赖，几秒内出结果。
任何一项失败都应先修复，再提交到 GitHub。
"""
import re
import sys
from pathlib import Path

RULES = []


def rule(title):
    def wrapper(fn):
        RULES.append((title, fn))
        return fn
    return wrapper


@rule("根目录存在 app.py")
def check_app_file(root):
    if not (root / "app.py").is_file():
        return False, "根目录没有 app.py"
    return True, "app.py"


@rule("app.py 暴露名为 app 的 Flask 实例")
def check_app_object(root):
    text = (root / "app.py").read_text(encoding="utf-8", errors="ignore")
    if not re.search(r"^\s*app\s*=\s*Flask\(", text, re.M):
        return False, "未找到 app = Flask(__name__)，gunicorn 无法启动"
    return True, "app = Flask(...)"


@rule("代码里没有 app.run()")
def check_no_run(root):
    hits = []
    for path in root.rglob("*.py"):
        if path.resolve() == (root / "check.py").resolve():
            continue  # 跳过检查器自身
        if any(part in {".venv", "venv", "__pycache__"} for part in path.parts):
            continue
        for idx, line in enumerate(path.read_text(encoding="utf-8", errors="ignore").splitlines(), 1):
            if "app.run(" in line or ".run(host=" in line:
                hits.append(f"{path.relative_to(root)}:{idx}")
    if hits:
        return False, "线上由 gunicorn 启动，请删除 / 注释 app.run()：" + "、".join(hits[:3])
    return True, "无 app.run()"


@rule("提供 /healthz 健康检查")
def check_healthz(root):
    text = (root / "app.py").read_text(encoding="utf-8", errors="ignore")
    if "/healthz" not in text:
        return False, "未找到 /healthz 路由（部署脚本靠它判断启动成功）"
    return True, "/healthz"


@rule("存在 requirements.txt")
def check_requirements(root):
    path = root / "requirements.txt"
    if not path.is_file():
        return False, "缺少 requirements.txt"
    lines = [ln.strip() for ln in path.read_text(encoding="utf-8").splitlines()
             if ln.strip() and not ln.strip().startswith("#")]
    unpinned = [ln for ln in lines if "==" not in ln]
    if unpinned:
        return False, "依赖未锁定版本（用 name==x.y.z）：" + "、".join(unpinned[:3])
    return True, f"{len(lines)} 项依赖均已锁定"


@rule("requirements.txt 包含 gunicorn")
def check_gunicorn(root):
    text = (root / "requirements.txt").read_text(encoding="utf-8").lower()
    if "gunicorn" not in text:
        return False, "缺少 gunicorn，线上无法启动"
    return True, "gunicorn"


@rule("使用 DATA_DIR 存放数据")
def check_data_dir(root):
    sources = [p for p in root.glob("*.py") if "DATA_DIR" in p.read_text(encoding="utf-8", errors="ignore")]
    if not sources:
        return False, "未使用 DATA_DIR，部署后数据会写在代码目录并被覆盖"
    return True, "DATA_DIR"


@rule("仓库里没有运行时数据文件")
def check_no_data_files(root):
    bad = [p.name for p in root.glob("*.json")
           if p.name not in {"package.json"}]
    if bad:
        return False, "根目录存在数据文件（应放到 DATA_DIR 并加入 .gitignore）：" + "、".join(bad[:3])
    return True, "未提交数据文件"


@rule(".gitignore 忽略数据与虚拟环境")
def check_gitignore(root):
    path = root / ".gitignore"
    if not path.is_file():
        return False, "缺少 .gitignore"
    text = path.read_text(encoding="utf-8")
    missing = [k for k in ("data/", "__pycache__") if k not in text]
    if missing:
        return False, ".gitignore 缺少：" + "、".join(missing)
    return True, ".gitignore"


@rule("模板与静态资源目录规范")
def check_structure(root):
    app_text = (root / "app.py").read_text(encoding="utf-8", errors="ignore")
    if "render_template" in app_text and not (root / "templates").is_dir():
        return False, "使用了 render_template，但缺少 templates/ 目录"
    if not (root / "static").is_dir():
        return False, "缺少 static/ 目录"
    return True, "templates/ static/"


@rule("仓库里没有数据库文件")
def check_no_db_files(root):
    bad = []
    for path in root.rglob("*"):
        if any(part in {".venv", "venv", "__pycache__", ".git", "node_modules"} for part in path.parts):
            continue
        if path.is_file() and path.suffix.lower() in {".db", ".sqlite", ".sqlite3"}:
            bad.append(str(path.relative_to(root)))
    if bad:
        return False, "仓库里提交了数据库文件（应放到 DATA_DIR 并 ignore）：" + "、".join(bad[:3])
    return True, "无数据库文件"


@rule("初始数据只作种子，不覆盖线上数据")
def check_seed_safe(root):
    seeds = root / "seeds"
    if not seeds.is_dir():
        return True, "未使用 seeds/"
    sources = []
    for path in root.rglob("*.py"):
        if any(part in {".venv", "venv", "__pycache__"} for part in path.parts):
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if "seeds" in text:
            sources.append((path, text))
    if not sources:
        return False, "存在 seeds/ 但代码没有引用，或未做播种判断"
    unsafe = [str(p.relative_to(root)) for p, text in sources if "exists()" not in text]
    if unsafe:
        return False, ("播种前缺少存在性判断，会覆盖线上数据：" + "、".join(unsafe[:3])
                       + "，请用 if not DB_PATH.exists() 保护")
    return True, "seeds/ 仅在数据不存在时导入"


def main():
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    print(f"部署前自检：{root}\n")

    failed = 0
    for idx, (title, fn) in enumerate(RULES, 1):
        try:
            ok, detail = fn(root)
        except Exception as exc:  # 单个规则异常不影响其他规则
            ok, detail = False, f"检查出错：{exc}"
        print(f"{'✓' if ok else '✗'} 规则 {idx}  {title}\n        {detail}")
        if not ok:
            failed += 1

    print()
    if failed:
        print(f"{failed} 项未通过，请修复后重新运行 python check.py")
        return 1
    print(f"全部 {len(RULES)} 项通过，可以提交到 GitHub 了")
    return 0


if __name__ == "__main__":
    sys.exit(main())
