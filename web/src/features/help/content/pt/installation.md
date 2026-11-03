# Instalar e manter o equori

Esta página trata dos arquivos de uma instalação feita com Docker Compose. Trata também dos comandos para atualizar, parar, iniciar e remover. O guia de cada sistema traz a primeira instalação.

## O diretório da instalação

O comando de instalação grava `compose.yaml`, `env.example`, `.env` e a pasta `copies` num só diretório. No Linux o diretório é `~/equori`. O comando o imprime no fim: "O equori está instalado em <dir>."

Todo comando desta página roda dentro desse diretório.

## Guarde uma cópia do arquivo .env

O arquivo `.env` contém a chave secreta. Sem a chave, o equori não consegue ler as conexões bancárias.

Guarde uma cópia do `.env` longe dos backups. O backup não contém a chave secreta.

## Atualizar

Execute o comando de instalação de novo. Ele instala a última versão. Antes de migrar os dados, o equori faz um backup.

## Voltar à versão anterior

No diretório de instalação:

1. Execute o comando de instalação da versão anterior, com `<version>` trocado pelo número dela, como `1.0.0`. Quando ele termina com o endereço, o equori está de volta nessa versão.

```sh
curl -fsSL https://github.com/andrelopes-code/equori/releases/download/v<version>/install.sh | sh
```

No Windows, no PowerShell:

```powershell
irm https://github.com/andrelopes-code/equori/releases/download/v<version>/install.ps1 | iex
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

```sh
docker compose stop
docker compose start
```

## Onde ficam os backups e as cópias

Os backups automáticos ficam no volume `backups`. As cópias criptografadas ficam na pasta `copies`, ao lado do `compose.yaml`. A variável `EQUORI_COPY_FOLDER` no `.env` escolhe outra pasta.

Veja as datas e defina a senha da cópia em [Configurações](/settings), no painel **Backup**. Quando um backup ou uma cópia está atrasado, veja [Solução de problemas](/help/troubleshooting).

## Remover o equori

- `docker compose down` mantém os dados.
- `docker compose down -v` também apaga o banco de dados e o volume dos backups.

## Uma nova instalação

A primeira instalação segue o guia do sistema:

- [Linux](https://github.com/andrelopes-code/equori/blob/main/docs/install/linux.pt-BR.md)
- [macOS](https://github.com/andrelopes-code/equori/blob/main/docs/install/macos.pt-BR.md)
- [Windows](https://github.com/andrelopes-code/equori/blob/main/docs/install/windows.pt-BR.md)
