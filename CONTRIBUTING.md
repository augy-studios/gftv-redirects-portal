# Contributing to GFTV Shortlinks

Thank you for your interest in contributing to GFTV Shortlinks! This document outlines how to get involved, from reporting bugs and requesting features to submitting code changes.

Please note that all participation in this project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By contributing, you agree to uphold its standards.

## Contents

- [Before You Start](#before-you-start)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)
- [Contributing Code](#contributing-code)
  - [Setting Up Your Environment](#setting-up-your-environment)
  - [Branching Strategy](#branching-strategy)
  - [Commit Messages](#commit-messages)
  - [Pull Request Process](#pull-request-process)
- [Security Vulnerabilities](#security-vulnerabilities)
- [Contact](#contact)

## Before You Start

Before opening an issue or starting work on a change, please:

1. **Search existing issues and pull requests** to check whether the bug has already been reported or the feature already proposed. Adding a comment to an existing thread is better than opening a duplicate.
2. **Discuss significant changes first.** For non-trivial features or architectural changes, open an issue and describe what you want to do before writing any code. This prevents wasted effort and ensures alignment with the project's direction.
3. **Check the documentation.** The [user guide at guide.gftv.asia](https://guide.gftv.asia) may already answer your question.

## Reporting Bugs

A good bug report helps us reproduce and fix the problem quickly. When filing a bug, please include:

- **A clear, descriptive title** — e.g. _"QR code download fails on iOS Safari 17"_, not _"QR broken"_
- **Steps to reproduce** — numbered, minimal steps that reliably trigger the issue
- **Expected behaviour** — what you expected to happen
- **Actual behaviour** — what actually happened
- **Environment** — browser name and version, operating system, and whether you are using the PWA install or the browser version
- **Screenshots or screen recordings** — if the issue is visual or intermittent
- **Console errors** — paste any relevant errors from the browser's developer console

> Security vulnerabilities should **not** be reported as public issues. See [Security Vulnerabilities](#security-vulnerabilities) below.

## Requesting Features

Feature requests are welcome. A strong feature request includes:

- **The problem you are trying to solve** — describe the context and motivation, not just the solution. _"As an editor, I want to bulk-create links because manually creating 20 links for a campaign takes too long"_ is more useful than _"add bulk link creation"_.
- **What you have considered** — alternatives you have thought of, and why you prefer the proposed approach.
- **Scope** — is this a small addition, a significant behaviour change, or a new workflow? Larger changes benefit from discussion before implementation.
- **Affected roles** — which user roles (Viewer, Editor, Admin, or unauthenticated visitors) would this change affect?

## Contributing Code

### Setting Up Your Environment

1. **Fork** the repository on GitHub and clone your fork locally.

   ```bash
   git clone https://github.com/<your-username>/gftv-redirects-portal.git
   cd gftv-redirects-portal
   ```

2. **Install dependencies.**

   ```bash
   npm install
   ```

3. **Set up environment variables.** Copy the example below into a `.env` file at the project root and fill in your Supabase credentials.

   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ```

4. **Start the local dev server** using the Vercel CLI (recommended, as it emulates edge functions and serverless routes correctly).

   ```bash
   npx vercel dev
   ```

   The app will be available at `http://localhost:3000`.

### Branching Strategy

- `main` — the stable production branch. Direct pushes are not permitted.
- Feature branches — branch off `main` using a descriptive name:
  - `feat/bulk-link-creation`
  - `fix/qr-download-ios-safari`
  - `docs/update-contributing-guide`
  - `chore/upgrade-otplib`

Keep branches focused on a single concern. A pull request that fixes a bug, adds a feature, and refactors unrelated code is harder to review and more likely to introduce regressions.

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) style:

```
<type>: <short description in imperative mood>

[optional body]

[optional footer]
```

Common types:

| Type | When to use |
|---|---|
| `feat` | A new feature visible to users |
| `fix` | A bug fix |
| `docs` | Documentation only changes |
| `refactor` | Code restructuring with no behaviour change |
| `chore` | Maintenance tasks (dependency updates, CI config, etc.) |
| `test` | Adding or updating tests |

Examples:

```
feat: add bulk ownership transfer for admins
fix: prevent QR code download from timing out on slow connections
docs: add trusted devices section to 2FA guide
chore: upgrade otplib to v12.0.1
```

### Pull Request Process

1. **Ensure your branch is up to date** with `main` before opening the PR.

   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Write a clear PR description** that explains:
   - What the change does
   - Why it is needed
   - How to test it (for bug fixes, include steps to reproduce the original bug)
   - Any known limitations or follow-up work

3. **Keep the PR focused.** A single, well-scoped change is easier to review than a large one. If you find unrelated issues while working, open separate PRs for them.

4. **Remove build artefacts and debug code** before requesting review. Do not commit `node_modules`, `.env` files, or temporary test files.

5. **Update documentation** if your change affects user-facing behaviour. This includes the docs under the `/docs` folder (synced to [guide.gftv.asia](https://guide.gftv.asia)) and inline code comments where relevant.

6. **Address review feedback** promptly. If you disagree with a suggestion, explain your reasoning — a constructive discussion is always welcome.

7. Pull requests require at least **one approving review** from a project maintainer before merging.

## Security Vulnerabilities

Please **do not** file public GitHub issues for security vulnerabilities. Instead, report them directly to the project maintainers at **augybiz@gmail.com** with a description of the vulnerability, steps to reproduce, and any relevant details.

We will acknowledge your report as soon as possible, work with you to understand the scope of the issue, and coordinate a fix and disclosure timeline.

## Contact

For questions that are not bugs or feature requests, you can reach the maintainers at **augy@augystudios.com**.
