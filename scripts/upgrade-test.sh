#!/usr/bin/env bash
# R7 of docs/specs/2026-10-26-distribution-design.md: a database written by the previous
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
# pool_max_conns: a release before the fixed pool size sizes it by the CPUs of the host, and a host of
# 4 CPUs stalled the seeding of that release; the setting is read by every release.
url="postgres://equori:equori@$name-db:5432/equori?sslmode=disable&pool_max_conns=20"

cleanup() {
	# A failed run keeps the logs of both containers: they are gone once the containers are removed.
	if [[ $? -ne 0 ]]; then
		docker logs --tail 200 "$name-app" >&2 || true
		docker logs --tail 50 "$name-db" >&2 || true
	fi
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

# The index feeds the seeding enables point at a closed local port: a fetch of real rates would
# revise the stored ones and the facts derived from them between the two snapshots.
start_app() {
	docker run -d --name "$name-app" --network "$name" -p "127.0.0.1:$port:8080" \
		-e EQUORI_DATABASE_URL="$url" -e EQUORI_INSECURE_COOKIES=true \
		-e EQUORI_FEED_BR_CDI_URL=http://127.0.0.1:9 -e EQUORI_FEED_BR_IPCA_URL=http://127.0.0.1:9 \
		"$1" >/dev/null
	wait_healthy
}

# Row counts of every table owned by a user and the balance of every account. Sessions and the
# outbox change with logins and deliveries, not with the facts.
snapshot() {
	docker exec -i "$name-db" psql -U equori -d equori -At -v ON_ERROR_STOP=1 <<'SQL'
SELECT account_id || ' ' || sum(amount) FROM ledger_posting WHERE NOT voided GROUP BY account_id ORDER BY 1;
SELECT format('SELECT %L || '' '' || count(*) FROM %I', table_name, table_name)
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name IN ('user_id', 'books_id')
  AND table_name NOT LIKE 'outbox\_%' AND table_name NOT IN ('identity_session', 'identity_membership')
ORDER BY table_name \gexec
SQL
}

# The dispatcher derives rows from the outbox after each write and retries a failed delivery with a
# growing delay; a snapshot counts once no delivery waits for a retry and two readings 10 seconds
# apart, two poll intervals of the dispatcher, agree.
retrying() {
	docker exec "$name-db" psql -U equori -d equori -At -c "SELECT count(*) FROM outbox_delivery WHERE status = 'retrying'"
}

settled() {
	local previous current
	previous=$(snapshot)
	for _ in $(seq 60); do
		sleep 10
		current=$(snapshot)
		if [[ $current == "$previous" && $(retrying) == 0 ]]; then
			printf '%s\n' "$current"
			return 0
		fi
		previous=$current
	done
	echo "facts still changing after 600 seconds" >&2
	return 1
}

docker network create "$name" >/dev/null
docker run -d --name "$name-db" --network "$name" -e POSTGRES_USER=equori -e POSTGRES_PASSWORD=equori \
	-e POSTGRES_DB=equori postgres:18-alpine >/dev/null
until docker exec "$name-db" pg_isready -h 127.0.0.1 -U equori -d equori >/dev/null 2>&1; do sleep 1; done

start_app "$prev_image"
printf '%s\n' equori-upgrade-test | docker exec -i "$name-app" /equori user create \
	--email upgrade@equori.test --language pt --region BR
# The seeder of v0.1.0-beta.6 prices fixed income on the cdi and the ipca, and a new instance
# enables no feed. Rates are stored directly: the test compares facts, not market data, and asks
# no provider.
docker exec -i "$name-db" psql -U equori -d equori -q -v ON_ERROR_STOP=1 <<'SQL'
INSERT INTO marketdata_feed (id, enabled) VALUES ('br_cdi', true), ('br_ipca', true)
ON CONFLICT (id) DO UPDATE SET enabled = true;
INSERT INTO marketdata_index_rate (index_id, date, rate, source)
SELECT 'cdi', d::date, 0.0004, 'br_cdi'
FROM generate_series(current_date - interval '12 years', current_date, interval '1 day') d
WHERE extract(isodow FROM d) < 6
ON CONFLICT DO NOTHING;
INSERT INTO marketdata_index_rate (index_id, date, rate, source)
SELECT 'ipca', d::date, 0.004, 'br_ipca'
FROM generate_series(date_trunc('month', current_date - interval '12 years'), current_date,
	interval '1 month') d
ON CONFLICT DO NOTHING;
SQL
git worktree add --detach "$work/src" "$prev_ref" >/dev/null
# The seeder of the previous ref drives the API of the release it seeds; the seeder of this tree
# asks for account kinds that v0.1.0-beta.5 rejects.
(cd "$work/src" && go run ./cmd/demoseed -url "http://127.0.0.1:$port" -email upgrade@equori.test \
	-password equori-upgrade-test)
settled >"$work/before"
docker rm -f "$name-app" >/dev/null

start_app "$new_image"
settled >"$work/after"
# A balance of before that differs or vanishes, or a table whose rows vanish or decrease, is a
# lost fact. A count that grows is not: each start finishes derived work the previous one left,
# about 56 categorizations and 2 account days of the seeded book (owner, 2026-11-28).
lost=$(awk '
	NR == FNR { after[$1] = $2; next }
	!($1 in after) { print; next }
	$1 ~ /^[0-9a-f-]{36}$/ && after[$1] != $2 { print; next }
	$1 !~ /^[0-9a-f-]{36}$/ && after[$1] + 0 < $2 + 0 { print }
' "$work/after" "$work/before")
if [[ -n $lost ]]; then
	echo "lost or changed after the upgrade:" >&2
	echo "$lost" >&2
	echo "the same lines after the upgrade:" >&2
	grep -F -f <(cut -d' ' -f1 <<<"$lost" | sed 's/$/ /') "$work/after" >&2 || true
	exit 1
fi
echo "upgrade from $prev_image to $new_image kept $(wc -l <"$work/before") facts"
