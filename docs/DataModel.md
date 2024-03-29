# Data Model

This section describes the database structures for supporting SSO between the
Personal Data Server and a single sign-on provider, such as Google.

## sso_provider

`sso_provider` records are primarily for storing the `client_id` and
`client_secret` generated by the SSO provider during registration.  The
`client_id` uniquely identifies the Personal Data Server. Information about the
provider itself is also stored here.

| Name                     | Type    | Required?    | Default | Description |
| ---                      | ---     | ---          | ---     | ---         |
| provider_id            | Integer | __Required__ | None    | Primary key. The ID of this record |
| provider               | String  | __Required__ | None    | User friendly name of the provider |
| name                   | String  | __Required__ | None    | Name of the provider |
| client_id              | String  | __Required__ | None    | Personal Data Server ID for this Provider |
| client_secret          | String  | __Required__ | None    | Secret shared between the Personal Data Server and this Provider |
| created_timestamp      | TimeStamp  | __Required__ | None    | The timestamp when the record was created |
| last_updated_timestamp | TimeStamp  | __Optional__ | None    | The timestamp when the record was last updated |

### SQL:

```postgresql
CREATE TABLE sso_provider (
    provider_id SERIAL NOT NULL PRIMARY KEY,
    provider varchar(30) NOT NULL,
    name varchar(40) NOT NULL,
    client_id varchar(191) NOT NULL,
    client_secret varchar(191) NOT NULL,
    created_timestamp TIMESTAMPTZ NULL,
    last_updated_timestamp TIMESTAMPTZ NULL
);
```

## user_account

Records that contains information about personal data server users.  Note that `user` is a reserved keyword in
PostgresSQL so the table name uses `user_account` instead of `user`. For now, this table saves two types of information:

1. The linkage between `user_account` and `sso_user_account` via `user_account_id` field;
2. The user preferences.

| Name                     | Type    | Required?    | Default | Description |
| ---                      | ---     | ---          | ---     | ---         |
| user_account_id                  | String  | __Required__ | None    | Primary key. The ID of this record |
| preferences              | JSONB   | __Optional__ | None    | The user preferences |
| created_timestamp      | TimeStamp  | __Required__ | None    | The timestamp when the record was created |
| last_updated_timestamp | TimeStamp  | __Optional__ | None    | The timestamp when the record was last updated |

SQL:

```postgresql
CREATE TABLE user_account (
    user_account_id SERIAL PRIMARY KEY NOT NULL,
    preferences JSONB NULL,
    created_timestamp TIMESTAMPTZ NOT NULL,
    last_updated_timestamp TIMESTAMPTZ NULL
);
```

## sso_user_account

These records store the information about the user as returned by the SSO
provider.  As such, they cross reference `user` and `sso_provider` records.

| Name                     | Type    | Required?    | Default | Description |
| ---                      | ---     | ---          | ---     | ---         |
| sso_user_account_id      | Integer | __Required__ | None    | Primary key. The ID of this record |
| user_id_from_provider    | String  | __Required__ | None    | The user id provided by the provider via the user information |
| provider_id              | Integer | __Required__ | None    | Reference to the sso_provider record |
| user_account_id                  | Integer | __Required__ | None    | Reference to the user_account record associated with the SSO user account |
| user_info                | JSONB   | __Required__ | None    | Information returned by the SSO provider about the associated user |
| created_timestamp      | TimeStamp | __Required__ | None    | The timestamp when the record was created |
| last_updated_timestamp | TimeStamp | __Optional__ | None    | The timestamp when the record was last updated |

### SQL:

```postgresql
CREATE TABLE sso_user_account (
    sso_user_account_id SERIAL PRIMARY KEY NOT NULL,
    user_id_from_provider varchar(64) NOT NULL,
    provider_id INTEGER NOT NULL REFERENCES sso_provider (provider_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    user_account_id INTEGER NOT NULL REFERENCES user_account (user_account_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    user_info JSONB NOT NULL,
    created_timestamp TIMESTAMPTZ NOT NULL,
    last_updated_timestamp TIMESTAMPTZ NULL
);
```

## access_token

The access token returned by the SSO Provider that is used for access to the
user's information stored by the Provider. The record cross references the
user's `sso_user_account` and `sso_provider`.

| Name                     | Type       | Required?    | Default           | Description |
| ---                      | ---        | ---          | ---               | ---         |
| sso_user_account_id      | Integer    | __Required__ | None              | Reference to the corresponding sso_user_account record |
| access_token             | String     | __Required__ | None              | The access token returned by the SSO Provider for this SSO user |
| expires_at               | TimeStamp  | __Required__ | One hour from now | The timestamp at which this `access_token` expires.  This Provider supplies the duration in seconds |
| refresh_token            | String     | __Optional__ | Null              | The refresh token returned by the SSO Provider for refreshing this `access_token` |
| created_timestamp      | TimeStamp  | __Required__ | None              | The timestamp when the record was created |
| last_updated_timestamp | TimeStamp  | __Optional__ | None              | The timestamp when the record was last updated |

### SQL:

```postgresql
CREATE TABLE access_token (
    sso_user_account_id INTEGER PRIMARY KEY NOT NULL REFERENCES sso_user_account (sso_user_account_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    access_token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NULL,
    refresh_token TEXT DEFAULT NULL,
    created_timestamp TIMESTAMPTZ NOT NULL,
    last_updated_timestamp TIMESTAMPTZ NULL
);
```

## referer_tracker

Keeps track of the mapping between the referer origin and an anti-forgery state. When an external website calls
Personal Data Server SSO API, this call is redirected to the authorization endpoint provided by the SSO provider.
When making an authorization request, a anti-forgery state token is generated by Personal Data Server and sent to the
SSO provider. At this point, the mapping between the referer origin and the state token is saved in this table. When
the SSO provider calls back to Personal Data Server with the access token, the same state token is sent back in the
request. Personal Data Server is able to find the corresponding referer origin and referer URL that the original
authentication request was from. The user will be redirected back to the referer URL when the authentication completes.
For the detail of the anti-forgery state, see the explanation of the anti-forgery state parameter in the Google
documentation of [using OAuth 2.0 for Web Server Applications](https://developers.google.com/identity/protocols/oauth2/web-server#httprest_1) and [Personal Data Server workflow](./Workflow.md).

| Name                | Type       | Required?    | Default           | Description |
| ---                 | ---        | ---          | ---               | ---         |
| state           | String    | __Required__ | None               | Primary key. This state token is generated by Personal Data Server and sent to the SSO provider at making authorization requests |
| referer_origin      | String     | __Optional__ | NULL              | The referer domain of an external website calling Personal Data Server API. |
| referer_url         | String     | __Optional__ | NULL              | The referer URL of an external website calling Personal Data Server API. Once the authentication completes, the user is redirected back to this URL |
| `created_timestamp` | TimeStamp  | __Required__ | None              | The timestamp when the record is created |

### SQL:

```postgresql
CREATE TABLE referer_tracker (
    state VARCHAR(64) NOT NULL PRIMARY KEY,
    referer_origin TEXT DEFAULT NULL,
    referer_url TEXT DEFAULT NULL,
    created_timestamp TIMESTAMPTZ NOT NULL
);
```

## login_token

Store login tokens generated by the Personal Data Server once users are authenticated. These tokens are passed back to
the redirect API provided by the external website for resource owners to access their preferences from the Personal
Data Server. The record cross references the user's `sso_user_account`.

| Name                     | Type       | Required?    | Default           | Description |
| ---                      | ---        | ---          | ---               | ---         |
| sso_user_account_id      | Integer    | __Required__ | None              | Primary key. Reference to the corresponding sso_user_account record |
| referer_origin           | String     | __Required__ | None              | Primary key. The referer domain of an external website calling Personal Data Server API|
| login_token              | String     | __Optional__ | Null              | The login token returned to the external website for its future access to Personal Data Server API |
| expires_at               | TimeStamp  | __Required__ | One day from now  | The timestamp at which this `login_token` expires |
| `created_timestamp`      | TimeStamp  | __Required__ | None              | The timestamp when the record is created |
| `last_updated_timestamp` | TimeStamp  | __Optional__ | None              | The timestamp when the record is last updated |

### SQL:

```postgresql
CREATE TABLE login_token (
    sso_user_account_id INTEGER NOT NULL REFERENCES sso_user_account (sso_user_account_id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    referer_origin TEXT NOT NULL,
    login_token VARCHAR(128) NOT NULL,
    expires_at TIMESTAMPTZ NULL,
    created_timestamp TIMESTAMPTZ NOT NULL,
    last_updated_timestamp TIMESTAMPTZ NULL,
    PRIMARY KEY (sso_user_account_id, referer_origin)
);
```

# To Do

* Diagram to show the relationships among the objects in the data model
