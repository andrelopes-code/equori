import type { contributionPlanEn } from "@/i18n/catalog-contribution-plan.en";

export const contributionPlanPtBR: Record<
  keyof typeof contributionPlanEn,
  string
> = {
  "contributionPlan.title": "Plano de aporte",
  "contributionPlan.subtitle":
    "Para onde vai cada aporte para levar a carteira ao ideal",
  "contributionPlan.open": "Plano de aporte",
  "contributionPlan.edit": "Editar grupos e ideais",
  "contributionPlan.amount": "Aporte",
  "contributionPlan.colClass": "Grupo",
  "contributionPlan.colTarget": "Ideal",
  "contributionPlan.colCurrent": "Hoje",
  "contributionPlan.colAfter": "Depois",
  "contributionPlan.colAmount": "Recebe",
  "contributionPlan.track":
    "{name}: hoje {current}, depois do aporte {after}, ideal {target}",
  "contributionPlan.quantity": "≈ {count} un.",
  "contributionPlan.shopping": "Lista de compras",
  "contributionPlan.copy": "Copiar lista",
  "contributionPlan.colTrack": "Posição frente ao ideal",
  "contributionPlan.colExpand": "Ativos",
  "contributionPlan.colActions": "Ações",
  "contributionPlan.copyFailed": "Não foi possível copiar a lista.",
  "contributionPlan.loadFailed": "Não foi possível carregar o plano de aporte.",
  "contributionPlan.retry": "Tentar de novo",
  "contributionPlan.copied": "Lista copiada",
  "contributionPlan.shoppingEmpty": "Nenhuma compra para este valor",
  "contributionPlan.lock": "Manter {name} fixo",
  "contributionPlan.addClass": "Adicionar grupo",
  "contributionPlan.className": "Nome do grupo",
  "contributionPlan.nameRequired": "Dê um nome a cada grupo antes de salvar.",
  "contributionPlan.removeClass": "Remover {name}",
  "contributionPlan.split": "Dividir entre ativos",
  "contributionPlan.addAsset": "Adicionar ativo",
  "contributionPlan.pickAccounts": "Contas de investimento",
  "contributionPlan.pickInstruments": "Ativos",
  "contributionPlan.inClass": "Em {name}",
  "contributionPlan.removeAsset": "Remover {name}",
  "contributionPlan.moveTo": "Grupo de {name}",
  "contributionPlan.save": "Salvar",
  "contributionPlan.discard": "Descartar",
  "contributionPlan.leaveTitle": "Descartar as alterações dos ideais?",
  "contributionPlan.keepEditing": "Continuar editando",
  "contributionPlan.outside": "Fora do plano",
  "contributionPlan.noPrice": "Sem cotação",
  "contributionPlan.pickerSearch": "Buscar ativos",
  "contributionPlan.chooseClass": "Escolher grupo",
  "contributionPlan.emptyBody":
    "Defina uma vez o ideal de cada grupo e cada aporte é dividido para aproximar a carteira dele.",
  "contributionPlan.startPortfolio": "Partir da minha carteira",
  "contributionPlan.startScratch": "Começar do zero",
  "contributionPlan.firstPurchase": "Registrar a primeira compra",
  "contributionPlan.incomplete":
    "Sem divisão enquanto estes ativos não têm valor hoje:",
  "contributionPlan.missingPrice": "{name}: sem cotação",
  "contributionPlan.missingRate": "{name}: sem câmbio",
  "problem.contribution_target_sum": "Os ideais dos grupos devem somar 100%.",
  "problem.contribution_member_target_sum":
    "Os ideais dos ativos de um grupo devem somar 100%.",
  "problem.contribution_class_name_duplicate": "Dois grupos têm o mesmo nome.",
  "problem.contribution_member_duplicate":
    "Um ativo está em dois lugares do plano.",
  "problem.contribution_member_invalid":
    "Um ativo do plano não é um investimento.",
  "problem.contribution_amount_invalid": "Informe um aporte maior que zero.",
  "contributionPlan.legendCurrent": "Hoje",
  "contributionPlan.legendContribution": "Este aporte",
  "contributionPlan.legendTarget": "Ideal",
  "contributionPlan.leaveBody":
    "Os ideais editados nesta tela não foram salvos.",
  "contributionPlan.intro":
    "Você divide a carteira em grupos e diz quanto cada grupo deveria ter. Cada aporte vai para os grupos que estão abaixo do ideal, sem vender nada.",
  "contributionPlan.how": "Como funciona",
  "contributionPlan.howStep1": "Defina os grupos e o ideal de cada um.",
  "contributionPlan.howStep2": "Digite o valor do aporte.",
  "contributionPlan.howStep3": "Compre o que a lista mostra.",
  "contributionPlan.month": "Este mês",
  "contributionPlan.portfolioToday": "Carteira hoje {today}",
  "contributionPlan.portfolioAfter":
    "Carteira hoje {today} · depois do aporte {after}",
  "contributionPlan.verdictApply": "Aplique {list}.",
  "contributionPlan.verdictItem": "{amount} em {name}",
  "contributionPlan.verdictRest": "Os demais grupos não recebem neste mês.",
  "contributionPlan.verdictNoAmount":
    "Informe o valor do aporte para ver onde aplicar.",
  "contributionPlan.verdictMissingPrice":
    "{name} está sem cotação; sem ela o aporte não é dividido.",
  "contributionPlan.verdictMissingRate":
    "{name} está sem câmbio; sem ele o aporte não é dividido.",
};
