# GET /api/v1/links

Returns a paginated list of short links owned by the authenticated user.

## Request

```
GET https://gftv.asia/api/v1/links
Authorization: ApiKey <your_api_key>
```

### Query parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `slug` | string | — | Filter links whose slug contains this value (case-insensitive) |
| `tag` | string | — | Filter links that have this exact tag |
| `limit` | integer | `50` | Maximum number of links to return (max `100`) |
| `offset` | integer | `0` | Number of links to skip (for pagination) |

## Response

### 200 OK

```json
{
  "success": true,
  "links": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "slug": "my-link",
      "destination": "https://example.com/some/long/path",
      "is_active": true,
      "access_count": 42,
      "tags": ["events", "2026"],
      "created_at": "2026-01-15T09:00:00.000Z",
      "updated_at": "2026-02-20T14:30:00.000Z"
    }
  ],
  "count": 1
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier for the link |
| `slug` | string | The short link path (e.g. `my-link` → `gftv.asia/my-link`) |
| `destination` | string | The full URL the short link redirects to |
| `is_active` | boolean | Whether the link is currently active and redirecting |
| `access_count` | integer | Total number of times the link has been visited |
| `tags` | array of strings | Up to 5 tags associated with the link |
| `created_at` | ISO 8601 string | When the link was created |
| `updated_at` | ISO 8601 string | When the link was last updated |

### Error responses

| Code | Error | Cause |
|------|-------|-------|
| `401` | Unauthorized | API key is missing or invalid |
| `403` | Forbidden | Account is not an Editor or Admin |
| `500` | Server error | Internal error fetching links |

## Example

```bash
curl -X GET "https://gftv.asia/api/v1/links?tag=events&limit=10" \
  -H "Authorization: ApiKey gftv_abc123..."
```
