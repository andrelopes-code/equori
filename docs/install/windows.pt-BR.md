English: [windows.md](windows.md)

# Instalar no Windows

## Requisitos

- Windows 10 versão 1803 ou mais recente, ou Windows 11, num processador x64 ou Arm.
- Sem Docker, Subsistema do Windows para Linux, virtualização ou direitos de administrador.

## Instalação

Execute o comando num terminal PowerShell:

```powershell
irm https://github.com/andrelopes-code/equori/releases/latest/download/install.ps1 | iex
```

O comando baixa a versão, confere o SHA-256 contra o `SHA256SUMS`, extrai em `%LOCALAPPDATA%\equori`, cria o atalho "equori" no Menu Iniciar e inicia o equori. O comando mostra as etapas na ordem Verificações, Download, SHA-256, Parada, Arquivos, Atalhos e Início, e imprime o endereço e a pasta.

Duas variáveis de ambiente definidas antes do comando mudam o comportamento dele:

- `EQUORI_DIR` seleciona outra pasta: `$env:EQUORI_DIR = 'D:\equori'`.
- `EQUORI_LANG` seleciona o idioma do comando, `en` ou `pt-BR`. Sem ela, o comando usa o idioma do Windows.

A pasta `<pasta>\data` guarda o banco de dados, o `equori.env`, o `secret.key`, os backups e o log `data\log\equori.log`. Os arquivos do programa e o `data` ficam numa só pasta.

Guarde uma cópia de `<pasta>\data\secret.key` longe dos backups: sem ela, as conexões bancárias não podem ser lidas.

## Primeiro acesso

O navegador abre o endereço com o token, `http://127.0.0.1:8080` por padrão. O formulário pede email, senha, idioma, região, moeda base, nome do livro, fuso horário e a verificação de atualização. Um ícone na área de notificação (bandeja) mostra que o equori está em execução.

O equori escuta somente em `127.0.0.1`. `EQUORI_HTTP_ADDR` em `<pasta>\data\equori.env` seleciona outro endereço ([configuration.pt-BR.md](configuration.pt-BR.md)).

## Uso diário

O ícone da bandeja tem um menu:

- "Abrir equori" abre o endereço no navegador. Um clique no ícone faz o mesmo.
- "Iniciar com o Windows" é um item de marcação. Ele grava ou apaga o valor `equori` em `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`. O item começa marcado depois da primeira instalação. Configurações → Apps → Inicialização lista o mesmo valor com chave própria.
- "Sair" encerra o equori e o PostgreSQL.

A dica do ícone nomeia o endereço. O atalho "equori" do Menu Iniciar abre o equori depois de "Sair". Uma segunda partida do equori na mesma pasta abre o navegador e termina.

O `equori-cli.exe`, na pasta da instalação, executa estes comandos no PowerShell:

```powershell
cd "$env:LOCALAPPDATA\equori"
.\equori-cli.exe backup --out equori.dump
.\equori-cli.exe stop
.\equori-cli.exe restore equori.dump
.\equori-cli.exe version
```

- `backup` grava um arquivo `pg_dump`.
- `stop` encerra o equori e espera até 90 segundos.
- `restore` substitui o banco de dados por um arquivo e se recusa a rodar enquanto o equori está em execução. Execute `stop` antes e inicie o equori pelo Menu Iniciar depois.
- `version` imprime a versão instalada.

## Atualização

Execute o comando de instalação de novo. O comando encerra o equori em execução, substitui os arquivos do programa e mantém o `data`. O `serve` faz backup dos dados antes de migrar (ADR 022, B3). O estado de "Iniciar com o Windows" permanece como estava.

Quando a versão instalada é igual à da versão publicada, o comando imprime "O equori {v} já está instalado em {dir}." e termina. A chave `-Reinstall` executa a instalação de novo e repara uma pasta:

```powershell
& ([scriptblock]::Create((irm https://github.com/andrelopes-code/equori/releases/latest/download/install.ps1))) -Reinstall
```

## Remoção

Configurações → Apps → equori executa `install.ps1 -Uninstall` a partir da pasta da instalação. O comando encerra o equori, remove os arquivos do programa, o atalho, o valor Run e a entrada de Configurações → Apps, e pergunta:

```text
Apagar os dados em <pasta>\data, backups incluídos? [s/N]
```

A resposta padrão é Não: os dados continuam em `<pasta>\data`. Uma instalação posterior na mesma pasta os encontra.

A mesma remoção roda pelo PowerShell, com `-Yes` para apagar os dados sem perguntar ou `-KeepData` para mantê-los sem perguntar:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\equori\install.ps1" -Uninstall -KeepData
```

Quando um programa mantém aberto um arquivo da pasta, o comando lista até cinco caminhos e termina com código de saída 1. Feche os programas que os usam e execute a remoção de novo.

## Limites

- Controle Inteligente de Aplicativos: com ele ligado, o Windows bloqueia o `equori.exe` porque a versão não tem assinatura digital. O comando para em [w5](#w5-smart-app-control-ligado). Desligar o Controle Inteligente de Aplicativos é a única forma de executar o equori.
- SmartScreen: o comando não mostra a tela do SmartScreen. A tela aparece quando um navegador baixa o zip da versão no lugar do comando.

## Solução de problemas

Cada entrada cita o erro impresso pelo comando de instalação e traz a solução. Toda parada do comando termina com a linha `Como resolver: <url>` que aponta para a entrada. `{dir}`, `{url}`, `{port}`, `{process}`, `{ver}`, `{arch}` e `{error}` representam valores que o comando imprime.

### w1 Windows antigo

Erro: "O equori precisa do Windows 10 versão 1803 ou mais recente; este computador usa {ver}."

Como resolver: Atualize o Windows e execute o comando de novo.

### w2 Processador sem suporte

Erro: "O equori roda em processadores x64 e Arm; este computador informa {arch}."

Como resolver: Use um computador com processador x64 ou Arm.

### w3 Pasta sem escrita

Erro: "{dir} não aceita arquivos novos."

Como resolver: Defina $env:EQUORI_DIR com outra pasta e execute o comando de novo.

### w4 Porta em uso

Erro: "A porta {port} está em uso por {process}."

Como resolver: Feche esse programa ou defina EQUORI_HTTP_ADDR=127.0.0.1:8081 em {dir}\data\equori.env e execute o comando de novo.

### w5 Smart App Control ligado

Erro: "O Controle Inteligente de Aplicativos está ligado: o Windows bloqueia programas sem assinatura digital, e o equori não tem."

Como resolver: Desligue-o em Segurança do Windows → Controle de aplicativos e do navegador → Controle Inteligente de Aplicativos e execute o comando de novo. Religá-lo pode exigir a redefinição do Windows.

### w6 Download falhou

Erro: "O download de {url} falhou após 3 tentativas: {error}."

Como resolver: Verifique a conexão com a internet e execute o comando de novo.

### w7 Checksum diferente

Erro: "O arquivo baixado não confere com o SHA256SUMS do release."

Como resolver: Execute o comando de novo; se repetir, relate em github.com/andrelopes-code/equori/issues.

<a id="w8-equori-nao-para"></a>

### w8 equori não para

Erro: "O equori em execução não parou em 90 segundos."

Como resolver: Saia do equori pelo ícone na bandeja e execute o comando de novo.

<a id="w9-equori-nao-inicia"></a>

### w9 equori não inicia

Erro: "O equori não respondeu em {url}healthz em 120 segundos; as últimas linhas do log estão acima."

Como resolver: Leia {dir}\data\log\equori.log; ele nomeia a causa.

## Compose para quem usa Docker

O comando das seções anteriores não executa o Docker Compose. Esta seção é a forma manual para quem executa o equori com Docker. O Linux usa os mesmos arquivos por [linux.pt-BR.md](linux.pt-BR.md).

### Requisitos do compose

- Subsistema do Windows para Linux: execute `wsl --install` num terminal aberto como administrador e reinicie o Windows (<https://learn.microsoft.com/windows/wsl/install>).
- Docker Desktop com "Use the WSL 2 based engine" ativado (<https://docs.docker.com/desktop/setup/install/windows-install/>).

### Instalação com compose

1. Baixe `compose.yaml` e `env.example` da versão para um diretório de instalação: <https://github.com/andrelopes-code/equori/releases/latest/download/compose.yaml> e <https://github.com/andrelopes-code/equori/releases/latest/download/env.example>.
2. Grave o `.env` como nos passos 2 a 5 de I5, com uma senha nova em `POSTGRES_PASSWORD`.
3. Execute `docker compose up -d` no diretório de instalação.

Guarde uma cópia do `.env` longe dos backups: ele contém a chave secreta, sem a qual as conexões bancárias não podem ser lidas.

### Primeiro acesso com compose

O navegador abre `http://127.0.0.1:8080`. O formulário pede os mesmos campos da forma nativa.

### Atualização com compose

Substitua o `compose.yaml` pelo arquivo da nova versão e execute `docker compose pull` e `docker compose up -d`. O `serve` faz backup dos dados antes de migrar (ADR 022, B3).

Uma alteração nos serviços vai em `compose.override.yaml`, na pasta da instalação: o Docker Compose aplica esse arquivo sobre o `compose.yaml`.

### Voltar à versão anterior com compose

No diretório de instalação:

1. Substitua o `compose.yaml` pelo arquivo da versão anterior, com `<version>` trocado pelo número dela, como `1.0.0`, e execute `docker compose up -d`.

```powershell
curl.exe -fsSLo compose.yaml https://github.com/andrelopes-code/equori/releases/download/v<version>/compose.yaml
docker compose up -d
```

2. Quando o equori não responde e as linhas do log trazem "database schema is newer than this binary", a atualização migrou o banco, e a versão anterior o recusa (ADR 022, V4). A linha também diz "this binary knows up to <N>". Liste os backups e escolha o `pre-migration-<data>-s<N>.dump` mais recente com esse `<N>`:

```powershell
docker compose run --rm --no-deps --entrypoint ls app /backups
```

3. Restaure-o, com `<file>` trocado pelo nome dele. Os dados voltam ao momento anterior à atualização.

```powershell
docker compose stop app
docker compose cp app:/backups/<file> .
docker compose cp <file> db:/tmp/restore.dump
docker compose exec -T db dropdb -U equori --force equori
docker compose exec -T db createdb --template=template0 --locale-provider=builtin --builtin-locale=C.UTF-8 -U equori equori
docker compose exec -T db pg_restore -U equori --no-owner --exit-on-error -d equori /tmp/restore.dump
docker compose start app
```

### Iniciar e parar com compose

No diretório de instalação:

```sh
docker compose stop
docker compose start
```

### Remoção com compose

- `docker compose down` mantém os dados.
- `docker compose down -v` apaga o banco de dados e o volume dos backups.

### Solução de problemas do compose

Cada entrada cita uma mensagem impressa pelo comando de instalação do compose (`install.sh` no Linux) ou pelo equori e traz a correção.

#### I1 Docker ausente

Mensagem: "O Docker não está instalado ou não está no PATH. Instale o Docker e execute este comando de novo."

Correção: Instale o Docker como em Requisitos do compose e execute o comando de instalação de novo.

#### I2 Docker sem resposta

Mensagem: "O Docker não responde. Abra o Docker Desktop ou, no Linux, inicie o serviço docker e inclua o usuário no grupo docker."

Correção: Abra o Docker Desktop ou, no Linux, inicie o serviço docker e inclua o usuário no grupo `docker`. Depois execute o comando de instalação de novo.

#### I3 Docker Compose v2 ausente

Mensagem: "O Docker Compose v2 está ausente: docker compose version falha. Instale o plugin Compose."

Correção: Instale o plugin Compose até `docker compose version` funcionar e execute o comando de instalação de novo.

#### I4 Docker sem WSL 2

Mensagem sem `wsl.exe`: "O Subsistema do Windows para Linux está ausente. Execute wsl --install num terminal aberto como administrador, reinicie o Windows e execute este comando de novo."

Mensagem com `wsl.exe`: "O Docker Desktop não usa o motor WSL 2. Ative Settings > General > "Use the WSL 2 based engine" e execute este comando de novo."

Correção: Sem `wsl.exe`, execute `wsl --install` num terminal aberto como administrador e reinicie o Windows. Senão, ative Settings > General > "Use the WSL 2 based engine" no Docker Desktop. Depois execute o comando de instalação de novo.

#### I5 compose.yaml sem .env

Mensagem: "<dir> tem compose.yaml sem .env: uma instalação feita sem este script. Grave o .env com a senha do banco dessa instalação; o guia mostra como."

Passos:

1. Baixe o `env.example` da versão para o diretório de instalação: <https://github.com/andrelopes-code/equori/releases/latest/download/env.example>.
2. Copie-o para `.env`.
3. Defina `POSTGRES_PASSWORD` com a senha do comando anterior: `change-me` no README anterior, `equori` sem ele.
4. Defina `EQUORI_SECRET_KEY` com a saída de `docker run --rm alpine sh -c 'head -c 32 /dev/urandom | base64'`.
5. Defina `EQUORI_PORT=8080`.
6. Execute o comando de instalação de novo.

#### I6 Falha no download

Mensagem: "O download de <url> falhou. Verifique a conexão com a internet e execute este comando de novo."

Correção: Verifique a conexão com a internet e execute o comando de instalação de novo.

#### I7 Nenhuma porta livre

Mensagem: "As portas 8080 a 8099 estão todas em uso. Encerre um programa que use uma delas e execute este comando de novo."

Correção: Encerre um programa que use uma das portas 8080 a 8099 e execute o comando de instalação de novo.

#### I8 equori sem resposta

Mensagem: "O equori não respondeu em http://127.0.0.1:<port>/healthz em 180 segundos; as últimas linhas do log estão acima."

Correção: Leia as linhas do log impressas acima da mensagem. `docker compose logs app` no diretório de instalação as imprime de novo.

#### C1 Configuração inválida

Mensagem: `invalid configuration (docs/install/configuration.md):`

Correção: Corrija as linhas do `.env` que o relatório nomeia e execute `docker compose up -d`. [configuration.pt-BR.md](configuration.pt-BR.md) lista todas as variáveis.

#### C2 Variável desconhecida

Mensagem: `environment variable unknown`

Correção: O log nomeia uma variável que o equori não lê. Corrija o nome no `.env`.

#### C3 Banco inacessível

Mensagem: `cannot connect to the database of EQUORI_DATABASE_URL`

Correção: Execute `docker compose ps db` para verificar o serviço do banco. Um `POSTGRES_PASSWORD` alterado depois do primeiro início não altera a senha guardada no banco (ADR 022, B5).

#### C4 Porta em uso

Mensagem: `EQUORI_HTTP_ADDR`

Correção: A mensagem termina com "expected a free host:port". Com o compose, `EQUORI_PORT` no `.env` seleciona a porta; defina uma livre e execute `docker compose up -d`.

#### C5 Chave secreta ausente

Mensagem: `EQUORI_SECRET_KEY is not set: bank connections, the second factor and the copy password are unavailable`

Correção: Uma instalação anterior ao P14 não tem a chave. Acrescente `EQUORI_SECRET_KEY` ao `.env` como em I5 e execute `docker compose up -d`.
