package config

import (
	"encoding/base64"
	"log/slog"
	"net"
	"net/url"
	"slices"
	"strconv"
)

// Reader names what reads a variable (A160.1).
type Reader string

const (
	// Binary is equori itself, through Load.
	Binary Reader = "binary"
	// Compose is compose.yaml, which reads .env of its directory.
	Compose Reader = "compose"
	// Tooling is the Makefile, compose.dev.yaml, the tests and cmd/demoseed.
	Tooling Reader = "tooling"
)

// Kind names the form a value takes (A160.3).
type Kind string

const (
	KindURL           Kind = "url"
	KindPath          Kind = "path"
	KindListenAddress Kind = "listen_address"
	KindPort          Kind = "port"
	KindIP            Kind = "ip"
	KindBool          Kind = "bool"
	KindLogLevel      Kind = "log_level"
	KindKey32         Kind = "key32"
	KindPassword      Kind = "password"
	KindText          Kind = "text"
)

// Audience groups the entries of the reference (A160.8).
type Audience string

const (
	Install     Audience = "install"
	Advanced    Audience = "advanced"
	Development Audience = "development"
)

const (
	AggregatorURLFamily = "EQUORI_AGGREGATOR_<ID>_URL"
	FeedURLFamily       = "EQUORI_FEED_<ID>_URL"
)

const secretKeyExample = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="

// Variable is one entry of the configuration map (A160.1). A family entry holds <ID> in Name and
// matches every name with its prefix and suffix (A160.2).
type Variable struct {
	Name   string
	Reader Reader
	Kind   Kind
	// Schemes are the schemes a KindURL value takes.
	Schemes []string
	// Default is the literal in force while the variable is unset; "" when none.
	Default  string
	Expected string
	Example  string
	// Secret keeps the value out of the start-up report (A161.2).
	Secret bool
	// Generated marks a variable that the installation script writes into .env (A163.6).
	Generated     bool
	Audience      Audience
	Description   string
	DescriptionPT string
}

// Variables is the configuration map, in the order of the start-up report.
func Variables() []Variable {
	return []Variable{
		{
			Name: "POSTGRES_PASSWORD", Reader: Compose, Kind: KindPassword, Default: "equori",
			Expected: "letters A to Z, a to z and digits 0 to 9", Example: "Zx81Qm4TfV9pLr2KcW7sNb3HdY6jGa5E",
			Secret: true, Generated: true, Audience: Install,
			Description:   "Password of the database user of compose.yaml. PostgreSQL reads it only when it creates the pgdata volume; a later change needs the same change inside the database.",
			DescriptionPT: "Senha do usuário do banco do compose.yaml. O PostgreSQL só a lê ao criar o volume pgdata; uma troca posterior exige a mesma troca dentro do banco.",
		},
		{
			Name: "EQUORI_PORT", Reader: Compose, Kind: KindPort, Default: "8080",
			Expected: "a port from 1 to 65535", Example: "8081", Generated: true, Audience: Install,
			Description:   "Port of the host on which compose.yaml publishes equori. The installation script writes the first free port from 8080 to 8099.",
			DescriptionPT: "Porta do computador em que o compose.yaml publica o equori. O script de instalação grava a primeira porta livre de 8080 a 8099.",
		},
		{
			Name: "EQUORI_HOST_IP", Reader: Compose, Kind: KindIP, Default: "127.0.0.1",
			Expected: "an IP address", Example: "0.0.0.0", Audience: Install,
			Description:   "Address of the host on which compose.yaml publishes equori. 0.0.0.0 opens it to the network, which over plain HTTP also needs EQUORI_INSECURE_COOKIES=true (docs/operations/remote-access.md).",
			DescriptionPT: "Endereço do computador em que o compose.yaml publica o equori. 0.0.0.0 o abre para a rede, o que em HTTP sem TLS também exige EQUORI_INSECURE_COOKIES=true (docs/operations/remote-access.md).",
		},
		{
			Name: "EQUORI_COPY_FOLDER", Reader: Compose, Kind: KindPath, Default: "./copies",
			Expected: "a directory path", Example: "/mnt/backup/equori", Audience: Install,
			Description:   "Host folder that receives the encrypted copies of the backups. The container user, uid 999, writes into it.",
			DescriptionPT: "Pasta do computador que recebe as cópias criptografadas dos backups. O usuário do contêiner, uid 999, grava nela.",
		},
		{
			Name: "EQUORI_SECRET_KEY", Reader: Binary, Kind: KindKey32,
			Expected: "32 bytes in standard base64", Example: secretKeyExample,
			Secret: true, Generated: true, Audience: Install,
			Description:   "Key that seals the bank credentials, the second factor and the copy password (ADR 008); openssl rand -base64 32 writes one. Unset, the first start writes secret.key in EQUORI_DATA_DIR (compose.yaml mounts the appdata volume there); with no data directory, those features are unavailable. A new key makes the stored credentials unreadable, so a copy of .env stays apart from the backups.",
			DescriptionPT: "Chave que sela as credenciais bancárias, o segundo fator e a senha das cópias (ADR 008); openssl rand -base64 32 gera uma. Sem ela, o primeiro início grava secret.key em EQUORI_DATA_DIR (o compose.yaml monta o volume appdata ali); sem diretório de dados, esses recursos ficam indisponíveis. Uma chave nova torna ilegíveis as credenciais gravadas, então uma cópia do .env fica longe dos backups.",
		},
		{
			Name: "EQUORI_SECRET_KEY_PREVIOUS", Reader: Binary, Kind: KindKey32,
			Expected: "32 bytes in standard base64", Example: secretKeyExample, Secret: true, Audience: Install,
			Description:   "The replaced key during a rotation: set it, run equori secrets rotate, then remove it.",
			DescriptionPT: "A chave substituída durante uma rotação: defina-a, execute equori secrets rotate e depois remova-a.",
		},
		{
			Name: "EQUORI_LOG_LEVEL", Reader: Binary, Kind: KindLogLevel, Default: "info",
			Expected: "debug, info, warn or error", Example: "debug", Audience: Install,
			Description:   "Lowest level of the records equori writes.",
			DescriptionPT: "Nível mínimo dos registros que o equori grava.",
		},
		{
			Name: "EQUORI_INSECURE_COOKIES", Reader: Binary, Kind: KindBool, Default: "false",
			Expected: "true or false", Example: "true", Audience: Install,
			Description:   "true drops the Secure attribute of the session cookie, which a login over plain HTTP from another host needs (ADR 003).",
			DescriptionPT: "true remove o atributo Secure do cookie de sessão, o que um login em HTTP sem TLS a partir de outro computador exige (ADR 003).",
		},
		{
			Name: "EQUORI_DISTRIBUTION", Reader: Binary, Kind: KindText,
			Expected: "compose or empty", Example: "compose", Audience: Advanced,
			Description:   "compose.yaml sets compose, so the notice of a newer release names the upgrade command of that form (A194).",
			DescriptionPT: "O compose.yaml define compose, para que o aviso de nova versão mostre o comando de atualização dessa forma (A194).",
		},
		{
			Name: "EQUORI_API_DOCS", Reader: Binary, Kind: KindBool, Default: "false",
			Expected: "true or false", Example: "true", Audience: Install,
			Description:   "true serves the API reference at /docs and the contract at /openapi.yaml, both without a session.",
			DescriptionPT: "true serve a referência da API em /docs e o contrato em /openapi.yaml, ambos sem sessão.",
		},
		{
			Name: "EQUORI_VERSION", Reader: Compose, Kind: KindText,
			Expected: "a release version", Example: "1.0.0", Audience: Advanced,
			Description:   "Image version of compose.yaml. A release sets its own version as the default; in a clone the default is dev, which compose builds.",
			DescriptionPT: "Versão da imagem do compose.yaml. Uma versão publicada define a própria versão como padrão; num clone o padrão é dev, que o compose constrói.",
		},
		{ //nolint:gosec // G101: an example of the reference, not a credential.
			Name: "EQUORI_DATABASE_URL", Reader: Binary, Kind: KindURL, Schemes: []string{"postgres", "postgresql"},
			Expected: "a postgres:// or postgresql:// URL", Example: "postgres://equori:password@db:5432/equori?sslmode=disable",
			Secret: true, Audience: Advanced,
			Description:   "URL of a PostgreSQL 18 database (external mode); compose.yaml sets it. Unset, equori runs its own PostgreSQL server over EQUORI_DATA_DIR (managed mode).",
			DescriptionPT: "URL de um banco PostgreSQL 18 (modo externo); o compose.yaml a define. Sem ela, o equori executa o próprio servidor PostgreSQL sobre EQUORI_DATA_DIR (modo gerenciado).",
		},
		{
			Name: "EQUORI_HTTP_ADDR", Reader: Binary, Kind: KindListenAddress, Default: ":8080",
			Expected: "host:port with a port from 1 to 65535", Example: "127.0.0.1:8081", Audience: Advanced,
			Description:   "Address on which equori listens. compose.yaml keeps the container on :8080 and publishes it through EQUORI_HOST_IP and EQUORI_PORT.",
			DescriptionPT: "Endereço em que o equori escuta. O compose.yaml mantém o contêiner em :8080 e o publica por EQUORI_HOST_IP e EQUORI_PORT.",
		},
		{
			Name: "EQUORI_DATA_DIR", Reader: Binary, Kind: KindPath,
			Expected: "a directory path", Example: "/var/lib/equori", Audience: Advanced,
			Description:   "Data directory of managed mode. Unset: %ProgramData%\\equori on Windows, ~/Library/Application Support/equori on macOS, $XDG_DATA_HOME/equori or ~/.local/share/equori on Linux.",
			DescriptionPT: "Diretório de dados do modo gerenciado. Sem ela: %ProgramData%\\equori no Windows, ~/Library/Application Support/equori no macOS, $XDG_DATA_HOME/equori ou ~/.local/share/equori no Linux.",
		},
		{
			Name: "EQUORI_POSTGRES_BIN", Reader: Binary, Kind: KindPath,
			Expected: "the directory of the postgres and pg_dump programs", Example: "/usr/lib/postgresql/18/bin", Audience: Advanced,
			Description:   "Directory of the PostgreSQL 18 programs for managed mode, backups and restore. Unset: postgresql/bin beside the executable, else the directory of postgres on PATH.",
			DescriptionPT: "Diretório dos programas do PostgreSQL 18 para o modo gerenciado, os backups e a restauração. Sem ela: postgresql/bin ao lado do executável, senão o diretório do postgres no PATH.",
		},
		{
			Name: "EQUORI_BACKUP_DIR", Reader: Binary, Kind: KindPath,
			Expected: "a directory path", Example: "/backups", Audience: Advanced,
			Description:   "Directory of the automatic backups; compose.yaml sets /backups. Unset: backups in the data directory in managed mode, no automatic backup in external mode.",
			DescriptionPT: "Diretório dos backups automáticos; o compose.yaml define /backups. Sem ela: backups no diretório de dados no modo gerenciado, nenhum backup automático no modo externo.",
		},
		{
			Name: "EQUORI_COPY_DIR", Reader: Binary, Kind: KindPath,
			Expected: "a directory path", Example: "/copies", Audience: Advanced,
			Description:   "Directory of the encrypted copies in the file system of the process; compose.yaml sets /copies and mounts EQUORI_COPY_FOLDER on it.",
			DescriptionPT: "Diretório das cópias criptografadas no sistema de arquivos do processo; o compose.yaml define /copies e monta EQUORI_COPY_FOLDER nele.",
		},
		{
			Name: AggregatorURLFamily, Reader: Binary, Kind: KindURL, Schemes: []string{"http", "https"},
			Expected: "an http:// or https:// URL", Example: "https://aggregator.example", Audience: Development,
			Description:   "Base URL of the API of an aggregator, by its ID (pluggy), in place of its public address; tests and fakes set it.",
			DescriptionPT: "URL base da API de um agregador, pelo seu ID (pluggy), no lugar do endereço público; testes e simuladores a definem.",
		},
		{
			Name: FeedURLFamily, Reader: Binary, Kind: KindURL, Schemes: []string{"http", "https"},
			Expected: "an http:// or https:// URL", Example: "https://feed.example", Audience: Development,
			Description:   "Address of a price, index or expectation feed, by its ID, in place of its public address; tests and fakes set it.",
			DescriptionPT: "Endereço de uma fonte de preços, índices ou expectativas, pelo seu ID, no lugar do endereço público; testes e simuladores a definem.",
		},
		{
			Name: "EQUORI_WEB_DEV_PORT", Reader: Binary, Kind: KindPort,
			Expected: "a port from 1 to 65535", Example: "5173", Audience: Development,
			Description:   "Port of the Vite development server, to which pages redirect on the same host (ADR 028). Unset, equori serves the embedded application.",
			DescriptionPT: "Porta do servidor de desenvolvimento Vite, para a qual as páginas redirecionam no mesmo host (ADR 028). Sem ela, o equori serve a aplicação embutida.",
		},
		{
			Name: "EQUORI_DEV_DB_PORT", Reader: Tooling, Kind: KindPort, Default: "54329",
			Expected: "a port from 1 to 65535", Example: "54330", Audience: Development,
			Description:   "Host port of the development database of compose.dev.yaml (make db-up).",
			DescriptionPT: "Porta do banco de desenvolvimento do compose.dev.yaml (make db-up).",
		},
		{
			Name: "EQUORI_TEST_DB_PORT", Reader: Tooling, Kind: KindPort, Default: "54339",
			Expected: "a port from 1 to 65535", Example: "54340", Audience: Development,
			Description:   "Host port of the test database of compose.dev.yaml (make db-test-up).",
			DescriptionPT: "Porta do banco de testes do compose.dev.yaml (make db-test-up).",
		},
		{
			Name: "EQUORI_TEST_DB_SERVICE", Reader: Tooling, Kind: KindText, Default: "db-test",
			Expected: "a service of compose.dev.yaml", Example: "db-test", Audience: Development,
			Description:   "Service of compose.dev.yaml in which the backup test runs pg_dump (make test).",
			DescriptionPT: "Serviço do compose.dev.yaml em que o teste de backup executa o pg_dump (make test).",
		},
		{ //nolint:gosec // G101: an example of the reference, not a credential.
			Name: "EQUORI_TEST_DATABASE_URL", Reader: Tooling, Kind: KindURL, Schemes: []string{"postgres", "postgresql"},
			Expected: "a postgres:// or postgresql:// URL", Example: "postgres://equori:equori@127.0.0.1:54339/postgres?sslmode=disable",
			Secret: true, Audience: Development,
			Description:   "URL of the test server that the Go tests read; the Makefile sets it from EQUORI_TEST_DB_PORT.",
			DescriptionPT: "URL do servidor de testes que os testes Go leem; o Makefile a define a partir de EQUORI_TEST_DB_PORT.",
		},
		{
			Name: "EQUORI_TEST_POSTGRES_BIN", Reader: Tooling, Kind: KindPath,
			Expected: "the directory of the postgres and pg_dump programs", Example: "/usr/lib/postgresql/18/bin", Audience: Development,
			Description:   "Directory of the PostgreSQL programs for the managed-mode tests (make test-cluster).",
			DescriptionPT: "Diretório dos programas do PostgreSQL para os testes do modo gerenciado (make test-cluster).",
		},
		{
			Name: "EQUORI_DEMO_PASSWORD", Reader: Tooling, Kind: KindPassword, Default: "equori-demo-account",
			Expected: "a password", Example: "demo-password-2026", Secret: true, Audience: Development,
			Description:   "Password of the demo user of make demo.",
			DescriptionPT: "Senha do usuário de demonstração do make demo.",
		},
		{
			Name: "EQUORI_EVAL_KEY", Reader: Tooling, Kind: KindPassword,
			Expected: "an API key of the provider", Example: "eval-key", Secret: true, Audience: Development,
			Description:   "Key of the provider that the evaluation tests (build tag eval) call; only the owner sets it.",
			DescriptionPT: "Chave do provedor que os testes de avaliação (build tag eval) chamam; só o owner a define.",
		},
	}
}

func (v Variable) valid(value string) bool {
	switch v.Kind {
	case KindURL:
		u, err := url.Parse(value)

		return err == nil && u.IsAbs() && u.Host != "" && slices.Contains(v.Schemes, u.Scheme)
	case KindListenAddress:
		_, port, err := net.SplitHostPort(value)

		return err == nil && validPort(port)
	case KindPort:
		return validPort(value)
	case KindIP:
		return net.ParseIP(value) != nil
	case KindBool:
		_, err := strconv.ParseBool(value)

		return err == nil
	case KindLogLevel:
		var level slog.Level

		return level.UnmarshalText([]byte(value)) == nil
	case KindKey32:
		key, err := base64.StdEncoding.DecodeString(value)

		return err == nil && len(key) == 32
	case KindPath, KindPassword, KindText:
		return true
	}

	return false
}

func validPort(s string) bool {
	port, err := strconv.Atoi(s)

	return err == nil && port >= 1 && port <= 65535
}
