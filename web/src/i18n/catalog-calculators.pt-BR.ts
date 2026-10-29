import type { calculatorsEn } from "@/i18n/catalog-calculators.en";

export const calculatorsPtBR: Record<keyof typeof calculatorsEn, string> = {
  "nav.calculators": "Calculadoras",
  "calc.title": "Calculadoras",
  "calc.subtitle":
    "Métodos publicados aplicados aos seus dados, cada um com sua fórmula e suas fontes.",
  "calc.group.invest": "Investir",
  "calc.group.credit": "Crédito e dívidas",
  "calc.group.plan": "Planejar",
  "calc.back": "Calculadoras",
  "calc.results": "Resultado",
  "calc.results.empty":
    "Preencha os dados; o resultado é recalculado a cada alteração.",
  "calc.method": "Como é calculado",
  "calc.method.steps": "Passos",
  "calc.method.formula": "Fórmula",
  "calc.method.assumptions": "Premissas",
  "calc.method.limits": "Limites",
  "calc.method.sources": "Fontes",
  "calc.filled": "Dos seus dados: {origin}",
  "calc.refill": "Preencher de novo",
  "calc.percent": "%",
  "calc.period": "Período",
  "calc.period.month": "ao mês",
  "calc.period.year": "ao ano",
  "calc.compound.title": "Juros compostos",
  "calc.compound.question": "Quanto um investimento vai alcançar?",
  "calc.rates.title": "Conversor de taxas",
  "calc.rates.question":
    "Quanto é esta taxa ao mês, ao ano ou descontada a inflação?",
  "calc.correction.title": "Correção por um índice",
  "calc.correction.question": "Quanto vale em outro mês um valor de um mês?",
  "calc.fixed-income.title": "Renda fixa após o imposto",
  "calc.fixed-income.question":
    "Quanto sobra após o imposto, e que taxa isenta equivale a uma tributada?",
  "calc.financing.title": "Financiamento",
  "calc.financing.question":
    "Quanto custa um empréstimo com prestação fixa ou com amortização fixa, e o que muda uma amortização extra?",
  "calc.cash-or-installments.title": "À vista ou parcelado",
  "calc.cash-or-installments.question":
    "O preço à vista ou o parcelamento sai mais barato?",
  "calc.credit-cost.title": "Custo do crédito",
  "calc.credit-cost.question":
    "Qual é o custo efetivo anual de uma oferta de crédito?",
  "calc.debt-payoff.title": "Quitação de dívidas",
  "calc.debt-payoff.question":
    "Em que ordem pagar as dívidas, e quando elas terminam?",
  "calc.reserve.title": "Reserva de emergência",
  "calc.reserve.question":
    "Quantos meses de despesas os saldos líquidos cobrem?",
  "calc.recurring-cost.title": "Custo recorrente",
  "calc.recurring-cost.question":
    "Quanto custa uma despesa recorrente ao longo dos anos?",
  "calc.independence.title": "Independência financeira",
  "calc.independence.question":
    "De quanto os investimentos precisam para pagar as despesas, e quando chegam lá?",
  "calc.own-or-rent.title": "Comprar ou alugar",
  "calc.own-or-rent.question": "Ter o imóvel custa menos por ano que alugar?",
  "calc.estimate":
    "Uma estimativa: a taxa é suposta constante, sem imposto nem tarifa.",
  "calc.origin.daily": "{percent} do {index} nos 12 meses até {date}",
  "calc.origin.spread": "{index} + {spread} ao ano nos 12 meses até {date}",
  "calc.origin.daily.current":
    "{percent} do {index} pela taxa de {date}, por um ano",
  "calc.origin.spread.current":
    "{index} + {spread} ao ano pela taxa de {date}, por um ano",
  "calc.floating.basis": "Taxa do índice",
  "calc.floating.basis.current": "Atual, mantida por um ano",
  "calc.floating.basis.trailing": "Últimos 12 meses",
  "calc.origin.daily.expected":
    "{percent} do {index} pela trajetória que a pesquisa de mercado de {date} espera, em {months} meses",
  "calc.origin.spread.expected":
    "{index} + {spread} ao ano pela trajetória que a pesquisa de mercado de {date} espera, em {months} meses",
  "calc.floating.basis.expected": "Esperada pelo mercado",
  "calc.floating.form": "Como a taxa segue o índice",
  "calc.floating.percent": "Percentual do índice",
  "calc.floating.spread": "Índice + spread",
  "calc.floating.spreadRate": "Spread ao ano",
  "calc.floating.spread.daily":
    "Somado à taxa do índice a cada dia, como 1/360 dele, como acumulam os contratos sobre este índice.",
  "calc.floating.spread.compound":
    "Composto com o índice no ano: (1 + índice) × (1 + spread) − 1.",
  "calc.origin.monthly": "{index} nos 12 meses até {date}",
  "calc.useIndex": "Usar {index}, últimos 12 meses",
  "calc.rateSource.fixed": "Digitada",
  "calc.compound.mode": "O que calcular",
  "calc.compound.mode.final": "Valor final",
  "calc.compound.mode.target": "Depósito necessário",
  "calc.compound.initial": "Valor inicial",
  "calc.compound.deposit": "Depósito mensal",
  "calc.compound.target": "Meta",
  "calc.compound.rateSource": "Origem da taxa",
  "calc.compound.rate": "Taxa de juros",
  "calc.compound.percent": "Percentual do índice",
  "calc.compound.inflation": "Inflação anual",
  "calc.compound.delay": "Começar mais tarde",
  "calc.compound.final": "Valor final",
  "calc.compound.deposited": "Total depositado",
  "calc.compound.interest": "Juros",
  "calc.compound.real": "Valor final em dinheiro de hoje",
  "calc.compound.delayed": "Valor final começando {months} meses depois",
  "calc.compound.difference": "Custo de esperar",
  "calc.compound.depositNeeded": "Depósito mensal necessário",
  "calc.compound.chart": "Saldo e depósitos por mês",
  "calc.compound.chart.balance": "Saldo",
  "calc.compound.chart.deposited": "Depositado",
  "calc.compound.chart.month": "Mês {month}",
  "calc.compound.income": "Renda mensal depois do prazo",
  "calc.compound.income.lasting": "Renda que mantém o patrimônio",
  "calc.compound.income.lastingToday":
    "Renda que mantém o poder de compra, em dinheiro de hoje",
  "calc.compound.income.lastingAtEnd":
    "A mesma renda, em dinheiro do fim do prazo",
  "calc.compound.income.spending":
    "Renda que consome o patrimônio no prazo de saque",
  "calc.compound.income.spendingToday":
    "Renda que consome o patrimônio no prazo de saque, em dinheiro de hoje",
  "calc.compound.income.none":
    "Com a inflação igual ou acima da rentabilidade, nenhuma renda mantém o poder de compra; um prazo de saque dá uma renda que consome o patrimônio.",
  "calc.compound.income.realNote":
    "Sacada no fim de cada mês e corrigida todo mês pela inflação informada; em dinheiro de hoje, a inflação até o fim do prazo é descontada.",
  "calc.compound.income.nominalNote":
    "Sem uma inflação informada, a renda mantém o valor nominal do patrimônio, não o seu poder de compra.",
  "calc.compound.withdraw": "Sacar a renda por",
  "calc.compound.withdraw.hint":
    "Vazio: a renda dura e mantém o patrimônio. Com um prazo: a renda consome o patrimônio nesse prazo.",
  "calc.compound.step8":
    "Depois do prazo, a renda que mantém o poder de compra é o valor final vezes (j − g), sendo g a inflação mensal; num prazo de saque de n meses, a renda cresce com a inflação e consome o valor final.",
  "calc.compound.formula7":
    "W = F · (j − g); em n meses: W = F · (j − g) / (1 − ((1 + g) / (1 + j))^n)",
  "calc.compound.assumption6":
    "A renda é sacada no fim de cada mês, e a rentabilidade e a inflação continuam as mesmas depois do prazo.",
  "calc.compound.step1":
    "A taxa anual vira uma taxa mensal: j = (1 + taxa anual)^(1/12) − 1.",
  "calc.compound.step2": "O valor inicial cresce por n meses à taxa j.",
  "calc.compound.step3":
    "Cada depósito entra no início do seu mês e cresce até o fim.",
  "calc.compound.step4":
    "O valor final é a soma dos dois; os juros são o valor final menos o que foi depositado.",
  "calc.compound.step5":
    "Com inflação, o valor final é dividido por (1 + inflação)^(n/12) para ler em dinheiro de hoje.",
  "calc.compound.step6":
    "Para uma meta, o depósito p é o que faz M1 mais M2 igualar a meta.",
  "calc.compound.formula1": "M1: Sn = q0 · (1 + j)^n",
  "calc.compound.formula2": "M2: Sn = (1 + j) · ((1 + j)^n − 1) / j · p",
  "calc.compound.formula3": "M5: anual = (1 + mensal)^12 − 1",
  "calc.compound.formula4": "M6: real = (1 + nominal) / (1 + inflação) − 1",
  "calc.compound.formula6":
    "Sn: valor após n meses; q0: valor inicial; p: depósito mensal; j: taxa mensal; n: meses.",
  "calc.compound.assumption1":
    "Cada depósito é feito no início do mês (método do Banco Central do Brasil).",
  "calc.compound.assumption2": "A taxa é a mesma em todos os meses.",
  "calc.compound.assumption3":
    "Nenhum imposto, tarifa ou resgate é descontado.",
  "calc.compound.assumption4":
    "Um percentual de um índice diário usa os seus últimos 12 meses como taxa anual.",
  "calc.compound.limit1":
    "As pessoas tendem a esperar que a poupança cresça em linha reta; o crescimento é exponencial (McKenzie e Liersch 2011).",
  "calc.compound.limit2":
    "As famílias subestimam o valor futuro de um investimento e a taxa implícita em um fluxo de pagamentos (Stango e Zinman 2009).",
  "calc.compound.limit3":
    "Os valores são arredondados para a menor unidade; um contrato pode arredondar de outro modo.",
  "calc.compound.volatility": "Volatilidade anual",
  "calc.compound.p10": "Cenário desfavorável (percentil 10)",
  "calc.compound.p50": "Cenário central (mediana)",
  "calc.compound.p90": "Cenário favorável (percentil 90)",
  "calc.compound.step7":
    "Com uma volatilidade, 2.000 trajetórias de retornos mensais são sorteadas e os percentis 10, 50 e 90 dos seus valores finais são mostrados.",
  "calc.compound.formula5":
    "Faixa: retorno de um mês = exp(μ + σ·z) − 1, σ = volatilidade / √12, μ = ln(1 + taxa anual) / 12 − σ²/2, z normal padrão",
  "calc.compound.assumption5":
    "Para a faixa, os retornos mensais são independentes e log-normais; os sorteios usam uma semente fixa, então as mesmas entradas dão a mesma faixa.",
  "calc.compound.limit4":
    "A faixa não é uma previsão. Com resgates, um retorno fixo subestima a faixa de resultados (Pfau 2016).",
  "calc.noIndexes":
    "Esta instalação não busca nenhum índice, então nenhum índice pode ser escolhido; um administrador os ativa em EQUORI_INDEX_FEEDS (docs/operations/price-feeds.md).",
  "calc.index": "Índice",
  "calc.index.none": "Nenhum",
  "calc.rates.rate": "Taxa",
  "calc.rates.inflation": "Inflação anual",
  "calc.rates.percent": "Percentual do índice",
  "calc.rates.monthly": "Taxa mensal",
  "calc.rates.annual": "Taxa anual",
  "calc.rates.real": "Taxa anual descontada a inflação",
  "calc.rates.ofIndex": "Taxa anual pelo índice",
  "calc.rates.step1":
    "Uma taxa mensal se capitaliza 12 vezes em um ano; uma taxa anual volta pela raiz 12.",
  "calc.rates.step2":
    "A taxa real divide o crescimento da taxa nominal pelo crescimento dos preços.",
  "calc.rates.step3":
    "Um percentual de um índice diário aplica esse percentual à taxa de cada dia dos últimos 12 meses e capitaliza os dias; um spread soma 1/360 dele a cada dia no €STR e no SOFR, e se compõe com o ano do índice nos demais.",
  "calc.rates.formula1":
    "M5: anual = (1 + mensal)^12 − 1; mensal = (1 + anual)^(1/12) − 1",
  "calc.rates.formula2": "M6: real = (1 + nominal) / (1 + inflação) − 1",
  "calc.rates.formula3":
    "Percentual de um índice: Π (1 + k · dᵢ) − 1 sobre os dias i dos últimos 12 meses; k o percentual, dᵢ a taxa do dia i",
  "calc.rates.assumption1":
    "As taxas se capitalizam mensalmente; um ano tem 12 meses.",
  "calc.rates.assumption2":
    "Os últimos 12 meses de um índice representam a sua taxa anual.",
  "calc.rates.limit1": "A taxa passada de um índice não prevê a próxima.",
  "calc.rates.limit2":
    "Contratos cotados em dias úteis usam outra contagem de dias, então seus números diferem.",
  "calc.correction.amount": "Valor",
  "calc.correction.from": "Mês inicial",
  "calc.correction.to": "Mês final",
  "calc.correction.corrected": "Valor corrigido",
  "calc.correction.factor": "Fator acumulado",
  "calc.correction.percent": "Variação acumulada",
  "calc.correction.months": "Meses usados",
  "calc.correction.order": "O mês inicial não pode vir depois do mês final.",
  "calc.correction.range":
    "As taxas guardadas deste índice vão de {first} a {last}.",
  "calc.correction.step1":
    "As taxas do índice são lidas para cada mês do mês inicial ao mês final, ambos incluídos; um índice diário dá cada dia desses meses.",
  "calc.correction.step2":
    "O fator é o produto de (1 + taxa) sobre essas taxas.",
  "calc.correction.step3":
    "O valor corrigido é o valor vezes o fator, arredondado para a menor unidade.",
  "calc.correction.formula1":
    "M7: corrigido = valor × Π (1 + rᵢ); rᵢ a taxa de cada mês ou dia i",
  "calc.correction.assumption1":
    "As taxas são as que a fonte do índice publicou e esta instalação guardou.",
  "calc.correction.limit1":
    "Os resultados podem diferir dos de uma instituição, que pode usar outras datas ou arredondamentos (Banco Central do Brasil, Calculadora do Cidadão).",
  "calc.financing.solve": "O que calcular",
  "calc.financing.solve.installment": "Prestação",
  "calc.financing.solve.amount": "Valor",
  "calc.financing.solve.rate": "Taxa",
  "calc.financing.solve.months": "Prazo",
  "calc.financing.amount": "Valor financiado",
  "calc.financing.rate": "Taxa de juros",
  "calc.financing.installment": "Prestação fixa",
  "calc.financing.prepayMonth": "Amortização extra após a prestação nº",
  "calc.financing.prepayAmount": "Valor da amortização extra",
  "calc.financing.solved.amount": "Valor financiado",
  "calc.financing.solved.rate": "Taxa mensal",
  "calc.financing.solved.annual": "Taxa anual",
  "calc.financing.solved.months": "Prazo em meses",
  "calc.financing.noSolution":
    "Nenhum valor resolve: a prestação não cobre os juros, ou a taxa ficaria fora de 0% a 100% ao mês.",
  "calc.financing.compare": "Prestação fixa e amortização fixa",
  "calc.financing.figure": "Valor",
  "calc.financing.price": "Prestação fixa",
  "calc.financing.sac": "Amortização fixa",
  "calc.financing.first": "Primeira prestação",
  "calc.financing.last": "Última prestação",
  "calc.financing.paid": "Total pago",
  "calc.financing.interest": "Total de juros",
  "calc.financing.priceTable": "Prestação fixa, mês a mês",
  "calc.financing.sacTable": "Amortização fixa, mês a mês",
  "calc.financing.br.price": "Price",
  "calc.financing.br.sac": "SAC",
  "calc.financing.br.installment": "Prestação Price",
  "calc.financing.br.compare": "Price e SAC",
  "calc.financing.br.priceTable": "Tabela Price por mês",
  "calc.financing.br.sacTable": "Tabela SAC por mês",
  "calc.financing.br.names":
    "No Brasil, a prestação fixa é a Tabela Price, e a amortização fixa é o Sistema de Amortização Constante (SAC).",
  "calc.financing.col.month": "Mês",
  "calc.financing.col.installment": "Prestação",
  "calc.financing.col.interest": "Juros",
  "calc.financing.col.amortization": "Amortização",
  "calc.financing.col.balance": "Saldo",
  "calc.financing.prepay.balance": "Saldo após a amortização extra",
  "calc.financing.prepay.without": "Juros restantes sem a amortização extra",
  "calc.financing.prepay.months": "Meses restantes, mantendo a prestação",
  "calc.financing.prepay.keepInstallmentInterest":
    "Juros restantes, mantendo a prestação",
  "calc.financing.prepay.installment": "Nova prestação, mantendo o prazo",
  "calc.financing.prepay.keepTermInterest": "Juros restantes, mantendo o prazo",
  "calc.financing.prepay.invalid":
    "O mês da amortização extra deve estar entre 1 e o prazo menos um.",
  "calc.financing.step1":
    "Prestação fixa: a prestação p é fixa e vem de M3; ela é arredondada uma vez.",
  "calc.financing.step2":
    "Amortização fixa: a amortização A = q0 / n é fixa e arredondada uma vez; os juros caem a cada mês.",
  "calc.financing.step3":
    "Os juros de cada mês são o saldo vezes j, arredondados; a última prestação zera o saldo.",
  "calc.financing.step4":
    "Uma amortização extra reduz o saldo logo após a sua prestação; o empréstimo então mantém a prestação ou o prazo.",
  "calc.financing.step5":
    "Uma taxa ausente é encontrada por bisseção até a prestação diferir menos de 0,000001 dela.",
  "calc.financing.formula1": "M3: q0 = (1 − (1 + j)^−n) / j · p",
  "calc.financing.formula2":
    "M4: A = q0 / n; juros do mês k = j · (q0 − (k − 1) · A); prestação = A + juros",
  "calc.financing.formula3":
    "q0: valor financiado; p: prestação; j: taxa mensal; n: meses; A: amortização.",
  "calc.financing.assumption1":
    "A primeira prestação vence um mês após o empréstimo.",
  "calc.financing.assumption2":
    "A taxa é fixa; nenhuma tarifa, seguro ou imposto está incluído.",
  "calc.financing.limit1":
    "As regras de consumo sobre descontos na antecipação são nacionais e não são aplicadas.",
  "calc.financing.limit2":
    "Os resultados podem diferir dos de um contrato, que pode arredondar ou datar as prestações de outro modo (Banco Central do Brasil).",
  "calc.cash.price": "Preço à vista",
  "calc.cash.count": "Número de parcelas",
  "calc.cash.installment": "Parcela",
  "calc.cash.first": "Primeira parcela",
  "calc.cash.first.later": "Daqui a um mês",
  "calc.cash.first.now": "No ato",
  "calc.cash.rateSource": "Origem da taxa de comparação",
  "calc.cash.compare": "Taxa de comparação",
  "calc.cash.monthly": "Taxa mensal implícita",
  "calc.cash.annual": "Taxa anual implícita",
  "calc.cash.total": "Total das parcelas",
  "calc.cash.presentValue": "Valor presente das parcelas à taxa de comparação",
  "calc.cash.cashLower": "O preço à vista é menor em",
  "calc.cash.installmentsLower": "O valor presente das parcelas é menor em",
  "calc.cash.same": "Diferença para o preço à vista",
  "calc.cash.noInterest":
    "As parcelas somam o preço à vista ou menos, então não têm juros.",
  "calc.cash.noSolution":
    "Nenhuma taxa até 100% ao mês iguala as parcelas ao preço à vista.",
  "calc.cash-or-installments.step1":
    "A taxa implícita j é aquela em que as parcelas, cada uma descontada para hoje, somam o preço à vista.",
  "calc.cash-or-installments.step2":
    "Ela é encontrada por bisseção até a soma diferir do preço à vista menos de 0,000001 dele.",
  "calc.cash-or-installments.step3":
    "As parcelas também são descontadas à taxa de comparação e comparadas ao preço à vista.",
  "calc.cash-or-installments.formula1":
    "à vista = Σ p / (1 + j)^k, k = 1 … n (k = 0 … n − 1 quando a primeira vence agora)",
  "calc.cash-or-installments.formula2":
    "p: parcela; n: número de parcelas; j: taxa mensal.",
  "calc.cash-or-installments.assumption1": "As parcelas são mensais e iguais.",
  "calc.cash-or-installments.assumption2":
    "A taxa de comparação é o que o dinheiro rende em outro lugar nesse meio-tempo.",
  "calc.cash-or-installments.limit1":
    "As famílias subestimam a taxa implícita em um fluxo de pagamentos (Stango e Zinman 2009).",
  "calc.cash-or-installments.limit2":
    "Tarifas, impostos e seguros fora das parcelas não são contados.",
  "calc.credit.released": "Valor liberado",
  "calc.credit.fees": "Tarifas pagas no início",
  "calc.credit.installment": "Prestação",
  "calc.credit.count": "Número de prestações",
  "calc.credit.releaseDate": "Data da liberação",
  "calc.credit.firstDue": "Primeiro vencimento",
  "calc.credit.annual": "Custo efetivo anual",
  "calc.credit.monthly": "Equivalente mensal",
  "calc.credit.paid": "Total pago",
  "calc.credit.flows": "Fluxos da oferta",
  "calc.credit.col.number": "Prestação",
  "calc.credit.col.date": "Vencimento",
  "calc.credit.col.days": "Dias desde a liberação",
  "calc.credit.col.amount": "Valor",
  "calc.credit.order":
    "O primeiro vencimento deve vir depois da data da liberação.",
  "calc.credit.noSolution":
    "Nenhum custo anual de −99% a 10.000% iguala os fluxos ao valor liberado menos as tarifas.",
  "calc.credit.cet":
    "No Brasil este custo é o Custo Efetivo Total (CET), definido pela Resolução CMN nº 4.881.",
  "calc.credit.us.apr": "APR (taxa mensal × 12)",
  "calc.credit.us.aprNote":
    "Nos Estados Unidos o contrato informa a APR, a taxa mensal vezes 12 (Regulation Z, apêndice J); ela é menor que o custo efetivo anual, que compõe os meses.",
  "calc.credit-cost.step1":
    "Cada prestação é datada mensalmente a partir do primeiro vencimento; um dia que o mês não tem vira o seu último dia.",
  "calc.credit-cost.step2":
    "Cada prestação é descontada pelos seus dias desde a liberação sobre 365.",
  "calc.credit-cost.step3":
    "O custo anual c é aquele em que as prestações descontadas igualam o valor liberado menos as tarifas pagas no início; ele é mostrado com 2 casas, arredondado para o par mais próximo.",
  "calc.credit-cost.formula1": "FC0 = Σ FCj / (1 + c)^((dj − d0) / 365)",
  "calc.credit-cost.formula2":
    "FC0: valor liberado menos as tarifas pagas no início; FCj: prestação j; dj: seu vencimento; d0: a data da liberação; c: custo anual.",
  "calc.credit-cost.assumption1":
    "Todo valor cobrado está nas prestações ou nas tarifas pagas no início.",
  "calc.credit-cost.limit1":
    "Taxas flutuantes e índices de preços ficam fora do custo (CMN 4.881, art. 5).",
  "calc.credit-cost.limit2":
    "Cheque especial e crédito rotativo usam prazo de 30 dias e o limite contratado, que esta calculadora não modela (CMN 4.881, art. 6).",
  "calc.fixedIncome.amount": "Valor aplicado",
  "calc.fixedIncome.rateSource": "Origem da taxa",
  "calc.fixedIncome.rate": "Taxa bruta",
  "calc.fixedIncome.days": "Prazo da aplicação",
  "calc.fixedIncome.kind": "Tributação",
  "calc.fixedIncome.kind.taxable": "Tributado",
  "calc.fixedIncome.kind.exempt": "Isento",
  "calc.fixedIncome.taxRate": "Imposto sobre o rendimento",
  "calc.fixedIncome.gross": "Rendimento bruto",
  "calc.fixedIncome.tax": "Imposto",
  "calc.fixedIncome.net": "Rendimento líquido",
  "calc.fixedIncome.netRate": "Taxa anual líquida",
  "calc.fixedIncome.taxShare": "Alíquota aplicada",
  "calc.fixedIncome.equivalentTaxable": "Taxa tributada equivalente",
  "calc.fixedIncome.equivalentExempt": "Taxa isenta equivalente",
  "calc.fixedIncome.iof":
    "Abaixo de 30 dias incide um imposto sobre o resgate (IOF), que esta calculadora não calcula.",
  "calc.fixedIncome.checked":
    "As regras de imposto da região foram conferidas em {date}.",
  "calc.fixedIncome.de.rate":
    "Na Alemanha, o imposto sobre juros é de 25% mais o adicional de solidariedade de 5,5% desse imposto: 26,375% (EStG § 32d; SolzG § 4).",
  "calc.fixedIncome.de.left":
    "O imposto de igreja e a isenção anual do poupador dependem da pessoa e não são descontados.",
  "calc.fixedIncome.pt.rate":
    "Em Portugal, os juros sofrem retenção à taxa liberatória de 28% (Código do IRS, artigo 71.º, 1).",
  "calc.fixedIncome.pt.left":
    "Uma taxa reduzida pela residência da pessoa ou pelo prazo do depósito não é aplicada.",
  "calc.fixedIncome.br.table":
    "No Brasil o imposto sobre um rendimento tributado é 22,5% até 180 dias, 20% de 181 a 360, 17,5% de 361 a 720 e 15% acima de 720 (Lei 11.033/2004, art. 1).",
  "calc.fixedIncome.br.days252":
    "Contratos brasileiros cotam taxas em 252 dias úteis ao ano, então o número de um contrato difere deste em 365 dias.",
  "calc.fixed-income.step1":
    "O rendimento bruto é o valor capitalizado à taxa anual pelos dias de aplicação, em um ano de 365 dias.",
  "calc.fixed-income.step2":
    "O imposto é a parcela da região sobre o rendimento bruto para os dias de aplicação; um título isento não paga nenhum.",
  "calc.fixed-income.step3":
    "A taxa anual líquida é o rendimento líquido levado de volta a um ano.",
  "calc.fixed-income.step4":
    "A taxa equivalente é a taxa do outro tipo que deixa o mesmo rendimento após o imposto.",
  "calc.fixed-income.formula1":
    "rendimento = valor × ((1 + r)^(dias / 365) − 1); imposto = rendimento × t",
  "calc.fixed-income.formula2": "r_e = r_t × (1 − t); r_t = r_e / (1 − t)",
  "calc.fixed-income.formula3":
    "r: taxa bruta anual; t: alíquota; r_e: taxa isenta; r_t: taxa tributada.",
  "calc.fixed-income.assumption1":
    "A taxa é a mesma em todo o período e o valor é resgatado uma vez, no fim.",
  "calc.fixed-income.limit1":
    "As regras de imposto mudam por lei; as da região valem na data em que foram conferidas.",
  "calc.fixed-income.limit2":
    "Taxas de administração e custódia não são contadas.",
  "calc.debt.row": "Dívida {n}",
  "calc.debt.name": "Nome da dívida {n}",
  "calc.debt.balance": "Saldo da dívida {n}",
  "calc.debt.rate": "Taxa da dívida {n}",
  "calc.debt.ratePeriod": "Taxas das dívidas",
  "calc.debt.ratePeriod.effective":
    "Uma taxa anual é lida como efetiva: a taxa do mês, composta por 12 meses, chega a ela.",
  "calc.debt.ratePeriod.nominal":
    "Uma taxa anual é lida como APR: a taxa do mês é a APR dividida por 12.",
  "calc.debt.minimum": "Pagamento mínimo da dívida {n}",
  "calc.debt.remove": "Remover a dívida {n}",
  "calc.debt.add": "Adicionar uma dívida",
  "calc.debt.budget": "Orçamento mensal para as dívidas",
  "calc.debt.origin": "{account}, saldo em {date}",
  "calc.debt.compare": "Avalanche e bola de neve",
  "calc.debt.figure": "Valor",
  "calc.debt.avalanche": "Avalanche",
  "calc.debt.snowball": "Bola de neve",
  "calc.debt.months": "Meses até o último pagamento",
  "calc.debt.interest": "Total de juros",
  "calc.debt.closes": "{name} termina no mês",
  "calc.debt.notClosedCell": "não termina",
  "calc.debt.avalancheLower": "A avalanche paga menos juros em",
  "calc.debt.snowballLower": "A bola de neve paga menos juros em",
  "calc.debt.sameInterest": "Diferença de juros",
  "calc.debt.belowMinimums":
    "O orçamento é menor que a soma dos pagamentos mínimos, então nenhum plano paga todas as dívidas.",
  "calc.debt.notClosed":
    "Após 1.200 meses uma dívida segue aberta: o orçamento não supera os juros.",
  "calc.debt-payoff.step1":
    "A cada mês cada dívida aberta acumula juros: saldo vezes a sua taxa mensal, arredondado.",
  "calc.debt-payoff.step2":
    "Cada dívida aberta recebe então o seu pagamento mínimo, no máximo o seu saldo.",
  "calc.debt-payoff.step3":
    "O resto do orçamento vai para as dívidas abertas na sequência da ordem, cada uma no máximo o seu saldo; uma dívida que termina libera o seu mínimo para as outras.",
  "calc.debt-payoff.step4":
    "Avalanche: a maior taxa primeiro, empates pelo menor saldo. Bola de neve: o menor saldo primeiro, empates pela maior taxa.",
  "calc.debt-payoff.formula1":
    "juros do mês = arredondar(saldo × taxa mensal); pagamento = mínimo + parte de (orçamento − Σ mínimos) na ordem",
  "calc.debt-payoff.assumption1":
    "Taxas, mínimos e orçamento ficam iguais em todos os meses, e nenhuma dívida nova é contraída.",
  "calc.debt-payoff.assumption2":
    "A taxa e o prazo do contrato de um empréstimo não são guardados, então cada taxa e mínimo é digitado.",
  "calc.debt-payoff.limit1":
    "A avalanche dá o menor total de juros; fechar primeiro as contas pequenas previu a quitação de todas as dívidas em dados de 6.000 clientes de renegociação (Gal e McShane 2012). A escolha é da pessoa.",
  "calc.debt-payoff.limit2": "Um plano para em 1.200 meses.",
  "calc.recurring.schedule": "Preencher de um agendamento",
  "calc.recurring.schedule.none": "Nenhum",
  "calc.recurring.amount": "Valor por ocorrência",
  "calc.recurring.per": "Frequência",
  "calc.recurring.per.month": "Todo mês",
  "calc.recurring.per.year": "Todo ano",
  "calc.recurring.years": "Anos",
  "calc.recurring.rate": "Taxa anual",
  "calc.recurring.origin": "agendamento {name}",
  "calc.recurring.total": "Total pago",
  "calc.recurring.futureValue": "Os mesmos pagamentos investidos à taxa",
  "calc.recurring.difference": "Juros que os pagamentos renderiam",
  "calc.recurring-cost.step1":
    "O total é o valor vezes o número de ocorrências nos anos.",
  "calc.recurring-cost.step2":
    "Com uma taxa, cada pagamento é tratado como um depósito no início do seu período e cresce até o fim à taxa desse período.",
  "calc.recurring-cost.formula1":
    "total = p × n; valor futuro = (1 + j) · ((1 + j)^n − 1) / j · p (M2)",
  "calc.recurring-cost.formula2":
    "p: valor por ocorrência; n: ocorrências; j: taxa de um mês, (1 + anual)^(1/12) − 1, ou de um ano (M5).",
  "calc.recurring-cost.assumption1":
    "O valor fica igual; nenhum reajuste por índice é aplicado.",
  "calc.recurring-cost.limit1":
    "Um agendamento preenche o valor dos seus termos mais recentes; mudanças futuras dos termos não são projetadas.",
  "calc.own.price": "Preço do imóvel",
  "calc.own.rent": "Aluguel anual",
  "calc.own.riskFree": "Taxa de juros que se deixa de ganhar",
  "calc.own.propertyTax": "Alíquota do imposto sobre o imóvel",
  "calc.own.deductibleTax":
    "Alíquota do imposto de renda sobre juros dedutíveis",
  "calc.own.mortgage": "Taxa do financiamento",
  "calc.own.maintenanceRate": "Taxa de manutenção e depreciação",
  "calc.own.appreciationRate": "Valorização esperada",
  "calc.own.riskPremiumRate": "Prêmio de risco de ter o imóvel",
  "calc.own.forgone": "Juros que se deixa de ganhar",
  "calc.own.propertyTaxCost": "Imposto sobre o imóvel",
  "calc.own.deduction": "Dedução de imposto",
  "calc.own.maintenance": "Manutenção e depreciação",
  "calc.own.appreciation": "Valorização esperada",
  "calc.own.riskPremium": "Prêmio de risco",
  "calc.own.total": "Custo anual de ter o imóvel",
  "calc.own.rentYear": "Aluguel anual",
  "calc.own.ownLower": "Ter o imóvel custa menos por ano em",
  "calc.own.rentLower": "Alugar custa menos por ano em",
  "calc.own.same": "Diferença por ano",
  "calc.own-or-rent.step1":
    "Cada componente é o preço vezes a sua taxa; a dedução e a valorização reduzem o custo.",
  "calc.own-or-rent.step2":
    "O custo anual de ter o imóvel é a soma dos seis componentes, comparada ao aluguel anual.",
  "calc.own-or-rent.formula1":
    "custo = P·r_rf + P·ω − P·τ(r_m + ω) + P·δ − P·g + P·γ",
  "calc.own-or-rent.formula2":
    "P: preço do imóvel; r_rf: taxa de juros que se deixa de ganhar; ω: alíquota do imposto sobre o imóvel; τ: alíquota do imposto de renda sobre juros do financiamento e imposto sobre o imóvel dedutíveis; r_m: taxa do financiamento; δ: manutenção e depreciação; g: valorização esperada; γ: prêmio de risco de ter o imóvel.",
  "calc.own-or-rent.assumption1":
    "Toda taxa é anual e se aplica ao preço inteiro.",
  "calc.own-or-rent.assumption2":
    "A dedução existe só onde os juros do financiamento são dedutíveis; a sua taxa começa em 0.",
  "calc.own-or-rent.limit1":
    "A fórmula vem do imposto de renda federal dos Estados Unidos; os impostos de outro país entram por ω e τ.",
  "calc.own-or-rent.limit2":
    "A valorização esperada e o prêmio de risco são estimativas escolhidas pela pessoa.",
  "calc.results.emptyTitle": "O resultado aparece aqui",
  "calc.options": "Ajustes opcionais",
  "calc.method.description": "Passos, fórmula, premissas, limites e fontes",
  "calc.term": "Prazo",
  "calc.unit": "Unidade",
  "calc.fixedIncome.days.equivalent":
    "{days} dias corridos de hoje até o resgate.",
  "calc.unit.months": "meses",
  "calc.unit.days": "dias",
  "calc.unit.years": "anos",
  "calc.unit.installments": "parcelas",
  "calc.rateSource.hint":
    "Uma taxa digitada abaixo, ou a dos últimos 12 meses de um índice.",
  "calc.percent.hint": "100 é o próprio índice; 110 é 10% acima dele.",
  "calc.compound.initial.hint": "O que já está investido hoje.",
  "calc.compound.deposit.hint": "Feito no início de cada mês.",
  "calc.compound.target.hint": "O saldo a alcançar no fim do prazo.",
  "calc.compound.rate.hint":
    "Rentabilidade esperada, antes de impostos e tarifas.",
  "calc.compound.inflation.hint":
    "Acrescenta o valor final em dinheiro de hoje.",
  "calc.compound.delay.hint":
    "Acrescenta quanto o valor final perde se os depósitos começarem este número de meses depois.",
  "calc.compound.volatility.hint":
    "Quanto os retornos anuais variam (desvio padrão). Acrescenta uma faixa de valores finais tirada de 2.000 trajetórias simuladas.",
  "calc.compound.summary":
    "{deposited} depositados em {months} meses rendem {interest} de juros.",
  "calc.compound.targetSummary":
    "Com este depósito todo mês por {months} meses, o saldo chega a {target}.",
  "calc.rates.rate.hint": "A taxa como foi informada, com o seu período.",
  "calc.rates.inflation.hint": "Acrescenta a taxa descontada a inflação.",
  "calc.rates.index.hint":
    "Acrescenta a taxa anual de um percentual do índice nos últimos 12 meses.",
  "calc.correction.amount.hint": "O valor no mês inicial.",
  "calc.correction.summary":
    "O {index} variou {percent} de {from} a {to}, em {months} meses.",
  "calc.fixedIncome.days.hint": "Dias corridos da aplicação ao resgate.",
  "calc.fixedIncome.kind.hint":
    "Isento: o rendimento não paga imposto de renda.",
  "calc.fixedIncome.summary":
    "Rendimento bruto de {gross}, menos {tax} de imposto ({share}), em {days} dias.",
  "calc.financing.solve.hint": "Informe os outros três valores.",
  "calc.financing.installment.hint": "A prestação que fica igual todo mês.",
  "calc.financing.prepayMonth.hint":
    "Acrescenta o que um pagamento extra muda: prazo menor ou prestação menor.",
  "calc.financing.summary":
    "{priceName}: {price} todo mês. {sacName}: de {sacFirst} caindo até {sacLast}.",
  "calc.financing.prepay.title": "Com a amortização extra",
  "calc.financing.schedule": "Mês a mês",
  "calc.cash.compare.hint":
    "Quanto o dinheiro renderia enquanto as parcelas são pagas. Com ela, o resultado diz qual opção custa menos.",
  "calc.cash.summary":
    "Parcelar custa {monthly} ao mês ({annual} ao ano) sobre o preço à vista.",
  "calc.cash.verdictSummary":
    "A {rate} ao ano, as parcelas valem hoje {value}.",
  "calc.credit.released.hint": "O que cai na conta.",
  "calc.credit.fees.hint":
    "Tarifas, seguros e impostos pagos no início ou descontados do valor liberado.",
  "calc.credit.cost": "Juros e tarifas",
  "calc.credit.summary": "{paid} pagos por {released} recebidos.",
  "calc.debt.budget.hint":
    "Tudo o que vai para as dívidas por mês, somando os mínimos.",
  "calc.debt.list": "Dívidas",
  "calc.debt.summary":
    "A última dívida termina no mês {avalanche} com a avalanche e no mês {snowball} com a bola de neve.",
  "calc.recurring.rate.hint":
    "Acrescenta quanto os mesmos pagamentos alcançariam se fossem investidos.",
  "calc.recurring.summaryMonth": "{amount} todo mês por {years} anos.",
  "calc.recurring.summaryYear": "{amount} todo ano por {years} anos.",
  "calc.own.rent.hint": "Doze meses de aluguel de um imóvel equivalente.",
  "calc.own.riskFree.hint":
    "O que o dinheiro do imóvel renderia sem risco, por ano.",
  "calc.own.propertyTax.hint": "Imposto anual sobre o imóvel, em % do preço.",
  "calc.own.deductibleTax.hint":
    "Só onde os juros do financiamento são dedutíveis; 0 nos demais casos.",
  "calc.own.mortgage.hint": "Usada só na dedução.",
  "calc.own.maintenanceRate.hint": "Reparos e desgaste por ano, em % do preço.",
  "calc.own.appreciationRate.hint": "Alta anual esperada do preço.",
  "calc.own.riskPremiumRate.hint": "Compensação pelo risco de o preço cair.",
  "calc.own.summary":
    "Ter o imóvel custa {own} por ano, contra {rent} de aluguel.",
  "calc.unavailable": "Esta calculadora ainda não está disponível",
  "calc.unavailable.description":
    "Ela lê valores das suas contas que esta versão ainda não calcula.",
  "calc.group.invest.description":
    "Como um valor cresce, o que uma taxa significa e o que sobra após o imposto.",
  "calc.group.credit.description":
    "Quanto custa um empréstimo ou um parcelamento, e como quitar dívidas.",
  "calc.group.plan.description":
    "Custos recorrentes, reservas e a escolha entre comprar e alugar.",
};
