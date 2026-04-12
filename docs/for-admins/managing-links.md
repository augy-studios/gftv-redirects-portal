# Managing Links (Admin)

{% hint style="info" %}
This section covers admin-level link management. For day-to-day link management as an Editor, see the [Managing Links](../managing-links/creating-a-link.md) section.
{% endhint %}

Admins can edit, transfer, and delete **any link** on the platform, regardless of who created it. This is useful for maintaining platform health and handling situations where a link owner is unavailable.

## Accessing links as an Admin

Admins can manage links in two ways:

1. **Admin Panel** — Go to **Admin** > **Links** to see a full list of all links on the platform with edit and delete controls.
2. **Directory** — When browsing the [Directory](../directory/browsing-the-directory.md) as a logged-in Admin, each link card includes an **Edit** button for quick access.

## Editing any link

1. Find the link in the Admin panel or the Directory.
2. Click **Edit**.
3. Modify any fields:
   - **Slug** — Change the short link path.
   - **Destination URL** — Update where the link points.
   - **Active status** — Toggle the link on or off.
   - **Tags** — Add or remove tags.
4. Click **Save**.

Changes take effect immediately.

{% hint style="warning" %}
Changing a link's slug breaks any previously distributed URLs or QR codes that used the old slug. Communicate changes to the link owner before making them where possible.
{% endhint %}

## Transferring link ownership

Admins can reassign a link to any Editor without requiring an ownership request:

1. Open the edit panel for the link.
2. Update the **Owner** field with the new owner's username.
3. Click **Save**.

The link immediately moves to the new owner's Dashboard. The previous owner loses access to it.

## Deleting any link

1. Find the link in the Admin panel.
2. Click **Delete**.
3. Confirm the deletion.

Deleted links are removed permanently. The slug is freed up immediately.

{% hint style="danger" %}
Deletion cannot be undone. If a link is still in active use, consider [deactivating it](../managing-links/link-status.md) instead, or transfer ownership to an active Editor.
{% endhint %}

## Handling inactive or abandoned links

Over time, some links may be owned by accounts that are no longer active. Admins should periodically review the platform for:

- Links pointing to dead or changed destinations.
- Links owned by deleted or deactivated accounts.
- Duplicate links serving the same destination.

For any of these, the Admin can edit the destination, transfer ownership to an active Editor, or delete the link as appropriate.

## Frequently asked questions

**Will the link's owner be notified if I edit or transfer their link?**
There is no automatic notification system. If you make significant changes to a link, communicate this to the original owner through other channels.

**Can Admins see the full view history of a link?**
Admins can see the view count for any link. Detailed per-visit logs may also be accessible for auditing purposes.

**Can an Editor's link be protected from admin edits?**
No. All links are subject to admin oversight. This is by design — platform integrity takes precedence.
