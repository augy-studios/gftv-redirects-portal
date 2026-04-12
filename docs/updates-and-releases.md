# Updates & Releases

This page tracks significant feature releases and updates to gftv.asia. The most recent changes are listed first.

Versions follow date-based release codes in the format `YYYY.MM.DD`.

---

## 2026.04.12 — Documentation & Stability

**Released:** 12 April 2026

- Launched comprehensive GitBook documentation at [guide.gftv.asia](https://guide.gftv.asia), covering all user roles, features, and admin workflows.
- Improved TOTP verification tolerance with a time-window buffer to account for clock skew between the server and authenticator apps.
- The previous TOTP cycle is now accepted during both login verification and 2FA setup confirmation.
- Merged pre-approved users feature — see [Pre-Approval System](for-admins/pre-approval-system.md).

---

## 2026.04.11 — Security, QR Codes & Link Ownership

**Released:** 11 April 2026

**Two-Factor Authentication (2FA)**

All gftv.asia accounts can now enable TOTP-based two-factor authentication. Supported by any standards-compliant authenticator app (Google Authenticator, Authy, 1Password, etc.). Includes:

- QR code setup and manual key entry.
- 8 one-time backup codes for account recovery, downloadable as `gftvlinks-backup-codes.txt` and regeneratable at any time (password required).
- Trusted device support — skip 2FA on known devices for up to 30 days.
- Logout All Sessions — invalidate every active session across all devices from the Profile page.

See [Two-Factor Authentication](your-account/two-factor-authentication.md) and [Trusted Devices](your-account/trusted-devices.md).

**QR Code Generation**

Any short link can now generate a downloadable composite QR code image — a PNG containing the QR code and the printed short link URL. The image can be downloaded, copied to clipboard, or shared natively on mobile. Available in both the public Directory and the My Links dashboard.

See [QR Codes](managing-links/qr-codes.md).

**Link Ownership**

- Ownership transfer — editors can hand off a link to another user from the link edit panel.
- Ownership requests — users can formally request ownership of a link they do not own; owners can approve or deny from the Ownership Requests page.

See [Ownership Requests](managing-links/ownership-requests.md).

**Other improvements**

- Server-side password entropy validation to enforce genuinely strong passwords.
- Replaced GoatCounter analytics with Supabase-native link visit tracking.
- Auto-lowercase tag input in real time as the user types.
- Email format validation during registration.
- Refactored table cell styles for improved layout and readability across Directory and Dashboard views.

---

## 2026.04.10 — User Roles, Homepage & Admin Improvements

**Released:** 10 April 2026

**Editor / Viewer Role System**

A new role system distinguishes between Viewers (who can browse the Directory but cannot create links) and Editors (who have full link management capabilities).

**Public Homepage**

A public homepage with a hero section, feature highlights, animated typing effect, and live platform statistics (total links, total redirects, total users).

**Profile View Tracking**

Logged-in users can now see a list of recent viewers of their profile.

See [User Profiles](directory/user-profiles.md).

**Admin Improvements**

- Admin Manage Short Link modal — admins can edit the slug, destination URL, active status, and tags of any link on the platform, and delete links if needed.
- Edit button in Directory for admin users, providing one-click access to the link management modal from the public listing.
- Unified modal interface for the admin user management panel.

See [Managing Users](for-admins/managing-users.md) and [Managing Links](for-admins/managing-links.md).

---

## 2026.04.09 — Platform Launch

**Released:** 9 April 2026

gftv.asia launched as the official link shortener for GFTV (Global Furry Television). Core features at launch included:

- **Short link creation** — editors can create custom slug links pointing to any external URL; slugs are alphanumeric (hyphens/underscores allowed) up to 60 characters. See [Creating a Link](managing-links/creating-a-link.md).
- **Public Directory** — browse all active links on the platform, searchable by keyword, tag, or username. See [Browsing the Directory](directory/browsing-the-directory.md).
- **Link tags** — label links with up to 5 tags for organisation and discovery. See [Link Tags](managing-links/link-tags.md).
- **Link analytics** — cumulative access count tracked and displayed per link on the Dashboard and Directory. See [Link Analytics](managing-links/link-analytics.md).
- **Edge Runtime redirect handler** — short link redirects served via Vercel Edge for globally distributed, low-latency performance; deactivated links fall back to the GFTV blog.
- **Admin panel** — manage users (approve, reset password, change role, delete) and platform links.
- **User profile modal** — public profile pages showing role badge, avatar, display name, link stats, and optional social links (Twitter/X, YouTube, Twitch, etc.). See [User Profiles](directory/user-profiles.md) and [Profile & Settings](your-account/profile-and-settings.md).
- **7 colour themes** — users can personalise their interface via the built-in theme selector.
- **PWA support** — installable on mobile and desktop with offline capability via service worker.
- **Invite-only registration** — new accounts are Pending until an Admin approves them.
