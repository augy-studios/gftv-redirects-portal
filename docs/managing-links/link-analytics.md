# Link Analytics

gftv.asia tracks detailed analytics for every short link, giving you a clear view of how your links are performing over time.

## Viewing link analytics

Each link in your **My Links** dashboard has an analytics button (bar chart icon). Clicking it opens the analytics modal for that link, with four tabs:

- **Overview** — total visit count, device type breakdown, and a 7-day click trend chart.
- **Heatmap** — a traffic heatmap showing clicks by day of the week and hour of the day (UTC), useful for identifying when your audience is most active.
- **History** — a chronological log of events for the link: creation, status changes (active/inactive), and ownership transfers.
- **Export** — download the complete all-time daily click history for the link as a CSV file.

The total visit count is also visible on link cards in the public [Directory](../directory/browsing-the-directory.md).

## What is tracked

| Data | Tracked? |
|---|---|
| Total visit count per link | Yes |
| Per-visit timestamp | Yes |
| Device type (Desktop, Tablet, Mobile) | Yes |
| Visitor identity | No |
| Visitor IP address | No |
| Browser name or version | No |

gftv.asia records that a visit happened and the general device category, but does **not** collect any personally identifiable information about visitors. Analytics are aggregate only.

{% hint style="info" %}
Every redirect through a `gftv.asia` short link increments the view count by 1, including the link owner visiting their own link.
{% endhint %}

## Using analytics to manage your links

Analytics can help you:

- **Identify popular links** — high-traffic links may warrant more careful management (e.g. avoid changing their slug).
- **Spot unused links** — links with very low or zero views over time may be candidates for cleanup.
- **Measure campaign reach** — if you create a dedicated short link for a specific event or announcement, the view count and daily trend give you a measure of reach.
- **Understand your audience** — the device breakdown and heatmap show what devices people use and when they are most active.

## Profile and directory statistics

The platform also surfaces higher-level statistics:

- Each **user profile** shows the total number of links created and the combined total views across all that person's links.
- The **home page** shows platform-wide statistics: total number of officers, total links created, and total clicks across all links.

## Frequently asked questions

**Can I see a breakdown of visits over time?**
Yes. The analytics modal shows a 7-day daily click trend chart. You can also export the complete all-time daily click history as a CSV from the Export tab.

**Are views counted for inactive links?**
No. Inactive links redirect visitors to the GFTV blog rather than the original destination. Only visits to active links increment the counter.

**Can other users see my link's view count?**
Yes. View counts are visible on link cards in the Directory to all logged-in users. The detailed analytics modal is only accessible to the link owner from their My Links dashboard.
