# Conectar um banco

Uma conexão bancária traz as contas e as transações de uma instituição sem arquivo. Um agregador, serviço externo, lê a instituição e envia os dados ao equori.

## Cadastrar as credenciais

A pessoa que administra a instalação faz isso uma vez.

1. Abra [Configurações](/settings) e escolha **Integrações**.
2. Escolha **Adicionar integração**.
3. Escolha o **Agregador**, dê um **Nome** e informe as credenciais que o agregador fornece.
4. Escolha **Criar**.

O equori guarda as credenciais cifradas e nunca as mostra de novo. Para trocá-las, escolha **Trocar credenciais**.

## Vincular cada conta

As conexões são criadas nas configurações, e as contas delas aparecem em [Vínculos](/accounts/links). Cada conta aguarda um vínculo: a sua conta no equori que recebe as transações dela.

1. Em [Vínculos](/accounts/links), encontre a conta marcada com **Aguarda vínculo**.
2. Escolha **Vincular**.
3. Escolha a sua conta, ou crie uma. O campo **Importa a partir de** define a primeira data importada.
4. Escolha **Vincular e sincronizar**.

Escolha **Ignorar** para uma conta que você não quer acompanhar.

## Ler o resumo de uma sincronização

Cada sincronização aparece em **Sincronizações recentes**, com uma linha por conta vinculada. A linha conta as linhas criadas, associadas, para revisar, alteradas e retiradas. A linha diz "sem alterações" quando a conta já estava em dia.

As linhas para revisar aguardam na importação, como em [Importar um extrato](/help/import-statement).

## Quando uma conexão para

O estado de uma conexão aparece em [Vínculos](/accounts/links):

- **Parada**: o banco não envia dados novos há algumas horas.
- **Consentimento a vencer**: a permissão dada ao agregador vence na data mostrada.
- **Precisa de você**: o agregador aguarda uma ação que só o titular pode fazer.

Cada estado indica o site do agregador onde a ação é feita. [Solução de problemas](/help/troubleshooting) lista os passos. Para a ideia por trás dessas telas, leia [Conexões bancárias](/help/bank-connections).
