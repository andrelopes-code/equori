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
  "calc.inputs": "Entradas",
  "calc.results": "Resultados",
  "calc.results.empty":
    "Preencha as entradas obrigatórias para ver os resultados.",
  "calc.method": "Como é calculado",
  "calc.method.answers": "O que responde",
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
    "Quanto custa um empréstimo, em Price e em SAC, e o que muda uma amortização extra?",
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
  "calc.months": "Meses",
  "calc.estimate":
    "Uma estimativa: a taxa é suposta constante, sem imposto nem tarifa.",
  "calc.origin.daily": "{percent} do {index} nos 12 meses até {date}",
  "calc.origin.monthly": "{index} nos 12 meses até {date}",
  "calc.useIndex": "Usar {index}, últimos 12 meses",
  "calc.rateSource.fixed": "Taxa fixa",
  "calc.compound.mode": "Calcular",
  "calc.compound.mode.final": "Valor final",
  "calc.compound.mode.target": "Depósito para uma meta",
  "calc.compound.initial": "Valor inicial",
  "calc.compound.deposit": "Depósito mensal",
  "calc.compound.target": "Meta",
  "calc.compound.rateSource": "Origem da taxa",
  "calc.compound.rate": "Taxa anual",
  "calc.compound.percent": "Percentual do índice",
  "calc.compound.inflation": "Inflação anual (opcional)",
  "calc.compound.delay": "Atraso em meses",
  "calc.compound.final": "Valor final",
  "calc.compound.deposited": "Total depositado",
  "calc.compound.interest": "Juros",
  "calc.compound.real": "Valor final em dinheiro de hoje",
  "calc.compound.delayed": "Valor final começando {months} meses depois",
  "calc.compound.difference": "Diferença para começar agora",
  "calc.compound.depositNeeded": "Depósito mensal necessário",
  "calc.compound.chart": "Saldo e depósitos por mês",
  "calc.compound.chart.balance": "Saldo",
  "calc.compound.chart.deposited": "Depositado",
  "calc.compound.chart.month": "Mês {month}",
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
  "calc.compound.volatility": "Volatilidade anual (opcional)",
  "calc.compound.p10": "Valor final, percentil 10",
  "calc.compound.p50": "Valor final, percentil 50",
  "calc.compound.p90": "Valor final, percentil 90",
  "calc.compound.step7":
    "Com uma volatilidade, 2.000 trajetórias de retornos mensais são sorteadas e os percentis 10, 50 e 90 dos seus valores finais são mostrados.",
  "calc.compound.formula5":
    "Faixa: retorno de um mês = exp(μ + σ·z) − 1, σ = volatilidade / √12, μ = ln(1 + taxa anual) / 12 − σ²/2, z normal padrão",
  "calc.compound.assumption5":
    "Para a faixa, os retornos mensais são independentes e log-normais; os sorteios usam uma semente fixa, então as mesmas entradas dão a mesma faixa.",
  "calc.compound.limit4":
    "A faixa não é uma previsão. Com resgates, um retorno fixo subestima a faixa de resultados (Pfau 2016).",
  "calc.noIndexes":
    "Esta instância não busca nenhum índice, então nenhum índice pode ser escolhido; um administrador os ativa em EQUORI_INDEX_FEEDS (docs/operations/price-feeds.md).",
  "calc.index": "Índice",
  "calc.index.none": "Nenhum",
  "calc.rates.rate": "Taxa",
  "calc.rates.inflation": "Inflação anual (opcional)",
  "calc.rates.percent": "Percentual do índice",
  "calc.rates.monthly": "Taxa mensal",
  "calc.rates.annual": "Taxa anual",
  "calc.rates.real": "Taxa anual descontada a inflação",
  "calc.rates.ofIndex": "Taxa anual do percentual do índice",
  "calc.rates.step1":
    "Uma taxa mensal se capitaliza 12 vezes em um ano; uma taxa anual volta pela raiz 12.",
  "calc.rates.step2":
    "A taxa real divide o crescimento da taxa nominal pelo crescimento dos preços.",
  "calc.rates.step3":
    "Um percentual de um índice diário aplica esse percentual à taxa de cada dia dos últimos 12 meses e capitaliza os dias.",
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
    "As taxas são as que a fonte do índice publicou e esta instância guardou.",
  "calc.correction.limit1":
    "Os resultados podem diferir dos de uma instituição, que pode usar outras datas ou arredondamentos (Banco Central do Brasil, Calculadora do Cidadão).",
  "calc.financing.solve": "Calcular",
  "calc.financing.solve.installment": "Prestação",
  "calc.financing.solve.amount": "Valor financiado",
  "calc.financing.solve.rate": "Taxa",
  "calc.financing.solve.months": "Prazo",
  "calc.financing.amount": "Valor financiado",
  "calc.financing.rate": "Taxa de juros",
  "calc.financing.installment": "Prestação Price",
  "calc.financing.prepayMonth": "Amortização extra após a prestação (opcional)",
  "calc.financing.prepayAmount": "Valor da amortização extra",
  "calc.financing.solved.installment": "Prestação Price",
  "calc.financing.solved.amount": "Valor financiado",
  "calc.financing.solved.rate": "Taxa mensal",
  "calc.financing.solved.annual": "Taxa anual",
  "calc.financing.solved.months": "Prazo em meses",
  "calc.financing.noSolution":
    "Nenhum valor resolve: a prestação não cobre os juros, ou a taxa ficaria fora de 0% a 100% ao mês.",
  "calc.financing.compare": "Price e SAC",
  "calc.financing.figure": "Valor",
  "calc.financing.price": "Price",
  "calc.financing.sac": "SAC",
  "calc.financing.first": "Primeira prestação",
  "calc.financing.last": "Última prestação",
  "calc.financing.paid": "Total pago",
  "calc.financing.interest": "Total de juros",
  "calc.financing.priceTable": "Tabela Price por mês",
  "calc.financing.sacTable": "Tabela SAC por mês",
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
    "Price: a prestação p é fixa e vem de M3; ela é arredondada uma vez.",
  "calc.financing.step2":
    "SAC: a amortização A = q0 / n é fixa e arredondada uma vez; os juros caem a cada mês.",
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
  "calc.cash.first.later": "Em um mês",
  "calc.cash.first.now": "Agora",
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
  "calc.fixedIncome.days": "Dias de aplicação",
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
};
