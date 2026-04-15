# GFTV Shortlinks — Release Notes

> **Release Date:** April 2026
> **Platform:** [gftv.asia](https://gftv.asia)

---

## Discord Version

Copy and paste the block below into Discord.

---

```
# 📣 **GFTV.asia Short Links Portal — Release Notes**
We've shipped a big wave of improvements to the GFTV Shortlinks portal. Here's everything that's new, broken down by your access level.

## 🌐 **Viewers**
- **QR Code Sharing** — Every public short link now has a QR code you can scan or download and share anywhere.
- **Faster Link Redirects** — Visit tracking is now handled natively, removing any reliance on third-party analytics.
- **Directory Search & Filters** — Browse all links from the public directory with four independent controls: keyword search (matches slug, destination, display name, and username), tag filter, Active/Inactive status filter, and sort by Date Created or Most Visits. All filtering and sorting happen instantly without page reloads.
- **Legal Pages** — Terms of Use and Privacy Policy are now published and linked from the portal footer.

## 🔐 **All Logged-In Users (Viewers & Editors)**
- **Two-Factor Authentication (2FA)** — Secure your account with a TOTP authenticator app (Google Authenticator, Authy, etc.). Set it up from your Profile page.
- **2FA Backup Codes** — When enabling 2FA, you'll receive 8 one-time backup codes. Download them and keep them safe. You can regenerate them anytime (password required).
- **Trusted Devices** — After a 2FA login, you can mark your device as trusted so you won't be prompted again on that device.
- **Logout All Sessions** — Found a suspicious login? Hit "Logout All Sessions" in your Profile to immediately invalidate every active session across all your devices.
- **Stronger Password Requirements** — Passwords are now validated for real entropy, not just length. Pick a strong one.
- **Auto-Lowercase Tags** — Tags are automatically lowercased as you type — no more mixed-case inconsistencies.

## ✏️ **Editors (Officers)**
*Everything above, plus:*
- **Ownership Transfer** — You can now hand off any of your short links to another user. Just enter their username in the link's edit panel.
- **Ownership Requests** — Other users can formally request ownership of your links. You'll receive the request and can approve or deny it from the Ownership Requests page.
- **QR Code in My Links** — The QR code button is available directly inside your "My Links" dashboard — no need to find the link in the public directory.
- **Link Analytics** — A detailed analytics modal for every link, accessible from your "My Links" dashboard. View a device type breakdown (Desktop, Tablet, Mobile), a 7-day click trend chart, an hour-of-day traffic heatmap, and a full link history log (creation events, status changes, and ownership transfers). Export the complete daily click history for any link as a CSV.
- **My Links Search & Filters** — Filter your links by keyword, tag, or status (Active / Inactive) and sort by date created or total visit count.
- **CSV Export** — Download your entire link list (or any filtered subset) as a CSV file, including slug, destination, active status, visit count, tags, and creation date.

## 🛠️ **Admins**
*Everything above, plus:*
- **Pre-Approved Users** — Pre-authorise an email address with a role (Viewer or Editor) before they register. When that person signs up, they're instantly approved, assigned their role, and logged in automatically.
- **Pre-Approval Auto-Linking** — If you add a pre-approval for an email that already belongs to an existing approved user, the record is immediately marked as Activated — no manual step needed.
- **Pre-Approval Dashboard** — See all pending pre-approvals, who created them, and when each one was activated.
- **Admin Link Management** — A new "Manage Short Link" modal lets admins edit the slug, destination URL, active status, and tags of **any** link on the platform — and delete links if needed.
- **Edit Button in Directory** — Admins now see an edit button on every link in the public directory for quick access.
- **User Management Improvements** — Reset any user's password, grant or revoke Editor/Viewer access, toggle admin status, or delete accounts entirely from the Admin panel.

## 💻 **Editors & Admins (Developer Access)**
*Available to all Editors and Admins:*
- **Public API v1** — Programmatic REST access to your links, authenticated with a personal API key (`Authorization: ApiKey <key>`).
  - `GET /api/v1/links` — List your links, filterable by slug or tag, with pagination support.
  - `POST /api/v1/links` — Create a new short link.
  - `GET /api/v1/links/:slug` — Retrieve any link by slug.
  - `PUT /api/v1/links/:slug` — Update your link's destination, active status, or tags.
- **API Integration Page** — Generate and manage your personal API key from the new **API** page in the portal sidebar. Regenerating your key immediately invalidates the previous one.

Thanks for using GFTV Shortlinks! 🦊
https://gftv.asia/
```

---

## Telegram Version

Copy and paste the block below into Telegram.

---

```
📣 *GFTV.asia Short Links Portal — Release Notes*
We've shipped a big wave of improvements to the GFTV Shortlinks portal\. Here's everything that's new, broken down by your access level\.

────────────────────────────
🌐 *Viewers*
────────────────────────────
• *QR Code Sharing* — Every public short link now has a QR code you can scan or download and share anywhere\.
• *Faster Link Redirects* — Visit tracking is now handled natively, removing any reliance on third\-party analytics\.
• *Directory Search & Filters* — Browse all links with four independent controls: keyword search, tag filter, Active/Inactive status filter, and sort by Date Created or Most Visits\. All filtering and sorting happen instantly without page reloads\.
• *Legal Pages* — Terms of Use and Privacy Policy are now published and linked from the portal footer\.

────────────────────────────
🔐 *All Logged\-In Users \(Viewers & Editors\)*
────────────────────────────
• *Two\-Factor Authentication \(2FA\)* — Secure your account with a TOTP authenticator app \(Google Authenticator, Authy, etc\.\)\. Set it up from your Profile page\.
• *2FA Backup Codes* — When enabling 2FA, you'll receive 8 one\-time backup codes\. Download them and keep them safe\. You can regenerate them anytime \(password required\)\.
• *Trusted Devices* — After a 2FA login, you can mark your device as trusted so you won't be prompted again on that device\.
• *Logout All Sessions* — Found a suspicious login? Hit "Logout All Sessions" in your Profile to immediately invalidate every active session across all your devices\.
• *Stronger Password Requirements* — Passwords are now validated for real entropy, not just length\. Pick a strong one\.
• *Auto\-Lowercase Tags* — Tags are automatically lowercased as you type — no more mixed\-case inconsistencies\.

────────────────────────────
✏️ *Editors \(Officers\)*
────────────────────────────
_Everything above, plus:_
• *Ownership Transfer* — You can now hand off any of your short links to another user\. Just enter their username in the link's edit panel\.
• *Ownership Requests* — Other users can formally request ownership of your links\. You'll receive the request and can approve or deny it from the Ownership Requests page\.
• *QR Code in My Links* — The QR code button is available directly inside your "My Links" dashboard — no need to find the link in the public directory\.
• *Link Analytics* — A detailed analytics modal for every link, accessible from your "My Links" dashboard\. View a device type breakdown \(Desktop, Tablet, Mobile\), a 7\-day click trend chart, an hour\-of\-day traffic heatmap, and a full link history log \(creation events, status changes, and ownership transfers\)\. Export the complete daily click history for any link as a CSV\.
• *My Links Search & Filters* — Filter your links by keyword, tag, or status \(Active / Inactive\) and sort by date created or total visit count\.
• *CSV Export* — Download your entire link list \(or any filtered subset\) as a CSV file, including slug, destination, active status, visit count, tags, and creation date\.

────────────────────────────
🛠️ *Admins*
────────────────────────────
_Everything above, plus:_
• *Pre\-Approved Users* — Pre\-authorise an email address with a role \(Viewer or Editor\) before they register\. When that person signs up, they're instantly approved, assigned their role, and logged in automatically\.
• *Pre\-Approval Auto\-Linking* — If you add a pre\-approval for an email that already belongs to an existing approved user, the record is immediately marked as Activated — no manual step needed\.
• *Pre\-Approval Dashboard* — See all pending pre\-approvals, who created them, and when each one was activated\.
• *Admin Link Management* — A new "Manage Short Link" modal lets admins edit the slug, destination URL, active status, and tags of *any* link on the platform — and delete links if needed\.
• *Edit Button in Directory* — Admins now see an edit button on every link in the public directory for quick access\.
• *User Management Improvements* — Reset any user's password, grant or revoke Editor/Viewer access, toggle admin status, or delete accounts entirely from the Admin panel\.

────────────────────────────
💻 *Editors & Admins \(Developer Access\)*
────────────────────────────
_Available to all Editors and Admins:_
• *Public API v1* — Programmatic REST access to your links, authenticated with a personal API key\. Supports listing, creating, reading, and updating links via `Authorization: ApiKey <key>`\.
• *API Integration Page* — Generate and manage your personal API key from the new *API* page in the portal sidebar\. Regenerating your key immediately invalidates the previous one\.

────────────────────────────
Thanks for using GFTV Shortlinks\! 🦊
https://gftv.asia/
```
