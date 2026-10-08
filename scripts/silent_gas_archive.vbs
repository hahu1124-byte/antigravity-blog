' Silent launcher for local-gas-archive.cjs (gas price xlsx archive).
' Called by Task Scheduler "AntigravityBlog_GasPriceArchive" (Wed/Thu 18:30).
' Launching node.exe directly from the task flashes a console window (steals focus in games),
' so the task must go through this VBS (Run with window style 0 = hidden).

Set WshShell = CreateObject("WScript.Shell")
strCmd = "cmd.exe /c ""C:\Program Files\Git\bin\bash.exe"" H:\gravity\.agent\scripts\hrun.sh H:/gravity/projects/antigravity-blog 0 node scripts/local-gas-archive.cjs"
WshShell.Run strCmd, 0, True
