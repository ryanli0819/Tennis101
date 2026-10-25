# Local agent pipeline (`cwork`)

Runs the Tennis101 agent team on your Mac, stage by stage, as in the tmux layout you showed. Use it alongside, or instead of, the cloud routines at claude.ai (which only run while scheduled on Anthropic's side). This one only runs while your Mac is on.

```
Stage 1  Serve Analyst (high) · Controls Designer (medium) · Skills Coach (medium)
Stage 2  Ball Physicist (high) · Body Animator (high)
Stage 3  Court Designer (medium) · Player Artist (high) · Serve Controller (high)
Stage 4  Guide Writer (low) · Locker Room Designer (medium)
Stage 5  Start Page Builder (medium)
Stage 6  Version Keeper (low)  ← always last
```
Stages and effort come from `agents/agents.json` (`feeds` and `effort`) through `stages.py`, so the pipeline follows the team automatically. An agent runs after every agent whose work it uses; agents in the same stage run side by side.

## One-time setup
1. **Claude Code CLI.** Install it in Terminal, then run `claude` once to sign in:
   ```bash
   curl -fsSL https://claude.ai/install.sh | bash
   ```
2. **tmux** (optional, for the pane view). It needs Homebrew. Install Homebrew from https://brew.sh, then:
   ```bash
   brew install tmux
   ```
   Without tmux, `cwork` still works: agents run in the background, and you follow them with `cwork-status`.
3. **Load the commands.** Add this line to `~/.zshrc`, then open a new Terminal:
   ```bash
   source ~/Documents/Tennis101/tools/pipeline/cwork.zsh
   ```

## Use
| Command | What it does |
|---|---|
| `cwork` | tmux session: window 0 is the conductor, then one window per stage with one pane per agent. Claude runs interactively, so you watch and approve. The next stage opens when every pane has exited. |
| `cwork --auto` | Unattended: `claude -p` with a fixed allow-list (read/edit files, git, gh, node, python3, web). Anything else is refused, not asked. Output goes to `.pipeline/logs/<name>.log`. |
| `cwork --only skills-coach,ball-physicist` | Run just these agents, still in stage order. |
| `cwork --dry-run` | Print the plan and commands; run nothing. |
| `cwork-status` | Each agent: waiting, running, done or failed, plus its last log line. |
| `cwork-stop` | Stop the pipeline (kills the tmux session). |
| `cwork-clean` | Remove worktrees whose work is committed and pushed. |

## Safety (same rules as the cloud agents)
- **Own worktree:** each agent works in `.worktrees/<name>` on branch `agent/<name>`, so parallel agents never edit the same checkout. Your own `main` checkout is untouched.
- **No merging:** agents push their branch and open a pull request. They never push to `main` or merge. You review.
- **Instructions come from the repo:** each agent reads `agents/_shared/RULES.md` and `agents/<name>/PROMPT.md`. Change an agent's job by editing its `PROMPT.md`.
- **Live view:** pushed branches and PRs show up on the Agent Control Room (`agents/dashboard.html`).

## Tested
- The full flow ran end to end with a stand-in for `claude`: worktrees and branches created per agent, the right effort per agent, stages in order with waiting, done markers, logs and `cwork-status`.
- The tmux pane view is not tested yet, because tmux isn't installed on this Mac.
