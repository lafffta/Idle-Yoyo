# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues on `lafffta/Idle-Yoyo`.

## Two ways to reach GitHub

Which one is available depends on where the agent is running, so check before assuming.

**Local sessions — the `gh` CLI.** The commands below are the canonical form.

**Claude Code on the web, and other remote sessions — the GitHub MCP tools.** `gh` is *not* installed in those environments, and neither is direct `api.github.com` access; requests to it are refused because sessions are bound to their configured repositories. Use the `mcp__github__*` tools instead — `issue_write`, `issue_read`, `list_issues`, `search_issues`, `create_pull_request`, `pull_request_read`, and so on. They cover everything below.

Infer the repo from `git remote -v`; `gh` does this automatically inside a clone, and the MCP tools take explicit `owner` and `repo`.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies. _MCP: `issue_write` with `method: "create"`._
- **Read an issue**: `gh issue view <number> --comments`, also fetching labels. _MCP: `issue_read`._
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters. _MCP: `list_issues`, which takes `labels`, `state` and pagination directly._
- **Comment on an issue**: `gh issue comment <number> --body "..."`. _MCP: `add_issue_comment`._
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`. _MCP: `issue_write` with `method: "update"` — note its `labels` field **replaces** the whole set rather than adding to it, so pass the full intended list._
- **Close**: `gh issue close <number> --comment "..."`. _MCP: `issue_write` with `method: "update"`, `state: "closed"` and a `state_reason`._

Labels that do not exist yet are created automatically when an issue is created with them. `ready-for-agent` and `spec` both came into being that way.

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff. _MCP: `pull_request_read` with `method: "get"` / `"get_diff"` / `"get_comments"`._
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`). _MCP: `list_pull_requests`._
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`. _MCP: `add_issue_comment`, `issue_write`, `update_pull_request`._

GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`, or `issue_read` from the MCP tools.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint, or the `sub_issue_write` MCP tool). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies** — the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/<owner>/<repo>/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only — the live gate). Where dependencies aren't available — including remote sessions, where raw `gh api` is not reachable — fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. That fallback is what the core-loop tickets (#4–#9) used.
- **Frontier query**: list the map's open children, drop any with an open blocker or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --add-assignee @me` — the session's first write.
- **Resolve**: comment the answer on the ticket, close it, then append a context pointer to the map's Decisions-so-far.
