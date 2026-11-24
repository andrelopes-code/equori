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
  "contributionPlan.reservedPrefix": "reservado para",
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
  "contributionPlan.registerAsset": "Cadastrar ativo",
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
  "contributionPlan.recordPrice": "Registrar cotação de {name}",
  "contributionPlan.recordRate": "Registrar câmbio de {name}",
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
  "contributionPlan.criteria.title": "Critérios dos ativos",
  "contributionPlan.criteria.description":
    "Opcional: seus critérios definem o ideal de cada ativo. Nada é vendido.",
  "contributionPlan.criteria.boardTitle": "Critérios de {name}",
  "contributionPlan.criteria.back": "Grupos e ideais",
  "contributionPlan.criteria.use": "Usar critérios",
  "contributionPlan.criteria.open": "Abrir critérios",
  "contributionPlan.criteria.openOf": "Abrir critérios de {name}",
  "contributionPlan.criteria.useIn": "Usar critérios em {name}",
  "contributionPlan.criteria.stateTyped": "ideal digitado por ativo",
  "contributionPlan.criteria.stateWhole": "um ideal para o grupo inteiro",
  "contributionPlan.criteria.stateOne":
    "{count} critério, {automatic} automático",
  "contributionPlan.criteria.stateMany":
    "{count} critérios, {automatic} automáticos",
  "contributionPlan.criteria.add": "Adicionar critério",
  "contributionPlan.criteria.addDescription":
    "O equori responde os automáticos. O limite de cada um é seu.",
  "contributionPlan.criteria.writeOwn": "Escrever um critério",
  "contributionPlan.criteria.writeOwnMeaning":
    "Uma pergunta de sim ou não que você responde para cada ativo.",
  "contributionPlan.criteria.pickAutomatic": "Escolher critérios automáticos",
  "contributionPlan.criteria.pickAutomaticMeaning":
    "O equori calcula das demonstrações e do preço e responde sozinho.",
  "contributionPlan.criteria.addOne": "Adicionar",
  "contributionPlan.criteria.addNamed": "Adicionar {name}",
  "contributionPlan.criteria.added": "no grupo",
  "contributionPlan.criteria.done": "Concluir",
  "contributionPlan.criteria.full": "Um grupo tem no máximo 20 critérios.",
  "contributionPlan.criteria.group.price": "Preço",
  "contributionPlan.criteria.group.return": "Rentabilidade",
  "contributionPlan.criteria.group.debt": "Dívida e liquidez",
  "contributionPlan.criteria.group.history": "Crescimento e histórico",
  "contributionPlan.criteria.group.signals": "Sinais de Piotroski",
  "contributionPlan.criteria.addNine": "Adicionar os nove",
  "contributionPlan.criteria.price_earnings_max": "P/L de até",
  "contributionPlan.criteria.price_earnings_max.meaning":
    "Preço dividido pelo lucro por ação de 12 meses.",
  "contributionPlan.criteria.price_book_max": "P/VP de até",
  "contributionPlan.criteria.price_book_max.meaning":
    "Preço dividido pelo patrimônio por ação.",
  "contributionPlan.criteria.roe_min": "ROE de ao menos",
  "contributionPlan.criteria.roe_min.meaning":
    "Retorno sobre o patrimônio: lucro de 12 meses sobre o patrimônio.",
  "contributionPlan.criteria.net_margin_min": "Margem líquida de ao menos",
  "contributionPlan.criteria.net_margin_min.meaning":
    "Lucro sobre a receita, em 12 meses.",
  "contributionPlan.criteria.gross_profit_assets_min":
    "Lucro bruto/ativos de ao menos",
  "contributionPlan.criteria.gross_profit_assets_min.meaning":
    "Lucro bruto de 12 meses sobre os ativos.",
  "contributionPlan.criteria.net_debt_equity_max": "Dívida líquida/PL de até",
  "contributionPlan.criteria.net_debt_equity_max.meaning":
    "Dívida menos caixa, sobre o patrimônio.",
  "contributionPlan.criteria.current_ratio_min":
    "Liquidez corrente de ao menos",
  "contributionPlan.criteria.current_ratio_min.meaning":
    "Ativo circulante sobre passivo circulante.",
  "contributionPlan.criteria.revenue_growth_min": "Receita cresce ao menos",
  "contributionPlan.criteria.revenue_growth_min.meaning":
    "Crescimento composto por ano nos últimos exercícios.",
  "contributionPlan.criteria.positive_years_min": "Anos com lucro, ao menos",
  "contributionPlan.criteria.positive_years_min.meaning":
    "Exercícios com lucro entre os 5 últimos.",
  "contributionPlan.criteria.limitOf": "Limite: {name}",
  "contributionPlan.criteria.years": "anos",
  "contributionPlan.criteria.ownLabel": "Critério {n}",
  "contributionPlan.criteria.ownPlaceholder": "Escreva a pergunta",
  "contributionPlan.criteria.remove": "Remover {name}",
  "contributionPlan.criteria.unnamed": "critério {n}",
  "contributionPlan.criteria.noteAutomatic": "automático",
  "contributionPlan.criteria.noteOwn": "sem dado",
  "contributionPlan.criteria.noteOutside": "não se aplica",
  "contributionPlan.criteria.noteNoLimit": "defina o limite",
  "contributionPlan.criteria.noteBlank": "escreva a pergunta",
  "contributionPlan.criteria.noteRepeated": "pergunta repetida",
  "contributionPlan.criteria.yes": "sim",
  "contributionPlan.criteria.no": "não",
  "contributionPlan.criteria.blank": "sem resposta",
  "contributionPlan.criteria.waiting": "calculando",
  "contributionPlan.criteria.points": "{yes} de {count}",
  "contributionPlan.criteria.equalShare": "parte igual",
  "contributionPlan.criteria.boardLabel": "Critérios por ativo de {name}",
  "contributionPlan.criteria.criterionColumn": "Critério",
  "contributionPlan.criteria.idealOf":
    "ideal de {name} no grupo: {share}, {yes} de {count} critérios",
  "contributionPlan.criteria.idealOfEqual":
    "ideal de {name} no grupo: {share}, parte igual por falta de resposta",
  "contributionPlan.criteria.cellAutomatic":
    "{asset}, {criterion}: {answer}, {figure}, dado de {date}, respondido pelo equori",
  "contributionPlan.criteria.cellSignal":
    "{asset}, {criterion}: {answer}, respondido pelo equori",
  "contributionPlan.criteria.cellReason":
    "{asset}, {criterion}: {answer}, {reason}, respondido pelo equori",
  "contributionPlan.criteria.cellOwn": "{asset}, {criterion}: {answer}",
  "contributionPlan.criteria.cellOwnReason":
    "{asset}, {criterion}: {answer}, sua resposta: {reason}",
  "contributionPlan.criteria.cellBlank": "{asset}, {criterion}: sem resposta",
  "contributionPlan.criteria.cellBlankReason":
    "{asset}, {criterion}: sem resposta, {reason}",
  "contributionPlan.criteria.cellWaiting": "{asset}, {criterion}: calculando",
  "contributionPlan.criteria.statementsOf": "Ver os dados de {name}",
  "contributionPlan.criteria.byCriteria": "os ideais vêm dos critérios",
  "contributionPlan.criteria.clear": "Remover critérios",
  "contributionPlan.criteria.clearTitle": "Remover os critérios de {name}?",
  "contributionPlan.criteria.clearBody":
    "O grupo volta ao ideal digitado, com os ideais de agora.",
  "contributionPlan.criteria.clearKeep": "Manter os critérios",
  "contributionPlan.criteria.emptyBody":
    "O ideal de cada ativo é a sua parte dos pontos do grupo.",
  "contributionPlan.criteria.noYes":
    "Nenhum sim: o grupo recebe o valor sem divisão entre os ativos.",
  "contributionPlan.criteria.equalShares":
    "Parte igual do grupo, por falta de resposta: {names}.",
  "contributionPlan.criteria.rules":
    "Um sim, um ponto. Sem resposta, parte igual. Preço do fim do mês anterior.",
  "contributionPlan.criteria.incompleteOne":
    "Complete {count} critério para salvar",
  "contributionPlan.criteria.incompleteMany":
    "Complete {count} critérios para salvar",
  "contributionPlan.criteria.helpLabel": "Sobre os critérios",
  "contributionPlan.criteria.helpWhat":
    "Um critério não é recomendação: o equori calcula o dado, compara com o limite que você escolheu e soma um ponto.",
  "contributionPlan.criteria.helpStudies":
    "Estudos no Brasil encontraram retorno maior em empresas com preço baixo sobre lucro e patrimônio (2007 a 2022, sem custos) e em empresas mais rentáveis (2010 a 2020). Nenhum testou limites em aportes mensais.",
  "contributionPlan.criteria.helpLimit":
    "O equori não sugere limites. Um limite escolhido não garante resultado.",
  "contributionPlan.criteria.helpPrice": "Preço baixo: UFU",
  "contributionPlan.criteria.helpQuality": "Qualidade e valor: USP",
  "contributionPlan.criteria.helpMethods":
    "Piotroski, Graham e Greenblatt: Brazilian Business Review",
  "contributionPlan.colProfit": "Lucro no ano",
  "contributionPlan.criteriaCount": "{yes} de {count} critérios",
  "contributionPlan.companyReport": "ver demonstrações",
  "contributionPlan.companyReport.title": "Demonstrações de {name}",
  "contributionPlan.fundReport": "ver informe",
  "contributionPlan.fundReport.title": "Informe do fundo",
  "contributionPlan.method.piotroski.helpLabel": "Sobre o método",
  "contributionPlan.method.piotroski.what":
    "Os nove sinais medem rentabilidade, endividamento, liquidez e eficiência nas demonstrações de dois exercícios. Piotroski (2000) testou-os em ações dos Estados Unidos de alto valor patrimonial sobre o preço, de 1976 a 1996: comprar as de mais sinais e vender as de menos rendeu 23% ao ano.",
  "contributionPlan.method.piotroski.after":
    "Em 35 países, de 2000 a 2018, as de sete ou mais sinais renderam mais que as de três ou menos, em todos os tamanhos. No Brasil, um estudo achou ganho acima do risco; outro não o achou a partir de 2011. Nos Estados Unidos, 97 regras renderam 58% menos depois de publicadas.",
  "contributionPlan.method.piotroski.limit":
    "Os estudos deixam de fora as companhias financeiras. O peso proporcional aos sinais e a parte igual de quem não os tem não foram testados. A decisão de usá-los é sua.",
  "contributionPlan.method.piotroski.source":
    "Piotroski: Journal of Accounting Research, 2000",
  "contributionPlan.method.piotroski.sourceWorld":
    "35 países: Journal of Asset Management, 2020",
  "contributionPlan.method.piotroski.sourceFor":
    "Brasil, achou: Brazilian Business Review, 2022",
  "contributionPlan.method.piotroski.sourceAgainst":
    "Brasil, não achou: REPeC, 2020",
  "contributionPlan.method.piotroski.sourceAfter":
    "Depois da publicação: Journal of Finance, 2016",
  "contributionPlan.facts.piotroski_p1": "Retorno sobre os ativos positivo",
  "contributionPlan.facts.piotroski_p2": "Caixa das operações positivo",
  "contributionPlan.facts.piotroski_p3": "Retorno sobre os ativos subiu",
  "contributionPlan.facts.piotroski_p4": "Caixa das operações acima do lucro",
  "contributionPlan.facts.piotroski_p5": "Dívida de longo prazo caiu",
  "contributionPlan.facts.piotroski_p6": "Liquidez corrente subiu",
  "contributionPlan.facts.piotroski_p7": "Sem emissão de ações",
  "contributionPlan.facts.piotroski_p8": "Margem bruta subiu",
  "contributionPlan.facts.piotroski_p9": "Giro dos ativos subiu",
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
  "contributionPlan.rule.dialog.maturityHint":
    "Ano em que o título vence. Os dois anos entram.",
  "contributionPlan.rule.dialog.anyYear": "Qualquer ano",
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
