"""Plan the agent pipeline: which agents run together, in which order.

    python3 -I tools/pipeline/stages.py [--only a,b,c]

Reads agents/agents.json. An agent's stage = the longest chain of agents whose work it uses
("feeds"), so producers run first and consumers run after them. Agents in the same stage don't
depend on each other and run in parallel. The Version Keeper always runs last, after every change.

Prints one line per agent:  <stage> <name> <effort> <title>
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
reg = json.load(open(os.path.join(ROOT, "agents", "agents.json")))
agents = {a["name"]: a for a in reg["agents"]}

only = None
if "--only" in sys.argv:
    only = set(sys.argv[sys.argv.index("--only") + 1].split(","))
    unknown = only - set(agents)
    if unknown:
        sys.exit(f"unknown agent(s): {', '.join(sorted(unknown))}. Known: {', '.join(sorted(agents))}")

stage = {}
def depth(name, seen=()):
    if name in stage: return stage[name]
    if name in seen: sys.exit(f"cycle in agents.json feeds: {' -> '.join(seen + (name,))}")
    producers = [a["name"] for a in reg["agents"] if name in a.get("feeds", []) and a["name"] != "version-keeper"]
    stage[name] = 1 + max((depth(p, seen + (name,)) for p in producers), default=0)
    return stage[name]

for n in agents:
    if n != "version-keeper": depth(n)
stage["version-keeper"] = max(stage.values()) + 1             # always last: records what everyone landed

for n in sorted(agents, key=lambda n: (stage[n], agents[n]["order"])):
    if only is None or n in only:
        a = agents[n]
        print(stage[n], n, a.get("effort", "medium"), a["title"])
