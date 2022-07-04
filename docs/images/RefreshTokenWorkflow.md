# Refresh Token Workflow

The Protocol Diagram was created using [Web Sequence Diagrams](https://www.websequencediagrams.com/)
and can be edited by pasting in the following.  The resulting diagram is
downloaded and save as "RefreshTokenWorkflow.png".

```text
title Refresh Token Workflow

UIO->Edge Proxy: 1i) make local authorized requests (e.g. /get_prefs) passing the login token
Edge Proxy->Personal Data Server: 2ii) redirect to Personal Data Server
note left of Personal Data Server: 3i) verify the login token
Personal Data Server->Google (SSO): 3ii) refresh access token using /token request
note left of Google (SSO): 5iii) only if the access token and the login token have expired
Google (SSO)->Personal Data Server: 3iv) return new access token response
note left of Personal Data Server: 3v) compute new login token if old one expired
Personal Data Server->Edge Proxy: 4iv) redirect with the new login token
Edge Proxy->UIO: 4v) redirect with the new login token as a cookie
```
