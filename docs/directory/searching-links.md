# Searching Links

The [Directory](browsing-the-directory.md) includes four independent controls at the top of the page for searching, filtering, and sorting links. All filtering and sorting happen client-side after the links are loaded, so the controls respond instantly.

## Keyword search

Type any text into the **Search by keyword** field to search across all of the following fields simultaneously:

* **Slug** — the short link path (e.g. `discord`)
* **Destination URL** — where the link redirects to
* **Display name** — the creator's display name
* **Username** — the creator's username

**Example:** Typing `telegram` returns links whose slug, destination, or creator contains the word "telegram".

{% hint style="info" %}
Keyword search is case-insensitive. Searching `Discord` and `discord` return the same results.
{% endhint %}

## Tag filter

Type a tag name into the **Filter by tag** field to narrow results to links that have been labelled with that tag.

**Example:** Typing `events-2025` shows only links tagged `events-2025`.

{% hint style="info" %}
Tag filtering is partial-match. Typing `event` will return links tagged `events-2025` or `event-stream`, so you do not need to type the full tag name.
{% endhint %}

## Status filter

Use the **All Status / Active / Inactive** dropdown to control which links are shown:

| Option       | What is shown                           |
| ------------ | --------------------------------------- |
| **All**      | Every link regardless of status         |
| **Active**   | Only links that are currently live      |
| **Inactive** | Only links that have been deactivated   |

## Sort order

Use the **Date Created / Most Visits** dropdown to change the order of results:

| Option          | Sort order                                      |
| --------------- | ----------------------------------------------- |
| **Date Created** | Newest links appear first (default)            |
| **Most Visits**  | Links with the highest visit count appear first |

## Combining controls

All four controls work together. For example, you can search for keyword `discord`, filter by tag `social`, show only Active links, and sort by Most Visits — the Directory will instantly show only links that satisfy all of those criteria at once.

## Clearing a search

Clear any input field or reset any dropdown to its default value to remove that filter. Setting all controls back to their defaults returns the full Directory listing.

## Frequently asked questions

**Does search return inactive links?** By default (when the status filter is set to **All**), both active and inactive links are shown. Inactive links are labelled with a red badge. Set the status filter to **Active** to hide them.

**Is search case-sensitive?** No. All searches are case-insensitive.

**Can I search by username specifically?** Keyword search matches usernames, so type the username into the keyword field. Alternatively, visit a user's [profile page](user-profiles.md) directly to see all their links automatically.
