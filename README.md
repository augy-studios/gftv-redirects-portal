# GFTV Shortlinks

The official link shortener for [GFTV (Global Furry Television)](https://globalfurrytv.news.blog), available at **[gftv.asia](https://gftv.asia)**.

## Contents

- [Introduction](#introduction)
- [Key Features](#key-features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Running Locally](#running-locally)
  - [Environment Variables](#environment-variables)
  - [Deploying to Vercel](#deploying-to-vercel)
- [Developer Documentation](#developer-documentation)
  - [Folder Structure](#folder-structure)
  - [Tech Stack](#tech-stack)
  - [API Routes](#api-routes)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Introduction

GFTV Shortlinks is the official link management platform for GFTV officers. It enables verified staff and volunteers to create short, trustworthy links under the `gftv.asia` domain — links that community members can click on with confidence.

There are multiple reasons why we built a dedicated link shortener rather than relying on commercial services:

- Generic shorteners (bit.ly, tinyurl) let **anyone** create links, including bad actors — making it impossible for the community to distinguish legitimate GFTV links from phishing attempts
- Commercial shorteners can be **blocked by spam filters** in emails and messaging platforms
- A branded `gftv.asia` domain acts as a **trust signal**, the same way a `.gov` domain signals an official government site

With GFTV Shortlinks, community members know that any `gftv.asia/...` link was created by a vetted GFTV officer. Link creation is restricted by default; only approved Editors and Admins can create links.

## Key Features

### For Everyone (No Account Required)

- **Public Directory** — Browse and search all active short links on the platform. Filter by keyword, tag, or username.
- **QR Code Scanning** — Every public short link has a scannable and downloadable QR code image.
- **Fast Redirects** — Redirects are served via Vercel Edge Runtime for ultra-low latency, with native visit tracking.

### For Logged-In Users (Viewers & Editors)

- **Two-Factor Authentication (2FA)** — Secure your account with a TOTP authenticator app (Google Authenticator, Authy, 1Password, etc.).
- **2FA Backup Codes** — Receive 8 one-time recovery codes when enabling 2FA. Regenerate them at any time with your password.
- **Trusted Devices** — Skip the 2FA prompt on devices you trust for up to 30 days.
- **Logout All Sessions** — Instantly invalidate every active session across all devices from your Profile page.
- **User Profiles** — Public profile pages showing role badge, avatar, link stats, and optional social links.
- **Strong Password Enforcement** — Passwords are validated against real entropy requirements, not just length rules.

### For Editors (Officers)

- **Link Creation** — Create short links with custom slugs (alphanumeric, hyphens, underscores; up to 60 characters).
- **Link Editing** — Update the destination URL, active status, and tags on any link you own.
- **Link Tags** — Label links with up to 5 tags each for easy organisation and discovery.
- **Link Analytics** — Track cumulative view counts for every short link you own.
- **QR Code Export** — Generate a downloadable composite PNG (QR code + printed URL) for any of your links.
- **Ownership Transfer** — Hand off a link to another user directly from the edit panel.
- **Ownership Requests** — Receive and respond to ownership requests from other officers.

### For Admins

- **User Management** — Approve registrations, reset passwords, grant or revoke Editor access, toggle admin status, or delete accounts.
- **Pre-Approval System** — Pre-authorise an email address with a role before the person registers. They are instantly activated on sign-up.
- **Admin Link Management** — Edit the slug, destination, active status, and tags of any link on the platform. Delete links when necessary.
- **Directory Edit Button** — Admins see an edit button on every link in the public directory for quick access.

### Platform

- **Progressive Web App (PWA)** — Installable on mobile and desktop. Works offline for previously visited pages.
- **7 Colour Themes** — Users can customise their interface with a built-in theme selector.
- **Role-Based Access Control** — Three roles: Viewer (read-only), Editor (link management), Admin (full control).
- **Invite-Only Registration** — New accounts are Pending until an Admin approves them, or a pre-approval is matched on sign-up.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- A [Supabase](https://supabase.com) project with the required tables and RPC functions
- A [Vercel](https://vercel.com) account (for deployment) or the [Vercel CLI](https://vercel.com/docs/cli) for local development

### Running Locally

```bash
# Clone the repository
git clone https://github.com/augy-studios/gftv-redirects-portal.git
cd gftv-redirects-portal

# Install dependencies
npm install

# Start the local dev server with Vercel CLI
vercel dev
```

The app will be available at `http://localhost:3000`. API routes under `/api` are served as Vercel serverless functions.

### Environment Variables

Create a `.env` file (or configure via the Vercel dashboard) with the following variables:

| Variable | Required | Description |
|---|:---:|---|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Your Supabase anonymous (public) API key |

All other configuration (session management, link limits, etc.) is handled at the application level using Supabase's built-in features.

### Deploying to Vercel

GFTV Shortlinks is designed to deploy on [Vercel](https://vercel.com) with zero additional configuration beyond the environment variables above.

```bash
# Deploy via Vercel CLI
vercel --prod
```

Alternatively, connect the repository to a Vercel project and push to `main` — Vercel will build and deploy automatically.

The redirect handler (`api/redirect/[slug].js`) runs on **Vercel Edge Runtime** for globally distributed, low-latency redirects.

## Developer Documentation

### Folder Structure

```
gftv-redirects-portal/
├── api/                    # Vercel serverless & edge functions
│   ├── admin/              # Admin-only endpoints (users, pre-approvals)
│   ├── auth/               # Authentication endpoints (login, register, 2FA, logout)
│   ├── links/              # Link CRUD endpoints
│   ├── ownership/          # Ownership transfer and request endpoints
│   ├── profile/            # Profile management endpoints
│   ├── redirect/           # Edge runtime redirect handler
│   └── stats.js            # Platform statistics endpoint
├── lib/                    # Shared server-side utilities
│   ├── auth.js             # Session resolution helper
│   ├── response.js         # Standardised API response helpers
│   └── supabase.js         # Supabase client initialisation
├── docs/                   # GitBook documentation source
├── images/                 # Static image assets
├── .well-known/            # Android asset links (PWA)
├── index.html              # Main SPA entry point
├── sw.js                   # Service worker (PWA offline support)
├── manifest.json           # PWA manifest
└── api.js                  # Client-side API wrapper
```

### Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Vanilla HTML/CSS/JS, PWA (service worker + manifest) |
| Backend | Vercel Serverless Functions (Node.js) |
| Redirect handler | Vercel Edge Runtime |
| Database | [Supabase](https://supabase.com) (PostgreSQL) |
| Authentication | Custom session tokens (bcrypt + crypto) |
| 2FA | TOTP via [otplib](https://github.com/yeojz/otplib) |
| QR Codes | [QRious](https://github.com/neocotic/qrious) |
| Password validation | [fast-password-entropy](https://github.com/wjbryant/fast-password-entropy) |
| Deployment | [Vercel](https://vercel.com) |

### API Routes

| Method | Path | Description | Auth Required |
|---|---|---|:---:|
| `POST` | `/api/auth/register` | Register a new account | No |
| `POST` | `/api/auth/login` | Log in (with optional 2FA challenge) | No |
| `POST` | `/api/auth/totp-verify` | Verify TOTP code and complete login | No |
| `GET` | `/api/auth/me` | Get current session user | Yes |
| `POST` | `/api/auth/logout` | End current session | Yes |
| `POST` | `/api/auth/logout-all` | End all sessions for the current user | Yes |
| `POST` | `/api/auth/totp-setup` | Generate a new TOTP secret | Yes |
| `POST` | `/api/auth/totp-enable` | Confirm and enable TOTP 2FA | Yes |
| `POST` | `/api/auth/totp-disable` | Disable TOTP 2FA | Yes |
| `POST` | `/api/auth/backup-codes-regenerate` | Regenerate 2FA backup codes | Yes |
| `GET` | `/api/links` | List all links (directory) | Yes |
| `POST` | `/api/links` | Create a new short link | Yes (Editor+) |
| `GET` | `/api/links/mine` | List the current user's links | Yes |
| `GET/PATCH/DELETE` | `/api/links/[id]` | Read, update, or delete a link | Yes |
| `GET/POST` | `/api/ownership` | List or create ownership requests | Yes |
| `PATCH/DELETE` | `/api/ownership/[id]` | Accept or decline an ownership request | Yes |
| `PATCH` | `/api/profile/update` | Update profile (display name, avatar, social links) | Yes |
| `POST` | `/api/profile/avatar` | Upload a profile avatar | Yes |
| `POST` | `/api/profile/delete` | Delete the current user's account | Yes |
| `GET` | `/api/profile/views` | Get profile view history | Yes |
| `GET` | `/api/stats` | Get platform-wide statistics | Yes |
| `GET/POST/DELETE` | `/api/admin/users` | Manage users | Yes (Admin) |
| `GET/POST/DELETE` | `/api/admin/preapproved` | Manage pre-approvals | Yes (Admin) |
| `GET` | `/api/redirect/[slug]` | Redirect a short link (Edge) | No |

## Documentation

Full user and admin documentation is available at **[guide.gftv.asia](https://guide.gftv.asia)** (powered by GitBook).

Topics covered include:

- [What is gftv.asia?](docs/getting-started/what-is-gftv-asia.md)
- [Joining as an Officer](docs/getting-started/joining-as-an-officer.md)
- [Creating and Managing Links](docs/managing-links/creating-a-link.md)
- [Two-Factor Authentication](docs/your-account/two-factor-authentication.md)
- [Admin Guide](docs/for-admins/managing-users.md)

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening issues or pull requests, and review our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

This project is licensed under the terms found in [LICENSE](LICENSE).
