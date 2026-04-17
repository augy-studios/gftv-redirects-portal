# Trusted Devices

If you have [2FA enabled](two-factor-authentication.md) and log in from the same device regularly, you can mark that device as **trusted** to skip the 2FA prompt for up to 30 days.

## How trusted devices work

When you mark a device as trusted:

* The device is recorded in your account.
* For the next **30 days**, logging in from that device will **not** prompt you for a 2FA code.
* After 30 days, the trust expires and you will be asked for a 2FA code again on your next login.

{% hint style="info" %}
"Trusted" applies to the specific browser on the specific device. A new browser or a private/incognito session will not inherit trust even on the same device.
{% endhint %}

## Trusting a device during login

1. Log in with your email and password.
2. When the 2FA prompt appears, enter your code.
3. Before submitting, tick the **Trust this device** checkbox.
4. Click **Verify**.

The device is now trusted for 30 days.

## Managing trusted devices

To see and manage which devices are currently trusted:

1. Log in and go to **Profile** > **Danger Zone**.
2. Scroll to the **Trusted Devices** section.
3. You will see a list of currently trusted devices.

From this list, you can:

| Action                             | What it does                                                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Remove a device**                | Revokes trust for that specific device immediately. The next login from it will require a 2FA code.             |
| **Log out from all devices**        | Ends all active sessions on every device, including this one, and clears all trust records. You will be signed out everywhere. |

## Revoking all sessions

If you believe your account has been accessed without your knowledge:

1. Go to **Profile** > **Danger Zone**.
2. Click **Log out from all devices**.
3. All sessions are terminated immediately, including your current one. All trusted device records are also cleared. You will be signed out and redirected to the home page.

{% hint style="danger" %}
If you suspect your account is compromised, also change your password immediately and consider regenerating your 2FA backup codes.
{% endhint %}

## Frequently asked questions

**Is it safe to trust a shared computer?** No. Only trust devices that are personal and secure. On a shared computer, always log out when done and never mark it as trusted.

**Can I see the device name or location for each trusted device?** The trusted devices list shows the devices that are registered, but detailed device metadata (browser name, OS, location) may be limited. Review the list regularly and remove any entries you do not recognise.

**What happens when trust expires?** After 30 days, the trust record expires naturally. The next time you log in from that device, you will be prompted for a 2FA code. You can re-trust it at that point.
