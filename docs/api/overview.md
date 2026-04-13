# API Overview

The gftv.asia API lets you programmatically **get**, **create**, and **update** short links on your account. It is available to all **Editor** and **Admin** users.

## Base URL

All API endpoints are served from:

```
https://gftv.asia/api/v1
```

## Authentication

Every request must include your API key in the `Authorization` header using the `ApiKey` scheme:

```
Authorization: ApiKey <your_api_key>
```

You can generate or regenerate your API key from the **API Integration** page inside the portal. Copy it immediately — the full key is only shown once.

{% hint style="warning" %}
**Keep your API key secret.** Anyone who has your key can create and modify links on your behalf. If you believe your key has been compromised, regenerate it immediately from the API Integration page — the old key stops working instantly.
{% endhint %}

## Request format

All request bodies must be JSON. Include the `Content-Type: application/json` header when sending a body.

## Response format

All responses are JSON objects. A successful response includes `"success": true` along with the returned data. An error response includes `"success": false` and an `"error"` field describing what went wrong.

**Success example:**

```json
{
  "success": true,
  "links": [ … ]
}
```

**Error example:**

```json
{
  "success": false,
  "error": "slug is already taken"
}
```

## Status codes

| Code | Meaning |
|------|---------|
| `200` | OK — request succeeded |
| `201` | Created — a new resource was successfully created |
| `400` | Bad Request — missing or invalid parameters |
| `401` | Unauthorized — API key is missing or invalid |
| `403` | Forbidden — your account does not have permission |
| `404` | Not Found — the requested resource does not exist |
| `405` | Method Not Allowed — HTTP method is not supported on this endpoint |
| `409` | Conflict — a resource with the same identifier already exists (e.g. duplicate slug) |
| `500` | Internal Server Error — something went wrong on our end |
