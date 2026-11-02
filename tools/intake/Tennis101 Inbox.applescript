-- TENNIS101 INBOX: a drop-target app. Drag videos (.mp4 / .mov / .m4v) or photos onto its icon.
-- Each file is copied into datasets/inbox (the original stays where it was). If the file name doesn't say which
-- player it shows, the app asks. Then it runs tools/intake/intake.py, which files everything and runs pose detection.
-- Build: osacompile -o ~/Desktop/"Tennis101 Inbox.app" "tools/intake/Tennis101 Inbox.applescript"
property ROOT : "/Users/fulei/Documents/Tennis101"
property PY : "/usr/bin/python3"

on run
	display dialog "Drag videos or photos of a player onto the Tennis101 Inbox icon." & return & return & ¬
		"They're copied into the project, filed by player and analysed (pose detection). Originals stay where they are." ¬
		buttons {"Open inbox folder", "OK"} default button "OK" with title "Tennis101 Inbox"
	if button returned of result is "Open inbox folder" then do shell script "open " & quoted form of (ROOT & "/datasets/inbox")
end run

on open droppedItems
	set inbox to ROOT & "/datasets/inbox/"
	set intake to ROOT & "/tools/intake/intake.py"
	set added to 0
	set skipped to {}
	repeat with f in droppedItems
		set p to POSIX path of f
		set fname to do shell script "basename " & quoted form of p
		set ext to do shell script "echo " & quoted form of fname & " | awk -F. '{print tolower($NF)}'"
		if ext is in {"mp4", "mov", "m4v", "png", "jpg", "jpeg", "webp", "heic", "gif"} then
			set found to do shell script PY & " -I " & quoted form of intake & " --detect " & quoted form of fname
			set newName to fname
			if found is "" then
				-- the name doesn't say who it is: ask
				set names to paragraphs of (do shell script PY & " -I " & quoted form of intake & " --players")
				set pick to choose from list names with title "Tennis101 Inbox" with prompt "Who is in " & fname & "?" & return & "(Pick several for a compilation.)" with multiple selections allowed
				if pick is false then
					set end of skipped to fname
				else
					set ids to ""
					repeat with s in pick
						set ids to ids & (word 1 of s) & " "
					end repeat
					set newName to ids & fname
				end if
			end if
			if fname is not in skipped then
				do shell script "cp " & quoted form of p & " " & quoted form of (inbox & newName)
				set added to added + 1
			end if
		else
			set end of skipped to fname
		end if
	end repeat
	if added > 0 then
		-- process in the background (pose detection on a long video takes a few minutes)
		do shell script "cd " & quoted form of ROOT & " && nohup " & PY & " -I " & quoted form of intake & ¬
			" > datasets/inbox/intake.out.log 2> datasets/inbox/intake.err.log &"
		display notification (added as text) & " file(s) added. Filing and pose detection are running; Claude can pick it up from here." with title "Tennis101 Inbox"
	end if
	if (count of skipped) > 0 then
		set AppleScript's text item delimiters to ", "
		display dialog "Skipped (not a video or photo, or no player chosen): " & (skipped as text) buttons {"OK"} default button "OK" with title "Tennis101 Inbox"
	end if
end open
