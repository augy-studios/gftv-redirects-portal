# Two-Factor Authentication

Two-factor authentication (2FA) adds a second layer of security to your gftv.asia account. Once enabled, logging in requires both your password and a time-based one-time code from an authenticator app.

## Why enable 2FA?

gftv.asia accounts can create and control short links that the GFTV community trusts. A compromised account could be used to redirect community members to malicious sites. Enabling 2FA significantly reduces the risk of unauthorised access even if your password is exposed.

{% hint style="success" %}
GFTV officers are strongly encouraged to enable 2FA, especially those with Editor or Admin roles.
{% endhint %}

## Setting up 2FA

You will need an authenticator app such as:

* Google Authenticator (iOS / Android)
* Authy (iOS / Android / Desktop)
* 1Password, Bitwarden, or another password manager with TOTP support

**Steps:**

1. Log in and go to **Settings** > **Security**.
2. Click **Set up Two-Factor Authentication**.
3. A **QR code** will be displayed.
4. Open your authenticator app and scan the QR code.
   * If you cannot scan it, click **Enter setup key manually** to copy the secret text instead.
5. Your authenticator app will now show a 6-digit code for gftv.asia.
6. Enter the current 6-digit code in the **Verification Code** field.
7. Click **Verify and Enable**.

2FA is now active on your account.

## Backup codes

When you enable 2FA, you will be given a set of **backup codes**. These are single-use codes you can use instead of your authenticator app if you ever lose access to it.

{% hint style="danger" %}
Save your backup codes somewhere safe (e.g. a password manager or printed copy stored securely). If you lose both your authenticator app access and your backup codes, you will need an Admin to reset your account.
{% endhint %}

Each backup code can only be used **once**. After using a code, it is invalidated.

### Regenerating backup codes

If you've used most of your codes or believe they may be compromised:

1. Go to **Settings** > **Security**.
2. Click **Regenerate Backup Codes**.
3. Your old codes are immediately invalidated.
4. Save the new codes in a safe location.

## Disabling 2FA

1. Go to **Settings** > **Security**.
2. Click **Disable Two-Factor Authentication**.
3. Enter your **current password** to confirm.
4. 2FA is disabled immediately.

{% hint style="warning" %}
Disabling 2FA removes the second layer of protection from your account. Only do this if you have a good reason, such as switching authenticator apps (in which case, re-enable 2FA immediately after).
{% endhint %}

## Frequently asked questions

**What is TOTP?** TOTP (Time-based One-Time Password) is a standard algorithm (RFC 6238) that generates a new 6-digit code every 30 seconds based on a shared secret. Your authenticator app and the gftv.asia server both knows the secret and generates the same code independently.

**My code isn't being accepted.** Ensure your device's clock is accurate as TOTP codes are time-sensitive. Try syncing your device's time and using the next code. If the problem persists, use a backup code.

**I've lost my authenticator app and backup codes.** Contact an Admin. They can reset your password and disable 2FA on your account so you can regain access.

**Do I need to re-verify 2FA when I change my password?** No. 2FA settings are separate from your password. Changing your password does not disable 2FA.
