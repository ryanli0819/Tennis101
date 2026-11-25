# Intake: get clips and photos into the project without sorting them by hand

**Easiest: the Tennis101 Inbox app on the Desktop.** Drag any labelled video (.mp4 / .mov / .m4v) or photo onto its icon. It asks nothing (Ryan, Nov 25): the file is moved into `datasets/inbox/` (no second copy is left where it came from) and filed by the player and stroke in its name, e.g. `djokovic 2nd serve back.mov`; several player names = a compilation (`datasets/video/_compilations/`), no player name = `inbox/unsorted/`, already in the project = the Trash. A notification says how many were added.
It copies the file into `datasets/inbox` (the original stays put), asks which player it shows if the name doesn't say,
and starts the intake (filing + pose detection) in the background. Rebuild it with:

    osacompile -o ~/Desktop/"Tennis101 Inbox.app" "tools/intake/Tennis101 Inbox.applescript"

The first time, macOS asks whether the app may use your Documents folder: allow it.

AV1 videos (YouTube downloads at 1440p and up) can't be decoded by macOS on M1/M2 Macs; the intake converts a 1080p H.264
copy automatically with `tools/intake/convert.py` (PyAV in `tools/.venv`, git-ignored). To recreate that environment:

    python3 -m venv tools/.venv && tools/.venv/bin/python -m pip install "av==17.0.0"
(The background watcher, `install-watcher.sh`, is blocked by macOS privacy protection on this Mac; the app replaces it.)

## By hand

1. **Record straight into the inbox.** Press ⌘⇧5 → Options → Save to → Other Location… → choose
   `Documents/Tennis101/datasets/inbox`. Every screen recording and screenshot now lands there.
2. **Say who it is** in the file name or a folder: rename to e.g. `shelton serve.mov`, `zverev forehand side.mov`,
   `medvedev clay outfit.png`, or make a folder `inbox/medvedev/` and drop files in it.
   Keywords: serve / 2nd serve (or kick), forehand, backhand, slice, running (footwork), match, practice.
3. **Run the intake** (or ask Claude to "process the inbox"):

       python3 -I tools/intake/intake.py --dry-run   # see where everything would go
       python3 -I tools/intake/intake.py             # file it and run pose detection

**Already in the system → rejected.** A file whose content matches a video or photo already under `datasets/` (or one filed earlier in the same run) goes to the macOS Trash (recoverable until it's emptied), and the log names the copy it matches. Renamed or re-labelled copies are caught too; a re-recorded or re-encoded version of the same clip is a different file and is filed. A different file with an existing file's name is filed as `name (2).mov`, never over it.

Files without a player name wait in `inbox/unsorted/`. A file naming several players (a compilation) goes to `datasets/video/_compilations/` with pose data, to be split per player. Everything is logged in `inbox/intake-log.json`.
Videos and photos never leave the Mac (git-ignored); only keypoints (numbers) are committed.

Optional: `install-watcher.sh` makes macOS run the intake automatically whenever a file lands in the inbox.
