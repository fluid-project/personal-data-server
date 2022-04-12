# Single Sign On Workflow Diagram

## Editing the Protocol Diagram

The Protocol Diagram was created using [Web Sequence Diagrams](https://www.websequencediagrams.com/)
and can be edited by pasting in the following.  The resulting diagram is
downloaded and saved as "SSOWorkflow.png".

```text
title Workflow to Connect External UIO Websites with Preferences Server
actor Resource Owner
participant UIO
participant Edge Proxy
participant Preferences Server
participant Google (SSO)

Resource Owner->UIO: 1a) Login
UIO->Preferences Server: 1b) redirect to prefs server login endpoint
Preferences Server->Google (SSO): 1c) redirect to Google login
Google (SSO)->Resource Owner: 2a) request user login and consent
Resource Owner->Google (SSO): 2b) login and grant consent
Google (SSO)->Preferences Server: 3a) state (anti-forgery token) and authorization code
note left of Preferences Server: 3b) confirm state (anti-forgery token)
Preferences Server->Google (SSO): 4a) exchange authorization code
Google (SSO)->Preferences Server: 4b) access token
note left of Preferences Server: 5a) generate a login token when authorized
Preferences Server->UIO: 5b) redirect back to UIO with tye login token
UIO->Edge Proxy: 6a) use the login token to make authorized requets (e.g. get or save prefs)
Edge Proxy->Preferences Server: 6b) redirect to prefs server API with the login token
note right of Preferences Server: Verify authorization
Preferences Server->Edge Proxy: 6d) return response
Edge Proxy->UIO: 6e) return response
```
