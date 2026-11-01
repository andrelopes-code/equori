#!/bin/sh
# Installs or upgrades equori under compose in ~/equori (docs/install/linux.md, macos.md; P14 A163).
set -eu

version=dev
repo=andrelopes-code/equori
dir=$HOME/equori

case ${LANG:-} in
pt*) lang=pt ;;
*) lang=en ;;
esac

system=linux
case $(uname -s 2>/dev/null || true) in
Darwin) system=macos ;;
esac

if [ "$version" = dev ]; then
	ref=main
	download=https://github.com/$repo/releases/latest/download
else
	ref=v$version
	download=https://github.com/$repo/releases/download/v$version
fi

guide=https://github.com/$repo/blob/$ref/docs/install/$system
if [ "$lang" = pt ]; then guide=$guide.pt-BR; fi
guide=$guide.md

# say EN PT prints the text of the active language.
say() {
	if [ "$lang" = pt ]; then printf '%s\n' "$2"; else printf '%s\n' "$1"; fi
}

# stop ANCHOR_EN ANCHOR_PT EN PT prints the message and its guide entry, then exits with status 1.
stop() {
	{
		say "$3" "$4"
		say "Guide: $guide#$1" "Guia: $guide#$2"
	} >&2
	exit 1
}

# listening PORT succeeds when a process of this host listens on PORT (A163.7).
listening() {
	if [ "$system" = macos ]; then
		lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
		return
	fi

	cat /proc/net/tcp /proc/net/tcp6 2>/dev/null |
		awk -v p=":$(printf '%04X' "$1")" '$4 == "0A" && substr($2, length($2) - 4) == p { found = 1 } END { exit !found }'
}

# fetch NAME copies NAME of the release, or of EQUORI_INSTALL_SOURCE, to DIR/NAME.part.
fetch() {
	if [ -n "${EQUORI_INSTALL_SOURCE:-}" ]; then
		cp "$EQUORI_INSTALL_SOURCE/$1" "$dir/$1.part"
	else
		curl -fsSL -o "$dir/$1.part" "$download/$1"
	fi
}

say "Checking Docker" "Verificando o Docker"
command -v docker >/dev/null 2>&1 ||
	stop i1-docker-is-not-installed i1-docker-ausente \
		"Docker is not installed or not on the PATH. Install Docker, then run this command again." \
		"O Docker não está instalado ou não está no PATH. Instale o Docker e execute este comando de novo."
docker info >/dev/null 2>&1 ||
	stop i2-docker-does-not-answer i2-docker-sem-resposta \
		"Docker does not answer. Start Docker Desktop, or on Linux start the docker service and add the user to the docker group." \
		"O Docker não responde. Abra o Docker Desktop ou, no Linux, inicie o serviço docker e inclua o usuário no grupo docker."
docker compose version >/dev/null 2>&1 ||
	stop i3-docker-compose-v2-is-missing i3-docker-compose-v2-ausente \
		"Docker Compose v2 is missing: docker compose version fails. Install the Compose plugin." \
		"O Docker Compose v2 está ausente: docker compose version falha. Instale o plugin Compose."

if [ -f "$dir/compose.yaml" ] && [ ! -f "$dir/.env" ]; then
	stop i5-composeyaml-without-env i5-composeyaml-sem-env \
		"$dir holds compose.yaml without .env: an installation made without this script. Write .env with the database password of that installation; the guide shows how." \
		"$dir tem compose.yaml sem .env: uma instalação feita sem este script. Grave o .env com a senha do banco dessa instalação; o guia mostra como."
fi

if [ -f "$dir/.env" ]; then
	port=$(sed -n 's/^EQUORI_PORT=\([0-9][0-9]*\)$/\1/p' "$dir/.env" | tail -n 1)
	port=${port:-8080}
else
	port=
	p=8080
	while [ "$p" -le 8099 ]; do
		if ! listening "$p"; then
			port=$p
			break
		fi

		p=$((p + 1))
	done

	[ -n "$port" ] ||
		stop i7-no-free-port i7-nenhuma-porta-livre \
			"Ports 8080 to 8099 are all in use. Stop a program that uses one of them, then run this command again." \
			"As portas 8080 a 8099 estão todas em uso. Encerre um programa que use uma delas e execute este comando de novo."
fi

created=
if [ ! -d "$dir" ]; then
	mkdir -p "$dir"
	created=1
fi

say "Downloading equori $version into $dir" "Baixando o equori $version em $dir"
for name in compose.yaml env.example; do
	if ! fetch "$name" 2>/dev/null; then
		rm -f "$dir/compose.yaml.part" "$dir/env.example.part"
		if [ -n "$created" ]; then rmdir "$dir"; fi
		stop i6-download-failed i6-falha-no-download \
			"The download of $download/$name failed. Check the internet connection, then run this command again." \
			"O download de $download/$name falhou. Verifique a conexão com a internet e execute este comando de novo."
	fi
done

mv "$dir/compose.yaml.part" "$dir/compose.yaml"
mv "$dir/env.example.part" "$dir/env.example"

# A present .env stays byte for byte: a new key loses the credentials, a new password the volume (A163.6).
if [ ! -f "$dir/.env" ]; then
	password=$(LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32)
	key=$(head -c 32 /dev/urandom | base64 | tr -d '\n')
	(
		umask 077
		sed -e "s|^POSTGRES_PASSWORD=\$|POSTGRES_PASSWORD=$password|" \
			-e "s|^EQUORI_SECRET_KEY=\$|EQUORI_SECRET_KEY=$key|" \
			-e "s|^EQUORI_PORT=\$|EQUORI_PORT=$port|" "$dir/env.example" >"$dir/.env.part"
	)
	chmod 600 "$dir/.env.part"
	mv "$dir/.env.part" "$dir/.env"
fi

cd "$dir"
mkdir -p copies
say "Starting equori on port $port" "Iniciando o equori na porta $port"
docker compose pull --ignore-pull-failures
if [ "$system" = linux ]; then
	# The container user, uid 999, writes the copies; Docker Desktop maps ownership on macOS (A163.8).
	# Under curl | sh the standard input is the rest of this script, which compose run would read.
	docker compose run --rm -T --no-deps --user 0 --entrypoint chown app 999:999 /copies </dev/null
fi

docker compose up -d

say "Waiting for equori to answer" "Aguardando a resposta do equori"
i=0
until curl -fsS --max-time 5 -o /dev/null "http://127.0.0.1:$port/healthz" 2>/dev/null; do
	i=$((i + 1))
	if [ "$i" -ge 90 ]; then
		docker compose logs --no-log-prefix --tail 20 app >&2 || true
		stop i8-equori-does-not-start i8-equori-sem-resposta \
			"equori did not answer on http://127.0.0.1:$port/healthz within 180 seconds; its last log lines are above." \
			"O equori não respondeu em http://127.0.0.1:$port/healthz em 180 segundos; as últimas linhas do log estão acima."
	fi

	sleep 2
done

url=http://127.0.0.1:$port/
if curl -fsS --max-time 5 "http://127.0.0.1:$port/api/v1/setup" | grep -q '"required":true'; then
	# The logged URL names the container port, so the token joins the host port (A163.11).
	token=$(docker compose logs --no-log-prefix app | grep 'first user setup' | tail -n 1 |
		sed -n 's/.*#token=\([A-Za-z0-9_-]*\).*/\1/p')
	if [ -n "$token" ]; then url=http://127.0.0.1:$port/setup#token=$token; fi
fi

if [ "$system" = macos ]; then
	open "$url" || true
elif command -v xdg-open >/dev/null 2>&1; then
	xdg-open "$url" >/dev/null 2>&1 || true
fi

say "equori is installed in $dir." "O equori está instalado em $dir."
say "Address: $url" "Endereço: $url"
say "Keep a copy of $dir/.env apart from the backups: it holds the secret key, without which the bank connections cannot be read." \
	"Guarde uma cópia de $dir/.env longe dos backups: ela contém a chave secreta, sem a qual as conexões bancárias não podem ser lidas."
