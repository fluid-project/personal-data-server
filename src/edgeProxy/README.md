# Edge Proxy Example

Edge Proxy example provides an Edge Proxy website and sample code to demonstrate how an external website interacts with
Personal Data Server to retrieve or save data. Follow steps below to set up the demo:

**Install Edge Proxy** run these commands to install the Edge Proxy website. Skip this step if the Edge Proxy is
already installed:

```bash
npm ci
```

**Start Edge Proxy** run these commands to start the Edge Proxy website:

```bash
npm ci
npm start
```

* Open `http://127.0.1.1:4000/` in a browser to access the Edge Proxy page.

**Start Personal Data Server** run these commands to start Personal Data Server:

```bash
cd ../..
npm start
```

* Open `http://localhost:3000/` in a browser to access Personal Data Server.

Note: Edge Proxy runs on "127.0.0.1" and Personal Data Server runs on "localhost", or vice versa. They should not
both running on the same domain as "127.0.0.1" or "localhost". This is to workaround the issue that the cookie value
can be cross posted when they are on the same domain regardless they are running on different ports.

**Demonstrate** follow instructions on the Edge Proxy page to demonstrate
