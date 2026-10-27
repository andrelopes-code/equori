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
  "calc.results": "Result",
  "calc.results.empty": "Fill in the inputs; the result updates as you type.",
  "calc.method": "How it is calculated",
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
    "What does a loan cost with a fixed installment or a fixed amortization, and what does a prepayment change?",
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
  "calc.estimate":
    "An estimate: the rate is assumed constant, with no tax or fee.",
  "calc.origin.daily": "{percent} of {index} over the 12 months to {date}",
  "calc.origin.spread":
    "{index} + {spread} a year over the 12 months to {date}",
  "calc.origin.daily.current":
    "{percent} of {index} at its rate of {date}, over a year",
  "calc.origin.spread.current":
    "{index} + {spread} a year at its rate of {date}, over a year",
  "calc.floating.basis": "Rate of the index",
  "calc.floating.basis.current": "Current, kept for a year",
  "calc.floating.basis.trailing": "Last 12 months",
  "calc.origin.daily.expected":
    "{percent} of {index} along the path the market survey of {date} expects, over {months} months",
  "calc.origin.spread.expected":
    "{index} + {spread} a year along the path the market survey of {date} expects, over {months} months",
  "calc.floating.basis.expected": "Expected by the market",
  "calc.floating.form": "How the rate follows the index",
  "calc.floating.percent": "Percent of the index",
  "calc.floating.spread": "Index + spread",
  "calc.floating.spreadRate": "Spread a year",
  "calc.floating.spread.daily":
    "Added to the index's rate each day, as its 360th, as contracts on this index accrue.",
  "calc.floating.spread.compound":
    "Compounded with the index over the year: (1 + index) × (1 + spread) − 1.",
  "calc.origin.monthly": "{index} over the 12 months to {date}",
  "calc.useIndex": "Use {index}, last 12 months",
  "calc.rateSource.fixed": "Typed",
  "calc.compound.mode": "What to calculate",
  "calc.compound.mode.final": "Final amount",
  "calc.compound.mode.target": "Required deposit",
  "calc.compound.initial": "Initial amount",
  "calc.compound.deposit": "Monthly deposit",
  "calc.compound.target": "Target",
  "calc.compound.rateSource": "Rate source",
  "calc.compound.rate": "Interest rate",
  "calc.compound.percent": "Percent of the index",
  "calc.compound.inflation": "Annual inflation",
  "calc.compound.delay": "Start later",
  "calc.compound.final": "Final amount",
  "calc.compound.deposited": "Total deposited",
  "calc.compound.interest": "Interest",
  "calc.compound.real": "Final amount in today's money",
  "calc.compound.delayed": "Final amount when starting {months} months later",
  "calc.compound.difference": "Cost of waiting",
  "calc.compound.depositNeeded": "Monthly deposit needed",
  "calc.compound.chart": "Balance and deposits by month",
  "calc.compound.chart.balance": "Balance",
  "calc.compound.chart.deposited": "Deposited",
  "calc.compound.chart.month": "Month {month}",
  "calc.compound.income": "Monthly income after the term",
  "calc.compound.income.lasting": "Income that keeps the balance",
  "calc.compound.income.lastingToday":
    "Income that keeps the purchasing power, in today's money",
  "calc.compound.income.lastingAtEnd":
    "The same income, in money of the term's end",
  "calc.compound.income.spending":
    "Income that spends the balance over the withdrawal term",
  "calc.compound.income.spendingToday":
    "Income that spends the balance over the withdrawal term, in today's money",
  "calc.compound.income.none":
    "With inflation at or above the rate, no income keeps the purchasing power; a withdrawal term gives one that spends the balance.",
  "calc.compound.income.realNote":
    "Withdrawn at the end of each month and raised each month with the inflation typed; today's money removes that inflation up to the end of the term.",
  "calc.compound.income.nominalNote":
    "Without an inflation, the income keeps the balance's nominal value, not its purchasing power.",
  "calc.compound.withdraw": "Withdraw the income for",
  "calc.compound.withdraw.hint":
    "Empty: the income lasts and keeps the balance. With a term: the income spends the balance over it.",
  "calc.compound.step8":
    "After the term, the income that keeps the purchasing power is the final amount times (j − g), g being the monthly inflation; over a withdrawal term of n months the income grows with inflation and spends the final amount.",
  "calc.compound.formula7":
    "W = F · (j − g); over n months: W = F · (j − g) / (1 − ((1 + g) / (1 + j))^n)",
  "calc.compound.assumption6":
    "The income is withdrawn at the end of each month, and the rate and the inflation stay the same after the term.",
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
  "calc.compound.volatility": "Annual volatility",
  "calc.compound.p10": "Unfavourable case (10th percentile)",
  "calc.compound.p50": "Middle case (median)",
  "calc.compound.p90": "Favourable case (90th percentile)",
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
  "calc.rates.inflation": "Annual inflation",
  "calc.rates.percent": "Percent of the index",
  "calc.rates.monthly": "Monthly rate",
  "calc.rates.annual": "Annual rate",
  "calc.rates.real": "Annual rate after inflation",
  "calc.rates.ofIndex": "Annual rate from the index",
  "calc.rates.step1":
    "A monthly rate compounds 12 times in a year; an annual rate is converted back by the 12th root.",
  "calc.rates.step2":
    "The real rate divides the growth of the nominal rate by the growth of prices.",
  "calc.rates.step3":
    "A percent of a daily index applies that percent to each day's rate of the last 12 months, then compounds the days; a spread is added to each day as its 360th for €STR and SOFR, and compounds with the index's year otherwise.",
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
  "calc.financing.solve": "What to calculate",
  "calc.financing.solve.installment": "Installment",
  "calc.financing.solve.amount": "Amount",
  "calc.financing.solve.rate": "Rate",
  "calc.financing.solve.months": "Term",
  "calc.financing.amount": "Amount financed",
  "calc.financing.rate": "Interest rate",
  "calc.financing.installment": "Fixed installment",
  "calc.financing.prepayMonth": "Extra payment after installment no.",
  "calc.financing.prepayAmount": "Prepayment amount",
  "calc.financing.solved.amount": "Amount financed",
  "calc.financing.solved.rate": "Monthly rate",
  "calc.financing.solved.annual": "Annual rate",
  "calc.financing.solved.months": "Term in months",
  "calc.financing.noSolution":
    "No value solves it: the installment does not cover the interest, or the rate would fall outside 0% to 100% a month.",
  "calc.financing.compare": "Fixed installment and fixed amortization",
  "calc.financing.figure": "Figure",
  "calc.financing.price": "Fixed installment",
  "calc.financing.sac": "Fixed amortization",
  "calc.financing.first": "First installment",
  "calc.financing.last": "Last installment",
  "calc.financing.paid": "Total paid",
  "calc.financing.interest": "Total interest",
  "calc.financing.priceTable": "Fixed installment by month",
  "calc.financing.sacTable": "Fixed amortization by month",
  "calc.financing.br.price": "Price",
  "calc.financing.br.sac": "SAC",
  "calc.financing.br.installment": "Price installment",
  "calc.financing.br.compare": "Price and SAC",
  "calc.financing.br.priceTable": "Price table by month",
  "calc.financing.br.sacTable": "SAC table by month",
  "calc.financing.br.names":
    "In Brazil the fixed installment is the Price table and the fixed amortization is the Constant Amortization System (SAC).",
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
    "Fixed installment: the installment p is fixed and found from M3; it is rounded once.",
  "calc.financing.step2":
    "Fixed amortization: the amortization A = q0 / n is fixed and rounded once; the interest falls each month.",
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
  "calc.credit.us.apr": "APR (monthly rate × 12)",
  "calc.credit.us.aprNote":
    "In the United States a contract states the APR, the monthly rate times 12 (Regulation Z, appendix J); it is lower than the effective annual cost, which compounds the months.",
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
  "calc.fixedIncome.amount": "Amount invested",
  "calc.fixedIncome.rateSource": "Rate source",
  "calc.fixedIncome.rate": "Gross rate",
  "calc.fixedIncome.days": "Holding term",
  "calc.fixedIncome.kind": "Taxation",
  "calc.fixedIncome.kind.taxable": "Taxable",
  "calc.fixedIncome.kind.exempt": "Exempt",
  "calc.fixedIncome.taxRate": "Tax on the yield",
  "calc.fixedIncome.gross": "Gross yield",
  "calc.fixedIncome.tax": "Tax",
  "calc.fixedIncome.net": "Net yield",
  "calc.fixedIncome.netRate": "Net annual rate",
  "calc.fixedIncome.taxShare": "Tax rate applied",
  "calc.fixedIncome.equivalentTaxable": "Equivalent taxable rate",
  "calc.fixedIncome.equivalentExempt": "Equivalent exempt rate",
  "calc.fixedIncome.iof":
    "Below 30 days a tax on the redemption (IOF) applies, which this calculator does not compute.",
  "calc.fixedIncome.checked":
    "The tax rules of the region were checked on {date}.",
  "calc.fixedIncome.de.rate":
    "In Germany the tax on interest is 25% plus the solidarity surcharge of 5.5% of that tax: 26.375% (EStG § 32d; SolzG § 4).",
  "calc.fixedIncome.de.left":
    "Church tax and the yearly saver's allowance depend on the person and are not subtracted.",
  "calc.fixedIncome.pt.rate":
    "In Portugal interest is withheld at the final rate of 28% (Código do IRS, article 71, 1).",
  "calc.fixedIncome.pt.left":
    "A reduced rate that applies to the person's residence or to the deposit's term is not applied.",
  "calc.fixedIncome.br.table":
    "In Brazil the tax on a taxable yield is 22.5% up to 180 days, 20% from 181 to 360, 17.5% from 361 to 720 and 15% above 720 (Lei 11.033/2004, art. 1).",
  "calc.fixedIncome.br.days252":
    "Brazilian contracts quote rates on 252 business days a year, so a contract figure differs from this 365-day figure.",
  "calc.fixed-income.step1":
    "The gross yield is the amount grown at the annual rate for the days held, on a 365-day year.",
  "calc.fixed-income.step2":
    "The tax is the region's share of the gross yield for the days held; an exempt security pays none.",
  "calc.fixed-income.step3":
    "The net annual rate is the net yield brought back to a year.",
  "calc.fixed-income.step4":
    "The equivalent rate is the rate of the other kind that leaves the same yield after tax.",
  "calc.fixed-income.formula1":
    "yield = amount × ((1 + r)^(days / 365) − 1); tax = yield × t",
  "calc.fixed-income.formula2": "r_e = r_t × (1 − t); r_t = r_e / (1 − t)",
  "calc.fixed-income.formula3":
    "r: annual gross rate; t: tax rate; r_e: exempt rate; r_t: taxable rate.",
  "calc.fixed-income.assumption1":
    "The rate stays the same for the whole period and the amount is redeemed once, at the end.",
  "calc.fixed-income.limit1":
    "Tax rules change by law; the region's rules hold on the date they were checked.",
  "calc.fixed-income.limit2": "Fees and custody charges are not counted.",
  "calc.debt.row": "Debt {n}",
  "calc.debt.name": "Name of debt {n}",
  "calc.debt.balance": "Balance of debt {n}",
  "calc.debt.rate": "Rate of debt {n}",
  "calc.debt.ratePeriod": "Debt rates quoted",
  "calc.debt.ratePeriod.effective":
    "An annual rate is read as effective: the month's rate compounds to it over 12 months.",
  "calc.debt.ratePeriod.nominal":
    "An annual rate is read as an APR: the month's rate is the APR divided by 12.",
  "calc.debt.minimum": "Minimum payment of debt {n}",
  "calc.debt.remove": "Remove debt {n}",
  "calc.debt.add": "Add a debt",
  "calc.debt.budget": "Monthly budget for the debts",
  "calc.debt.origin": "{account}, balance on {date}",
  "calc.debt.compare": "Avalanche and snowball",
  "calc.debt.figure": "Figure",
  "calc.debt.avalanche": "Avalanche",
  "calc.debt.snowball": "Snowball",
  "calc.debt.months": "Months to the last payment",
  "calc.debt.interest": "Total interest",
  "calc.debt.closes": "{name} closes in month",
  "calc.debt.notClosedCell": "not closed",
  "calc.debt.avalancheLower": "The avalanche pays less interest by",
  "calc.debt.snowballLower": "The snowball pays less interest by",
  "calc.debt.sameInterest": "Difference in interest",
  "calc.debt.belowMinimums":
    "The budget is below the sum of the minimum payments, so no plan pays every debt.",
  "calc.debt.notClosed":
    "After 1,200 months a debt is still open: the budget does not outgrow the interest.",
  "calc.debt-payoff.step1":
    "Each month every open debt accrues its interest: balance times its monthly rate, rounded.",
  "calc.debt-payoff.step2":
    "Every open debt then receives its minimum payment, at most its balance.",
  "calc.debt-payoff.step3":
    "The rest of the budget goes to the open debts in the order's sequence, each at most its balance; a debt that closes frees its minimum for the others.",
  "calc.debt-payoff.step4":
    "Avalanche: the highest rate first, ties by the smaller balance. Snowball: the smaller balance first, ties by the higher rate.",
  "calc.debt-payoff.formula1":
    "interest of a month = round(balance × monthly rate); payment = minimum + share of (budget − Σ minimums) in the order",
  "calc.debt-payoff.assumption1":
    "Rates, minimums and the budget stay the same every month, and no new debt is taken.",
  "calc.debt-payoff.assumption2":
    "The contract rate and term of a loan are not stored, so each rate and minimum is typed.",
  "calc.debt-payoff.limit1":
    "The avalanche gives the lowest total interest; closing small accounts first predicted paying off all debt in data on 6,000 debt-settlement clients (Gal and McShane 2012). The choice is the person's.",
  "calc.debt-payoff.limit2": "A plan stops at 1,200 months.",
  "calc.recurring.schedule": "Fill from a schedule",
  "calc.recurring.schedule.none": "None",
  "calc.recurring.amount": "Amount per occurrence",
  "calc.recurring.per": "Frequency",
  "calc.recurring.per.month": "Every month",
  "calc.recurring.per.year": "Every year",
  "calc.recurring.years": "Years",
  "calc.recurring.rate": "Annual rate",
  "calc.recurring.origin": "schedule {name}",
  "calc.recurring.total": "Total paid",
  "calc.recurring.futureValue": "The same payments invested at the rate",
  "calc.recurring.difference": "Interest the payments would earn",
  "calc.recurring-cost.step1":
    "The total is the amount times the number of occurrences in the years.",
  "calc.recurring-cost.step2":
    "With a rate, each payment is treated as a deposit at the start of its period and grown to the end at the rate of that period.",
  "calc.recurring-cost.formula1":
    "total = p × n; future value = (1 + j) · ((1 + j)^n − 1) / j · p (M2)",
  "calc.recurring-cost.formula2":
    "p: amount per occurrence; n: occurrences; j: rate of a month, (1 + annual)^(1/12) − 1, or of a year (M5).",
  "calc.recurring-cost.assumption1":
    "The amount stays the same; no adjustment by an index is applied.",
  "calc.recurring-cost.limit1":
    "A schedule fills the amount of its latest terms; later changes of its terms are not projected.",
  "calc.own.price": "House price",
  "calc.own.rent": "Annual rent",
  "calc.own.riskFree": "Forgone interest rate",
  "calc.own.propertyTax": "Property tax rate",
  "calc.own.deductibleTax": "Income tax rate on deductible interest",
  "calc.own.mortgage": "Mortgage rate",
  "calc.own.maintenanceRate": "Maintenance and depreciation rate",
  "calc.own.appreciationRate": "Expected appreciation",
  "calc.own.riskPremiumRate": "Risk premium of owning",
  "calc.own.forgone": "Forgone interest",
  "calc.own.propertyTaxCost": "Property tax",
  "calc.own.deduction": "Tax deduction",
  "calc.own.maintenance": "Maintenance and depreciation",
  "calc.own.appreciation": "Expected appreciation",
  "calc.own.riskPremium": "Risk premium",
  "calc.own.total": "Annual cost of owning",
  "calc.own.rentYear": "Annual rent",
  "calc.own.ownLower": "Owning costs less per year by",
  "calc.own.rentLower": "Renting costs less per year by",
  "calc.own.same": "Difference per year",
  "calc.own-or-rent.step1":
    "Each component is the price times its rate; the deduction and the appreciation lower the cost.",
  "calc.own-or-rent.step2":
    "The annual cost of owning is the sum of the six components, set against the annual rent.",
  "calc.own-or-rent.formula1":
    "cost = P·r_rf + P·ω − P·τ(r_m + ω) + P·δ − P·g + P·γ",
  "calc.own-or-rent.formula2":
    "P: house price; r_rf: forgone interest rate; ω: property tax rate; τ: income tax rate on deductible mortgage interest and property tax; r_m: mortgage rate; δ: maintenance and depreciation; g: expected appreciation; γ: risk premium of owning.",
  "calc.own-or-rent.assumption1":
    "Every rate is annual and applies to the whole price.",
  "calc.own-or-rent.assumption2":
    "The deduction exists only where mortgage interest is deductible; its rate starts at 0.",
  "calc.own-or-rent.limit1":
    "The formula comes from the United States federal income tax; another country's taxes enter through ω and τ.",
  "calc.own-or-rent.limit2":
    "Expected appreciation and the risk premium are estimates the person chooses.",
  "calc.results.emptyTitle": "The result appears here",
  "calc.options": "Optional adjustments",
  "calc.method.description": "Steps, formula, assumptions, limits and sources",
  "calc.term": "Term",
  "calc.unit": "Unit",
  "calc.fixedIncome.days.equivalent":
    "{days} calendar days from today to the redemption.",
  "calc.unit.months": "months",
  "calc.unit.days": "days",
  "calc.unit.years": "years",
  "calc.unit.installments": "installments",
  "calc.rateSource.hint":
    "A rate typed below, or the last 12 months of an index.",
  "calc.percent.hint": "100 is the index itself; 110 is 10% above it.",
  "calc.compound.initial.hint": "What is invested today.",
  "calc.compound.deposit.hint": "Made at the start of each month.",
  "calc.compound.target.hint": "The balance to reach at the end.",
  "calc.compound.rate.hint": "Expected return, before tax and fees.",
  "calc.compound.inflation.hint": "Adds the final amount in today's money.",
  "calc.compound.delay.hint":
    "Adds what the final amount loses when the deposits start this many months later.",
  "calc.compound.volatility.hint":
    "How much yearly returns vary (standard deviation). Adds a range of final amounts from 2,000 simulated paths.",
  "calc.compound.summary":
    "{deposited} deposited over {months} months earn {interest} in interest.",
  "calc.compound.targetSummary":
    "This deposit each month for {months} months reaches {target}.",
  "calc.rates.rate.hint": "The rate as quoted, with its period.",
  "calc.rates.inflation.hint": "Adds the rate after inflation.",
  "calc.rates.index.hint":
    "Adds the annual rate of a percent of the index over its last 12 months.",
  "calc.correction.amount.hint": "The amount on the start month.",
  "calc.correction.summary":
    "{index} varied {percent} from {from} to {to}, over {months} months.",
  "calc.fixedIncome.days.hint":
    "Calendar days from the investment to the redemption.",
  "calc.fixedIncome.kind.hint": "Exempt: the yield pays no income tax.",
  "calc.fixedIncome.summary":
    "{gross} of gross yield, less {tax} of tax ({share}), over {days} days.",
  "calc.financing.solve.hint": "Fill in the other three figures.",
  "calc.financing.installment.hint":
    "The installment that stays the same every month.",
  "calc.financing.prepayMonth.hint":
    "Adds what an extra payment changes: a shorter term or a smaller installment.",
  "calc.financing.summary":
    "{priceName}: {price} every month. {sacName}: from {sacFirst} down to {sacLast}.",
  "calc.financing.prepay.title": "With the extra payment",
  "calc.financing.schedule": "Month by month",
  "calc.cash.compare.hint":
    "What the money would earn meanwhile. With it, the result states which option costs less.",
  "calc.cash.summary":
    "Paying in installments costs {monthly} a month ({annual} a year) over the cash price.",
  "calc.cash.verdictSummary":
    "At {rate} a year, the installments are worth {value} today.",
  "calc.credit.released.hint": "What reaches the account.",
  "calc.credit.fees.hint":
    "Fees, insurance and taxes paid at the start or taken from the amount released.",
  "calc.credit.cost": "Interest and fees",
  "calc.credit.summary": "{paid} paid back for {released} received.",
  "calc.debt.budget.hint":
    "All that goes to the debts each month, minimums included.",
  "calc.debt.list": "Debts",
  "calc.debt.summary":
    "The last debt closes in month {avalanche} with the avalanche and in month {snowball} with the snowball.",
  "calc.recurring.rate.hint":
    "Adds what the same payments would reach if invested.",
  "calc.recurring.summaryMonth": "{amount} every month for {years} years.",
  "calc.recurring.summaryYear": "{amount} every year for {years} years.",
  "calc.own.rent.hint": "Twelve months of rent for a comparable home.",
  "calc.own.riskFree.hint":
    "What the money in the home would earn at no risk, a year.",
  "calc.own.propertyTax.hint": "Yearly property tax, as a share of the price.",
  "calc.own.deductibleTax.hint":
    "Only where mortgage interest is deductible; 0 elsewhere.",
  "calc.own.mortgage.hint": "Used only for the deduction.",
  "calc.own.maintenanceRate.hint":
    "Repairs and wear, a year, as a share of the price.",
  "calc.own.appreciationRate.hint": "Expected yearly rise of the price.",
  "calc.own.riskPremiumRate.hint":
    "Compensation for the risk of the price falling.",
  "calc.own.summary": "Owning costs {own} a year against {rent} of rent.",
  "calc.unavailable": "This calculator is not available yet",
  "calc.unavailable.description":
    "It reads figures of your accounts that this version does not compute yet.",
  "calc.group.invest.description":
    "How an amount grows, what a rate means and what is left after tax.",
  "calc.group.credit.description":
    "What a loan or an installment plan costs, and how to pay debts off.",
  "calc.group.plan.description":
    "Recurring costs, reserves and the choice between owning and renting.",
} as const;
