# Pre-Approval System

The pre-approval system lets Admins authorise email addresses in advance, so new officers can register and be immediately granted the correct role without needing manual approval.

## Why use pre-approvals?

Without pre-approval, every new registration lands in a **Pending** queue and requires an Admin to manually review and approve it. Pre-approvals eliminate this friction:

* The officer registers normally.
* Because their email is on the pre-approved list, their account is **instantly activated** with the assigned role.
* No Admin action is needed post-registration.

{% hint style="success" %}
Pre-approvals are the recommended onboarding method for new GFTV officers. Add their email to the list, then share the registration link with them.
{% endhint %}

## Adding a pre-approval

1. Go to the **Admin** panel > **Pre-Approvals**.
2. Click **Add Pre-Approval**.
3. Enter the officer's **email address**.
4. Select the **role** to assign on registration:
   * **Editor** — for officers who will create and manage links.
   * **Viewer** — for officers who only need read access to the Directory.
5. Click **Save**.

The email address is now on the pre-approved list. Share the gftv.asia registration link with the officer. When they register using that email, their account will be immediately activated with the selected role.

## Viewing pre-approvals

The pre-approvals list shows all pre-approved entries with three possible statuses:

| Status        | Meaning                                                |
| ------------- | ------------------------------------------------------ |
| **Pending**   | The officer has not yet registered with this email     |
| **Activated** | The officer has registered and their account is active |

## Removing a pre-approval

If you no longer want a specific email to be pre-approved (e.g. the offer was rescinded before the person registered):

1. Go to **Admin** panel > **Pre-Approvals**.
2. Find the entry in the list.
3. Click **Remove**.

{% hint style="warning" %}
You can only remove a pre-approval while its status is **Pending**. Once the email has been used to register (status: **Activated**), removing the pre-approval entry does not affect the existing account. To change the account's access, use [Managing Users](managing-users.md) instead.
{% endhint %}

## Frequently asked questions

**What if an officer registers with a different email than the one I pre-approved?** The pre-approval is tied to the specific email address. If they register with a different email, their account will be placed in the Pending queue for manual review.

**Can I pre-approve multiple emails at once?** Currently, pre-approvals must be added one at a time.

**Can I change the role in a pre-approval after adding it?** Remove the entry and add a new one with the correct role, as long as the email has not yet been used to register.

**Does a pre-approval expire?** Pre-approvals do not expire. They remain on the list until the email is used to register or an Admin removes them.
