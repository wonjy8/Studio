# Studio App

Studio is a production planning and shoot-day command center.

## Deployment model

Studio keeps public source code separate from private runtime data.

- **GitHub:** application source, public documentation, fictional demo data
- **GHCR:** deployable Studio container image built from `main`
- **NAS:** real user accounts, project data, scripts, references, database, runtime secrets
- **Domain:** `studio.wonjongyou.com` (planned via Cloudflare Tunnel)

Never commit real production data, credentials, API keys, tokens, uploaded scripts, references, or database files. See `SECURITY.md`.

## Container publishing

Every push to `main` builds the public-source Studio container on GitHub-hosted Actions and publishes:

```text
ghcr.io/wonjy8/studio:latest
ghcr.io/wonjy8/studio:<commit-sha>
```

The NAS does not need a Git checkout or a privileged GitHub Actions runner. It only needs to pull the published image.

## Synology / Container Manager

The included `compose.yaml` is intended for Synology Container Manager:

```yaml
services:
  studio:
    container_name: studio
    image: ghcr.io/wonjy8/studio:latest
    restart: unless-stopped
    pull_policy: always
    ports:
      - "8787:8080"
    security_opt:
      - no-new-privileges:true
```

The container listens on `8080`; the NAS publishes it on port `8787` for the later Cloudflare Tunnel connection. Do not forward port `8787` from the router to the public internet.

Health check endpoint:

```text
/health
```

## Update path

The intended production flow is:

```text
main → GitHub-hosted Actions → GHCR image → Synology pulls latest → Studio restarts
```

The first NAS project creation and the NAS-side automatic image refresh still require one-time DSM configuration. Runtime secrets remain on the NAS and are never part of the image.

## Current boundary

This container serves the existing browser-based prototype. It does **not** yet provide authentication, a server database, private file storage, or real AI integration. Those capabilities should be added as server-side services without moving private data into this public repository.
