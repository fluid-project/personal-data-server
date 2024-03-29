# Personal Data Server Workflow

A workflow supported by the Personal Data Server, where the user makes save/retrieve
requests for their preferences while on a static site. An example is where a user
changes their UI Options (UIO) preferences and wants to save them.

Included in this workflow is an OAuth2 authorization sequence where
users are authenticated by a third party single sign on (SSO) provider, such as
Google or GitHub.

This document describes the requests, responses, payloads, and database structures
needed to support static access and single sign on workflows.

The examples all assume that the OAuth2 authorization server
is Google.  Google provides an [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
where each step of the SSO workflow can be executed in isolation, and where information
about the requests and responses are displayed.  This was used to determine the details
of the SSO process.

## Login Workflow

![Workflow to Connect External UIO Websites with Preferences Server](./images/SSOLoginWorkflow.png)

Read [this document](./images/SSOLoginWorkflow.md) regarding how to edit this diagram.

### Actors/Resources

* **Resource Owner**: The user attempting to authorize UIO to use their
  preferences
* **UIO**: An embedded instance of User Interface Options (UI Options)
  preferences editor/enactors. UIO resides on the browser side of the external website.
* **Edge Proxy**: Lambda functions, server configuration, or light weight server
  to handle redirects between UIO and the Personal Data Server. To allow cross origin
  requests. Edge proxy is the server side of the external website.
* **SSO Client**: A client of an SSO provider, where the client uses the
  provider as a way of authenticating users.  The Personal Data Server is a client
  in this context.
* **SSO Provider**: An OAuth2 server that is used to authenticate users. Google is
  an SSO provider.
* **Personal Data Server**: An instance of the Personal Data Storage service. Stores
  preferences and authenticates with a single sign on (SSO) provider, e.g. Google.
* **Google SSO**: Using Google as SSO provider. The examples are based on their
  API but others could be substituted.

### Workflow Description

1. Start login

    **1a.** Resource Owner interacts with UIO's user interface to log into the
    Personal Data Server using their Google credentials

    **1b.** UIO redirects to the Preferences Server login API. e.g. `/sso/google`. See [the API document](API.md) for details. This triggers the SSO workflow which is described in the [Single Sign On Details](#single-sign-on-details)
    section.
2. The Personal Data Server sends an [authentication request](https://developers.google.com/identity/protocols/oauth2/openid-connect#sendauthrequest)
   to Google. Meanwhile, the Personal Data Server keeps track of the referer URL
   that the login request is from. This referer URL is the external website URL
   on which UIO is implemented.

   **2a.** the authentication request includes the following as query parameters:
      * `client_id` identifying the Personal Data Server to Google
      * `response_type` which is usually `code`
      * `scope` which would likely be `openid email`
      * `redirect_uri` which is the endpoint on the Personal Data Server that
           will receive the response from Google. It must match the authorized
           redirect URI that was pre-registered with Google.
      * `state`, the anti-forgery unique state token

   **2b.** Login and consent:  The Resource Owner may be presented with a login
      screen by Google in their domain, and asked to consent the requested
      scope.
      * If the user is already logged into Google, they will be presented
        with the consent dialog.

   **2c.** The Resource Owner authenticates with Google and grants consent.
      * If the user has previously provided consent, Google will present no
        dialog, but will retrieve the scope(s) of information for which the user
        has consented.

   **2d.** [Authorization code and anti-forgery](https://developers.google.com/identity/protocols/oauth2/openid-connect#confirmxsrftoken):
      Google responds to the Personal Data Server at the `redirect_uri` including:
      * `state` anti-forgery token from step 2i
      * `code` the authentication code provided by Google
      * `scope` the scopes for which the user consented at step 2iii.

   **2e.** The Personal Data Server confirms that the `state` (anti-forgery token) is
      valid by checking that it matches the value it sent to Google in step 2i.

   **2f.** [Exchange Authorization Code](https://developers.google.com/identity/protocols/oauth2/openid-connect#exchangecode):
      The Personal Data Server requests exchanging the Authorization Code for an
      Access Token and ID Token. This includes the following:
      * `code`, the Authorization Code sent from the previous response from
         Google
      * `client_id` for the Personal Data Server (same value as steps 2i)
      * `redirect_uri` which is the endpoint on the Personal Data Server that
         will receive the response from Google (same value as step 2i)
      * `grant_type` which must be set to `authorization_code`

   **2g.** Google responds at the previously specified redirect uri with the Access
      Token.
      * The `access_token` can be used by the Personal Data Server to access the Google API
3. Authenticate and Authorize UIO

   **3a.** The Personal Data Server generates a time-limite `login_token` that is
   associated with the authenticated Resource Owner. This login token is persisted
   in the Personal Data Server's database. The login token is associated with the Resource Owner's `sso_user_account`
   and the referer URL of the login request.  This `loginToken` has a
   expiration that is defined by the Personal Data Server. When the `loginToken`
   generated at the current step has not expired but the SSO `access_token` already
   expires, the SSO `access_token` will be refreshed and the `loginToken` is simultaneously refreshed.

   **3b.** The Personal Data Server redirects to the redirect API provided by the Edge Proxy, e.g. `{edgeProxyDomain}/api/redirect?loginToken={loginToken}&maxAge={maxAge}&refererURL={refererURL}`,
      passing back these query parameters:

      | Name          | Type     | Description |
      | ---           | ---      | ---         |
      | `loginToken` | `String`   | The login token for future preferences requests |
      | `maxAge` | `Number`   | The max age of the login token in second |
      | `refererURL` | `String`   | the referer URL of the login request. This URL will be used by the Edge Proxy to redirect back to UIO |

  **3c.** The Edge Proxy redirects to UIO webpage, passing back the
  login token as a cookie value of `PDS_loginToken`. The `Expires/Max-Age` value is set to the `maxAge`

### Single Sign On Details

This section gives more details regarding step 2 above, the part of the static
workflow that is specific to user authentication using an SSO provider.

#### Client Registration with SSO Provider

Prior to executing the SSO workflow, the Personal Data Server must register as a
client of an SSO provider, e.g., Google.  Registration is a manual process using
the [Google developer console](https://console.cloud.google.com/apis/credentials).
The provider will generate a client id and a client secret that identifies the
Personal Data Server to the provider during the SSO workflow.  The client id and
secret need to be stored in the Personal Data Server's database for use when it
communicates with the SSO provider.  In addition, the client defines a redirect uri for
the provider to call to contact the client.  The redirect uri is stored with the
SSO provider.

Furthermore, providers typically require links to the client's main website, the
client's privacy policy, and a name and icon that identifies the client.  These
are included in the provider's login and consent dialogs to inform users
which client is requesting access to the user's information.  The links, name,
and icon are persisted with the SSO provider.

Once these pieces are in place, the SSO workflow proceeds as described below.

**2a**. The workflow begins with the Personal Data Server requesting authorization
from the provider:

```text
GET https://accounts.google.com/o/oauth2/auth
```

##### Parameters

| Name             | Type     | Description |
| ---              | ---      | ---         |
| `client_id`      | `String` | __Required__. The client id of the Personal Data Server, generated by Google during registration, and stored in an [`AppAuthProvider`](#application-auth-provider-data-model) record |
| `redirect_uri`   | `String` | __Recommended__. The endpoint of the Personal Data Server where the provider redirects to upon successful authorization |
| `scope`          | `String` | __Optional__. The scope of the access to the user's information as stored with the provider.  For example, `openid profile email` will ask for the user's Google profile, email address, and open ID |
| `response_type`  | `String` | __Required__. The value `code` will request an access token to use to access the user's Google information |
| `state`          | `String` | __Recommended__. Anti-forgery unique state token |
| `access_type`    | `String`, one of [`offline`, `online`] | __Optional__. Whether to return a refresh token with the access token (`offline`), defaults to `online`.  This parameter is specific to Google's API |

Payload: none

The `access_type` parameter is part to Google's OAuth2 API and declares whether
the user is online for _all_ other requests.  If set to `offline`, some requests
can be made without the user's involvement.  One such case is a request to
refresh an expired access token:  with `access_type=offline`, the refresh
workflow can be executed in the background and not require the user to provide
their credentials on a sign-in page.

**2b, 2c**.  Login and consent:  Google SSO redirects back to the Resource
Owner’s space for their login credentials (e.g., user name and password), and
their consent.  Since this is entirely Google's domain, the specifics are
not documented here.  Assuming the user successfully logs in and provides the
required consent, Google redirects back to the Personal Data Server, as documented
in the next step.

**2d**. Google redirects to the Personal Data Server using the `redirect_uri`, passing an
authorization code:

```text
GET https://<redirect_uri>/
```

#### Parameters

| Name             | Type     | Description |
| ---              | ---      | ---         |
| `code`           | `String` | __Required__. The authorization code generated by Google's authorization service |
| `state`          | `String` | __Required__. Anti-forgery unique state token sent to Google by the Personal Data Server in step 2i. |
| `scope`          | `String` | The scope of access to the user's information as stored with Google that the user consented to. |

Payload: None

Notes:

* Reference: [OAuth2 Specification](https://tools.ietf.org/html/rfc6749#section-4.1.2) of this step.
* Google documentation about the [authorization code and anti-forgery token](https://developers.google.com/identity/protocols/oauth2/openid-connect#confirmxsrftoken)
* Google documentation about the `scope` parameter: [OAuth 2.0 Scopes for Google APIs](https://developers.google.com/identity/protocols/oauth2/scopes)

**2e**. Confirm anti-forgery token:

The Personal Data Server checks the value of the `state` parameter and confirms
that it matches the value it generated and sent to Google at step 2i.  If they
match, the Personal Data Server concludes that this is a legitimate request from
Google.

**2f**. Personal Data Server Exchanges the authorization code for an access token:

```text
POST https://accounts.google.com/o/oauth2/token
```

##### Body of POST

| Name             | Type     | Description |
| ---              | ---      | ---         |
| `grant_type`     | `String` | __Required__. Must be set to `authorization_code` |
| `code`           | `String` | __Required__. The authorization code sent by Google in the previous step, 2iv |
| `redirect_uri`   | `String` | __Required__. The endpoint of the Personal Data Server as was sent to Google in step 2i. |
| `client_id`      | `String` | __Required__. The client id of the Personal Data Server, generated by Google during registration, and stored in an [`AppAuthProvider` record](#application-auth-provider-data-model). This is the same value as in step 2i |
| `client_secret`  | `String` | __Required__. The client secret shared between the Personal Data Server and Google, generated by Google during registration, and stored in an [`AppAuthProvider` record](#application-auth-provider-data-model). |

Notes:

* Reference: [OAuth2 Access Token Request](https://tools.ietf.org/html/rfc6749#section-4.1.3)

**2g.** Google responds with an access token.

```text
HTTP/1.1 200 OK
Content-Type: application/json;charset=UTF-8
{
    "access_token":"2YotnFZFEjr1zCsicMWpAA",
    "token_type":"bearer",
    "expires_in":3600,
    "refresh_token":"tGzv3JOkF0XG5Qx2TlKWIA"
    "scope": "openid"
}
```

##### Payload of response

| Name             | Type     | Description |
| ---              | ---      | ---         |
| `access_token`   | `String` | __Required__. Generated by Google to use to access the user's Google information in the context of the scopes specified in step 2iv |
| `token_type`     | `String` | __Required__. The type of access token, e.g. `bearer` |
| `expires_in`     | `Number` | __Recommended__. The lifespan of the `access_token` in seconds.  After expiring, using it to request the user's Google information will fail |
| `refresh_token`  | `String` | __Optional__. Used to request new access tokens from Google when the current one expires |
| `state`          | `String` | __Required__. The anti-forgery token sent by the Personal Data Server to Google at step 2i |
| `scope`          | `String` | The scope of access to the user's information as stored with Google that the user consented to.  Same value as step 2iv. |

The `access_token` is added to the `Authorization` header of requests sent to
Google by the Personal Data Server to request information about the user.  It has
an expiration given by the `expires_in` parameter.  If the access token has
expired, the requests using it will fail.  However, the `refresh_token` can be
used after the access token has expired to request a new access token from
Google.  Refresh tokens also expire, but their lifespan is, with respect
to Google, six months.  They are also invalid if the user changes their
Google password after they have been generated.  In that case, the entire SSO
workflow must restart.

Notes:

* [OAuth2 Access Token Response](https://tools.ietf.org/html/rfc6749#section-4.1.4)
* [Google's Access Token](https://developers.google.com/identity/protocols/oauth2#2.-obtain-an-access-token-from-the-google-authorization-server.)

## Get/Save Preferences Workflow

![Workflow to Get or Save Preferences with Preferences Server](./images/SSOPrefsWorkflow.png)

Read [this document](./images/SSOPrefsWorkflow.md) regarding how to edit this diagram.

### Workflow Description

1. Initiate a get or save request

    **1a.** UIO makes a request to the Edge Proxy with the login token sent in the request header as a cookie value of
    `PDS_loginToken`. When sending a save request, preferences to be saved is also sent along.

    **1b.** The Edge Proxy calls the corresponding API provided by the Personal Data Server.
    See [the Personal Data Server API documentation](./API.md) for details

2. Login token verification and response

   **2a.** The Personal Data Server validates the login token. If the token is valid, the Personal Data Server
   retrieve or save preferences, then respond to the Edge Proxy. Otherwise, redirects to the Personal Data Server
   login API.

   **2b.** The Edge Proxy responds to UIO.

## Refresh Token Workflow

It was noted in the login workflow step 3a that the Edge Proxy's `loginToken` expired
in concert with the Personal Data Server's `access_token`.  The next section
describes how the Personal Data Server refreshes its `access_token`.  It will
refresh the Edge Proxy's `loginToken` at the same time, but how is that
triggered?

When the Edge Proxy makes any kind of request for user preferences, it passes
the `loginToken` as its credentials.  As part of handling this request,
the Personal Data Server checks if the associated `access_token` has expired.
If it has, the Personal Data Server sends a refresh request to Google to get a new
`access_token`.  It also generates a new `loginToken` at the same time, and it
includes the new value as part of its response to the Edge Proxy.  This workflow
is shown below.

![Refresh Token Workflow](./images/RefreshTokenWorkflow.png)

Read [this document](./images/RefreshTokenWorkflow.md) regarding how to edit this diagram.

Refresh tokens are requested of and returned by the provider in steps 2vi and
2vii.  They are persisted and are available for acquiring a new access tokens when
the current access token expires.

The request for a refresh can happen automatically:  When the Personal Data Server
notices that the current `access_token` in its database has expired, it can issue
the refresh request.  This does not involve the user in any way; in particular,
there are no dialogs presented to the user.  The refresh can be done entirely in
the background.  This is a result o sending `online` vs. `offline` as the access type
in the original sign-on request at step 2i.

In order for the Personal Data Server to make the refresh request, there must be
some trigger to indicate that the current access token has expired, and that a
new one is needed to continue.  When so triggered, the Personal Data Server makes
the refresh request and stores the results.

**5ii.** Refresh `access_token` using `/token` request

```text
POST https://accounts.google.com/o/oauth2/token
Header: Authorization: Bearer <access_token>
```

### Body of POST

| Name             | Type     | Description |
| ---              | ---      | ---         |
| `client_id`      | `String` | __Required__. The client id of the Personal Data Server, generated by Google during registration, and stored in an [`AppAuthProvider` record](#application-auth-provider-data-model). This is the same value as in step 2i |
| `client_secret`  | `String` | __Required__. The client secret shared between the Personal Data Server and Google, generated by Google during registration, and stored in an [`AppAuthProvider` record](#application-auth-provider-data-model). |
| `grant_type`     | `String` | __Required__. Must be set to `refresh_token` |
| `refresh_token`  | `String` | __Required__. The value of the refresh token sent by Google in step, 2vii |
| `redirect_uri`   | `String` | __Required__. The endpoint of the Personal Data Server as was sent to Google in step 2i. |

### Response

The response is similar to the original access token response, but with a new
access token and, optionally, a new refresh token.  The SSO provider decides
when a given refresh token is no longer valid, and, if so, will also return a
new refresh token for subsequent refresh token requests.

**5iv.** Return new access token

```text
HTTP/1.1 200 OK
Content-Type: application/json;charset=UTF-8
{
    "access_token": "JOkF0XG5Ejr1zCQx2TlKWI",
    "token_type": "bearer",
    "expires_in": 3600,
    "scope": "openId",
    "refresh_token": "fFAGRNJru1FTz70BzhT3Zg"
}
```

| Name             | Type     | Description |
| ---              | ---      | ---         |
| `access_token`   | `String` | __Required__. Generated by Google to use to access the user's Google information in the context of the scopes specified in step 2iv |
| `token_type`     | `String` | __Required__. The type of access token, e.g. `bearer` |
| `expires_in`     | `Number` | __Recommended__. The lifespan of the `access_token` in seconds.  After expiring, it will no longer work to access the user's Google information |
| `scope`          | `String` | The scope of access to the user's information as stored with Google that the user consented to.  Same value as step 2iv. |
| `refresh_token`  | `String` | __Optional__. If the `refresh_token` used in the request is no longer valid, a new `refresh_token` is generated and returned by Google in the response |

If Google's response contains a new `refresh_token` it replaces the one that the
Personal Data Server currently has in its database -- the refresh token is itself
refreshed.

Notes:

* [Google Resfresh Token API](https://developers.google.com/identity/protocols/oauth2/native-app#offline)
