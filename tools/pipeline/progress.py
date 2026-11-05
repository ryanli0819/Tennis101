"""Turn Claude's stream-json output into short, readable progress lines.

    claude -p "..." --output-format stream-json --verbose | python3 -I tools/pipeline/progress.py

One line per step, with the time: which file it reads or edits, which command it runs, what it says,
and the final result. Used by cwork --auto so the log fills in live instead of only at the end.
"""
import json, sys, time

def short(s, n=110):
    s = " ".join(str(s).split())
    return s if len(s) <= n else s[: n - 1] + "…"

def tool_line(name, inp):
    if name in ("Read", "Edit", "Write", "NotebookEdit"):
        return f"{name} {inp.get('file_path', '')}"
    if name == "Bash":
        return f"$ {inp.get('command', '')}"
    if name in ("Glob", "Grep"):
        return f"{name} {inp.get('pattern', '')}"
    if name in ("WebFetch", "WebSearch"):
        return f"{name} {inp.get('url') or inp.get('query', '')}"
    return f"{name} {json.dumps(inp)[:80]}"

for raw in sys.stdin:
    raw = raw.strip()
    if not raw:
        continue
    t = time.strftime("%H:%M:%S")
    try:
        ev = json.loads(raw)
    except ValueError:
        print(f"[{t}] {short(raw)}", flush=True)
        continue
    kind = ev.get("type")
    if kind == "system" and ev.get("subtype") == "init":
        print(f"[{t}] started · model {ev.get('model', '?')}", flush=True)
    elif kind == "assistant":
        for block in ev.get("message", {}).get("content", []):
            if block.get("type") == "tool_use":
                print(f"[{t}] → {short(tool_line(block.get('name'), block.get('input', {})))}", flush=True)
            elif block.get("type") == "text" and block.get("text", "").strip():
                print(f"[{t}] {short(block['text'])}", flush=True)
    elif kind == "result":
        secs = (ev.get("duration_ms") or 0) / 1000
        print(f"[{t}] finished: {ev.get('subtype', '')} · {secs:.0f} s · {ev.get('num_turns', '?')} turns", flush=True)
        if ev.get("result"):
            print("\n" + str(ev["result"]).strip(), flush=True)
