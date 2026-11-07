---
name: freshness-scan
description: Mandatory session-start ritual — mtime-first scan for recently modified files, git fallback on ambiguity, then WORKSTACK read.
---

# Freshness scan

Run this at session start in any estate repo. It exists because the most recent edits are usually *uncommitted* — git status lies about recency, mtimes don't.

## Step 1 — mtime-first (primary)

PowerShell, depth-capped run in the launch directory (or repo root when inside a repo):

```powershell
Get-ChildItem -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch '\\\.git\\|\\node_modules\\|\\\.venv\\|\\dist\\|\\build\\|\\__pycache__\\|\\\.worktrees\\' } |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 15 @{n='qtime';e={$_.LastWriteTime.ToString('MM-dd HH:mm')}}, @{n='file';e={$_.FullName.Substring((Get-Location).Path.Length+1)}} |
  Format-Table -AutoSize
```

Steps: read the top 10–15 rows aloud to yourself; if a file or pattern dominates, it's the active thread surface. Ask the estate (one crisp question) if the trail is ambiguous before exploring further.

## Step 2 — git fallback (only when unsure)

If the mtime list doesn't explain why you're here or there's doubt over tracking state:

1. `git status --short`
2. Current branch vs main divergence: `git log --oneline -5` and `git branch -a`
3. Stashes/worktrees if stack-adjacent: `git worktree list`

## Step 3 — WORKSTACK read

Read `WORKSTACK.md` in the repo root if present. It is the ledger of open threads; it decides whether your task belongs to an active thread or starts a new one. Keep it honest at wrap (see skills/wrap-checklist).

## Output (optional, in-session)

```
Fresh: 12 files (newest 14:32 <path>)
Git: branch feature/example, 12 dirty
Workstack: 2 open threads, 1 assigned to this session
```

Never assume the repo is well-behaved until both scans agree.
