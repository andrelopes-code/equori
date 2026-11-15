import type { planningTabsEn } from "@/i18n/catalog-planning-tabs.en";

export const planningTabsPtBR: Record<keyof typeof planningTabsEn, string> = {
  "agenda.close": "Fechamento de {month}",
  "agenda.closeNote": "Entradas menos saídas do mês",
  "agenda.leftOut": "{amounts} fora: sem cotação",
  "agenda.inflows": "Entradas",
  "agenda.received": "{percent} recebido",
  "agenda.outflows": "Saídas",
  "agenda.paid": "{percent} pago",
  "agenda.toPay": "Falta pagar",
  "agenda.pendingOne": "1 pendente",
  "agenda.pendingMany": "{count} pendentes",
  "agenda.until": "Até {date}",
  "agenda.rest": "Resto do mês",
  "agenda.happened": "Já aconteceram · {count}",
  "agenda.nothingPending": "Nada a pagar ou receber neste mês",
  "agenda.lateOne": "1 dia de atraso",
  "agenda.lateMany": "{days} dias de atraso",
  "agenda.date": "Data",
  "agenda.when": "Quando",
  "agenda.kindAccount": "Tipo e conta",
  "agenda.doneCaption": "Ocorrências que já aconteceram",
  "agenda.running": "Saldo acumulado do mês",
  "agenda.runningLow":
    "Menor saldo {amount} em {date}; o mês fecha em {close}.",
  "agenda.runningFlat":
    "O fluxo do mês não fica abaixo de zero; fecha em {close}.",
};
