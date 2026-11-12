import type { contributionPlanEn } from "@/i18n/catalog-contribution-plan.en";

export const contributionPlanPtBR: Record<
  keyof typeof contributionPlanEn,
  string
> = {
  "contributionPlan.title": "Plano de aporte",
  "contributionPlan.subtitle":
    "Para onde vai cada aporte para levar a carteira ao alvo",
  "contributionPlan.open": "Plano de aporte",
  "contributionPlan.edit": "Editar alvos",
  "contributionPlan.amount": "Aporte",
  "contributionPlan.total": "Carteira",
  "contributionPlan.totalAfter": "Após o aporte",
  "contributionPlan.driftMoves":
    "Este aporte leva a carteira de {before} para {after} de distância do alvo.",
  "contributionPlan.driftNow": "A carteira está a {drift} do alvo.",
  "contributionPlan.points": "{value} p.p.",
  "contributionPlan.colClass": "Classe",
  "contributionPlan.colTarget": "Alvo",
  "contributionPlan.colCurrent": "Atual",
  "contributionPlan.colAfter": "Após",
  "contributionPlan.colAmount": "Aportar",
  "contributionPlan.track":
    "{name}: atual {current}, após {after}, alvo {target}",
  "contributionPlan.quantity": "≈ {count} un.",
  "contributionPlan.shopping": "Lista de compras",
  "contributionPlan.copy": "Copiar lista",
  "contributionPlan.colTrack": "Posição frente ao alvo",
  "contributionPlan.colExpand": "Ativos",
  "contributionPlan.colActions": "Ações",
  "contributionPlan.copyFailed": "Não foi possível copiar a lista.",
  "contributionPlan.loadFailed": "Não foi possível carregar o plano de aporte.",
  "contributionPlan.retry": "Tentar de novo",
  "contributionPlan.copied": "Lista copiada",
  "contributionPlan.shoppingEmpty": "Nenhuma compra para este valor",
  "contributionPlan.lock": "Manter {name} fixo",
  "contributionPlan.addClass": "Adicionar classe",
  "contributionPlan.className": "Nome da classe",
  "contributionPlan.nameRequired": "Dê um nome à classe",
  "contributionPlan.removeClass": "Remover {name}",
  "contributionPlan.split": "Dividir entre ativos",
  "contributionPlan.addAsset": "Adicionar ativo",
  "contributionPlan.pickAccounts": "Contas de investimento",
  "contributionPlan.pickInstruments": "Ativos",
  "contributionPlan.inClass": "Em {name}",
  "contributionPlan.removeAsset": "Remover {name}",
  "contributionPlan.moveTo": "Classe de {name}",
  "contributionPlan.save": "Salvar",
  "contributionPlan.discard": "Descartar",
  "contributionPlan.leaveTitle": "Descartar as alterações dos alvos?",
  "contributionPlan.keepEditing": "Continuar editando",
  "contributionPlan.outside": "Fora do plano",
  "contributionPlan.pickerSearch": "Buscar ativos",
  "contributionPlan.chooseClass": "Escolher classe",
  "contributionPlan.emptyBody":
    "Defina uma divisão-alvo uma vez e cada aporte é dividido para aproximar a carteira dela.",
  "contributionPlan.startPortfolio": "Partir da minha carteira",
  "contributionPlan.startScratch": "Começar do zero",
  "contributionPlan.firstPurchase": "Registrar a primeira compra",
  "contributionPlan.incomplete":
    "Sem divisão enquanto estes ativos não têm valor hoje:",
  "contributionPlan.missingPrice": "{name}: sem cotação",
  "contributionPlan.missingRate": "{name}: sem câmbio",
  "problem.contribution_target_sum": "Os alvos das classes devem somar 100%.",
  "problem.contribution_member_target_sum":
    "Os alvos dos ativos de uma classe devem somar 100%.",
  "problem.contribution_class_name_duplicate": "Duas classes têm o mesmo nome.",
  "problem.contribution_member_duplicate":
    "Um ativo está em dois lugares do plano.",
  "problem.contribution_member_invalid":
    "Um ativo do plano não é um investimento.",
  "problem.contribution_amount_invalid": "Informe um aporte maior que zero.",
  "contributionPlan.legendCurrent": "Atual",
  "contributionPlan.legendContribution": "Este aporte",
  "contributionPlan.legendTarget": "Alvo",
  "contributionPlan.leaveBody":
    "Os alvos editados nesta tela não foram salvos.",
};
