# Get/Save Preferences Diagram

## Editing the Protocol Diagram

The Protocol Diagram was created using [Web Sequence Diagrams](https://www.websequencediagrams.com/)
and can be edited by pasting in the following.  The resulting diagram is
downloaded and saved as "SSOPrefsWorkflow.png".

```text
title Workflow to Get or Save Preferences with Personal Data Server
participant UIO
participant Edge Proxy
participant Personal Data Server

UIO->Edge Proxy: 1a) use the login token to make a get or save preferences request
Edge Proxy->Personal Data Server: 1b) call Personal Data Server API with the login token
note right of Personal Data Server: Verify the login token
Personal Data Server->Edge Proxy: 2a) if authorized, get/save and respond; otherwise, refresh the access token and the login token
Edge Proxy->UIO: 2b) respond to UIO
```
