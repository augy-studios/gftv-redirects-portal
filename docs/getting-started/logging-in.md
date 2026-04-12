# Logging In

This page covers how to log in to gftv.asia, including two-factor authentication (2FA) and what to do if you run into problems.

## Standard login

1. Go to [gftv.asia](https://gftv.asia).
2. Click **Login** in the navigation bar.
3. Enter your **email address** and **password**.
4. Click **Log In**.

If your credentials are correct and your account is active, you'll be taken to your **Dashboard**.

## Two-factor authentication (2FA)

If you have [2FA enabled](../your-account/two-factor-authentication.md) on your account, you will be prompted to enter a one-time code after your password is accepted.

1. Open your authenticator app (e.g. Google Authenticator, Authy).
2. Find the entry for **gftv.asia**.
3. Enter the 6-digit code shown.
4. Click **Verify**.

{% hint style="info" %}
TOTP codes are time-based and valid for a short window. If your code is rejected, make sure your device's clock is correct and try again with the next code.
{% endhint %}

### Using a backup code

If you do not have access to your authenticator app, you can use one of your backup codes:

1. On the 2FA prompt, click **Use a backup code**.
2. Enter one of your saved backup codes.
3. Click **Verify**.

Each backup code can only be used once. After using all your codes, generate new ones from your [Account Settings](../your-account/two-factor-authentication.md).

### Trusted devices

If you are logging in from a device you use regularly, you can tick **Trust this device** during the 2FA step. Trusted devices skip the 2FA prompt for 30 days.

See [Trusted Devices](../your-account/trusted-devices.md) to manage which devices are trusted.

## Sessions

Your login session lasts for **30 days**. After that, you will need to log in again. You can also log out manually at any time from the navigation menu.

To end all active sessions at once (e.g. if you suspect unauthorised access), use the **Log out from all devices** option in your account settings.

## Troubleshooting

**I forgot my password.**
Passwords cannot be reset self-service. Contact an Admin and ask them to reset your password. They will provide you with a temporary password; change it immediately after logging in.

**My account says it's "Pending".**
Your registration is awaiting approval by an Admin. Reach out to your team lead or an Admin to expedite the approval.

**My 2FA code is not being accepted.**
Ensure your device's time is synchronised correctly. TOTP codes are time-sensitive. If the problem persists, use a backup code and then re-configure 2FA once you're logged in.

**I've run out of backup codes and lost my authenticator.**
Contact an Admin. They can reset your password and, if necessary, disable 2FA on your account so you can regain access.
