-- TENNIS101 INBOX: a drop-target app. Drag videos (.mp4 / .mov / .m4v) or photos onto its icon.
-- It asks what the clips show (Serves, Forehands or Backhands), then, for each file, which players are in it: tick one
-- or several (players named in the file are ticked already). Each file is copied into datasets/inbox/<category>/ (the
-- original stays where it was). Then it runs tools/intake/intake.py, which files everything and runs pose detection.
-- Build: osacompile -o ~/Desktop/"Tennis101 Inbox.app" "tools/intake/Tennis101 Inbox.applescript"
property ROOT : "/Users/fulei/Documents/Tennis101"
property PY : "/usr/bin/python3"

on run
	display dialog "Drag videos or photos onto the Tennis101 Inbox icon, then pick Serves, Forehands or Backhands and the players in each clip." & return & return & ¬
		"They're copied into the project, filed by player and analysed (pose detection). Originals stay where they are." ¬
		buttons {"Open inbox folder", "OK"} default button "OK" with title "Tennis101 Inbox"
	if button returned of result is "Open inbox folder" then do shell script "open " & quoted form of (ROOT & "/datasets/inbox")
end run

on open droppedItems
	set inbox to ROOT & "/datasets/inbox/"
	set intake to ROOT & "/tools/intake/intake.py"
	set added to 0
	set skipped to {}
	-- 1. Which stroke? One of three categories, once for everything dropped together.
	set cats to {"Serves", "Forehands", "Backhands"}
	set catPick to choose from list cats with title "Tennis101 Inbox" with prompt "What do these clips show?" default items {"Serves"} OK button name "Next"
	if catPick is false then return
	set cat to item 1 of catPick
	set catDir to do shell script "echo " & quoted form of cat & " | tr 'A-Z' 'a-z'"
	set names to paragraphs of (do shell script PY & " -I " & quoted form of intake & " --players")
	repeat with f in droppedItems
		set p to POSIX path of f
		set fname to do shell script "basename " & quoted form of p
		set ext to do shell script "echo " & quoted form of fname & " | awk -F. '{print tolower($NF)}'"
		if ext is in {"mp4", "mov", "m4v", "png", "jpg", "jpeg", "webp", "heic", "gif"} then
			-- 2. Which players? Tick exactly the ones in this clip (several for a compilation). Players named in the file are ticked already.
			set found to do shell script PY & " -I " & quoted form of intake & " --detect " & quoted form of fname
			set pre to {}
			if found is not "" then
				set AppleScript's text item delimiters to ","
				set ids to text items of found
				set AppleScript's text item delimiters to ""
				repeat with n in names
					if my idOf(n) is in ids then set end of pre to (n as text)
				end repeat
			end if
			set pick to choose from list names with title "Tennis101 Inbox · " & cat with prompt "Which players are in " & fname & "?" & return & "Choose one or several (⌘-click); only the ones you pick are filed." default items pre with multiple selections allowed
			if pick is false then
				set end of skipped to fname
			else
				set ids to ""
				repeat with s in pick
					set ids to ids & my idOf(s) & " "
				end repeat
				-- inbox/<category>/<ids> <file>: intake.py files it by player and stroke from that path
				do shell script "mkdir -p " & quoted form of (inbox & catDir) & " && cp " & quoted form of p & " " & quoted form of (inbox & catDir & "/" & ids & fname)
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
		display notification (added as text) & " " & catDir & " file(s) added. Filing and pose detection are running; Claude can pick it up from here." with title "Tennis101 Inbox"
	end if
	if (count of skipped) > 0 then
		set AppleScript's text item delimiters to ", "
		display dialog "Skipped (not a video or photo, or no player chosen): " & (skipped as text) buttons {"OK"} default button "OK" with title "Tennis101 Inbox"
	end if
end open

-- "de-minaur — Alex de Minaur" → "de-minaur" (AppleScript's "word" would split at the hyphen)
on idOf(n)
	set n to n as text
	return text 1 thru ((offset of " " in n) - 1) of n
end idOf
