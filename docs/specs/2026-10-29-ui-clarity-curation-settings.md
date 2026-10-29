# Curadoria de clareza: configurações, cotações, calculadoras e captura

Tabela de curadoria (`2026-10-29-ui-clarity-design.md`, seção 5) de `/settings`, `/instruments`, `/calculators/*` e da captura por texto (`/transactions/capture`, `/transactions/queue`), em `43bb15a5`. Os termos transversais das curadorias anteriores já valem aqui.

## Ficam

- Configurações: os campos de idioma, região e moeda base já têm ajuda; aparência, tokens de acesso externo e provedores do assistente são áreas de quem configura a instalação e já descrevem cada controle.
- Captura por texto: rascunho, fila offline, conta padrão e parcelas já usam palavras comuns e têm descrição.
- Calculadoras: amortização, prestação, prazo, índice e alíquota são as palavras dos contratos que as calculadoras simulam.

## Mudam

| Elemento | Remédio | Critério | Proposta |
|---|---|---|---|
| "Instrumentos" (menu, página, configurações) e "instrumento" nos textos | Renomear | termo de mercado; a página lista moedas e investimentos com o preço de cada um | Cotações; moeda ou investimento; Cadastro (dados do item) |
| "Um instrumento é compartilhado por todas as contas da instância." | Renomear | termo de sistema | Uma moeda ou um investimento vale para todos os usuários desta instalação. |
| Importação de arquivo: "os fatos do arquivo" | Renomear | termo de sistema | os dados do arquivo |
| "Taxa mensal implícita", "Taxa anual implícita" | Renomear | termo de matemática financeira | Juros por mês embutidos nas parcelas; Juros por ano embutidos nas parcelas |
| "Valor presente das parcelas à taxa de comparação" | Renomear | idem | Quanto as parcelas valem hoje, pela taxa de comparação |
| "Cenário desfavorável (percentil 10)", "(mediana)", "(percentil 90)" | Renomear | termo de estatística | Cenário desfavorável: 9 em 10 simulações terminam acima; Cenário central: metade das simulações termina acima; Cenário favorável: 9 em 10 simulações terminam abaixo |
| "Equivalente mensal" | Renomear | não diz de quê | Taxa equivalente por mês |
| "Taxa tributada equivalente", "Taxa isenta equivalente" | Renomear | termo de mercado | Taxa com imposto que rende o mesmo; Taxa sem imposto que rende o mesmo |
| "Índice + spread", "Spread ao ano" | Renomear | termo de mercado | Índice + taxa adicional; Taxa adicional ao ano |

Em en: "Instruments" vira "Prices"; "security" vira "investment"; "implied rate", "present value", "percentile", "equivalent taxable/exempt rate" e "spread" saem pelos mesmos motivos.
