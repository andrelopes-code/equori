<!-- Gerado por make gen a partir de internal/platform/config/variables.go; não editar. -->

# Configuração

O compose.yaml lê as variáveis do .env do seu diretório. O equori lê o ambiente do processo e, no modo gerenciado, o equori.env do seu diretório de dados (ADR 022, C2). Ao iniciar, o equori verifica cada variável que lê, imprime uma linha por valor inválido e termina com status 1. A coluna Esperado traz o texto das mensagens de início, em inglês.

## Instalação

| Variável | Lida por | Esperado | Padrão | Exemplo | Descrição |
|---|---|---|---|---|---|
| `POSTGRES_PASSWORD` | `compose.yaml` | letters A to Z, a to z and digits 0 to 9 | `equori` | `Zx81Qm4TfV9pLr2KcW7sNb3HdY6jGa5E` | Senha do usuário do banco do compose.yaml. O PostgreSQL só a lê ao criar o volume pgdata; uma troca posterior exige a mesma troca dentro do banco. |
| `EQUORI_PORT` | `compose.yaml` | a port from 1 to 65535 | `8080` | `8081` | Porta do computador em que o compose.yaml publica o equori. O script de instalação grava a primeira porta livre de 8080 a 8099. |
| `EQUORI_HOST_IP` | `compose.yaml` | an IP address | `127.0.0.1` | `0.0.0.0` | Endereço do computador em que o compose.yaml publica o equori. 0.0.0.0 o abre para a rede, o que em HTTP sem TLS também exige EQUORI_INSECURE_COOKIES=true (docs/operations/remote-access.md). |
| `EQUORI_COPY_FOLDER` | `compose.yaml` | a directory path | `./copies` | `/mnt/backup/equori` | Pasta do computador que recebe as cópias criptografadas dos backups. O usuário do contêiner, uid 999, grava nela. |
| `EQUORI_SECRET_KEY` | `equori` | 32 bytes in standard base64 | — | `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=` | Chave que sela as credenciais bancárias, o segundo fator e a senha das cópias (ADR 008); openssl rand -base64 32 gera uma. Sem ela, no modo externo, esses recursos ficam indisponíveis; o modo gerenciado grava secret.key. Uma chave nova torna ilegíveis as credenciais gravadas, então uma cópia do .env fica longe dos backups. |
| `EQUORI_SECRET_KEY_PREVIOUS` | `equori` | 32 bytes in standard base64 | — | `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=` | A chave substituída durante uma rotação: defina-a, execute equori secrets rotate e depois remova-a. |
| `EQUORI_LOG_LEVEL` | `equori` | debug, info, warn or error | `info` | `debug` | Nível mínimo dos registros que o equori grava. |
| `EQUORI_INSECURE_COOKIES` | `equori` | true or false | `false` | `true` | true remove o atributo Secure do cookie de sessão, o que um login em HTTP sem TLS a partir de outro computador exige (ADR 003). |
| `EQUORI_API_DOCS` | `equori` | true or false | `false` | `true` | true serve a referência da API em /docs e o contrato em /openapi.yaml, ambos sem sessão. |

## Avançado

| Variável | Lida por | Esperado | Padrão | Exemplo | Descrição |
|---|---|---|---|---|---|
| `EQUORI_DISTRIBUTION` | `equori` | compose or empty | — | `compose` | O compose.yaml define compose, para que o aviso de nova versão mostre o comando de atualização dessa forma (A194). |
| `EQUORI_VERSION` | `compose.yaml` | a release version | — | `1.0.0` | Versão da imagem do compose.yaml. Uma versão publicada define a própria versão como padrão; num clone o padrão é dev, que o compose constrói. |
| `EQUORI_DATABASE_URL` | `equori` | a postgres:// or postgresql:// URL | — | `postgres://equori:password@db:5432/equori?sslmode=disable` | URL de um banco PostgreSQL 18 (modo externo); o compose.yaml a define. Sem ela, o equori executa o próprio servidor PostgreSQL sobre EQUORI_DATA_DIR (modo gerenciado). |
| `EQUORI_HTTP_ADDR` | `equori` | host:port with a port from 1 to 65535 | `:8080` | `127.0.0.1:8081` | Endereço em que o equori escuta. O compose.yaml mantém o contêiner em :8080 e o publica por EQUORI_HOST_IP e EQUORI_PORT. |
| `EQUORI_DATA_DIR` | `equori` | a directory path | — | `/var/lib/equori` | Diretório de dados do modo gerenciado. Sem ela: %ProgramData%\equori no Windows, ~/Library/Application Support/equori no macOS, $XDG_DATA_HOME/equori ou ~/.local/share/equori no Linux. |
| `EQUORI_POSTGRES_BIN` | `equori` | the directory of the postgres and pg_dump programs | — | `/usr/lib/postgresql/18/bin` | Diretório dos programas do PostgreSQL 18 para o modo gerenciado, os backups e a restauração. Sem ela: postgresql/bin ao lado do executável, senão o diretório do postgres no PATH. |
| `EQUORI_BACKUP_DIR` | `equori` | a directory path | — | `/backups` | Diretório dos backups automáticos; o compose.yaml define /backups. Sem ela: backups no diretório de dados no modo gerenciado, nenhum backup automático no modo externo. |
| `EQUORI_COPY_DIR` | `equori` | a directory path | — | `/copies` | Diretório das cópias criptografadas no sistema de arquivos do processo; o compose.yaml define /copies e monta EQUORI_COPY_FOLDER nele. |

## Desenvolvimento

| Variável | Lida por | Esperado | Padrão | Exemplo | Descrição |
|---|---|---|---|---|---|
| `EQUORI_AGGREGATOR_<ID>_URL` | `equori` | an http:// or https:// URL | — | `https://aggregator.example` | URL base da API de um agregador, pelo seu ID (pluggy), no lugar do endereço público; testes e simuladores a definem. |
| `EQUORI_FEED_<ID>_URL` | `equori` | an http:// or https:// URL | — | `https://feed.example` | Endereço de uma fonte de preços, índices ou expectativas, pelo seu ID, no lugar do endereço público; testes e simuladores a definem. |
| `EQUORI_WEB_DEV_PORT` | `equori` | a port from 1 to 65535 | — | `5173` | Porta do servidor de desenvolvimento Vite, para a qual as páginas redirecionam no mesmo host (ADR 028). Sem ela, o equori serve a aplicação embutida. |
| `EQUORI_DEV_DB_PORT` | Makefile, testes | a port from 1 to 65535 | `54329` | `54330` | Porta do banco de desenvolvimento do compose.dev.yaml (make db-up). |
| `EQUORI_TEST_DB_PORT` | Makefile, testes | a port from 1 to 65535 | `54339` | `54340` | Porta do banco de testes do compose.dev.yaml (make db-test-up). |
| `EQUORI_TEST_DB_SERVICE` | Makefile, testes | a service of compose.dev.yaml | `db-test` | `db-test` | Serviço do compose.dev.yaml em que o teste de backup executa o pg_dump (make test). |
| `EQUORI_TEST_DATABASE_URL` | Makefile, testes | a postgres:// or postgresql:// URL | — | `postgres://equori:equori@127.0.0.1:54339/postgres?sslmode=disable` | URL do servidor de testes que os testes Go leem; o Makefile a define a partir de EQUORI_TEST_DB_PORT. |
| `EQUORI_TEST_POSTGRES_BIN` | Makefile, testes | the directory of the postgres and pg_dump programs | — | `/usr/lib/postgresql/18/bin` | Diretório dos programas do PostgreSQL para os testes do modo gerenciado (make test-cluster). |
| `EQUORI_DEMO_PASSWORD` | Makefile, testes | a password | `equori-demo-account` | `demo-password-2026` | Senha do usuário de demonstração do make demo. |
| `EQUORI_EVAL_KEY` | Makefile, testes | an API key of the provider | — | `eval-key` | Chave do provedor que os testes de avaliação (build tag eval) chamam; só o owner a define. |
