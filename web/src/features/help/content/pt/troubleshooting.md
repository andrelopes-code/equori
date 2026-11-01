# Solução de problemas

Cada entrada nomeia um sintoma como a tela o mostra. Em seguida traz a causa, os passos e a página com mais detalhes.

## Uma conexão aparece como Parada

O banco não envia dados novos há algumas horas. [Vínculos](/accounts/links) mostra quantas.

1. Sincronize de novo. Escolha **Sincronizar agora** na aba **Sincronização** de uma conta da conexão.
2. Se o estado continuar, confira a conexão no site do agregador que a tela indica.

Mais: [Conectar um banco](/help/connect-bank).

## Uma conexão aparece como Consentimento a vencer

A permissão dada ao agregador termina na data que [Vínculos](/accounts/links) mostra. Depois dessa data, a sincronização para.

1. Renove o consentimento no site do agregador que a tela indica.
2. Sincronize de novo.

Mais: [Conectar um banco](/help/connect-bank).

## O saldo difere do da instituição

A comparação achou uma diferença. Falta uma transação, um rendimento não foi registrado ou uma transação está duplicada.

1. Abra a conta e a aba **Conferência de saldo**.
2. Registre as transações que faltam e escolha **Já registrei o que faltava**.
3. Para um rendimento, escolha **Registrar rendimento**. Para uma diferença sem explicação, escolha **Registrar ajuste**.

Mais: [Conferir o saldo de uma conta](/help/check-balance).

## O valor de uma fatura difere do da instituição

A instituição pode ter cobrado uma compra feita perto do fechamento na fatura seguinte.

1. Abra a fatura em [Cartões](/cards).
2. Leia as compras que a tela sugere mover e mova as que a instituição cobrou depois.
3. Se os totais continuarem diferentes, escolha **Dados da instituição** e registre o total que a instituição informa.

Mais: [A tela da fatura](/help/statement).

## Uma transação aparece duas vezes

Uma linha de extrato virou uma nova transação, enquanto a mesma compra já estava registrada à mão.

1. Abra a importação que contém a linha.
2. Anule ou corrija uma das duas transações.

Importar o mesmo arquivo duas vezes não duplica nada. Mais: [Importar um extrato](/help/import-statement).

## Uma transação não aparece

Três causas são comuns:

- A data é anterior à data em que a conta **Importa a partir de**. Linhas anteriores a esse dia não são importadas.
- A linha está **Descartada** na importação.
- A conexão aparece como **Parada**.

Escolha **Trocar data inicial** na aba **Sincronização** para importar linhas anteriores. Confira a situação da linha na importação. Mais: [Importar um extrato](/help/import-statement).

## O acesso recusa o código do segundo fator

O app autenticador ou a chave de acesso não está à mão.

1. Na tela de acesso, escolha **Usar um código de recuperação**.
2. Informe um **Código de recuperação**. Cada código vale uma vez.
3. Em [Configurações](/settings), painel **Segurança**, escolha **Gerar novos códigos**. Os códigos atuais deixam de valer.

## O último backup diário tem mais de 48 horas

O painel **Backup** de [Configurações](/settings) mostra esta mensagem quando o último backup diário está atrasado.

1. Escolha **Fazer backup agora**.
2. Se o backup falhar, leia o log do servidor. No diretório de instalação, `docker compose logs app` o imprime.

Quando o painel diz "Os backups automáticos estão desligados", defina `EQUORI_BACKUP_DIR` no `.env`. Mais: [Instalar e manter o equori](/help/installation).

## A cópia criptografada está atrasada

O painel **Backup** de [Configurações](/settings) indica a causa:

- "Sem senha de cópia. Defina uma abaixo.": digite uma **Nova senha da cópia** de no mínimo 12 caracteres, repita-a e escolha **Salvar senha**.
- "Não foi possível gravar na pasta de cópia.": no diretório de instalação, execute `mkdir -p copies && sudo chown 999:999 copies`.
- "A última cópia falhou.": leia o log do servidor com `docker compose logs app`.

O próximo backup grava uma nova cópia. Mais: [Instalar e manter o equori](/help/installation).

## O equori não abre no navegador

O comando de instalação imprime o endereço no fim. Enquanto não existe usuário, executar o comando de novo imprime o endereço de novo.

O comando pode parar com "O equori não respondeu em http://127.0.0.1:<port>/healthz em 180 segundos". Leia as linhas do log impressas acima. No diretório de instalação, `docker compose logs app` as imprime de novo.

O guia do sistema lista todas as mensagens da instalação, na seção Solução de problemas. Mais: [Instalar e manter o equori](/help/installation).
