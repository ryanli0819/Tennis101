-- TENNIS101 INBOX: a drop-target app. Drag videos (.mp4 / .mov / .m4v) or photos onto its icon. No questions
-- (Ryan, Nov 25: "sort them yourselves according to the names"): each file is MOVED into datasets/inbox/ (one copy
-- on the Mac, Ryan Nov 25: "now there's two copies of all the film") and tools/intake/intake.py files it from its name alone — the player's name (several
-- names = a compilation) and the stroke (serve / 2nd serve / kick, forehand, backhand, slice, running, match,
-- practice). A file already in the project goes to the Trash (recoverable); a file with no player name waits in
-- inbox/unsorted/. A notification says what happened.
-- Build: osacompile -o ~/Desktop/"Tennis101 Inbox.app" "tools/intake/Tennis101 Inbox.applescript"
property ROOT : "/Users/fulei/Documents/Tennis101"
property PY : "/usr/bin/python3"

on run
	display dialog "Drag labelled videos or photos onto the Tennis101 Inbox icon, e.g. \"djokovic 2nd serve back.mov\"." & return & return & ¬
		"They're moved into the project (no second copy is left behind) and filed by the player and stroke in their names. A clip that's already in the project goes to the Trash." ¬
		buttons {"Open inbox folder", "OK"} default button "OK" with title "Tennis101 Inbox"
	if button returned of result is "Open inbox folder" then do shell script "open " & quoted form of (ROOT & "/datasets/inbox")
end run

on open droppedItems
	set inbox to ROOT & "/datasets/inbox/"
	set intake to ROOT & "/tools/intake/intake.py"
	set added to 0
	set ignored to 0
	repeat with f in droppedItems
		set p to POSIX path of f
		set fname to do shell script "basename " & quoted form of p
		set ext to do shell script "echo " & quoted form of fname & " | awk -F. '{print tolower($NF)}'"
		if ext is in {"mp4", "mov", "m4v", "png", "jpg", "jpeg", "webp", "heic", "gif"} then
			-- move, never overwrite: a name already waiting in the inbox gets a time stamp in front
			do shell script "d=" & quoted form of (inbox & fname) & "; [ -e \"$d\" ] && d=" & quoted form of inbox & "\"$(date +%H%M%S) \"" & quoted form of fname & "; mv -n " & quoted form of p & " \"$d\""
			set added to added + 1
		else
			set ignored to ignored + 1
		end if
	end repeat
	if added > 0 then
		-- file by name and run pose detection in the background (a long video takes a few minutes)
		do shell script "cd " & quoted form of ROOT & " && nohup " & PY & " -I " & quoted form of intake & ¬
			" > datasets/inbox/intake.out.log 2> datasets/inbox/intake.err.log &"
		set msg to (added as text) & " file(s) moved in and being filed by name."
		if ignored > 0 then set msg to msg & " " & (ignored as text) & " skipped (not a video or photo)."
		display notification msg with title "Tennis101 Inbox"
	else if ignored > 0 then
		display notification "Nothing added: only videos (.mp4 .mov .m4v) and photos are taken." with title "Tennis101 Inbox"
	end if
end open
