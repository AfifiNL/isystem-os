#!/usr/bin/env bash
set -euo pipefail

image_ref="${1:-}"
evidence_directory="${2:-}"
scratch_size="${ISYSTEM_SCRATCH_SIZE:-1g}"
if [[ -z "$image_ref" ]]; then
  echo "Usage: $0 <local-image-ref> [evidence-directory]" >&2
  exit 2
fi

for required_command in docker; do
  command -v "$required_command" >/dev/null 2>&1 || {
    echo "Container verification requires '$required_command'." >&2
    exit 2
  }
done

if [[ ! "$scratch_size" =~ ^[1-9][0-9]*[mMgG]$ ]] ||
  ((${#scratch_size} > 10)); then
  echo "Container verification requires ISYSTEM_SCRATCH_SIZE in whole MiB or GiB units." >&2
  exit 2
fi
scratch_amount="${scratch_size%?}"
scratch_unit="${scratch_size: -1}"
if [[ "$scratch_unit" == "m" || "$scratch_unit" == "M" ]]; then
  scratch_mib="$scratch_amount"
else
  scratch_mib=$((scratch_amount * 1024))
fi
if ((scratch_mib < 1024)); then
  echo "Container verification requires at least 1 GiB of writable media scratch space." >&2
  exit 2
fi
docker image inspect "$image_ref" >/dev/null

if [[ -n "$evidence_directory" ]]; then
  if [[ -L "$evidence_directory" ]]; then
    echo "Evidence directory must not be a symlink." >&2
    exit 2
  fi
  mkdir -p "$evidence_directory"
  evidence_directory="$(cd "$evidence_directory" && pwd -P)"
fi

container_name="isystem-os-public-smoke-$$-${RANDOM:-0}"
cleanup() {
  docker rm --force "$container_name" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

configured_user="$(docker image inspect --format '{{.Config.User}}' "$image_ref")"
if [[ -z "$configured_user" || "$configured_user" == "0" || "$configured_user" == "root" ]]; then
  echo "Container verification failed: runtime image does not declare a non-root user." >&2
  exit 1
fi

docker run --detach \
  --name "$container_name" \
  --network none \
  --cpus 2 \
  --memory 2g \
  --pids-limit 512 \
  --read-only \
  --tmpfs "/tmp:rw,noexec,nosuid,size=$scratch_size,mode=1777" \
  --tmpfs /app/.next/cache:rw,noexec,nosuid,size=128m,uid=1001,gid=1001,mode=0750 \
  --cap-drop ALL \
  --security-opt no-new-privileges:true \
  --env NEXT_PUBLIC_SITE_URL=http://localhost:3000 \
  --env NEXT_PUBLIC_SUPABASE_URL=https://public-smoke.supabase.invalid \
  --env NEXT_PUBLIC_SUPABASE_ANON_KEY=synthetic-public-anon-key \
  --env HOSTNAME=0.0.0.0 \
  --env PORT=3000 \
  "$image_ref" >/dev/null

runtime_security="$(docker inspect --format '{{.HostConfig.ReadonlyRootfs}}|{{json .HostConfig.CapDrop}}|{{json .HostConfig.SecurityOpt}}|{{.Config.User}}|{{.HostConfig.PidsLimit}}|{{.HostConfig.Memory}}|{{.HostConfig.NanoCpus}}' "$container_name")"
tmpfs_security="$(docker inspect --format '{{index .HostConfig.Tmpfs "/tmp"}}' "$container_name")"
if [[ "$runtime_security" != true* ]] ||
  [[ "$runtime_security" != *'"ALL"'* ]] ||
  [[ "$runtime_security" != *'no-new-privileges'* ]] ||
  [[ "$runtime_security" != *'|512|2147483648|2000000000' ]]; then
  echo "Container verification failed: required runtime restrictions are absent." >&2
  exit 1
fi
if [[ "$tmpfs_security" != *noexec* || "$tmpfs_security" != *nosuid* ||
  "$tmpfs_security" != *size=* ]]; then
  echo "Container verification failed: /tmp is not a bounded noexec/nosuid tmpfs." >&2
  exit 1
fi

health_status="starting"
for ((_attempt = 1; _attempt <= 50; _attempt++)); do
  running_status="$(docker inspect --format '{{.State.Running}}' "$container_name")"
  if [[ "$running_status" != "true" ]]; then
    health_status="exited"
    break
  fi
  health_status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container_name")"
  if [[ "$health_status" == "healthy" ]]; then
    break
  fi
  if [[ "$health_status" == "unhealthy" || "$health_status" == "missing" ]]; then
    break
  fi
  sleep 1
done

if [[ -n "$evidence_directory" ]]; then
  printf '%s\n' "$runtime_security" > "$evidence_directory/runtime-security.txt"
  printf '%s\n' "$health_status" > "$evidence_directory/health-status.txt"
  docker logs "$container_name" > "$evidence_directory/container.log" 2>&1 || true
fi

if [[ "$health_status" != "healthy" ]]; then
  echo "Container verification failed: health status is '$health_status'." >&2
  docker logs "$container_name" >&2 || true
  exit 1
fi

media_smoke_output=""
if ! media_smoke_output="$(docker exec "$container_name" sh -eu -c '
  scratch_kib="$(df -Pk /tmp | awk "NR == 2 { print \$2 }")"
  if [ -z "$scratch_kib" ] || [ "$scratch_kib" -lt 1048576 ]; then
    echo "scratch capacity is below 1 GiB" >&2
    exit 1
  fi
  ffmpeg -nostdin -hide_banner -loglevel error \
    -f lavfi -i color=c=black:s=640x360:r=24 -t 1 \
    -c:v mpeg4 -y /tmp/public-media-smoke.mp4
  dimensions="$(ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height -of csv=p=0:s=x \
    /tmp/public-media-smoke.mp4)"
  rm -f /tmp/public-media-smoke.mp4
  [ "$dimensions" = "640x360" ]
  printf "scratch_kib=%s\nmedia_dimensions=%s\n" "$scratch_kib" "$dimensions"
' 2>&1)"; then
  if [[ -n "$evidence_directory" ]]; then
    printf '%s\n' "$media_smoke_output" > "$evidence_directory/media-smoke.txt"
  fi
  echo "Container verification failed: FFmpeg scratch smoke did not pass." >&2
  printf '%s\n' "$media_smoke_output" >&2
  exit 1
fi

if [[ -n "$evidence_directory" ]]; then
  printf '%s\n' "$tmpfs_security" > "$evidence_directory/tmpfs-security.txt"
  printf '%s\n' "$media_smoke_output" > "$evidence_directory/media-smoke.txt"
fi

echo "Container passed security, health, scratch-capacity, and FFmpeg media checks."
