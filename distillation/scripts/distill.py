#!/usr/bin/env python3
"""蒸馏工具箱：初始化 / 审计 / 周报。

用法:
    python3 distill.py init   [--root .]
    python3 distill.py audit  [--root .] [--stale-days 14]
    python3 distill.py digest [--root .] [--days 7]

退出码:
    init   0 = 就绪（已存在则不覆盖）
    audit  0 = PASS（可有警告），1 = FAIL
    digest 0 = 正常输出
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

TYPES = ("decision", "preference", "method", "pitfall", "tool", "agent", "one-off")
STATUSES = ("raw", "confirmed", "promoted", "dropped")
REQUIRED_INBOX = ("原话", "场景", "证据", "候选", "状态")
REQUIRED_DECISION = ("状态", "决定", "理由", "证据")
INBOX_KEYS = REQUIRED_INBOX + ("晋升到", "推断", "原因")
CANDIDATE_HINTS = ("规则", "技能", "工具", "角色", "决策", "日志", "丢弃", "drop")
RULE_FILES = ("AGENTS.md", "CLAUDE.md", ".cursorrules")
SKILL_DIRS = (".opencode/skills", "skills", ".claude/skills")
TOOL_DIRS = (".opencode/tools", "scripts")

DEFAULT_CONFIG = {
    "stale_days": 14,
    "inbox": ".distill/inbox",
    "decisions": ".distill/decisions",
    "rules": [],
    "skills": [],
    "tools": [],
}

ENTRY_RE = re.compile(r"(?m)^###[ \t]+(E-\d{8}-\d{2})[ \t]*(?:·|\||-)[ \t]*([A-Za-z-]+)[ \t]*$")
FIELD_RE = re.compile(r"(?m)^-[ \t]+([^:：\n]+?)[ \t]*[:：][ \t]*(.*)$")
DECISION_FILE_RE = re.compile(r"^\d{3}-.+\.md$")
DATE_IN_ID_RE = re.compile(r"^E-(\d{4})(\d{2})(\d{2})-\d{2}$")


# ---------- 基础 ----------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="AI 蒸馏工具箱")
    p.add_argument("command", choices=("init", "audit", "digest"))
    p.add_argument("--root", default=".", help="项目根目录，默认当前目录")
    p.add_argument("--stale-days", type=int, default=None, help="raw 超过多少天算过期（默认读配置）")
    p.add_argument("--days", type=int, default=7, help="周报回看天数，默认 7")
    return p.parse_args()


def load_config(root: Path) -> dict:
    path = root / ".distill" / "config.json"
    if not path.is_file():
        raise SystemExit(f"✗ 未初始化：找不到 {path}（先运行 init）")
    try:
        cfg = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"✗ 配置不是合法 JSON: {path}（{exc}）")
    merged = dict(DEFAULT_CONFIG)
    merged.update(cfg)
    return merged


def entry_date(entry_id: str) -> date | None:
    m = DATE_IN_ID_RE.match(entry_id)
    if not m:
        return None
    try:
        return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    except ValueError:
        return None


# ---------- inbox 解析 ----------

def parse_entries(text: str) -> list[dict]:
    marks = list(ENTRY_RE.finditer(text))
    entries = []
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(text)
        block = text[m.start():end]
        fields: dict[str, str] = {}
        for fm in FIELD_RE.finditer(block):
            key = fm.group(1).strip()
            if key in INBOX_KEYS and key not in fields:
                fields[key] = fm.group(2).strip()
        entries.append({
            "id": m.group(1),
            "type": m.group(2),
            "fields": fields,
            "block": block,
        })
    return entries


def read_inbox(root: Path, cfg: dict) -> tuple[list[dict], list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    inbox = root / cfg["inbox"]
    if not inbox.is_dir():
        errors.append(f"inbox 目录不存在: {cfg['inbox']}")
        return [], errors, warnings

    entries: list[dict] = []
    files = [f for f in sorted(inbox.glob("*.md")) if f.name.lower() != "readme.md"]
    if not files:
        warnings.append("inbox 还没有按天文件（捕获触发点可能没生效）")

    for f in files:
        if not re.match(r"^\d{4}-\d{2}-\d{2}\.md$", f.name):
            warnings.append(f"inbox 文件名不是 YYYY-MM-DD.md: {f.name}")
            continue
        text = f.read_text(encoding="utf-8")
        parsed = parse_entries(text)
        if not parsed:
            warnings.append(f"{f.name} 没有条目（格式见 references/capture.md）")
            continue
        for e in parsed:
            e["file"] = f.name
            entries.append(e)
    return entries, errors, warnings


def audit_inbox(root: Path, cfg: dict, stale_days: int) -> tuple[list[dict], list[str], list[str]]:
    entries, errors, warnings = read_inbox(root, cfg)
    quotes: dict[str, str] = {}

    for e in entries:
        where = f"{e['file']} {e['id']}"
        if e["type"] not in TYPES:
            errors.append(f"{where} 类型未知: {e['type']}（可选: {', '.join(TYPES)}）")

        f = e["fields"]
        status = f.get("状态")
        if status not in STATUSES:
            errors.append(f"{where} 缺状态或状态非法: {status}")
        for key in REQUIRED_INBOX:
            if not f.get(key):
                errors.append(f"{where} 缺字段: {key}")

        quote = f.get("原话", "")
        if quote and not (quote.startswith(("'", '"', "“", "‘")) or "agent 推断" in quote or quote.startswith("推断")):
            warnings.append(f"{where} 原话未逐字引用或未标注 agent 推断")

        candidate = f.get("候选", "")
        if candidate and not any(h in candidate for h in CANDIDATE_HINTS):
            warnings.append(f"{where} 候选去向不在推荐集合: {candidate}")

        if status == "promoted" and not f.get("晋升到"):
            errors.append(f"{where} 状态 promoted 但缺「晋升到」")

        d = entry_date(e["id"])
        if d is None:
            errors.append(f"{where} 条目编号日期非法: {e['id']}")
        elif status == "raw" and (date.today() - d).days > stale_days:
            warnings.append(f"{where} raw 已超过 {stale_days} 天")

        if quote and "agent 推断" not in quote and not quote.startswith("推断"):
            norm = re.sub(r"[\s\"'“”‘’，。！？、;；:：]+", "", quote).lower()
            if len(norm) >= 6:
                if norm in quotes:
                    warnings.append(f"{where} 重复原话（与 {quotes[norm]} 相同）")
                else:
                    quotes[norm] = e["id"]

    return entries, errors, warnings


# ---------- decisions / skills ----------

def has_field(text: str, name: str) -> bool:
    """字段可写成 `- 决定: ...`，也可写成 `## 决定` 小节。"""
    return bool(
        re.search(rf"(?m)^-\s*{name}\s*[:：]", text)
        or re.search(rf"(?m)^##\s*{name}\s*$", text)
    )


def read_decisions(root: Path, cfg: dict) -> tuple[list[dict], list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    d = root / cfg["decisions"]
    if not d.is_dir():
        errors.append(f"decisions 目录不存在: {cfg['decisions']}")
        return [], errors, warnings

    files = [f for f in sorted(d.glob("*.md"))
             if DECISION_FILE_RE.match(f.name) and f.name != "000-template.md"]
    if not files:
        warnings.append("decisions 还没有记录（有取舍的决策应落在这里）")

    records = []
    for f in files:
        text = f.read_text(encoding="utf-8")
        for key in REQUIRED_DECISION:
            if not has_field(text, key):
                errors.append(f"{f.name} 缺字段: {key}")
        if not re.search(r"(?m)^-\s*状态\s*[:：]\s*(proposed|accepted|superseded)\b", text):
            errors.append(f"{f.name} 状态非法或缺失")
        m = re.search(r"(?m)^-\s*日期\s*[:：]\s*(\d{4}-\d{2}-\d{2})", text)
        records.append({"file": f.name, "date": m.group(1) if m else None, "text": text})

    index = d / "README.md"
    if index.is_file():
        idx = index.read_text(encoding="utf-8")
        for f in files:
            if f.name not in idx:
                warnings.append(f"decisions/README.md 索引未登记: {f.name}")

    return records, errors, warnings


def audit_skills(root: Path, cfg: dict) -> tuple[int, list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    count = 0

    for rel in cfg.get("skills") or []:
        d = root / rel
        if not d.is_dir():
            warnings.append(f"技能目录不存在: {rel}")
            continue
        for sub in sorted(p for p in d.iterdir() if p.is_dir()):
            skill = sub / "SKILL.md"
            if not skill.is_file():
                warnings.append(f"{rel}/{sub.name}/ 无 SKILL.md（不是技能就移出该目录）")
                continue
            text = skill.read_text(encoding="utf-8")
            fm = re.match(r"^---\s*\n(.*?)\n---", text, re.S)
            if not fm:
                errors.append(f"{rel}/{sub.name}/SKILL.md 缺 frontmatter")
                continue
            body = fm.group(1)
            if not re.search(r"(?m)^name:\s*\S+", body):
                errors.append(f"{rel}/{sub.name}/SKILL.md frontmatter 缺 name")
            if not re.search(r"(?m)^description:\s*\S+", body):
                errors.append(f"{rel}/{sub.name}/SKILL.md frontmatter 缺 description")
            count += 1

    return count, errors, warnings


# ---------- 输出 ----------

def report(title: str, errors: list[str], warnings: list[str], summary: str | None = None) -> None:
    print(f"▶ {title}")
    if summary:
        print(f"  {summary}")
    for w in warnings:
        print(f"  ⚠ {w}")
    for e in errors:
        print(f"  ✗ {e}")


# ---------- 命令 ----------

def cmd_init(root: Path) -> int:
    if not root.is_dir():
        print(f"✗ 根目录不存在: {root}")
        return 1

    base = root / ".distill"
    (base / "inbox").mkdir(parents=True, exist_ok=True)
    (base / "decisions").mkdir(parents=True, exist_ok=True)

    cfg_path = base / "config.json"
    if cfg_path.exists():
        print(f"ℹ 配置已存在，不覆盖: {cfg_path}")
    else:
        cfg = dict(DEFAULT_CONFIG)
        cfg["rules"] = [n for n in RULE_FILES if (root / n).exists()]
        cfg["skills"] = [n for n in SKILL_DIRS if (root / n).is_dir()]
        cfg["tools"] = [n for n in TOOL_DIRS if (root / n).is_dir()]
        cfg_path.write_text(json.dumps(cfg, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"✓ 写入配置: {cfg_path}")

    readme = base / "README.md"
    if not readme.exists():
        readme.write_text(
            "# .distill — 想法与经验蒸馏\n\n"
            "本目录由 distillation 技能维护。格式：\n\n"
            "```markdown\n"
            "### E-YYYYMMDD-NN · 类型\n"
            "- 原话: \"…\"\n"
            "- 场景: …\n"
            "- 证据: …\n"
            "- 候选: 规则 | 技能 | 工具 | 角色 | 决策 | 仅日志\n"
            "- 状态: raw | confirmed | promoted | dropped\n"
            "```\n\n"
            "命令：\n\n"
            "```bash\n"
            "python3 <skill>/scripts/distill.py audit\n"
            "python3 <skill>/scripts/distill.py digest --days 7\n"
            "```\n\n"
            "规则：用户原话逐字引用；推断必须标注；捕获要宽，晋升要窄。\n",
            encoding="utf-8",
        )
        print(f"✓ 写入说明: {readme}")

    print("\n下一步：")
    print("  1. 按 SKILL.md 的 Capture 触发点记第一条；")
    print("  2. 交付前执行 Triage 三问；")
    print("  3. 每周跑 audit + digest。")
    return 0


def cmd_audit(root: Path, stale_days_arg: int | None) -> int:
    cfg = load_config(root)
    stale_days = stale_days_arg if stale_days_arg is not None else int(cfg.get("stale_days", 14))

    entries, inbox_errors, inbox_warnings = audit_inbox(root, cfg, stale_days)
    counts = {s: 0 for s in STATUSES}
    for e in entries:
        s = e["fields"].get("状态")
        if s in counts:
            counts[s] += 1
    summary = " ".join(f"{k}={counts[k]}" for k in STATUSES)
    report(f"Inbox（{len(entries)} 条）", inbox_errors, inbox_warnings, summary)

    decisions, dec_errors, dec_warnings = read_decisions(root, cfg)
    report(f"Decisions（{len(decisions)} 条）", dec_errors, dec_warnings)

    skill_count, skill_errors, skill_warnings = audit_skills(root, cfg)
    report(f"Skills（{skill_count} 个 SKILL.md）", skill_errors, skill_warnings)

    errors = inbox_errors + dec_errors + skill_errors
    warnings = inbox_warnings + dec_warnings + skill_warnings
    print("-" * 40)
    if errors:
        print(f"❌ FAIL（{len(errors)} 个错误，{len(warnings)} 个警告）")
        return 1
    suffix = f"，{len(warnings)} 个警告" if warnings else ""
    print(f"✅ PASS{suffix}")
    return 0


def cmd_digest(root: Path, days: int) -> int:
    cfg = load_config(root)
    stale_days = int(cfg.get("stale_days", 14))
    entries, _, _ = read_inbox(root, cfg)
    decisions, _, _ = read_decisions(root, cfg)

    today = date.today()
    start = today - timedelta(days=max(days - 1, 0))
    dated = [(entry_date(e["id"]), e) for e in entries]
    week = [(d, e) for d, e in dated if d and d >= start]
    all_count = len(entries)
    promoted = sum(1 for e in entries if e["fields"].get("状态") == "promoted")
    raw_rows = [(d, e) for d, e in dated if e["fields"].get("状态") == "raw"]
    stale = [(d, e) for d, e in raw_rows if d and (today - d).days > stale_days]
    confirmed = [e for e in entries if e["fields"].get("状态") == "confirmed"]

    dup_count = 0
    seen: dict[str, str] = {}
    for e in entries:
        q = e["fields"].get("原话", "")
        if not q or "agent 推断" in q or q.startswith("推断"):
            continue
        norm = re.sub(r"[\s\"'“”‘’，。！？、;；:：]+", "", q).lower()
        if len(norm) < 6:
            continue
        if norm in seen:
            dup_count += 1
        else:
            seen[norm] = e["id"]

    type_counts: dict[str, int] = {}
    for _, e in week:
        type_counts[e["type"]] = type_counts.get(e["type"], 0) + 1

    week_decisions = [r for r in decisions if r["date"] and r["date"] >= start.isoformat()]

    print(f"# 蒸馏周报 {start.isoformat()} → {today.isoformat()}\n")
    print("## 本周")
    if week:
        dist = " / ".join(f"{k} {v}" for k, v in sorted(type_counts.items()))
        print(f"- 新增 {len(week)} 条：{dist}")
    else:
        print("- 新增 0 条")
    print(f"- 晋升 {sum(1 for _, e in week if e['fields'].get('状态') == 'promoted')} 条")
    print(f"- 新增决策记录 {len(week_decisions)} 条")
    print(f"- 待处理 raw {len(raw_rows)} 条（过期 {len(stale)} 条）")
    print(f"- 重复原话 {dup_count} 条")
    if all_count:
        print(f"- 累计晋升率 {promoted / all_count:.0%}（{promoted}/{all_count}）")

    print("\n## 待你确认")
    pending = [e for e in confirmed if "规则" in e["fields"].get("候选", "")]
    if pending:
        for e in pending[:10]:
            quote = e["fields"].get("原话", "")[:60]
            print(f"- {e['id']}：{quote} → 原话拟升级为规则")
    else:
        print("- 无")

    print("\n## 建议")
    tips: list[str] = []
    if not week:
        tips.append("本周 0 条：把 Capture 三问放进交付清单，触发点补具体例子，不要等「有值得记的」才记。")
    if stale:
        tips.append(f"{len(stale)} 条 raw 超过 {stale_days} 天：本周内处理，或标 dropped 并写原因。")
    if all_count >= 5 and promoted / all_count > 0.6:
        tips.append(f"晋升率 {promoted / all_count:.0%} 偏高：捕获太窄，先多记再过滤。")
    if all_count >= 10 and promoted / all_count < 0.15:
        tips.append(f"晋升率 {promoted / all_count:.0%} 偏低：收紧捕获触发点，一次性问题标 dropped。")
    if dup_count:
        tips.append("存在重复原话：记录前先搜 inbox，重复出现可合并并注明次数。")
    if confirmed:
        others = len(confirmed) - len(pending)
        if others:
            tips.append(f"{others} 条 confirmed 尚未晋升（非规则去向）：按候选落到技能/工具/决策，或标 dropped。")
    if not tips:
        if all_count < 5:
            tips.append(f"样本还少（{all_count} 条）：先保持捕获节奏，暂不调整门槛。")
        else:
            tips.append("数据在健康区间：保持当前节奏，下周只看同类纠偏是否减少。")
    for t in tips[:4]:
        print(f"- {t}")

    print("\n## 下周重点")
    if not week:
        print("- 恢复捕获：每次交付前跑三问，先记再判断。")
    elif stale:
        print("- 清掉过期 raw，再决定晋升或丢弃。")
    else:
        print("- 保持节奏；下周对照同类纠偏是否减少。")
    return 0


def main() -> int:
    args = parse_args()
    root = Path(args.root).expanduser().resolve()
    if args.command == "init":
        return cmd_init(root)
    if args.command == "audit":
        return cmd_audit(root, args.stale_days)
    return cmd_digest(root, args.days)


if __name__ == "__main__":
    sys.exit(main())
