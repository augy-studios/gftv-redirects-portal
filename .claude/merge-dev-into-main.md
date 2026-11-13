# Merging `dev` into `main`: Redirects Portal

Context for whoever merges this repo's `dev` branch into `main`. Augy, give this file to Claude: "Read `.claude/merge-dev-into-main.md` and help me merge `dev` into `main`."

- **What's on `dev`:** the readable-refactor chain for help desk #20, one squash commit per job. 5 of 7 jobs have landed so far.
- **What merging does:** Merging into `main` deploys the site, API and redirects on Vercel.
- **Kept up to date:** the coordinator (Thomas's workspace) updates this file each time a job lands, and once more just before opening the pull request. Last updated 13 Nov, 16:46 SGT.

## Claude: how to run the merge

Work through these in order, and stop to ask Augy wherever a step says so.

1. **Read first:** this file, then `README.md`. Never read, print or copy a `.env` or `token.env` file; use the `.example` files.
2. **Check `dev` matches this file:** `git fetch origin`, then `git log --oneline origin/main..origin/dev`. Every commit in the Jobs table below should be there. Commits titled "Merge context" only update this file. Read the message of any other commit the table doesn't list (`git show <sha>`) and tell Augy what it is.
3. **Run the tests** on a checkout of `dev` (commands below). All must pass. If one fails, stop and tell Augy; don't fix it on `main`.
4. **Go through "Before merging"** with Augy. Steps marked as his (Vercel settings, the database) are his to do by hand; ask him to confirm each one.
5. **The pull request:** `gh pr list --base main --head dev`. Thomas's side opens it once the last job lands. If Augy wants to ship before that, open it yourself: `gh pr create --base main --head dev`, titled "Help desk #20: readable refactor", with the Jobs table as its body.
6. **Merge with a merge commit, never squash or rebase**: `gh pr merge <number> --merge`. Squashing would drop the one-commit-per-job history, and each commit's `Archived-As` line points to the job's full branch. Ask Augy before running it: **merging is deploying.**
7. **Go through "After merging"**, then the smoke test with Augy (unless this file says to run it before merging).
8. **If something breaks:** in Vercel, promote the previous production deployment to roll back at once. Then revert the merge on `main` through a pull request (`git revert -m 1 <merge sha>`), and tell Thomas. Never force-push.

## Jobs

| Job | What it does | On `dev` |
|---|---|---|
| 01 | Playwright baseline | `dc00358` |
| 02 | Readability: shared browser files | `49ec031` |
| 03 | Readability: API handlers and lib/ | `09aaa50` |
| 04 | Readability: script.js, part 1 | `1f60619` |
| 05 | Readability: script.js, part 2 | `cdf81cf` |
| 06 | Readability: inline scripts and tools | to come |
| 07 | Final sweep | to come |

Each job's commit message lists what changed and how it was reviewed. The full branch is kept at `refs/archive/<job-id>`: `git fetch origin 'refs/archive/*:refs/archive/*'` to see them.

## Tests

```bash
npm ci
npm test            # all 28 API handlers against a fake Supabase
npm run test:e2e    # Playwright baseline: 69 views, DOM snapshots and screenshots
```

They need no `.env`, network or real database.

## Before merging

- **`main` moved since the last job?** Augy keeps pushing to `main`, so merge `main` into `dev` first and re-run the tests (the coordinator does this before each job lands).
- **Service worker:** `sw.js`'s `VERSION` must differ from `main`'s (job 07 bumps it). If it doesn't, bump it in a commit on `dev` first.
- **Release notes:** add the release to `CHANGELOG.md` and `RELEASE_NOTES.md` in this repo's date-code format, in a commit on `dev`, with Augy's OK on the wording.

## After merging

- Nothing by hand beyond the smoke test.

## Smoke test on the live site

The tests can't reach the real database, logins or messaging, so check these by hand after the deploy:

- Sign in, with 2FA and with a backup code.
- Create and edit a link; open the short link and check the redirect.
- An ownership transfer and an avatar upload.
- The admin pages load for an admin.

## What users may notice

- None meant: this chain only renames and rewrites for readability. Every page, API reply and redirect should behave as before.

Open questions and anything left for later are on help desk #20's review page, not here.
