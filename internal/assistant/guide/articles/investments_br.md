Rules of a book of region BR for an individual. The law changes: the notice of the broker prevails, and a doubt goes to the issuer.

Articles of the products of Brazil, each read with get_help:

| Topic | Products |
|---|---|
| fixed_income_br | CDB, RDB, LC, LF, debentures, LCI, LCA, LH, LCD, CDCA, CRI, CRA, LIG: subtypes, income tax, IOF, FGC, terms and the indexer comparison |
| government_bonds_br | Tesouro Direto: codes, tax and guarantee |
| equities_br | stocks, units, FII, Fiagro, ETF and BDR: income and the tax of a sale |
| funds_br | open funds and come-cotas |

Tax year. The tax year of Brazil is the calendar year, from January 1 to December 31; get_tax_year takes that year.

Issuer. The CNPJ of the issuer of a contract, numeric or alphanumeric (IN RFB 2.229/2024), is its identifier with the scheme br_cnpj; the check digits are validated.

Cash abroad. A balance in a foreign currency with yield_mode auto is an application abroad: the exchange variation of its principal counts in the annual tax abroad when the balance is spent, sold or exchanged back (Lei 14.754/2023, art. 3, § 2). The result of each outflow is its reais minus the average cost in reais of the balance, and get_tax_year with view abroad_tax counts it as a gain or a loss. A balance with yield_mode none gives no result (art. 2, § 3, for deposits that earn nothing in an institution authorized by the monetary authority of its country).
