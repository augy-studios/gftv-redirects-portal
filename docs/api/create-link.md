# POST /api/v1/links

Creates a new short link under the authenticated user's account.

## Request

```
POST https://gftv.asia/api/v1/links
Authorization: ApiKey <your_api_key>
Content-Type: application/json
```

### Request body

```json
{
  "slug": "my-link",
  "destination": "https://example.com/some/long/path",
  "tags": ["events", "2026"]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `slug` | string | **Yes** | The short link path. Must be 1–60 characters: letters, numbers, hyphens (`-`), or underscores (`_`). Must be unique across the platform. |
| `destination` | string | **Yes** | The full URL to redirect to. Must be a valid URL and must not point to `gftv.asia` (except `guide.gftv.asia` and `form.gftv.asia`). |
| `tags` | array of strings | No | Up to 5 tags. Omit or pass an empty array for no tags. |

## Response

### 201 Created

```json
{
  "success": true,
  "link": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "slug": "my-link",
    "destination": "https://example.com/some/long/path",
    "is_active": true,
    "access_count": 0,
    "tags": ["events", "2026"],
    "created_at": "2026-04-13T10:00:00.000Z",
    "updated_at": "2026-04-13T10:00:00.000Z"
  }
}
```

### Error responses

| Code | Error | Cause |
|------|-------|-------|
| `400` | `slug is required` | The `slug` field is missing or empty |
| `400` | `destination is required` | The `destination` field is missing or empty |
| `400` | `slug must be 1–60 alphanumeric characters, hyphens, or underscores` | Slug contains invalid characters or exceeds 60 characters |
| `400` | `destination must be a valid URL` | The destination is not a well-formed URL |
| `400` | `destination cannot point to gftv.asia` | Circular redirect guard (`guide.gftv.asia` and `form.gftv.asia` are allowed) |
| `400` | `tags must be an array of up to 5 strings` | More than 5 tags provided, or wrong type |
| `401` | Unauthorized | API key is missing or invalid |
| `403` | Forbidden | Account is not an Editor or Admin |
| `409` | `slug is already taken` | Another link already uses this slug |
| `500` | Server error | Internal error creating the link |

## Example

```bash
curl -X POST "https://gftv.asia/api/v1/links" \
  -H "Authorization: ApiKey gftv_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "convention-2026",
    "destination": "https://example.com/convention/registration",
    "tags": ["events", "2026"]
  }'
```
