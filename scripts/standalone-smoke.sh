#!/usr/bin/env bash
# Smoke test of the standalone image (ADR 022, M6, M7, B1, B2, C3).
set -euo pipefail
image=${1:?usage: $0 IMAGE}
name=equori-smoke-$$
port=18081
cleanup() { docker rm -f "$name" >/dev/null 2>&1 || true; docker volume rm "$name" >/dev/null 2>&1 || true; }
trap cleanup EXIT

healthy() {
	for _ in $(seq 90); do
		[[ "$(docker inspect -f '{{.State.Health.Status}}' "$name")" == healthy ]] && return 0
		sleep 1
	done
	docker logs "$name" >&2
	return 1
}

docker volume create "$name" >/dev/null
docker run -d --name "$name" -v "$name:/data" -p "127.0.0.1:$port:8080" "$image" >/dev/null
healthy
echo "1 started"
docker exec "$name" equori version | head -1
printf '%s\n' equori-smoke-test | docker exec -i "$name" equori user create --email smoke@equori.test --language en --region US --currency USD
echo "2 a command attached to the running server"
docker exec "$name" equori backup | grep -E '^/data/backups/equori-[0-9-]+-s[0-9]+\.dump$'
echo "3 backup written"
[[ "$(docker exec "$name" equori secrets key | tr -d '\n' | wc -c)" == 44 ]]
echo "4 secret key generated"
[[ "$(docker exec "$name" psql "host=/data/run user=equori dbname=equori" -Atc "SELECT datlocprovider::text || ' ' || datlocale FROM pg_database WHERE datname = 'equori'")" == "b C.UTF-8" ]]
echo "5 builtin C.UTF-8 order"
if docker exec "$name" equori restore /data/backups/"$(docker exec "$name" ls /data/backups | head -1)" 2>"/tmp/$name.err"; then
	echo "restore ran beside serve" >&2
	exit 1
fi
grep -q 'stop it, then run equori restore again' "/tmp/$name.err"
echo "6 restore refused beside serve"
docker restart "$name" >/dev/null
healthy
echo "7 clean restart"
docker kill -s KILL "$name" >/dev/null
docker start "$name" >/dev/null
healthy
echo "8 restart after SIGKILL"
