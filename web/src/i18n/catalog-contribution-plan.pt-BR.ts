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
  "contributionPlan.colTarget": "Ideal",
  "contributionPlan.quantity": "≈ {count} un.",
  "contributionPlan.shopping": "Lista de compras",
  "contributionPlan.copy": "Copiar lista",
  "contributionPlan.copyFailed": "Não foi possível copiar a lista.",
  "contributionPlan.loadFailed": "Não foi possível carregar o plano de aporte.",
  "contributionPlan.retry": "Tentar de novo",
  "contributionPlan.copied": "Lista copiada",
  "contributionPlan.shoppingEmpty": "Nenhuma compra para este valor",
  "contributionPlan.lock": "Manter {name} fixo",
  "contributionPlan.addClass": "Adicionar grupo",
  "contributionPlan.className": "Nome do grupo",
  "contributionPlan.split": "Dividir entre ativos",
  "contributionPlan.addAsset": "Adicionar ativo",
  "contributionPlan.pickAccounts": "Contas de investimento",
  "contributionPlan.pickInstruments": "Ativos",
  "contributionPlan.inClass": "Em {name}",
  "contributionPlan.moveTo": "Grupo de {name}",
  "contributionPlan.save": "Salvar",
  "contributionPlan.discard": "Descartar",
  "contributionPlan.leaveTitle": "Descartar as alterações dos ideais?",
  "contributionPlan.keepEditing": "Continuar editando",
  "contributionPlan.outside": "Fora do plano",
  "contributionPlan.noPrice": "sem cotação",
  "contributionPlan.pickerSearch": "Buscar ativos",
  "contributionPlan.chooseClass": "Escolher grupo",
  "contributionPlan.startPortfolio": "Partir da minha carteira",
  "contributionPlan.startScratch": "Começar do zero",
  "contributionPlan.firstPurchase": "Registrar a primeira compra",
  "problem.contribution_target_sum": "Os ideais dos grupos devem somar 100%.",
  "problem.contribution_member_target_sum":
    "Os ideais dos ativos de um grupo devem somar 100%.",
  "problem.contribution_class_name_duplicate": "Dois grupos têm o mesmo nome.",
  "problem.contribution_member_duplicate":
    "Um ativo está em dois lugares do plano.",
  "problem.contribution_member_invalid":
    "Um ativo do plano não é um investimento.",
  "problem.contribution_amount_invalid": "Informe um aporte maior que zero.",
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
  "contributionPlan.ideal": "Carteira frente ao ideal",
  "contributionPlan.keyToday": "hoje",
  "contributionPlan.keyAfter": "com este aporte",
  "contributionPlan.keyIdeal": "ideal",
  "contributionPlan.markerIdeal": "ideal {share}",
  "contributionPlan.statusBelow":
    "abaixo do ideal (hoje {today}, ideal {ideal})",
  "contributionPlan.statusAbove":
    "acima do ideal (hoje {today}, ideal {ideal})",
  "contributionPlan.statusAt": "no ideal ({ideal})",
  "contributionPlan.statusBelowMember":
    "abaixo do ideal (hoje {today}, ideal {ideal} do grupo)",
  "contributionPlan.statusAboveMember":
    "acima do ideal (hoje {today}, ideal {ideal} do grupo)",
  "contributionPlan.statusAtMember": "no ideal ({ideal} do grupo)",
  "contributionPlan.statusNoIdeal": "sem ideal próprio (hoje {today} do grupo)",
  "contributionPlan.outcomeReceives": "recebe {amount}",
  "contributionPlan.outcomeNone": "não recebe neste mês",
  "contributionPlan.outcomeWaits": "aguarda a cotação",
  "contributionPlan.barLabel": "{name}: hoje {today}, ideal {ideal}",
  "contributionPlan.barLabelAfter":
    "{name}: hoje {today}, depois do aporte {after}, ideal {ideal}",
  "contributionPlan.barLabelNoIdeal":
    "{name}: hoje {today} do grupo, sem ideal próprio",
  "contributionPlan.showAssets": "Mostrar os ativos de {name}",
  "contributionPlan.outsideOne": "{count} investimento fora do plano",
  "contributionPlan.outsideMany": "{count} investimentos fora do plano",
  "contributionPlan.outsideWithTotal": "{summary} · {total}",
  "contributionPlan.barIdeal": "Ideal",
  "contributionPlan.barToday": "Hoje",
  "contributionPlan.barContribution": "Este aporte",
  "contributionPlan.barNoAmount": "informe o valor do aporte",
  "contributionPlan.barNameMissing": "dê um nome a cada grupo",
  "contributionPlan.handle": "Divisão entre {left} e {right}",
  "contributionPlan.handleValue": "{left} {leftShare}, {right} {rightShare}",
  "contributionPlan.help":
    "Arraste a divisão entre dois grupos ou digite o percentual. O total fica sempre em 100%. O cadeado mantém um grupo fixo.",
  "contributionPlan.helpLabel": "Como editar",
  "contributionPlan.decrease": "Diminuir {name}",
  "contributionPlan.increase": "Aumentar {name}",
  "contributionPlan.rowMenu": "Ações de {name}",
  "contributionPlan.removeGroup": "Remover grupo",
  "contributionPlan.removeMember": "Remover ativo",
};
