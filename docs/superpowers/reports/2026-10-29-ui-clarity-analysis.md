# Clareza da interface: diagnóstico e proposta de ajuda e documentação

Análise do estado de `web/` em `21fadbc8`. Fontes: catálogo pt-BR (2 882 textos de uma linha), 420 componentes de `web/src/features`, as regras de `docs/contributing/forms.md` e a documentação da Slotted instalada (`0.1.0-beta.27`).

## 1. Números

| Medida | Valor |
|---|---|
| Campos de formulário com `FieldLabel` | 203 |
| Campos com `FieldDescription` (frase sob o controle) | 48 |
| Campos com ajuda de termo (`help=`, `FieldHelp`) | 18 |
| Cabeçalhos de coluna de `Table` | 207 |
| Cabeçalhos de coluna com explicação | 0 |
| Colunas de `DataGrid` (instrumentos, transações) | 16, nenhuma com `description` ou `help` |
| Usos de `Tooltip`, `HoverCard` e `Tour` | 0 |
| Cabeçalhos de página (`PageHeaderHeading`) | 34, dos quais 26 com subtítulo |
| Documentação para quem usa o app | nenhuma; `docs/operations` atende quem instala, `docs/domain` atende quem desenvolve |

Cobertura de descrição por módulo (rótulos / descrições):

| Módulo | Rótulos | Descrições |
|---|---|---|
| accounts | 33 | 11 |
| transactions | 40 | 9 |
| cards | 29 | 7 |
| planning | 28 | 3 |
| instruments | 20 | 4 |
| setup | 16 | 6 |
| calculators | 12 | 6 |
| categories | 10 | 0 |
| goals | 6 | 0 |
| portfolio | 2 | 0 |

A regra F8 de `docs/contributing/forms.md` já exige `FieldHelp` em todo rótulo que seja termo de contabilidade, banco ou investimento. A regra existe; a aplicação cobre 18 campos.

## 2. Achados

### 2.1 O modelo contábil aparece na tela

O ledger usa partidas dobradas (`docs/domain/02-ubiquitous-language.md`): toda transação é um conjunto de lançamentos que somam zero. Esse modelo é interno. A tela o expõe sem explicação:

- Detalhe da transação: tabela "Lançamentos da transação" com as colunas Conta, Valor, Situação, Liquidado em, Memo.
- Situação de lançamento: "Pendente" e "Compensado", sem definição de cada estado.
- Extrato de conta: colunas "Contrapartida" e "Saldo após".
- Categorias e relatórios: "Próprio" e "Direto" como nomes de coluna.
- Conexões: "Conta do livro que ela alimenta", "Aguarda vínculo".

A mesma ação tem dois nomes: o menu lateral e a paleta de comandos escrevem "Novo lançamento" (`nav.entry.long`); o cabeçalho da página e o dock do telefone escrevem "Nova transação" (`nav.new`).

### 2.2 Termos por área sem definição na tela

| Área | Termos |
|---|---|
| Investimentos | Custo médio, Custo, Resultado não realizado, Resultados realizados, Participação, Classe fiscal, Tratamento fiscal, Retido, Valor de face, Contagem de dias, Spread anual, Percentual do índice |
| Cartões | Faturado, Comprometido, A faturar, Fatura provisória, Financiada, Valor estornado, "Uma compra no dia do fechamento entra", Fechamento em dia não útil |
| Importação e conciliação | Reconciliação, Critério, Encontrado, Pontos, Saldo do extrato, Separador, Linhas de cabeçalho; estados de lote Recebida, Conciliada, Criada, Retirada |
| Instituições | Esquema, Identificador, Entrada do catálogo |
| Planejamento | Tolerância de conciliação (%), Dias de carência, Calendário de dias úteis, Vigente a partir de, Da base, Sugerido |
| Configuração | Capacidades do modelo, Fonte instalada, Agregador, Tokens por dia, Endereço da API, Moeda base, Região |
| Calculadoras | Cenário desfavorável (percentil 10), Taxa tributada equivalente, Taxa mensal implícita, Valor presente das parcelas à taxa de comparação |

### 2.3 Estados sem legenda

Colunas "Situação" e etiquetas de estado listam valores sem dizer o que cada um significa nem o que fazer a seguir: fatura Aberta, Fechada, Paga em parte, Vencida, Financiada; conexão "Precisa de você"; lote "Para revisar".

### 2.4 Telas sem propósito declarado

8 dos 34 cabeçalhos de página não têm subtítulo. Entre os que têm, alguns trazem um número no lugar do propósito: Metas escreve "{count} metas"; Patrimônio escreve o valor do patrimônio líquido.

### 2.5 Exemplo que já funciona

O seletor de tipo de conta descreve cada opção em uma frase de leigo (`kind.hint.*`: "Cartão de refeição, alimentação ou transporte.", "Dinheiro que alguém deve a você."). Esse é o padrão de texto a seguir.

## 3. Referências

- Ajuda não substitui um rótulo claro. Uma dica flutuante não carrega informação necessária para concluir a tarefa, e boa parte dos usos de dica desaparece com rótulos melhores ([NN/g, Tooltip Guidelines](https://nngroup.com/articles/tooltip-guidelines)).
- Ajuda puxada pela pessoa supera ajuda empurrada. Tours de abertura interrompem, não melhoram o desempenho na tarefa e são esquecidos; a ajuda contextual exige um gatilho discreto ([resumo do estudo NN/g em HeyDesigner](https://heydesigner.com/newsletter/daily-issues/2023-45/)).
- Documentação em quatro tipos, cada um com uma necessidade: tutorial (aprender), guia de tarefa (resolver), referência (consultar), explicação (entender). Adotado pela Canonical e outros projetos ([Diátaxis na Canonical](https://ubuntu.com/blog/diataxis-a-new-foundation-for-canonical-documentation)).
- Actual Budget, gerenciador financeiro auto-hospedado, mantém a documentação de uso em [actualbudget.org/docs](https://actualbudget.org/docs/), organizada por função (orçamento, regras, agendamentos, transações, relatórios, backup).

## 4. Proposta em camadas

Cada camada depende da anterior. A ordem vai do que remove a dúvida ao que a explica.

### Camada 0: vocabulário

Um glossário de uso, separado do glossário de domínio, é a fonte única dos termos na tela. Cada entrada: termo exibido, definição em até duas frases para leigo, um exemplo. Política:

1. Onde existe palavra comum com o mesmo sentido, o rótulo troca para ela.
2. Onde o termo é necessário (Custo médio, Fatura), o rótulo fica e recebe ajuda.
3. Um conceito, um nome: "lançamento" deixa de nomear a ação de criar transação.

A definição de um termo regional (um identificador de banco, um imposto) vive na implementação da região, conforme ADR 016.

### Camada 1: ajuda no lugar da pergunta

A ajuda é escolhida por triagem de cada tela (seção 5), nunca adicionada em lote. Onde a triagem indicar ajuda:

- Campo: termo → `FieldHelp`; consequência da resposta → `FieldDescription` (F8).
- Coluna: `DataGrid` já aceita `description` e `help` por coluna. `Table` não oferece ajuda no cabeçalho; essa falta é um achado da Slotted (área `family`).
- Estado: a etiqueta leva a definição do estado e a próxima ação.
- Número de resumo (cartões de figura da visão geral, do cartão, da carteira): uma linha que diz o que o número soma. `StatCard` não oferece ajuda; segundo achado candidato da Slotted.

### Camada 2: ajuda da tela

Cada página tem um botão "Sobre esta tela" no cabeçalho. Ele abre uma gaveta com: para que serve a tela, o que significa cada seção e coluna, as tarefas comuns, e o link para a página correspondente da documentação. O conteúdo vem dos mesmos arquivos da Camada 4, indexados pela rota.

### Camada 3: primeiros passos

Uma lista de primeiros passos na visão geral, visível até ser concluída ou dispensada: criar a primeira conta, importar um extrato, categorizar, criar um agendamento. Cada item abre a tela da tarefa. Tour guiado só sob demanda, nas telas de fluxo com várias etapas (importação, fatura), por um botão "Mostrar como funciona"; nunca abre sozinho.

### Camada 4: documentação de uso

Arquivos Markdown em pt-BR e en, no repositório, organizados por Diátaxis:

| Tipo | Conteúdo inicial |
|---|---|
| Tutorial | O primeiro mês no equori, do cadastro da conta ao primeiro relatório |
| Guia de tarefa | Importar um extrato; pagar uma fatura; registrar uma compra parcelada; conciliar um saldo; criar uma regra de categoria |
| Referência | Uma página por tela (seções, colunas, campos, estados); o glossário de uso |
| Explicação | Como o equori registra dinheiro (partidas dobradas em linguagem leiga); como a fatura é calculada; o que é conciliação |

Os mesmos arquivos são embutidos no binário e servidos em `/help` dentro do app, o que funciona sem internet numa instalação auto-hospedada. Um site público gerado dos mesmos arquivos é opcional e posterior.

### Camada 5: assistente

O módulo `assistant` responde perguntas sobre os dados. Uma ferramenta de consulta ao glossário e à documentação permite perguntas como "o que é custo médio" no chat, com a resposta citando a página de ajuda.

## 5. Triagem e redação

Texto de ajuda em excesso tem custo: cada ícone de ajuda disputa atenção com o campo, e uma ajuda que repete o rótulo ensina a pessoa a ignorar todas as outras. A ajuda entra só onde a triagem a justifica.

### 5.1 Ordem de remédio

Para cada campo, coluna ou estado que gera dúvida, o primeiro remédio aplicável encerra a triagem:

1. Remover: o campo ou a coluna não é necessário para a tarefa da tela, ou tem valor padrão que serve à maioria.
2. Renomear: existe palavra comum com o mesmo sentido.
3. Reestruturar: um controle diferente torna a resposta óbvia (opções nomeadas no lugar de um número, um exemplo no próprio controle, a pergunta reescrita).
4. Descrever: a dúvida é sobre o formato ou a consequência da resposta → `FieldDescription`.
5. Definir: a dúvida é sobre o significado de um termo que precisa ficar → `FieldHelp`.

### 5.2 Critérios para definir um termo

Um rótulo recebe `FieldHelp` quando atende a pelo menos um critério:

- O termo tem sentido técnico desconhecido de quem não trabalha com finanças (Custo médio, Valor de face).
- O termo tem sentido técnico diferente do sentido comum (Resultado, Situação, Compensado).
- Dois campos da mesma tela podem ser confundidos (Tarifa ao lado de Imposto).

Não recebem ajuda os rótulos que qualquer leitor entende: Data, Valor, Descrição, Nome, Categoria, Conta, Cor, Moeda.

Uma tela em que mais da metade dos campos atende aos critérios volta ao passo 2 ou 3 da ordem de remédio: o problema é o desenho da tela, não a falta de ajuda.

### 5.3 Redação

- Uma definição tem até duas frases. A primeira diz o que é; a segunda, quando existir, dá um exemplo com números.
- A definição não repete o rótulo e não usa outro termo que também precisaria de definição.
- Uma descrição tem uma linha (cerca de 90 caracteres na tradução mais longa, F8).
- Um termo tem uma definição só, no glossário de uso; toda tela que mostra o termo usa a mesma chave do catálogo.
- O texto em pt-BR e o texto em en são escritos cada um na sua língua, sem tradução literal.

### 5.4 Processo por tela

1. A triagem da tela produz uma tabela: elemento, remédio escolhido (5.1), critério atendido (5.2), texto proposto.
2. O dono revisa e aprova a tabela antes de qualquer alteração de código.
3. A implementação aplica só o que a tabela aprovada lista.

A ordem das telas segue o uso: transações, contas, cartões, visão geral, depois as demais.

### 5.5 Verificação

- Um teste falha quando uma rota de `router.tsx` não tem página de referência em pt-BR e en.
- `review-screen` e a revisão de PR conferem, em toda tela nova, a tabela de triagem e a Camada 2.

## 6. Decisões pendentes do dono

1. Política de vocabulário: trocar rótulos por palavras comuns onde existirem (Camada 0, item 1), ou manter os rótulos e só explicar.
2. Lugar da documentação: só dentro do app (`/help`), ou também um site público.
3. Tour guiado sob demanda nas telas de várias etapas, ou só lista de primeiros passos e ajuda contextual.
4. Abrir agora os dois achados candidatos da Slotted (ajuda em cabeçalho de `Table`; ajuda em `StatCard`).
