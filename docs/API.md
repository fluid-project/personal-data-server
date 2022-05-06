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

## Google Sign In (GET /sso/google)

* **description**: Use a Google account to sign into Personal Data Server. This API uses
[Google OAuth2 authorization process](https://developers.google.com/identity/protocols/oauth2/web-server).
* **route:** `/sso/google`
* **method:** `GET`
* **return:** Take the user through the Google sign in process where users sign in with their own Google accounts.
If the sign-in request is issued from an external website, when the sign in completes, the response redirects the
user back to the external website with a login token in the cookie. This login token can then be used to access this
user's preferences.

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
* **body:** The preferences object.

```json
{
    "textSize": 1.2,
    "lineSpace": 1.3
}
```

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

When the size of the incoming preferences is greater than 10K bytes, return http status code 413 with a html page
indicating the request entity is too large.
