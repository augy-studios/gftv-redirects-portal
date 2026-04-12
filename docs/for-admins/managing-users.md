# Managing Users

{% hint style="info" %}
This section is for **Admins** only. If you do not have Admin access, the admin panel will not be visible to you.
{% endhint %}

Admins have full control over user accounts on gftv.asia. The admin panel lets you approve new registrations, change roles, edit account details, reset passwords, and delete accounts.

## Accessing the admin panel

1. Log in with an Admin account.
2. Click **Admin** in the navigation bar (visible to Admins only).
3. Select **Users** from the admin menu.

## Viewing users

The user list shows all accounts on the platform, separated into:

- **Approved users** — active accounts with a role assigned.
- **Pending users** — accounts awaiting approval (registered without a pre-approved email).

Each row shows the user's username, email, display name, current role, and available actions.

## Approving pending accounts

When a user registers without having been pre-approved, their account is placed in the **Pending** queue. To approve them:

1. Find the user in the **Pending** section of the user list.
2. Click **Grant Editor** (to give full link-creation access) or **Grant Viewer** (for read-only access).
3. The account is activated immediately and the user can log in.

{% hint style="info" %}
To avoid manual approvals, use the [Pre-Approval System](pre-approval-system.md) to add email addresses before officers register.
{% endhint %}

## Changing roles

You can change a user's role at any time:

| Action | Result |
|---|---|
| **Grant Editor** | Gives the user Editor access (can create and manage links) |
| **Grant Viewer** | Restricts the user to read-only access |
| **Revoke access** | Removes Editor or Viewer role; account becomes inactive |
| **Toggle Admin** | Grants or revokes Admin status |

{% hint style="warning" %}
Be careful when granting Admin status. Admins have full platform access, including the ability to edit, transfer, or delete any link and manage any user account.
{% endhint %}

## Editing user details

Admins can update a user's username, display name, and email address:

1. Find the user in the list.
2. Click **Edit**.
3. Update the relevant fields.
4. Click **Save**.

## Resetting passwords

If a user has forgotten their password and cannot reset it themselves:

1. Find the user in the list.
2. Click **Reset Password**.
3. The system generates a random 16-character temporary password and displays it to you.
4. Share this password securely with the user and ask them to change it immediately after logging in.

{% hint style="danger" %}
The temporary password is shown only once. Copy it before closing the dialog.
{% endhint %}

## Deleting user accounts

Deleting an account is permanent. All of the user's links, profile data, and settings are removed.

Before deleting an account:
- Consider whether any of the user's links are still in active use.
- If so, [transfer their links](managing-links.md) to another Editor first.

To delete an account:
1. Find the user in the list.
2. Click **Delete**.
3. The deletion dialog requires **three confirmation steps** to prevent accidental deletions.
4. Complete all three steps to proceed.

## Frequently asked questions

**Can I restore a deleted account?**
No. Account deletion is permanent and irreversible.

**What happens to a deleted user's links?**
The links are deleted along with the account. Transfer important links before deleting the account.

**Can a user remove their own Admin status?**
No. Admin status can only be toggled by another Admin.
