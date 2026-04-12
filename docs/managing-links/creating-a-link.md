# Creating a Short Link

{% hint style="info" %}
You need an **Editor** account to create short links. If you only have Viewer access, contact an Admin to have your role upgraded.
{% endhint %}

## How to create a link

1. Log in to [gftv.asia](https://gftv.asia).
2. Go to your **Dashboard**.
3. Click **Create Link** (or the **+** button).
4. Fill in the fields described below.
5. Click **Create**.

Your new link will appear in your Dashboard and will immediately be live in the public [Directory](../directory/browsing-the-directory.md).

## Fields

### Slug (short link)

The slug is the part of the URL that comes after `gftv.asia/`. For example, a slug of `discord` produces the link `gftv.asia/discord`.

**Slug rules:**

* May contain letters (`a–z`, `A–Z`), numbers (`0–9`), hyphens (`-`), and underscores (`_`).
* Maximum 60 characters.
* Must be unique — no two links can share the same slug.
* Case-sensitive: `gftv.asia/Discord` and `gftv.asia/discord` are treated as different slugs.

If you leave the slug field blank, the platform will automatically generate a random 8-character slug for you.

### Destination URL

The destination URL is where visitors will be sent when they click your short link. Enter the full URL, including `https://`.

{% hint style="warning" %}
Destination URLs cannot point back to `gftv.asia` itself. Self-referential redirects are blocked to prevent loops.
{% endhint %}

### Tags

Tags help you and others organise and discover links. You can add up to **5 tags** per link.

See [Link Tags](link-tags.md) for full details on tag format and usage.

## After creating a link

Once created, your link is:

* **Active** by default, so that visitors are redirected immediately.
* Visible in the **public Directory** for anyone to browse.
* Listed in your **Dashboard** where you can edit, deactivate, or delete it.

To generate a QR code for your new link, see [QR Codes](qr-codes.md).

## Frequently asked questions

**Can I choose any slug I want?** Yes, as long as it follows the format rules and isn't already taken. Check the Directory first to avoid conflicts.

**What if I don't choose a slug?** Leave the slug field blank and the platform will auto-generate a random 8-character slug.

**Can I change the slug after creating the link?** Yes. Edit your link from the Dashboard and update the slug. Keep in mind that the old slug will stop working immediately after the change.

**Is there a limit on how many links I can create?** There is currently no per-user link limit.
