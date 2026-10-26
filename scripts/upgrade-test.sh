#!/usr/bin/env bash
# R7 of docs/superpowers/specs/2026-10-26-distribution-design.md: a database written by the previous
# release keeps every fact when the new release migrates it.
set -euo pipefail

if [[ $# -ne 3 ]]; then
	echo "usage: $0 PREV_IMAGE NEW_IMAGE PREV_REF" >&2
	exit 2
fi
prev_image=$1 new_image=$2 prev_ref=$3
name=equori-upgrade-$$
port=18080
work=$(mktemp -d)
url="postgres://equori:equori@$name-db:5432/equori?sslmode=disable"

cleanup() {
	docker rm -f "$name-db" "$name-app" >/dev/null 2>&1 || true
	docker network rm "$name" >/dev/null 2>&1 || true
	git worktree remove --force "$work/src" >/dev/null 2>&1 || true
	rm -rf "$work"
}
trap cleanup EXIT

wait_healthy() {
	for _ in $(seq 120); do
		curl -fsS "http://127.0.0.1:$port/healthz" >/dev/null 2>&1 && return 0
		sleep 1
	done
	docker logs "$name-app" >&2
	return 1
}

start_app() {
	docker run -d --name "$name-app" --network "$name" -p "127.0.0.1:$port:8080" \
		-e EQUORI_DATABASE_URL="$url" -e EQUORI_INSECURE_COOKIES=true "$1" >/dev/null
	wait_healthy
}

# Row counts of every table owned by a user and the balance of every account. Sessions and the
# outbox change with logins and deliveries, not with the facts.
snapshot() {
	docker exec -i "$name-db" psql -U equori -d equori -At -v ON_ERROR_STOP=1 <<'SQL'
SELECT account_id || ' ' || sum(amount) FROM ledger_posting WHERE NOT voided GROUP BY account_id ORDER BY 1;
SELECT format('SELECT %L || '' '' || count(*) FROM %I', table_name, table_name)
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'user_id'
  AND table_name NOT LIKE 'outbox\_%' AND table_name <> 'identity_session'
ORDER BY table_name \gexec
SQL
}

docker network create "$name" >/dev/null
docker run -d --name "$name-db" --network "$name" -e POSTGRES_USER=equori -e POSTGRES_PASSWORD=equori \
	-e POSTGRES_DB=equori postgres:18-alpine >/dev/null
until docker exec "$name-db" pg_isready -h 127.0.0.1 -U equori -d equori >/dev/null 2>&1; do sleep 1; done

start_app "$prev_image"
printf '%s\n' equori-upgrade-test | docker exec -i "$name-app" /equori user create \
	--email upgrade@equori.test --language pt --region BR
git worktree add --detach "$work/src" "$prev_ref" >/dev/null
(cd "$work/src" && go run ./cmd/demoseed -url "http://127.0.0.1:$port" -email upgrade@equori.test \
	-password equori-upgrade-test -today 2026-10-26)
# The dispatcher of the previous release drains the outbox of the seeding.
sleep 15
snapshot >"$work/before"
docker rm -f "$name-app" >/dev/null

start_app "$new_image"
snapshot >"$work/after"
diff -u "$work/before" "$work/after"
echo "upgrade from $prev_image to $new_image kept $(wc -l <"$work/before") facts"
