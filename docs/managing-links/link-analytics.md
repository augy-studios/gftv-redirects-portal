# Link Analytics

gftv.asia tracks how many times each short link has been visited, giving you a simple view of how your links are performing.

## Viewing your link's view count

Each link in your **Dashboard** displays a **view count** — the total number of times the short link has been visited (i.e. a redirect was performed).

The view count is also visible on link cards in the public [Directory](../directory/browsing-the-directory.md), so other officers can see how popular a link is.

## What is tracked

| Data | Tracked? |
|---|---|
| Total visit count per link | Yes |
| Per-visit timestamp | Yes (stored internally) |
| Visitor identity | No |
| Visitor IP address | No |
| Browser or device details | No |

gftv.asia records that a visit happened, but does **not** collect any personally identifiable information about visitors. Analytics are aggregate only.

{% hint style="info" %}
Every redirect through a `gftv.asia` short link increments the view count by 1, including the link owner visiting their own link.
{% endhint %}

## Using analytics to manage your links

View counts can help you:

- **Identify popular links** — high-traffic links may warrant more careful management (e.g. avoid changing their slug).
- **Spot unused links** — links with very low or zero views over time may be candidates for cleanup.
- **Measure campaign reach** — if you create a dedicated short link for a specific event or announcement, the view count gives you a rough measure of reach.

## Profile and directory statistics

The platform also surfaces higher-level statistics:

- Each **user profile** shows the total number of links created and the combined total views across all that person's links.
- The **home page** shows platform-wide statistics: total number of officers, total links created, and total clicks across all links.

## Frequently asked questions

**Can I see a breakdown of visits over time?**
The platform currently shows the total lifetime view count per link. Per-day or per-week breakdowns are not displayed in the UI.

**Are views counted for inactive links?**
No. Inactive links redirect visitors to the GFTV blog rather than the original destination. Only visits to active links increment the counter.

**Can other users see my link's view count?**
Yes. View counts are visible on link cards in the public Directory to all users (logged in or not).
