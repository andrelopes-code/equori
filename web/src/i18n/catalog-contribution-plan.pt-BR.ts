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
  "contributionPlan.planHint":
    "O plano do mês envia {savings} de poupança agendada e {goals} de depósitos em metas à corretora.",
  "contributionPlan.usePlan": "Usar {amount}",
  "contributionPlan.reservedFor": "reservado para {goal}",
  "contributionPlan.colTarget": "Ideal",
  "contributionPlan.colGroup": "Grupo",
  "contributionPlan.colGets": "Recebe",
  "contributionPlan.quantity": "≈ {count} cotas",
  "contributionPlan.orderUnits": "≈ {count} cotas · {cost}",
  "contributionPlan.leftover": "Sobra {amount}",
  "contributionPlan.orderOne": "≈ {count} cota × {price}",
  "contributionPlan.orderMany": "≈ {count} cotas × {price}",
  "contributionPlan.orderSymbol": "≈ {count} {symbol} × {price}",
  "contributionPlan.byValue": "aplicação por valor",
  "contributionPlan.unpriced": "sem cotação · valor planejado",
  "contributionPlan.colAsset": "Ativo",
  "contributionPlan.colOrder": "Ordem",
  "contributionPlan.colTotal": "Total",
  "contributionPlan.colShare": "Do aporte",
  "contributionPlan.leftoverName": "Sobra",
  "contributionPlan.leftoverStays": "fica na conta",
  "contributionPlan.purchaseBarLabel": "Divisão do aporte: {parts}",
  "contributionPlan.purchaseBarEnd": "aporte {amount}",
  "contributionPlan.splitToSee": "divida entre ativos para ver as cotas",
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
  "problem.contribution_question_invalid":
    "Cada pergunta tem de 1 a 200 caracteres e é diferente das outras do grupo; um grupo tem no máximo 10.",
  "problem.contribution_answers_invalid":
    "Cada ativo de um grupo com perguntas responde todas as perguntas, e o ideal vem das respostas.",
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
  "contributionPlan.verdictMany":
    "Aplique {amount} em {count} compras, listadas abaixo.",
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
  "contributionPlan.statusBelowAfter":
    "abaixo do ideal (hoje {today}, depois {after}, ideal {ideal})",
  "contributionPlan.statusAboveAfter":
    "acima do ideal (hoje {today}, depois {after}, ideal {ideal})",
  "contributionPlan.statusAtAfter":
    "no ideal (hoje {today}, depois {after}, ideal {ideal})",
  "contributionPlan.statusBelowAfterMember":
    "abaixo do ideal (hoje {today}, depois {after}, ideal {ideal} do grupo)",
  "contributionPlan.statusAboveAfterMember":
    "acima do ideal (hoje {today}, depois {after}, ideal {ideal} do grupo)",
  "contributionPlan.statusAtAfterMember":
    "no ideal (hoje {today}, depois {after}, ideal {ideal} do grupo)",
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
  "contributionPlan.assetsButton": "Ativos ({count})",
  "contributionPlan.splitLong": "Dividir o ideal do grupo entre os ativos",
  "contributionPlan.splitHint":
    "Ligado, cada ativo tem seu próprio ideal dentro do grupo.",
  "contributionPlan.noAssets":
    "Nenhum ativo neste grupo. Adicione os ativos que você compra para ele.",
  "contributionPlan.removeGroup": "Remover grupo",
  "contributionPlan.removeMember": "Remover ativo",
  "contributionPlan.compareIndexers": "comparar indexadores",
  "contributionPlan.compareIndexers.title": "Comparar indexadores",
  "contributionPlan.fundReport": "ver informe",
  "contributionPlan.fundReport.title": "Informe do fundo",
  "contributionPlan.questions.mode": "Ideal de cada ativo",
  "contributionPlan.questions.typed": "Digitado",
  "contributionPlan.questions.byQuestions": "Pelas minhas perguntas",
  "contributionPlan.questions.hint":
    "Escreva perguntas de sim ou não. Cada sim soma um ponto ao ativo; o ideal de cada ativo é a sua parte dos pontos do grupo.",
  "contributionPlan.questions.label": "Pergunta {n}",
  "contributionPlan.questions.remove": "Remover pergunta {n}",
  "contributionPlan.questions.add": "Adicionar pergunta",
  "contributionPlan.questions.answerLabel": "Resposta à pergunta {n}",
  "contributionPlan.questions.count": "{yes} de {count} sim",
  "contributionPlan.questions.ideal": "ideal {share} do grupo",
  "contributionPlan.questions.noYes":
    "Nenhum sim: o grupo recebe o valor sem divisão entre os ativos.",
  "contributionPlan.questions.noFacts": "Uma conta não tem informe.",
  "contributionPlan.rule.currency": "em {code}",
  "contributionPlan.rule.years.between": "vence de {from} a {to}",
  "contributionPlan.rule.years.from": "vence a partir de {from}",
  "contributionPlan.rule.years.to": "vence até {to}",
  "contributionPlan.rule.liquidity.yes": "liquidez diária",
  "contributionPlan.rule.liquidity.no": "sem liquidez diária",
  "contributionPlan.rule.guarantee.covered": "coberto pelo {name}",
  "contributionPlan.rule.guarantee.sovereign": "título público",
  "contributionPlan.rule.guarantee.uncovered": "sem garantia",
  "contributionPlan.rule.guarantee.unavailable":
    "garantia indisponível na região do livro",
  "contributionPlan.rule.mode.label": "Como o grupo reúne seus ativos",
  "contributionPlan.rule.mode.chosen": "Ativos escolhidos",
  "contributionPlan.rule.mode.byRule": "Por regra",
  "contributionPlan.rule.mode.dropMembersOne":
    "O ativo escolhido sai do grupo.",
  "contributionPlan.rule.mode.dropMembersMany":
    "Os {count} ativos escolhidos saem do grupo.",
  "contributionPlan.rule.mode.dropRulesOne": "A regra sai do grupo.",
  "contributionPlan.rule.mode.dropRulesMany":
    "As {count} regras saem do grupo.",
  "contributionPlan.rule.mode.confirm": "Trocar",
  "contributionPlan.rule.mode.keep": "Manter",
  "contributionPlan.rule.intro":
    "Entra no grupo todo ativo que atende uma das regras, inclusive os que você comprar depois.",
  "contributionPlan.rule.add": "Adicionar regra",
  "contributionPlan.rule.edit": "Editar regra",
  "contributionPlan.rule.remove": "Remover regra",
  "contributionPlan.rule.countOne": "1 ativo · {value}",
  "contributionPlan.rule.countMany": "{count} ativos · {value}",
  "contributionPlan.rule.none": "nenhum ativo hoje",
  "contributionPlan.rule.dialog.title": "Regra do grupo {name}",
  "contributionPlan.rule.dialog.type": "Tipo de investimento",
  "contributionPlan.rule.dialog.any": "Qualquer",
  "contributionPlan.rule.dialog.subtypes": "Subtipos",
  "contributionPlan.rule.dialog.returnKind": "Forma do retorno",
  "contributionPlan.rule.dialog.maturity": "Vencimento",
  "contributionPlan.rule.dialog.from": "De",
  "contributionPlan.rule.dialog.to": "Até",
  "contributionPlan.rule.dialog.liquidity": "Liquidez diária",
  "contributionPlan.rule.dialog.yes": "Sim",
  "contributionPlan.rule.dialog.no": "Não",
  "contributionPlan.rule.dialog.guarantee": "Garantia",
  "contributionPlan.rule.dialog.covered": "Coberto pelo {name}",
  "contributionPlan.rule.dialog.sovereign": "Título público",
  "contributionPlan.rule.dialog.uncovered": "Sem garantia",
  "contributionPlan.rule.dialog.currency": "Moeda de cotação",
  "contributionPlan.rule.dialog.save": "Salvar regra",
  "contributionPlan.rule.dialog.cancel": "Cancelar",
  "contributionPlan.rule.dialog.needCondition":
    "Escolha ao menos uma condição.",
  "contributionPlan.rule.dialog.yearRange": "Um ano de 1900 a 2200.",
  "contributionPlan.rule.dialog.yearOrder":
    "O ano final não pode vir antes do inicial.",
  "contributionPlan.rule.dialog.entersOne":
    "Entra neste grupo hoje: 1 ativo · {value}",
  "contributionPlan.rule.dialog.entersMany":
    "Entram neste grupo hoje: {count} ativos · {value}",
  "contributionPlan.rule.dialog.entersNone":
    "Nenhum ativo entra neste grupo hoje. Os que você comprar depois entram.",
  "contributionPlan.help.rules":
    "Um ativo escolhido em um grupo vale antes das regras. Entre regras, o ativo entra no primeiro grupo da lista.",
  "problem.contribution_rule_invalid":
    "Um grupo tem ativos escolhidos ou de 1 a 5 regras, e cada regra precisa de condições válidas.",
};
