# Importar um extrato

O extrato é o arquivo que o banco ou o cartão oferece para baixar. O equori lê arquivos **OFX** e **CSV** de até 10 MB.

## Enviar o arquivo

1. Abra a conta em [Contas](/accounts).
2. Escolha **Importar extrato** e selecione o arquivo.
3. Para um CSV, diga como ele é lido: o separador, quantas linhas de cabeçalho ele tem, o formato da data e quais colunas trazem a data, a descrição e o valor. As primeiras linhas aparecem como serão lidas, para conferir antes de importar.
4. Escolha **Importar**.

Linhas que já vieram numa importação anterior são reconhecidas e ignoradas. Importar o mesmo arquivo duas vezes não duplica nada.

## O que acontece com cada linha

A página da importação mostra a situação de cada linha:

- **Associada**: a linha é uma transação que você já tinha registrado. Nada novo foi criado.
- **Criada**: a linha virou uma transação nova, ainda sem categoria.
- **Para revisar**: a linha se parece com uma ou mais transações, mas não o bastante para decidir sozinha.
- **Descartada**: você decidiu deixar a linha fora dos seus registros.

## Revisar uma linha

Escolha a linha para ver as **transações parecidas**, cada uma com uma pontuação. A pontuação soma pontos pela data, pelo valor e pelo favorecido parecidos.

- **É esta transação** associa a linha à transação escolhida.
- **Criar uma nova transação** registra a linha como transação nova.
- **Descartar a linha** deixa a linha de fora.

Quando o arquivo traz o saldo da conta, ele é registrado como saldo da instituição e serve para a [conferência de saldo](/help/check-balance).
