# PUT /api/v1/links/:slug

Updates an existing short link. You must own the link (or be an Admin) to update it.

## Request

```
PUT https://gftv.asia/api/v1/links/<slug>
Authorization: ApiKey <your_api_key>
Content-Type: application/json
```

### Path parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `slug` | string | The slug of the short link to update |

### Request body

All fields are optional — include only the fields you want to change.

```json
{
  "destination": "https://example.com/new/destination",
  "is_active": false,
  "tags": ["updated-tag"]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `destination` | string | New destination URL. Must be valid and must not point to `gftv.asia`. |
| `is_active` | boolean | Set to `false` to disable the link (visitors will not be redirected), or `true` to re-enable it. |
| `tags` | array of strings | Replaces the existing tag list. Up to 5 tags. Pass `[]` to clear all tags. |

{% hint style="info" %}
You cannot change a link's `slug` via the API. To use a different slug, create a new link.
{% endhint %}

## Response

### 200 OK

```json
{
  "success": true,
  "link": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "slug": "my-link",
    "destination": "https://example.com/new/destination",
    "is_active": false,
    "access_count": 42,
    "tags": ["updated-tag"],
    "created_at": "2026-01-15T09:00:00.000Z",
    "updated_at": "2026-04-13T11:00:00.000Z"
  }
}
```

### Error responses

| Code | Error | Cause |
|------|-------|-------|
| `400` | `destination must be a string` | `destination` field is not a string |
| `400` | `destination must be a valid URL` | The destination is not a well-formed URL |
| `400` | `destination cannot point to gftv.asia` | Circular redirect guard |
| `400` | `is_active must be a boolean` | `is_active` field is not `true` or `false` |
| `400` | `tags must be an array of up to 5 strings` | More than 5 tags, or wrong type |
| `401` | Unauthorized | API key is missing or invalid |
| `403` | Forbidden | Account is not the link owner (or not an Admin) |
| `404` | Not Found | No link exists with the given slug |
| `500` | Server error | Internal error updating the link |

## Examples

### Disable a link

```bash
curl -X PUT "https://gftv.asia/api/v1/links/my-link" \
  -H "Authorization: ApiKey gftv_abc123..." \
  -H "Content-Type: application/json" \
  -d '{ "is_active": false }'
```

### Update destination and tags

```bash
curl -X PUT "https://gftv.asia/api/v1/links/convention-2026" \
  -H "Authorization: ApiKey gftv_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "destination": "https://example.com/convention/updated-page",
    "tags": ["events", "2026", "updated"]
  }'
```
