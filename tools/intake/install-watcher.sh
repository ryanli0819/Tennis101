#!/bin/zsh
# Runs tools/intake/intake.py automatically whenever something lands in datasets/inbox (a macOS LaunchAgent).
# Install:   zsh tools/intake/install-watcher.sh
# Remove:    launchctl unload ~/Library/LaunchAgents/com.tennis101.intake.plist && rm ~/Library/LaunchAgents/com.tennis101.intake.plist
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST=~/Library/LaunchAgents/com.tennis101.intake.plist
cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.tennis101.intake</string>
  <key>ProgramArguments</key><array><string>/usr/bin/python3</string><string>-I</string><string>$ROOT/tools/intake/intake.py</string></array>
  <key>WatchPaths</key><array><string>$ROOT/datasets/inbox</string></array>
  <key>ThrottleInterval</key><integer>30</integer>
  <key>StandardOutPath</key><string>$ROOT/datasets/inbox/intake.out.log</string>
  <key>StandardErrorPath</key><string>$ROOT/datasets/inbox/intake.err.log</string>
</dict></plist>
PL
launchctl unload "$PLIST" 2>/dev/null; launchctl load "$PLIST" && echo "Watching $ROOT/datasets/inbox"
