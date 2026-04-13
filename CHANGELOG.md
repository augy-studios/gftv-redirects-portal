## Changelog

All notable changes to GFTV Shortlinks are documented in this file. Dates are displayed in AEST (UTC+10).

Versions follow date-based release codes in the format `YYYY.MM.DD`. If multiple releases occur on the same day, a lowercase letter suffix is appended (e.g. `2026.04.12-a`, `2026.04.12-b`).

---

#### [2026.04.13](https://github.com/augy-studios/gftv-redirects-portal/compare/2026.04.12...2026.04.13)

> 13 April 2026

**Analytics, Public API & Dashboard Enhancements**

- Add **link analytics modal** — per-link analytics accessible from the My Links dashboard, showing device type breakdown (Desktop, Tablet, Mobile, Others), a 7-day click trend chart, an hour-of-day traffic heatmap, and a full link history log
- Add **device type tracking** on link visits — the `record_link_visit` RPC now accepts a `device_type` parameter; existing visits default to `Others`
- Add **link history log** — auto-recorded event trail for each link (creation, status changes, ownership transfers) via a database trigger (`trg_link_history`)
- Add **analytics CSV export** — export the full all-time daily click history for any link as a CSV from the analytics modal
- Add **Public API v1** — REST API for programmatic link access, authenticated via `Authorization: ApiKey <key>`:
  - `GET /api/v1/links` — list your links, filterable by slug or tag with pagination
  - `POST /api/v1/links` — create a new short link
  - `GET /api/v1/links/:slug` — retrieve any link by slug
  - `PUT /api/v1/links/:slug` — update your link's destination, active status, or tags
- Add **API Integration page** — generate and manage a personal API key from the portal sidebar; available to Editors and Admins
- Add **My Links search and filters** — filter by keyword, tag, or active/inactive status; sort by date created or total visit count
- Add **My Links CSV export** — download your link list (or any filtered subset) as a CSV file including slug, destination, active status, visits, tags, and creation date
- Fix `visited_at` column naming in link visits migration
- Fix API key display field layout on small screens

---

#### [2026.04.12](https://github.com/augy-studios/gftv-redirects-portal/compare/2026.04.11...2026.04.12)

> 12 April 2026

**Documentation & Stability**

- Add comprehensive GitBook documentation for [guide.gftv.asia](https://guide.gftv.asia), covering all user roles, features, and admin workflows
- Improve TOTP verification tolerance by adding a time-window buffer to account for clock skew between the server and authenticator apps
- Allow the previous TOTP cycle during both login verification and 2FA setup confirmation
- Merge pre-approved users feature from `claude/add-preapproved-users-W7O6b`

---

#### [2026.04.11](https://github.com/augy-studios/gftv-redirects-portal/compare/2026.04.10...2026.04.11)

> 11 April 2026

**Security, QR Codes & Link Ownership**

- Add **Two-Factor Authentication (2FA)** with TOTP support — users can enable/disable 2FA from their Profile page using any standards-compliant authenticator app
- Add **2FA backup codes** — 8 one-time recovery codes issued on 2FA setup, downloadable as `gftvlinks-backup-codes.txt`; regeneratable at any time (password required)
- Add **trusted device** support — users can skip the 2FA prompt on trusted devices for up to 30 days
- Add **Logout All Sessions** — invalidate every active session across all devices from the Profile page
- Add server-side **password entropy validation** using `fast-password-entropy` to enforce genuinely strong passwords
- Add **QR code generation** for short links — generates a composite PNG (QR + printed URL) downloadable or shareable natively on mobile; available in both the public Directory and the My Links dashboard
- Switch QR code rendering to **QRious** library for improved browser compatibility
- Add **ownership transfer** — editors can hand off a link to another user from the link edit panel
- Add **ownership requests** — users can formally request ownership of a link they do not own; owners can approve or deny from the Ownership Requests page
- Auto-lowercase tag input in real time as the user types
- Validate email format during registration
- Refactor table cell styles for improved layout and readability across Directory and Dashboard views
- Replace GoatCounter analytics with **Supabase-native link visit tracking** via `record_link_visit` RPC

---

#### [2026.04.10](https://github.com/augy-studios/gftv-redirects-portal/compare/2026.04.09...2026.04.10)

> 10 April 2026

**User Roles, Homepage & Admin Improvements**

- Add **Editor / Viewer role system** — Viewers can browse the Directory but cannot create links; Editors have full link management capabilities
- Add **public homepage** with hero section, feature highlights, animated typing effect, and live platform statistics (total links, total redirects, total users)
- Add **profile view tracking** — logged-in users can see a list of recent viewers of their profile
- Add **admin Manage Short Link modal** — admins can edit the slug, destination URL, active status, and tags of any link on the platform, and delete links if needed
- Add **Edit button in Directory** for admin users, providing one-click access to the link management modal from the public listing
- Refactor admin user management panel with a unified modal interface for editing users
- Replace the admin Actions column with a consolidated Edit modal

---

#### [2026.04.09](https://github.com/augy-studios/gftv-redirects-portal/compare/initial...2026.04.09)

> 9 April 2026

**Platform Launch**

- Launch **gftv.asia** as the official link shortener for GFTV (Global Furry Television)
- **Short link creation** — editors can create custom slug links pointing to any external URL; slugs are alphanumeric (hyphens/underscores allowed) up to 60 characters
- **Public Directory** — browse all active links on the platform, searchable by keyword, tag, or username
- **Link tags** — label links with up to 5 tags for organisation and discovery
- **Link analytics** — cumulative access count tracked and displayed per link on the Dashboard and Directory
- **Edge Runtime redirect handler** — short link redirects served via Vercel Edge for globally distributed, low-latency performance; deactivated links fall back to the GFTV blog
- **Admin panel** — manage users (approve, reset password, change role, delete) and platform links
- **User profile modal** — public profile pages showing role badge, avatar, display name, link stats, and optional social links (Twitter/X, YouTube, Twitch, etc.)
- **Social links display** on user profiles
- **7 colour themes** — users can personalise their interface via the built-in theme selector
- **PWA support** — installable on mobile and desktop with offline capability via service worker
- **Invite-only registration** — new accounts are Pending until an Admin approves them
- Standardised API response helpers (`ok`, `err`, `parseBody`) across all serverless routes
- Restrict destination URLs from pointing back to `gftv.asia` to prevent circular redirects
- All icons and emoji converted to inline SVGs for consistent cross-platform rendering
- Remove `/r/` prefix requirement from short link paths
