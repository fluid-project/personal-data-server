# Edge Proxy Example

Edge Proxy example provides an Edge Proxy website and sample code to demonstrate how an external website interacts with
Personal Data Server to retrieve or save data. Follow steps below to set up the demo:

## Getting Started

**Install Edge Proxy:** run these commands to install the Edge Proxy website. Skip this step if the Edge Proxy is
already installed:

```bash
npm ci
```

**Start Edge Proxy:** run these commands to start the Edge Proxy website:

```bash
npm ci
npm start
```

* Open `http://127.0.0.1:4000/` in a browser to access the Edge Proxy page.

**Start Personal Data Server:** run these commands to start Personal Data Server:

```bash
cd ../..
npm start
```

* Open `http://localhost:3000/` in a browser to access Personal Data Server.

Note: Edge Proxy should be run on "127.0.0.1" and Personal Data Server should be run on "localhost", or vice versa.
They should not both running on the same domain as "127.0.0.1" or "localhost". This will allow for a valid
demonstration of transmitting the session cookie value between the different domains that the Personal Data Server
and the Edge Proxy would ordinarily be hosted from.

**Demonstrate:** follow instructions on the Edge Proxy page to demonstrate

## Configuration

The port that the Edge Proxy listens on can be overridden by an environment variable named `PDS_EDGEPROXY_PORT`.

| Name        | Default Value | Description | Envionment Variable for Overriding |
| ----------- | ----------- | ----------- | ----------- |
| port | 4000 | The port that the Edge Proxy will listen on | PDS_EDGEPROXY_PORT |
