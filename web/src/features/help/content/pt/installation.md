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
