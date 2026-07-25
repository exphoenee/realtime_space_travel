#!/usr/bin/env python3
"""Generate plans/roadmap.md from the plan files.

Single source of truth: the ./plans/ directory. This script reads every
plans/NNN-*.md file's YAML front matter **and** its "Haladás (TODO)" section,
then regenerates plans/roadmap.md so it contains everything needed to:

  1. see where the project stands (per-plan status + TODO progress + next task), and
  2. decide where a new plan can be inserted (dependencies + dependents).

roadmap.md is informational and auto-generated — never edit it by hand.
Regenerate it before reading it:

    python .claude/scripts/generate_roadmap.py

No third-party dependencies (ships with a minimal front-matter parser).
"""
from __future__ import annotations

import datetime as dt
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
PLANS_DIR = ROOT / "plans"

STATUS_CELL = {
    "implemented": "✅ Implemented",
    "in-progress": "🟨 In progress",
    "not-started": "⬜ Not started",
}
CHECKBOX_RE = re.compile(r"^\s*-\s*\[([ xX~])\]\s*(.*)$")


def _strip_scalar(v: str):
    v = v.strip()
    if (v.startswith('"') and v.endswith('"')) or (v.startswith("'") and v.endswith("'")):
        return v[1:-1]
    if v in ("null", "~", ""):
        return None
    return v


def parse_front_matter(text: str) -> dict | None:
    """Minimal YAML front-matter parser for the fields this script needs."""
    if not text.startswith("---"):
        return None
    end = text.find("\n---", 3)
    if end == -1:
        return None
    lines = text[3:end].strip("\n").split("\n")
    data: dict = {}
    i = 0
    while i < len(lines):
        raw = lines[i]
        if not raw.strip() or raw.lstrip().startswith("#"):
            i += 1
            continue
        m = re.match(r"^([A-Za-z_][\w]*):\s*(.*)$", raw)
        if not m:
            i += 1
            continue
        key, val = m.group(1), m.group(2).strip()
        if val == "":
            items = []
            j = i + 1
            while j < len(lines):
                lm = re.match(r"^\s+-\s*(.*)$", lines[j])
                if not lm:
                    break
                items.append(_strip_scalar(lm.group(1)))
                j += 1
            data[key] = items
            i = j
        elif val.startswith("[") and val.endswith("]"):
            inner = val[1:-1].strip()
            data[key] = [_strip_scalar(x) for x in inner.split(",")] if inner else []
            i += 1
        else:
            data[key] = _strip_scalar(val)
            i += 1
    return data


def parse_todo(text: str) -> dict:
    """Count TODO checkboxes and capture the first open task."""
    done = prog = todo = 0
    next_open = None
    for line in text.splitlines():
        m = CHECKBOX_RE.match(line)
        if not m:
            continue
        mark, label = m.group(1).lower(), m.group(2).strip()
        if mark == "x":
            done += 1
        elif mark == "~":
            prog += 1
            if next_open is None:
                next_open = label
        else:  # space -> open
            todo += 1
            if next_open is None:
                next_open = label
    total = done + prog + todo
    return {"done": done, "prog": prog, "todo": todo, "total": total, "next_open": next_open}


def load_plans() -> list[dict]:
    plans = []
    for path in sorted(PLANS_DIR.glob("[0-9]*.md")):
        if path.name == "roadmap.md":
            continue
        text = path.read_text(encoding="utf-8")
        fm = parse_front_matter(text)
        if fm is None:
            print(f"[warn] no YAML front matter: {path.name}", file=sys.stderr)
            continue
        fm["_path"] = path
        fm["_todo"] = parse_todo(text)
        plans.append(fm)
    plans.sort(key=lambda p: (p.get("step") is None, int(p.get("step") or 0)))
    return plans


def validate_plans(plans: list[dict]) -> list[str]:
    """Structural checks that must never silently pass.

    A plan with `step: null` used to sort as step 0 and collide with the real step 0 —
    the roadmap looked fine while the plan was effectively unplaced. Surface it instead.
    """
    issues: list[str] = []
    seen_steps: dict[int, str] = {}

    for p in plans:
        name = p["_path"].name
        stem = name[:-3]
        step = p.get("step")
        prefix = int(name[:3]) if name[:3].isdigit() else None

        if step is None:
            issues.append(
                f"`{name}` has **`step: null`** — unplaced. The `manage-roadmap` agent must "
                f"assign a step (and rename the file to match) before this plan can be worked on."
            )
        else:
            step = int(step)
            if prefix is not None and prefix != step:
                issues.append(
                    f"`{name}` — filename prefix `{prefix:03d}` != YAML `step: {step}`. "
                    f"The prefix defines implementation order; rename or fix the step."
                )
            if step in seen_steps:
                issues.append(f"duplicate `step: {step}` — `{seen_steps[step]}` and `{name}`")
            else:
                seen_steps[step] = name

        if p.get("slug") != stem:
            issues.append(f"`{name}` — YAML `slug: {p.get('slug')}` != filename `{stem}`")

    steps = sorted(seen_steps)
    expected = list(range(len(steps)))
    if steps and steps != expected:
        issues.append(f"steps are not contiguous from 0: {steps} (expected {expected})")

    # dependency direction: a plan must come after everything it depends on
    step_by_slug = {p.get("slug"): p.get("step") for p in plans}
    for p in plans:
        if p.get("step") is None:
            continue
        for d in dep_slugs(p):
            if d not in step_by_slug:
                issues.append(f"`{p['_path'].name}` depends on unknown plan `{d}`")
            elif step_by_slug[d] is not None and int(step_by_slug[d]) >= int(p["step"]):
                issues.append(
                    f"`{p['_path'].name}` (step {p['step']}) depends on `{d}` "
                    f"(step {step_by_slug[d]}) — a dependency must have a LOWER step"
                )
    return issues


def short_title(title: str | None, slug: str) -> str:
    if not title:
        return slug
    for sep in (" – ", " — ", " - "):
        if sep in title:
            return title.split(sep)[0].strip()
    return title.strip()


def normalize_status(s: str | None) -> str:
    return (s or "not-started").replace("_", "-")


def render_phase(fm: dict) -> str:
    phases = fm.get("phases")
    if isinstance(phases, list) and phases:
        nums = [str(p) for p in phases if p is not None]
        if len(nums) == 2:
            return f"{nums[0]}–{nums[1]}"
        return ", ".join(nums) if nums else "—"
    phase = fm.get("phase")
    return "—" if phase in (None, "") else str(phase)


def dep_slugs(fm: dict) -> list[str]:
    return [d for d in (fm.get("dependencies") or []) if d]


def render_dep_steps(fm: dict, step_by_slug: dict) -> str:
    steps = sorted({step_by_slug[d] for d in dep_slugs(fm) if d in step_by_slug})
    return ", ".join(str(s) for s in steps) if steps else "—"


def build_roadmap(plans: list[dict], issues: list[str] | None = None) -> str:
    today = dt.date.today().isoformat()
    step_by_slug = {p.get("slug"): int(p.get("step") or 0) for p in plans}

    total = len(plans)
    counts = {"implemented": 0, "in-progress": 0, "not-started": 0}
    for p in plans:
        counts[normalize_status(p.get("status"))] += 1

    tasks_done = sum(p["_todo"]["done"] for p in plans)
    tasks_total = sum(p["_todo"]["total"] for p in plans)

    # reverse deps: slug -> [steps that depend on it]
    dependents: dict[str, list[int]] = {p.get("slug"): [] for p in plans}
    for p in plans:
        for d in dep_slugs(p):
            if d in dependents:
                dependents[d].append(int(p.get("step") or 0))

    # --- YAML header ---
    y = ["---",
         "# Auto-generated from plan files — do not edit manually",
         "# Single source of truth: ./plans/ directory",
         "# Regenerate with: python .claude/scripts/generate_roadmap.py",
         f'generated_at: "{today}"',
         f"total_plans: {total}",
         f"implemented: {counts['implemented']}",
         f"in_progress: {counts['in-progress']}",
         f"not_started: {counts['not-started']}",
         f"tasks_done: {tasks_done}",
         f"tasks_total: {tasks_total}",
         "plans:"]
    for p in plans:
        t = p["_todo"]
        y.append(f"  - step: {int(p.get('step') or 0)}")
        y.append(f'    slug: "{p.get("slug")}"')
        y.append(f'    status: "{normalize_status(p.get("status"))}"')
        y.append(f'    category: "{p.get("category") or ""}"')
        y.append(f"    tasks_done: {t['done']}")
        y.append(f"    tasks_total: {t['total']}")
        y.append(f"    dependencies: [{', '.join(dep_slugs(p))}]")
    y.append("---")

    b = ["", "# Roadmap", "",
         "> Auto-generated from `./plans/` — **do not edit by hand**. Regenerate before reading:",
         "> `python .claude/scripts/generate_roadmap.py`",
         f"> Last generated: {today}", ""]

    # --- Consistency issues (must be impossible to miss) ---
    if issues:
        b += ["## ⚠️ Consistency Issues", "",
              "> The plan files are inconsistent. **Fix these before implementing anything** —",
              "> the numbers below cannot be trusted until they are resolved.", ""]
        b += [f"- {i}" for i in issues]
        b += [""]

    # --- Project status ---
    b += ["## Project Status", "",
          f"- **Plans:** {counts['implemented']} implemented · {counts['in-progress']} in progress · {counts['not-started']} not started (of {total})",
          f"- **Tasks:** {tasks_done}/{tasks_total} done"
          + (f" ({round(100 * tasks_done / tasks_total)}%)" if tasks_total else ""),
          ""]

    # --- Overview ---
    b += ["## Overview", "",
          "| Step | Plan | Status | Progress | Phase | Category | Depends on |",
          "|------|------|--------|----------|-------|----------|-----------|"]
    for p in plans:
        status = normalize_status(p.get("status"))
        t = p["_todo"]
        prog = f"{t['done']}/{t['total']}" if t["total"] else "—"
        b.append(
            f"| {int(p.get('step') or 0)} "
            f"| {short_title(p.get('title'), p.get('slug'))} "
            f"| {STATUS_CELL.get(status, status)} "
            f"| {prog} "
            f"| {render_phase(p)} "
            f"| {p.get('category') or '—'} "
            f"| {render_dep_steps(p, step_by_slug)} |"
        )
    b.append("")

    # --- Next open tasks (where the project stands) ---
    open_plans = [p for p in plans if p["_todo"]["next_open"]]
    if open_plans:
        b += ["## Next Open Tasks", "",
              "> The next unchecked TODO in each unfinished plan (the live work front).", ""]
        for p in open_plans:
            b.append(f"- **Step {int(p.get('step') or 0)} — {short_title(p.get('title'), p.get('slug'))}"
                     f"** ({p['_todo']['done']}/{p['_todo']['total']}): {p['_todo']['next_open']}")
        b.append("")

    # --- Insertion guide (where a new plan fits) ---
    b += ["## Insertion Guide", "",
          "> To place a **new plan**: it goes after the highest step of its dependencies and before the",
          "> lowest step of anything that must depend on it. `manage-roadmap` then renumbers the rest",
          "> (step 0 and 1 are stable). Slugs are shown so dependencies can be wired directly.", "",
          "| Step | Slug | Category | Depends on (slugs) | Required by (steps) |",
          "|------|------|----------|--------------------|---------------------|"]
    for p in plans:
        deps = ", ".join(dep_slugs(p)) or "—"
        reqd = ", ".join(str(s) for s in sorted(dependents.get(p.get("slug"), []))) or "—"
        b.append(f"| {int(p.get('step') or 0)} | `{p.get('slug')}` | {p.get('category') or '—'} | {deps} | {reqd} |")
    b.append("")

    # --- Phase details ---
    b += ["## Phase Details", "",
          "> Full descriptions, decisions, and architecture live in the individual plan files.", "",
          "| Step | Plan File | Title |",
          "|------|-----------|-------|"]
    for p in plans:
        b.append(f"| {int(p.get('step') or 0)} | `plans/{p['_path'].name}` | {short_title(p.get('title'), p.get('slug'))} |")

    return "\n".join(y + b) + "\n"


def main() -> int:
    if not PLANS_DIR.is_dir():
        print(f"error: plans directory not found at {PLANS_DIR}", file=sys.stderr)
        return 1
    plans = load_plans()
    if not plans:
        print("error: no plan files with YAML front matter found", file=sys.stderr)
        return 1
    issues = validate_plans(plans)
    (PLANS_DIR / "roadmap.md").write_text(build_roadmap(plans, issues), encoding="utf-8")
    impl = sum(1 for p in plans if normalize_status(p.get("status")) == "implemented")
    print(f"[ok] roadmap.md regenerated from {len(plans)} plan(s) - {impl} implemented")
    if issues:
        print(f"[error] {len(issues)} consistency issue(s) - see 'Consistency Issues' "
              f"in roadmap.md:", file=sys.stderr)
        for i in issues:
            print(f"  - {i}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
