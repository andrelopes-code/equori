# Remote access

The phone needs HTTPS for two things: installing the application and queueing captures without the server (ADR 022, D7). Each setup below gives equori an HTTPS address that the phone opens.

## Tailscale

This setup serves equori bound to `127.0.0.1:8080`, as the Homebrew service runs it, and compose on `127.0.0.1` and the port of `EQUORI_PORT` in `.env` (8080 by default). Tailscale Serve publishes that port to the owner's tailnet over HTTPS:

```sh
tailscale serve --bg 8080
tailscale serve status
tailscale serve reset
```

With compose on another port, the command names the port of `EQUORI_PORT`.

`tailscale serve status` prints the address `https://<machine>.<tailnet>.ts.net`, which the phone opens. `tailscale serve reset` removes the configuration.

- HTTPS certificates must be enabled for the tailnet; the first `tailscale serve` asks for it.
- Serve stays inside the tailnet. Funnel publishes to the internet and is not used.
- The command syntax changed in client 1.52; `tailscale serve --help` shows the form of the installed client.
- On Windows the service listens on `127.0.0.1:8080` too; the same command, in a terminal after Tailscale for Windows is installed, publishes it.

## Reverse proxy with a domain

This setup suits a VPS or a host with a public name. A reverse proxy holds the public certificate and forwards to equori. With compose, the port is that of `EQUORI_PORT`. Caddy example:

```
equori.example.com {
	reverse_proxy 127.0.0.1:8080
}
```

The proxy keeps the `Host` header, which is Caddy's default. The cross-origin protection of ADR 003 compares `Host` with `Origin`.

## Plain HTTP on a LAN

The application runs over `http://<lan address>:8080`. The session cookie of a login over plain HTTP carries no `Secure` attribute (ADR 003), so it crosses the network unencrypted. While a session of the same host name over HTTPS is open in the browser, the browser refuses the cookie of a login over HTTP; `EQUORI_INSECURE_COOKIES=true`, set before both logins, allows the two. The Homebrew service listens on `127.0.0.1:8080` only: its environment sets `EQUORI_HTTP_ADDR`, and a process value wins over `equori.env` (ADR 022, C2). LAN access from a Homebrew installation therefore runs `EQUORI_HTTP_ADDR=0.0.0.0:8080 equori serve` outside the service. Compose: `.env` sets `EQUORI_HOST_IP=0.0.0.0`, then `docker compose up -d` in the installation directory applies it. A browser refuses the secure-context features over plain HTTP:

| Works | Does not work |
|---|---|
| Login with a password, and with TOTP as second factor | Installation on the phone |
| Every screen while the server answers | The offline capture queue |
| Copying a text | Passkeys |
| | The service worker |
| | Copying an image of a spreadsheet to other applications |

## Phone

1. Open the HTTPS address and sign in.
2. Install the application: "Add to Home Screen" in Safari, "Install app" in Chrome.

On iOS, Safari deletes the storage of a site that is not installed after 7 days without use; the installed application keeps the queue's storage.
