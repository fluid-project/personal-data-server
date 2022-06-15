# Single Sign On Workflow Diagram

## Editing the Protocol Diagram

The Protocol Diagram was created using [Web Sequence Diagrams](https://www.websequencediagrams.com/)
and can be edited by pasting in the following.  The resulting diagram is
downloaded and saved as "SSOLoginWorkflow.png".

```text
title Workflow to Connect External UIO Websites with Personal Data Server
actor Resource Owner
participant UIO
participant Edge Proxy
participant Personal Data Server
participant Google SSO

Resource Owner->UIO: 1a) Login
UIO->Personal Data Server: 1b) redirect to Personal Data Server login endpoint
Personal Data Server->Google (SSO): 2a) send request to Google login
Google (SSO)->Resource Owner: 2b) request user login and consent
Resource Owner->Google (SSO): 2c) login and grant consent
Google (SSO)->Personal Data Server: 2d) state (anti-forgery token) and authorization code
note left of Personal Data Server: 2e) confirm state (anti-forgery token)
Personal Data Server->Google (SSO): 2f) exchange authorization code
Google (SSO)->Personal Data Server: 2g) access token
note left of Personal Data Server: 3a) generate a login token when authorized
Personal Data Server->Edge Proxy: 3b) redirect to the redirect API with the login token
Edge Proxy->UIO: 3c) redirect with the login token as a cookie
```
