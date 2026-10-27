// The words of the calculators, spread into catalogEn.
export const calculatorsEn = {
  "nav.calculators": "Calculators",
  "calc.title": "Calculators",
  "calc.subtitle":
    "Published methods applied to your inputs, each with its formula and sources.",
  "calc.group.invest": "Invest",
  "calc.group.credit": "Credit and debt",
  "calc.group.plan": "Plan",
  "calc.back": "Calculators",
  "calc.inputs": "Inputs",
  "calc.results": "Results",
  "calc.results.empty": "Fill in the required inputs to see the results.",
  "calc.method": "How it is calculated",
  "calc.method.answers": "What it answers",
  "calc.method.steps": "Steps",
  "calc.method.formula": "Formula",
  "calc.method.assumptions": "Assumptions",
  "calc.method.limits": "Limits",
  "calc.method.sources": "Sources",
  "calc.filled": "From your data: {origin}",
  "calc.refill": "Fill again",
  "calc.percent": "%",
  "calc.period": "Period",
  "calc.period.month": "per month",
  "calc.period.year": "per year",
  "calc.compound.title": "Compound interest",
  "calc.compound.question": "How much will an investment reach?",
  "calc.rates.title": "Rate converter",
  "calc.rates.question":
    "What is this rate per month, per year, or after inflation?",
  "calc.correction.title": "Correction by an index",
  "calc.correction.question":
    "What is an amount from one month worth in another?",
  "calc.fixed-income.title": "Fixed income after tax",
  "calc.fixed-income.question":
    "What remains after tax, and which exempt rate matches a taxable one?",
  "calc.financing.title": "Financing",
  "calc.financing.question":
    "What does a loan cost, in Price and in SAC, and what does a prepayment change?",
  "calc.cash-or-installments.title": "Cash or installments",
  "calc.cash-or-installments.question":
    "Is the cash price or the installment plan cheaper?",
  "calc.credit-cost.title": "Cost of credit",
  "calc.credit-cost.question":
    "What is the effective annual cost of a credit offer?",
  "calc.debt-payoff.title": "Debt payoff",
  "calc.debt-payoff.question":
    "In what order should debts be paid, and when do they end?",
  "calc.reserve.title": "Emergency reserve",
  "calc.reserve.question":
    "How many months of expenses do liquid balances cover?",
  "calc.recurring-cost.title": "Recurring cost",
  "calc.recurring-cost.question":
    "What does a recurring expense cost over the years?",
  "calc.independence.title": "Financial independence",
  "calc.independence.question":
    "How large must investments be to pay the expenses, and when are they reached?",
  "calc.own-or-rent.title": "Own or rent",
  "calc.own-or-rent.question": "Does owning cost less per year than renting?",
  "calc.months": "Months",
  "calc.estimate":
    "An estimate: the rate is assumed constant, with no tax or fee.",
  "calc.origin.daily": "{percent} of {index} over the 12 months to {date}",
  "calc.origin.monthly": "{index} over the 12 months to {date}",
  "calc.useIndex": "Use {index}, last 12 months",
  "calc.rateSource.fixed": "Fixed rate",
  "calc.compound.mode": "Calculate",
  "calc.compound.mode.final": "Final amount",
  "calc.compound.mode.target": "Deposit for a target",
  "calc.compound.initial": "Initial amount",
  "calc.compound.deposit": "Monthly deposit",
  "calc.compound.target": "Target",
  "calc.compound.rateSource": "Rate source",
  "calc.compound.rate": "Annual rate",
  "calc.compound.percent": "Percent of the index",
  "calc.compound.inflation": "Annual inflation (optional)",
  "calc.compound.delay": "Delay in months",
  "calc.compound.final": "Final amount",
  "calc.compound.deposited": "Total deposited",
  "calc.compound.interest": "Interest",
  "calc.compound.real": "Final amount in today's money",
  "calc.compound.delayed": "Final amount when starting {months} months later",
  "calc.compound.difference": "Difference to starting now",
  "calc.compound.depositNeeded": "Monthly deposit needed",
  "calc.compound.chart": "Balance and deposits by month",
  "calc.compound.chart.balance": "Balance",
  "calc.compound.chart.deposited": "Deposited",
  "calc.compound.chart.month": "Month {month}",
  "calc.compound.step1":
    "The annual rate becomes a monthly rate: j = (1 + annual rate)^(1/12) − 1.",
  "calc.compound.step2": "The initial amount grows for n months at j.",
  "calc.compound.step3":
    "Each deposit enters at the start of its month and grows until the end.",
  "calc.compound.step4":
    "The final amount is the sum of both; interest is the final amount less what was deposited.",
  "calc.compound.step5":
    "With inflation, the final amount is divided by (1 + inflation)^(n/12) to read in today's money.",
  "calc.compound.step6":
    "For a target, the deposit p is the one that makes M1 plus M2 equal to the target.",
  "calc.compound.formula1": "M1: Sn = q0 · (1 + j)^n",
  "calc.compound.formula2": "M2: Sn = (1 + j) · ((1 + j)^n − 1) / j · p",
  "calc.compound.formula3": "M5: annual = (1 + monthly)^12 − 1",
  "calc.compound.formula4": "M6: real = (1 + nominal) / (1 + inflation) − 1",
  "calc.compound.formula6":
    "Sn: amount after n months; q0: initial amount; p: monthly deposit; j: monthly rate; n: months.",
  "calc.compound.assumption1":
    "Each deposit is made at the start of the month (Banco Central do Brasil method).",
  "calc.compound.assumption2": "The rate stays the same every month.",
  "calc.compound.assumption3": "No tax, fee or withdrawal is taken.",
  "calc.compound.assumption4":
    "A percent of a daily index uses its last 12 months as the annual rate.",
  "calc.compound.limit1":
    "People tend to expect savings to grow in a straight line; the growth is exponential (McKenzie and Liersch 2011).",
  "calc.compound.limit2":
    "Households underestimate the future value of an investment and the rate implied by a payment stream (Stango and Zinman 2009).",
  "calc.compound.limit3":
    "Amounts are rounded to the minor unit; a contract may round differently.",
  "calc.compound.volatility": "Annual volatility (optional)",
  "calc.compound.p10": "Final amount, 10th percentile",
  "calc.compound.p50": "Final amount, 50th percentile",
  "calc.compound.p90": "Final amount, 90th percentile",
  "calc.compound.step7":
    "With a volatility, 2,000 paths of monthly returns are drawn and the 10th, 50th and 90th percentile of their final amounts are shown.",
  "calc.compound.formula5":
    "Range: return of a month = exp(μ + σ·z) − 1, σ = volatility / √12, μ = ln(1 + annual rate) / 12 − σ²/2, z standard normal",
  "calc.compound.assumption5":
    "For the range, monthly returns are independent and log-normal; the draws use a fixed seed, so the same inputs give the same range.",
  "calc.compound.limit4":
    "The range is not a forecast. With withdrawals, one fixed return understates the range of outcomes (Pfau 2016).",
  "calc.noIndexes":
    "This instance fetches no index, so no index can be chosen; an administrator enables them in EQUORI_INDEX_FEEDS (docs/operations/price-feeds.md).",
  "calc.index": "Index",
  "calc.index.none": "None",
  "calc.rates.rate": "Rate",
  "calc.rates.inflation": "Annual inflation (optional)",
  "calc.rates.percent": "Percent of the index",
  "calc.rates.monthly": "Monthly rate",
  "calc.rates.annual": "Annual rate",
  "calc.rates.real": "Annual rate after inflation",
  "calc.rates.ofIndex": "Annual rate of the percent of the index",
  "calc.rates.step1":
    "A monthly rate compounds 12 times in a year; an annual rate is converted back by the 12th root.",
  "calc.rates.step2":
    "The real rate divides the growth of the nominal rate by the growth of prices.",
  "calc.rates.step3":
    "A percent of a daily index applies that percent to each day's rate of the last 12 months, then compounds the days.",
  "calc.rates.formula1":
    "M5: annual = (1 + monthly)^12 − 1; monthly = (1 + annual)^(1/12) − 1",
  "calc.rates.formula2": "M6: real = (1 + nominal) / (1 + inflation) − 1",
  "calc.rates.formula3":
    "Percent of an index: Π (1 + k · dᵢ) − 1 over the days i of the last 12 months; k the percent, dᵢ the rate of day i",
  "calc.rates.assumption1": "Rates compound monthly; a year is 12 months.",
  "calc.rates.assumption2":
    "The last 12 months of an index stand for its annual rate.",
  "calc.rates.limit1": "A past index rate does not predict the next one.",
  "calc.rates.limit2":
    "Contracts quoted on business days use another day count, so their figures differ.",
  "calc.correction.amount": "Amount",
  "calc.correction.from": "Start month",
  "calc.correction.to": "End month",
  "calc.correction.corrected": "Corrected amount",
  "calc.correction.factor": "Accumulated factor",
  "calc.correction.percent": "Accumulated change",
  "calc.correction.months": "Months used",
  "calc.correction.order": "The start month must not come after the end month.",
  "calc.correction.range":
    "The stored rates of this index run from {first} to {last}.",
  "calc.correction.step1":
    "The rates of the index are read for every month from the start month to the end month, both included; a daily index gives every day of those months.",
  "calc.correction.step2":
    "The factor is the product of (1 + rate) over those rates.",
  "calc.correction.step3":
    "The corrected amount is the amount times the factor, rounded to the minor unit.",
  "calc.correction.formula1":
    "M7: corrected = amount × Π (1 + rᵢ); rᵢ the rate of each month or day i",
  "calc.correction.assumption1":
    "The rates are the ones the index source published and this instance stored.",
  "calc.correction.limit1":
    "Results can differ from those of an institution, which may use other dates or rounding (Banco Central do Brasil, Calculadora do Cidadão).",
  "calc.financing.solve": "Solve for",
  "calc.financing.solve.installment": "Installment",
  "calc.financing.solve.amount": "Amount",
  "calc.financing.solve.rate": "Rate",
  "calc.financing.solve.months": "Term",
  "calc.financing.amount": "Amount financed",
  "calc.financing.rate": "Interest rate",
  "calc.financing.installment": "Price installment",
  "calc.financing.prepayMonth": "Prepayment after installment (optional)",
  "calc.financing.prepayAmount": "Prepayment amount",
  "calc.financing.solved.installment": "Price installment",
  "calc.financing.solved.amount": "Amount financed",
  "calc.financing.solved.rate": "Monthly rate",
  "calc.financing.solved.annual": "Annual rate",
  "calc.financing.solved.months": "Term in months",
  "calc.financing.noSolution":
    "No value solves it: the installment does not cover the interest, or the rate would fall outside 0% to 100% a month.",
  "calc.financing.compare": "Price and SAC",
  "calc.financing.figure": "Figure",
  "calc.financing.price": "Price",
  "calc.financing.sac": "SAC",
  "calc.financing.first": "First installment",
  "calc.financing.last": "Last installment",
  "calc.financing.paid": "Total paid",
  "calc.financing.interest": "Total interest",
  "calc.financing.priceTable": "Price table by month",
  "calc.financing.sacTable": "SAC table by month",
  "calc.financing.col.month": "Month",
  "calc.financing.col.installment": "Installment",
  "calc.financing.col.interest": "Interest",
  "calc.financing.col.amortization": "Amortization",
  "calc.financing.col.balance": "Balance",
  "calc.financing.prepay.balance": "Balance after the prepayment",
  "calc.financing.prepay.without": "Interest left without the prepayment",
  "calc.financing.prepay.months": "Months left, keeping the installment",
  "calc.financing.prepay.keepInstallmentInterest":
    "Interest left, keeping the installment",
  "calc.financing.prepay.installment": "New installment, keeping the term",
  "calc.financing.prepay.keepTermInterest": "Interest left, keeping the term",
  "calc.financing.prepay.invalid":
    "The prepayment month must be between 1 and the term less one.",
  "calc.financing.step1":
    "Price: the installment p is fixed and found from M3; it is rounded once.",
  "calc.financing.step2":
    "SAC: the amortization A = q0 / n is fixed and rounded once; the interest falls each month.",
  "calc.financing.step3":
    "Each month's interest is the balance times j, rounded; the last installment closes the balance.",
  "calc.financing.step4":
    "A prepayment lowers the balance right after its installment; the loan then keeps either the installment or the term.",
  "calc.financing.step5":
    "A missing rate is found by bisection until the installment differs by less than 0.000001 of it.",
  "calc.financing.formula1": "M3: q0 = (1 − (1 + j)^−n) / j · p",
  "calc.financing.formula2":
    "M4: A = q0 / n; interest of month k = j · (q0 − (k − 1) · A); installment = A + interest",
  "calc.financing.formula3":
    "q0: amount financed; p: installment; j: monthly rate; n: months; A: amortization.",
  "calc.financing.assumption1":
    "The first installment is due one month after the loan.",
  "calc.financing.assumption2":
    "The rate is fixed; no fee, insurance or tax is included.",
  "calc.financing.limit1":
    "Consumer rules on prepayment discounts are national and are not applied.",
  "calc.financing.limit2":
    "Results can differ from those of a contract, which may round or date installments otherwise (Banco Central do Brasil).",
  "calc.cash.price": "Cash price",
  "calc.cash.count": "Number of installments",
  "calc.cash.installment": "Installment",
  "calc.cash.first": "First installment",
  "calc.cash.first.later": "In one month",
  "calc.cash.first.now": "Now",
  "calc.cash.rateSource": "Comparison rate source",
  "calc.cash.compare": "Comparison rate",
  "calc.cash.monthly": "Implied monthly rate",
  "calc.cash.annual": "Implied annual rate",
  "calc.cash.total": "Total of the installments",
  "calc.cash.presentValue":
    "Present value of the installments at the comparison rate",
  "calc.cash.cashLower": "The cash price is lower by",
  "calc.cash.installmentsLower":
    "The present value of the installments is lower by",
  "calc.cash.same": "Difference to the cash price",
  "calc.cash.noInterest":
    "The installments total the cash price or less, so they carry no interest.",
  "calc.cash.noSolution":
    "No rate up to 100% a month makes the installments equal the cash price.",
  "calc.cash-or-installments.step1":
    "The implied rate j is the one at which the installments, each discounted to today, add up to the cash price.",
  "calc.cash-or-installments.step2":
    "It is found by bisection until the sum differs from the cash price by less than 0.000001 of it.",
  "calc.cash-or-installments.step3":
    "The installments are also discounted at the comparison rate and set against the cash price.",
  "calc.cash-or-installments.formula1":
    "cash = Σ p / (1 + j)^k, k = 1 … n (k = 0 … n − 1 when the first is due now)",
  "calc.cash-or-installments.formula2":
    "p: installment; n: number of installments; j: monthly rate.",
  "calc.cash-or-installments.assumption1":
    "Installments are monthly and equal.",
  "calc.cash-or-installments.assumption2":
    "The comparison rate is what the money earns elsewhere in the meantime.",
  "calc.cash-or-installments.limit1":
    "Households underestimate the rate implied by a payment stream (Stango and Zinman 2009).",
  "calc.cash-or-installments.limit2":
    "Fees, taxes and insurance outside the installments are not counted.",
  "calc.credit.released": "Amount released",
  "calc.credit.fees": "Fees paid upfront",
  "calc.credit.installment": "Installment",
  "calc.credit.count": "Number of installments",
  "calc.credit.releaseDate": "Release date",
  "calc.credit.firstDue": "First due date",
  "calc.credit.annual": "Effective annual cost",
  "calc.credit.monthly": "Monthly equivalent",
  "calc.credit.paid": "Total paid",
  "calc.credit.flows": "Flows of the offer",
  "calc.credit.col.number": "Installment",
  "calc.credit.col.date": "Due date",
  "calc.credit.col.days": "Days from release",
  "calc.credit.col.amount": "Amount",
  "calc.credit.order": "The first due date must come after the release date.",
  "calc.credit.noSolution":
    "No annual cost from −99% to 10,000% makes the flows equal the amount released less the fees.",
  "calc.credit.cet":
    "In Brazil this cost is the Custo Efetivo Total (CET), defined by Resolução CMN nº 4.881.",
  "calc.credit-cost.step1":
    "Each installment is dated monthly from the first due date; a day the month lacks becomes its last day.",
  "calc.credit-cost.step2":
    "Each installment is discounted by its days from the release over 365.",
  "calc.credit-cost.step3":
    "The annual cost c is the one at which the discounted installments equal the amount released less the fees paid upfront; it is shown with 2 decimals, rounded half to even.",
  "calc.credit-cost.formula1": "FC0 = Σ FCj / (1 + c)^((dj − d0) / 365)",
  "calc.credit-cost.formula2":
    "FC0: amount released less the fees paid upfront; FCj: installment j; dj: its due date; d0: the release date; c: annual cost.",
  "calc.credit-cost.assumption1":
    "Every amount charged is in the installments or in the fees paid upfront.",
  "calc.credit-cost.limit1":
    "Floating rates and price indexes are left out of the cost (CMN 4.881, art. 5).",
  "calc.credit-cost.limit2":
    "Overdraft and revolving credit use a 30-day term and the agreed limit, which this calculator does not model (CMN 4.881, art. 6).",
} as const;
