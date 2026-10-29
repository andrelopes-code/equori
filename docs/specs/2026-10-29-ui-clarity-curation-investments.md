# Curadoria de clareza: investimentos e relatórios

Tabela de curadoria (`2026-10-29-ui-clarity-design.md`, seção 5) de `/instruments`, `/portfolio`, `/portfolio/year`, `/reports` e dos formulários de compra ou venda, rendimento, câmbio e compra no exterior, em `a61001c7`. Os termos transversais das curadorias anteriores se aplicam.

Quem usa estas telas investe; termos que toda corretora mostra ficam: custo médio, posição, cotação, bolsa, valor de face, spread, índice. Classe fiscal e tratamento fiscal ficam: os valores vêm da jurisdição da região (ADR 016).

| Elemento | Remédio | Critério | Proposta |
|---|---|---|---|
| "Ativo" (coluna, agrupamento, ano fiscal) e "ativos" em textos | Renomear | termo de mercado; "ativo" também é o oposto de "inativo" na mesma tela de cartões | Investimento |
| "Resultado não realizado" | Renomear | termo de contabilidade | Lucro ou prejuízo atual |
| "Resultados realizados" (aba e título do ano) | Renomear | termo de contabilidade | Lucro ou prejuízo nas vendas |
| "Participação" | Renomear | não diz de quê | % da carteira |
| "Conta de caixa" (compra ou venda, rendimento, fatos) | Renomear | termo de contabilidade | Conta que paga ou recebe; Conta que pagou ou recebeu |
| "Efeito no caixa" | Renomear | idem | Quanto sai ou entra na conta |
| "Preço armazenado" | Renomear | termo de sistema | Preço registrado |
| "Taxa efetiva" (câmbio) | Renomear | "taxa" se confunde com tarifa | Cotação da operação |
| "Outra moeda (código ISO 4217)" | Renomear | nome de norma | Outra moeda (código de 3 letras). Um exemplo de código seria valor regional |
| "A apropriação de preços depende deles", "preços apropriados" | Renomear | termo de contabilidade | Sem eles, o preço do título não é calculado dia a dia; preços calculados |
| "…para todas as contas da instância" | Renomear | termo de sistema | …para todos os usuários desta instalação |
| Relatórios: "Ativos", "Passivos", "visão de caixa", "Nada lançado", coluna "Lançamentos", "Fluxos" | Renomear | termos transversais | Você tem; Você deve; pelo dinheiro que de fato entrou e saiu; Nada registrado; Transações; Entradas e saídas |

"Encargo de compra internacional (pontos-base)" fica: a ajuda do campo já define o ponto-base.

## Varredura dos termos transversais

Os termos transversais das curadorias anteriores foram aplicados nos textos restantes de todos os catálogos (configurações, assistente, captura offline, visão geral, calculadoras, dados de mercado):

- "livro", "livros", "deste livro" → "seus registros", "um equori vazio", "todas as suas contas". O grupo de configurações "Livros" passa a "Finanças", palavra do subtítulo da página.
- "instância" → "instalação".
- "Open Finance" → "conexão bancária"; "provedor" da conexão bancária → "conexão bancária". "Provedor" do modelo de linguagem fica: é o termo do assistente.
- "lançamento", "lançar" → "transação", "registrar"; a fila offline guarda textos, e passa a "Textos offline".
- "conciliação", "conciliada" → "conferência de saldo"; "associada" para linhas importadas.
- "Ativos", "Passivos" → "Você tem", "Você deve".
- "MiB" → "MB".

O tema de cor "Livro-caixa" fica: é um nome próprio de tema.
