# Personal Data Server API

This documents APIs supported by Personal Data Server.

## Check the readiness of Personal Data Server (GET /ready)

* **description**: Check whether Personal Data Server is ready to handle requests. It checks:
  * The communication with the backend database is ready
  * Personal Data Server is ready to handle requests
* **route:** `/ready`
* **method:** `GET`
* **return:** When the server is ready, return http status code 200 with a JSON document:

```json
{
    "isReady": true
}
```

When the server is not ready, return http status code 503 with a JSON document:

```json
{
    "isError": true,
    "message": "Database is not ready"
}
```


## Check the liveness of Personal Data Server (GET /health)

* **description**: Check whether Personal Data Server itself is running. This API doesn't check if the communication
with the backend database is ready.
* **route:** `/health`
* **method:** `GET`
* **return:** Return http status code 200 with a JSON document:

```json
{
    "isHealthy": true
}
```

## Get preferences (GET /get_prefs)

* **description**: Retrieve user preferences based on a login token. If the login token is valid, Personal Data Server
returns the preferences of the user who is associated with the login token.
* **route:** `/get_prefs`
* **method:** `GET`
* **header:** Authorization: Bearer < login_token >
  * `login_token` The login token can be first requested via /sso/google endpoint. It represents the authorization
    that grants a user on a specific website to access preferences. Refer to [Workflow](./Workflow.md) about the
    detail.
* **return:** When succeeded, return http status code 200 with preferences in a JSON document:

```json
{
    "textSize": 1,
    "tableOfContents": true
}
```

When a login token is not found, return http status code 403 with error:

```json
{
    "isError": true,
    "message": "Please login first."
}
```

When a login token is invalid or expired, return http status code 403 with error:

```json
{
    "isError": true,
    "message": "Invalid login token. Please login."
}
```

## Save preferences (POST /save_prefs)

* **description**: Save user preferences based on a login token. If the login token is valid, the preferences
is save for the user who is associated with the login token.
* **route:** `/save_prefs`
* **method:** `POST`
* **header:** Authorization: Bearer < login_token >
  * `login_token` The login token can be first requested via /sso/google endpoint. It represents the authorization
    that grants a user on a specific website to access preferences. Refer to [Workflow](./Workflow.md) about the
    detail.
* **return:** When succeeded, return http status code 200 with a message "Saved successfully".

When a login token is not found, return http status code 403 with error:

```json
{
    "isError": true,
    "message": "Please login first."
}
```

When a login token is invalid or expired, return http status code 403 with error:

```json
{
    "isError": true,
    "message": "Invalid login token. Please login."
}
```

When the size of the incoming preferences is greater than 1K bytes, return http status code 403 with error:

```json
{
    "isError": true,
    "message": "Cannot save the incoming preferences."
}
```
