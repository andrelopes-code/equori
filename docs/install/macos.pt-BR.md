English: [macos.md](macos.md)

# Instalar no macOS

## Pré-requisitos

- Docker Desktop: <https://docs.docker.com/desktop/setup/install/mac-install/>.

## Instalação

Execute o comando num terminal:

```sh
curl -fsSL https://github.com/andrelopes-code/equori/releases/latest/download/install.sh | sh
```

O comando instala o equori em `~/equori` e grava ali `compose.yaml`, `env.example`, `.env` e a pasta `copies`.

No fim o comando imprime: "O equori está instalado em <dir>." e "Endereço: <url>".

Guarde uma cópia de `<dir>/.env` longe dos backups: ela contém a chave secreta, sem a qual as conexões bancárias não podem ser lidas.

## Primeiro acesso

O navegador abre o endereço com o token. O formulário pede email, senha, idioma, região, moeda base, nome do livro, fuso horário e a verificação de atualização. Enquanto não existe usuário, executar o comando de novo imprime o endereço de novo.

## Atualização

Execute o comando de instalação de novo. O `serve` faz backup dos dados antes de migrar (ADR 022, B3).

## Voltar à versão anterior

No diretório de instalação:

1. Execute o comando de instalação da versão anterior, com `<version>` trocado pelo número dela, como `1.0.0`. Quando ele termina com o endereço, o equori está de volta nessa versão.

```sh
curl -fsSL https://github.com/andrelopes-code/equori/releases/download/v<version>/install.sh | sh
```

2. Quando ele para com "O equori não respondeu" e as linhas do log acima trazem "database schema is newer than this binary", a atualização migrou o banco, e a versão anterior o recusa (ADR 022, V4). A linha também diz "this binary knows up to <N>". Liste os backups e escolha o `pre-migration-<data>-s<N>.dump` mais recente com esse `<N>`:

```sh
docker compose run --rm --no-deps --entrypoint ls app /backups
```

3. Restaure-o, com `<file>` trocado pelo nome dele. Os dados voltam ao momento anterior à atualização.

```sh
docker compose stop app
docker compose cp app:/backups/<file> .
docker compose cp <file> db:/tmp/restore.dump
docker compose exec -T db dropdb -U equori --force equori
docker compose exec -T db createdb --template=template0 --locale-provider=builtin --builtin-locale=C.UTF-8 -U equori equori
docker compose exec -T db pg_restore -U equori --no-owner --exit-on-error -d equori /tmp/restore.dump
docker compose start app
```

## Iniciar e parar

No diretório de instalação:

```sh
docker compose stop
docker compose start
```

## Remoção

- `docker compose down` mantém os dados.
- `docker compose down -v` apaga o banco de dados e o volume dos backups.

## Solução de problemas

Cada entrada cita a mensagem impressa pelo comando de instalação ou pelo equori e traz a correção. Toda parada do comando de instalação termina com a linha `Como resolver: <url>` que aponta para a entrada.

### I1 Docker ausente

Mensagem: "O Docker não está instalado ou não está no PATH. Instale o Docker e execute este comando de novo."

Correção: Instale o Docker como em Pré-requisitos e execute o comando de instalação de novo.

### I2 Docker sem resposta

Mensagem: "O Docker não responde. Abra o Docker Desktop ou, no Linux, inicie o serviço docker e inclua o usuário no grupo docker."

Correção: Abra o Docker Desktop ou, no Linux, inicie o serviço docker e inclua o usuário no grupo `docker`. Depois execute o comando de instalação de novo.

### I3 Docker Compose v2 ausente

Mensagem: "O Docker Compose v2 está ausente: docker compose version falha. Instale o plugin Compose."

Correção: Instale o plugin Compose até `docker compose version` funcionar e execute o comando de instalação de novo.

### I5 compose.yaml sem .env

Mensagem: "<dir> tem compose.yaml sem .env: uma instalação feita sem este script. Grave o .env com a senha do banco dessa instalação; o guia mostra como."

Passos:

1. Baixe o `env.example` da versão para o diretório de instalação: <https://github.com/andrelopes-code/equori/releases/latest/download/env.example>.
2. Copie-o para `.env`.
3. Defina `POSTGRES_PASSWORD` com a senha do comando anterior: `change-me` no README anterior, `equori` sem ele.
4. Defina `EQUORI_SECRET_KEY` com a saída de `openssl rand -base64 32`.
5. Defina `EQUORI_PORT=8080`.
6. Execute o comando de instalação de novo.

### I6 Falha no download

Mensagem: "O download de <url> falhou. Verifique a conexão com a internet e execute este comando de novo."

Correção: Verifique a conexão com a internet e execute o comando de instalação de novo.

### I7 Nenhuma porta livre

Mensagem: "As portas 8080 a 8099 estão todas em uso. Encerre um programa que use uma delas e execute este comando de novo."

Correção: Encerre um programa que use uma das portas 8080 a 8099 e execute o comando de instalação de novo.

### I8 equori sem resposta

Mensagem: "O equori não respondeu em http://127.0.0.1:<port>/healthz em 180 segundos; as últimas linhas do log estão acima."

Correção: Leia as linhas do log impressas acima da mensagem. `docker compose logs app` no diretório de instalação as imprime de novo.

### C1 Configuração inválida

Mensagem: `invalid configuration (docs/install/configuration.md):`

Correção: Corrija as linhas do `.env` que o relatório nomeia e execute `docker compose up -d`. [configuration.pt-BR.md](configuration.pt-BR.md) lista todas as variáveis.

### C2 Variável desconhecida

Mensagem: `environment variable unknown`

Correção: O log nomeia uma variável que o equori não lê. Corrija o nome no `.env`.

### C3 Banco inacessível

Mensagem: `cannot connect to the database of EQUORI_DATABASE_URL`

Correção: Execute `docker compose ps db` para verificar o serviço do banco. Um `POSTGRES_PASSWORD` alterado depois do primeiro início não altera a senha guardada no banco (ADR 022, B5).

### C4 Porta em uso

Mensagem: `EQUORI_HTTP_ADDR`

Correção: A mensagem termina com "expected a free host:port". Com o compose, `EQUORI_PORT` no `.env` seleciona a porta; defina uma livre e execute `docker compose up -d`.

### C5 Chave secreta ausente

Mensagem: `EQUORI_SECRET_KEY is not set: bank connections, the second factor and the copy password are unavailable`

Correção: Uma instalação anterior ao P14 não tem a chave. Acrescente `EQUORI_SECRET_KEY` ao `.env` como em I5 e execute `docker compose up -d`.
