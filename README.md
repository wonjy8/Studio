# Studio App

Studio is a production planning and shoot-day command center.

## Deployment model

Studio keeps public source code separate from private runtime data.

- **GitHub:** application source, public documentation, fictional demo data
- **NAS:** real user accounts, project data, scripts, references, database, runtime secrets
- **Domain:** `studio.wonjongyou.com` (planned via Cloudflare Tunnel)

Never commit real production data, credentials, API keys, tokens, uploaded scripts, references, or database files. See `SECURITY.md`.

## Synology / Container Manager

The repository includes a small nginx container for the current static Studio prototype.

```sh
docker compose up -d --build
```

The container listens on port `8080` internally. The included compose configuration binds it to NAS loopback port `8787`, so it is not intentionally exposed directly to the internet. A reverse proxy or Cloudflare Tunnel can be connected to the service in a later deployment step.

Health check endpoint:

```text
/health
```

## Current boundary

This container serves the existing browser-based prototype. It does **not** yet provide authentication, a server database, private file storage, or real AI integration. Those capabilities should be added as server-side services without moving private data into this public repository.
