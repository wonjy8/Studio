# Studio

Studio is a production planning and shoot-day command center: Workspace → Project → Shoot.

The NAS-hosted app provides local-account login, private persistent project data, PDF script preview/download, and reference image storage. Accounts are provisioned on the NAS; public signup and AI integration are disabled. Each account has an isolated workspace with multiple projects and configurable project icons.

Read [NAS deployment](docs/NAS_DEPLOYMENT.md) for the exact DSM update, account setup, backup, and acceptance checks. Existing Cloudflare Tunnel routes to `http://studio:8080`; no router forwarding is needed. Runtime data lives in the private `studio-data` Docker volume and never in Git or the image.

## Development

Node 24 is the production runtime. No third-party runtime packages are required.

```sh
npm test
npm run check
APP_ORIGIN=http://localhost:8080 COOKIE_SECURE=false npm start
```

In another terminal, provision a fictional local account using `npm run account -- demo-user` and supply a password through stdin. Do not put real passwords in command arguments or shell history. HTTP/insecure-cookie mode is local development only.

GitHub Actions checks pull requests, builds the container, then publishes `ghcr.io/wonjy8/studio:latest` and an immutable commit tag on main. The NAS pulls the image and retains its volume. See [authentication architecture](docs/AUTH_AND_SERVER.md), [product rules](docs/PRODUCT.md), and [security policy](SECURITY.md).
