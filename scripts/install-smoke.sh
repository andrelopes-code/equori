#!/usr/bin/env bash
# Installation smoke test on Linux (P14 A166.2): scenarios S230, S227, S228 and S229.
set -euo pipefail
image=${1:?usage: $0 IMAGE VERSION}
version=${2:?usage: $0 IMAGE VERSION}
work=$(mktemp -d)
listener=
export COMPOSE_PROJECT_NAME=equori-smoke-$$
export DOCKER_CONFIG=${DOCKER_CONFIG:-$HOME/.docker}

# reset removes the installation of the last scenario; copies belongs to uid 999.
reset() {
	if [[ -d $work/home/equori ]]; then (cd "$work/home/equori" && docker compose down -v >/dev/null 2>&1) || true; fi
	docker run --rm --user 0 --entrypoint rm -v "$work:/work" "$image" -rf /work/home >/dev/null
}

cleanup() {
	if [[ -n $listener ]]; then kill "$listener" 2>/dev/null || true; fi
	reset || true
	rm -rf "$work"
}
trap cleanup EXIT

for p in 8080 8081; do
	if (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; then
		echo "port $p is in use; the smoke needs 8080 and 8081 free" >&2
		exit 1
	fi
done

docker tag "$image" "ghcr.io/andrelopes-code/equori:$version-standalone"
scripts/pin-assets.sh "$version" "$work/dist"
mkdir -p "$work/bin" "$work/empty"
printf '#!/bin/sh\nprintf "%%s\\n" "$1" >%s/opened\n' "$work" >"$work/bin/xdg-open"
chmod +x "$work/bin/xdg-open"
env=$work/home/equori/.env

install() {
	HOME=$work/home PATH=$work/bin:$PATH EQUORI_INSTALL_SOURCE=$work/dist LANG=C.UTF-8 sh "$work/dist/install.sh" 2>&1
}

# quiet fails when the output holds compose output or a carriage return (A190.2, A190.5).
quiet() {
	if grep -qE "Container |Pull|$(printf '\r')" <<<"$1"; then
		echo "$2: the output holds compose output or a carriage return" >&2
		exit 1
	fi
}

set +e
out=$(HOME=$work/home PATH=$work/empty LANG=C.UTF-8 /bin/sh "$work/dist/install.sh" 2>&1)
status=$?
set -e
[[ $status == 1 ]]
grep -q 'Docker is not installed or not on the PATH' <<<"$out"
grep -q "docs/install/linux.md#i1-docker-is-not-installed" <<<"$out"
grep -q '^  \[!!\] Docker' <<<"$out"
grep -q '^Error: Docker is not installed' <<<"$out"
grep -q '^How to fix: https://' <<<"$out"
[[ ! -e $work/home/equori ]]
echo "S230 stops without docker and writes nothing"

out=$(install)
[[ $(stat -c %a "$env") == 600 ]]
[[ $(sed -n 's/^POSTGRES_PASSWORD=//p' "$env") =~ ^[A-Za-z0-9]{32}$ ]]
[[ $(sed -n 's/^EQUORI_SECRET_KEY=//p' "$env" | base64 -d | wc -c) == 32 ]]
port=$(sed -n 's/^EQUORI_PORT=//p' "$env")
url=$(grep -oE "http://127\.0\.0\.1:$port/setup#token=[A-Za-z0-9_-]+" <<<"$out")
[[ $(cat "$work/opened") == "$url" ]]
code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
	-d "{\"token\":\"${url#*#token=}\",\"email\":\"smoke@equori.test\",\"password\":\"equori-smoke-test\",\"language\":\"en\",\"region\":\"US\",\"base_currency\":\"USD\",\"update_check\":false}" \
	"http://127.0.0.1:$port/api/v1/setup")
[[ $code == 201 ]]
grep -qx "equori $version" <<<"$out"
grep -qx "Installing into $work/home/equori" <<<"$out"
[[ $(grep -c '^  \[ok\] ' <<<"$out") == 5 ]]
[[ -s $work/home/equori/install.log ]]
quiet "$out" S227
echo "S227 installed on port $port; the setup token creates the first member"

cp "$env" "$work/env.before"
out=$(install)
cmp "$env" "$work/env.before"
# A negated command never trips set -e, so the check exits by hand.
if grep -q '#token=' <<<"$out"; then
	echo "S228 printed a token after the first member" >&2
	exit 1
fi
grep -q "Address: http://127.0.0.1:$port/" <<<"$out"
grep -qx "Upgrading $work/home/equori" <<<"$out"
grep -q 'docker compose stop' <<<"$out"
quiet "$out" S228
curl -fsS -o /dev/null "http://127.0.0.1:$port/healthz"
echo "S228 a second run keeps .env and prints no token"

reset
python3 -m http.server 8080 --bind 127.0.0.1 >/dev/null 2>&1 &
listener=$!
for _ in $(seq 20); do
	if (exec 3<>/dev/tcp/127.0.0.1/8080) 2>/dev/null; then break; fi
	sleep 0.5
done
out=$(install)
grep -qx 'EQUORI_PORT=8081' "$env"
grep -q 'http://127.0.0.1:8081/setup#token=' <<<"$out"
echo "S229 a listener on 8080 moves the installation to 8081"
