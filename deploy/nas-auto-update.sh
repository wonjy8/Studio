#!/bin/sh
# Run from DSM Task Scheduler as root. Only the Studio compose service is recreated.
set -eu
PATH=/var/packages/ContainerManager/target/usr/bin:/usr/local/bin:/usr/bin:/bin:$PATH
export PATH
project_dir=${STUDIO_PROJECT_DIR:-/volume2/docker/studio}
image=ghcr.io/wonjy8/studio:latest
cd "$project_dir"
lock="$project_dir/.studio-update.lock"
if ! mkdir "$lock" 2>/dev/null; then
  echo 'Studio updater is already running (or its lock requires inspection).'
  exit 0
fi
trap 'rmdir "$lock"' EXIT
trap 'exit 1' HUP INT TERM

# Read the running project's exact Compose file list, preserving its project name.
files=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project.config_files"}}' studio)
project=$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' studio)
case "$project" in ''|'<no value>') echo 'Studio must be managed by a Compose project.' >&2; exit 1;; esac
case "$files" in ''|'<no value>') echo 'Cannot identify the current Compose configuration.' >&2; exit 1;; esac
# Original DSM project files are the source of truth. Never use a prior updater override.
base_files=$(printf '%s' "$files" | tr ',' '\n' | sed '/\/.studio-update.override.yaml$/d')
[ -n "$base_files" ] || { echo 'No persistent project configuration found.' >&2; exit 1; }
set --
while IFS= read -r file; do
  [ -f "$file" ] || { echo 'A Compose configuration file is missing.' >&2; exit 1; }
  set -- "$@" -f "$file"
done <<FILES
$base_files
FILES
if docker compose version >/dev/null 2>&1; then
  compose() { docker compose -p "$project" "$@"; }
else
  command -v docker-compose >/dev/null
  compose() { docker-compose -p "$project" "$@"; }
fi
mounted=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/data"}}{{.RW}}{{end}}{{end}}' studio)
[ "$mounted" = true ] || { echo 'Refusing update: persistent writable /data mount is missing.' >&2; exit 1; }
old=$(docker inspect --format '{{.Image}}' studio)
docker pull "$image"
new=$(docker image inspect --format '{{.Id}}' "$image")
if [ "$old" = "$new" ]; then exit 0; fi
# Pin the pulled immutable image ID locally so a moving latest tag cannot race the update.
docker image tag "$old" studio-rollback:local
docker image tag "$new" studio-update:local
# Keep this override in the project directory so Compose's recorded file list remains valid.
override="$project_dir/.studio-update.override.yaml"
write_override() {
  printf 'services:\n  studio:\n    image: %s\n    pull_policy: never\n' "$1" > "$override"
}
write_override studio-update:local
if compose "$@" -f "$override" config --quiet && compose "$@" -f "$override" up -d --no-deps studio; then
  attempt=0
  while [ "$attempt" -lt 30 ]; do
    state=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' studio 2>/dev/null || true)
    if [ "$state" = healthy ]; then
      echo 'Studio updated and healthy.'
      exit 0
    fi
    [ "$state" != unhealthy ] || break
    attempt=$((attempt + 1))
    sleep 2
  done
fi
echo 'Studio update failed; restoring previous image.' >&2
write_override studio-rollback:local
compose "$@" -f "$override" up -d --no-deps studio
exit 1
