# GET /api/v1/links/:slug

Retrieves a single short link by its slug. Any authenticated Editor or Admin can look up any link by slug, regardless of ownership.

## Request

```
GET https://gftv.asia/api/v1/links/<slug>
Authorization: ApiKey <your_api_key>
```

### Path parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | string | The slug of the short link to retrieve |

## Response

### 200 OK

```json
{
  "success": true,
  "link": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "slug": "my-link",
    "destination": "https://example.com/some/long/path",
    "is_active": true,
    "access_count": 42,
    "tags": ["events", "2026"],
    "created_at": "2026-01-15T09:00:00.000Z",
    "updated_at": "2026-02-20T14:30:00.000Z"
  }
}
```

### Error responses

| Code | Error | Cause |
|------|-------|-------|
| `401` | Unauthorized | API key is missing or invalid |
| `403` | Forbidden | Account is not an Editor or Admin |
| `404` | Not Found | No link exists with the given slug |

## Example

```bash
curl -X GET "https://gftv.asia/api/v1/links/my-link" \
  -H "Authorization: ApiKey gftv_abc123..."
```
