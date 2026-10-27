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
  "calc.compound.symbols":
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
};
