import type { settingsEn } from "@/i18n/catalog-settings.en";

// The words of the settings screen in pt-BR, spread into catalogPtBR.
export const settingsPtBR: Record<keyof typeof settingsEn, string> = {
  "settings.group.personal": "Pessoal",
  "settings.group.books": "Finanças",
  "settings.group.connections": "Conexões",
  "settings.group.system": "Sistema",
  "settings.summary.account": "Identidade conectada, papel e sessão.",
  "settings.summary.appearance":
    "Tema, cores, forma, texto e movimento da interface.",
  "settings.summary.language": "Idioma, e como datas e números são escritos.",
  "settings.summary.privacy": "Valores ocultos na tela.",
  "settings.summary.finances": "Moeda base e cotações.",
  "settings.summary.calendars": "Feriados que deslocam datas agendadas.",
  "settings.summary.integrations": "Credenciais de agregadores.",
  "settings.summary.assistant":
    "Provedores de modelos de linguagem, usos e gastos.",
  "settings.external_access.title": "Acesso externo (MCP)",
  "settings.summary.external_access": "Claude, Codex e outros agentes.",
  "settings.external_access.description":
    "O MCP permite que um agente que você já usa, como o Claude Code ou o Codex, leia e altere suas finanças com as ferramentas do assistente.",
  "settings.external_access.privacy":
    "O provedor do modelo do cliente recebe os dados que o cliente lê.",
  "settings.external_access.write_warning":
    "Um token de leitura e escrita permite que o cliente lance e exclua sem o cartão de confirmação do equori, sob o pedido de aprovação do próprio cliente.",
  "settings.external_access.reachability":
    "O claude.ai, os conectores do Claude Desktop e os aplicativos móveis se conectam a partir dos servidores da Anthropic e precisam de um endereço HTTPS público para o equori. Clientes neste computador ou nesta rede, como o Claude Code e o Codex, se conectam assim mesmo.",
  "settings.external_access.empty":
    "Nenhum token ainda. Um token conecta um cliente.",
  "settings.external_access.create": "Criar token",
  "settings.external_access.name": "Nome",
  "settings.external_access.scope": "Acesso",
  "settings.external_access.scope.read": "Somente leitura",
  "settings.external_access.scope.write": "Leitura e escrita",
  "settings.external_access.expiry": "Expira em",
  "settings.external_access.days": "{count} dias",
  "settings.external_access.created": "criado em {date}",
  "settings.external_access.used": "último uso em {date}",
  "settings.external_access.unused": "nunca usado",
  "settings.external_access.expires": "expira em {date}",
  "settings.external_access.delete": "Excluir",
  "settings.external_access.deleteTitle": "Excluir o token {name}?",
  "settings.external_access.deleteHint":
    "Um cliente que o usa falha na próxima requisição.",
  "settings.external_access.tokenTitle": "Copie o token agora",
  "settings.external_access.tokenHint":
    "O equori o mostra só uma vez. Cole uma das configurações abaixo no cliente.",
  "settings.external_access.token": "Token",
  "settings.external_access.claudeCode": "Claude Code",
  "settings.external_access.codex":
    "Codex (config.toml); defina EQUORI_TOKEN com o token",
  "settings.external_access.json": "Outros clientes (JSON)",
  "settings.external_access.done": "Concluir",
  "settings.summary.data": "Exportação e importação dos seus registros.",
  "settings.browserOnly.tag": "Este dispositivo",
  "settings.account.session": "Sessão",
  "settings.account.logoutDescription":
    "Encerra a sessão neste dispositivo. Outros dispositivos continuam conectados.",
  "settings.language.help": "Palavras da interface.",
  "settings.region.help":
    "Formatos de data e número, e os catálogos regionais.",
  "settings.language.exampleDescription":
    "A data de hoje e um número, como a região escolhida os escreve.",
  "settings.ledger.instrumentsTitle": "Cotações",
  "settings.ledger.instrumentsDescription":
    "Moedas, investimentos e seus preços.",
  "settings.appearance.reset": "Restaurar padrões",
  "settings.appearance.theme": "Tema",
  "settings.appearance.colour": "Cor",
  "settings.appearance.shape": "Forma e espaçamento",
  "settings.appearance.text": "Texto",
  "settings.appearance.motion": "Movimento e efeitos",
  "settings.scheme.description":
    "Sistema segue o sistema operacional. Alto contraste leva todo texto e toda borda ao contraste máximo.",
  "scheme.high-contrast": "Alto contraste",
  "settings.accent.custom": "Cor personalizada",
  "settings.tone": "Tom das superfícies",
  "settings.tone.description":
    "O matiz dos fundos, das bordas e do texto secundário.",
  "tone.graphite": "Grafite",
  "tone.slate": "Ardósia",
  "tone.zinc": "Zinco",
  "tone.stone": "Pedra",
  "tone.sage": "Sálvia",
  "settings.corners.description":
    "O arredondamento de cartões, campos e botões.",
  "settings.density.description":
    "Quanto espaço linhas e controles ocupam; mais densa mostra mais linhas por tela.",
  "settings.textSize": "Tamanho do texto",
  "settings.textSize.description":
    "Escala o texto e o espaço ao redor; a altura dos controles segue a densidade.",
  "textSize.standard": "Padrão",
  "settings.typeface": "Fonte",
  "settings.typeface.description":
    "Cada fonte é baixada na primeira vez que aparece. Sistema usa a fonte do próprio sistema operacional.",
  "settings.typeface.sample": "Ag 123",
  "typeface.geist": "Geist",
  "typeface.system": "Sistema",
  "typeface.grotesque": "Inter",
  "typeface.humanist": "Source Sans",
  "typeface.rounded": "Nunito",
  "typeface.mono": "Geist Mono",
  "settings.motion": "Reduzir movimento",
  "settings.motion.description":
    "Encurta transições e animações a um instante, independente do sistema operacional.",
  "calendar.purpose":
    "O vencimento de um cartão ou a data de um agendamento que cai em dia não útil passa para um dia útil. O calendário de dias úteis define quais dias não são úteis: o fim de semana e os feriados.",
  "calendar.how.title": "Como um calendário desloca uma data",
  "calendar.how.description":
    "Cada cartão e cada agendamento usa um calendário; o calendário da sua região é o padrão. No exemplo, um vencimento no sábado passa para a segunda; a regra do agendamento também pode levá-lo ao dia útil anterior.",
  "calendar.how.asked": "Vencimento",
  "calendar.how.used": "Data usada",
  "calendar.how.example": "{asked} não é dia útil; a data passa para {used}.",
  "calendar.list.title": "Calendários disponíveis",
  "calendar.list.description":
    "Escolha um calendário para ver os dias que ele considera não úteis.",
  "calendar.holidays.count":
    "Feriados em {year}: {count}. Os fins de semana também não são dias úteis.",
  "settings.tone.custom": "Tom personalizado",
  "settings.typeface.custom": "Fonte instalada",
  "settings.typeface.customPlaceholder": "Nome da família, como Fira Sans",
  "settings.typeface.customDescription":
    "Qualquer fonte instalada neste dispositivo, pelo nome da família. Um nome que o dispositivo não tem mostra a fonte do sistema.",
  "settings.typeface.use": "Usar",
  "settings.typeface.invalid":
    "Somente letras, dígitos, espaços, pontos, hífens e sublinhados, até 64 caracteres.",
  "calendar.how.off": "Dia não útil: fim de semana ou feriado",
  "settings.theme.gallery": "Tema",
  "settings.theme.curated": "Temas do equori",
  "settings.theme.saved": "Seus temas",
  "settings.theme.savedEmpty": "Um tema salvo ou importado aparece aqui.",
  "settings.theme.current": "Tema atual",
  "settings.theme.custom": "Personalizado",
  "settings.theme.customHint":
    "Nenhum tema guarda estes valores. Salve para manter este visual.",
  "settings.theme.save": "Salvar como tema",
  "settings.theme.import": "Importar",
  "settings.theme.more": "Mais ações do tema",
  "settings.theme.copy": "Copiar como JSON",
  "settings.theme.download": "Baixar arquivo",
  "settings.theme.copied": "Tema copiado como JSON.",
  "settings.theme.rename": "Renomear",
  "settings.theme.delete": "Excluir",
  "settings.theme.name": "Nome",
  "settings.theme.nameInvalid": "De 1 a 40 caracteres.",
  "settings.theme.saveTitle": "Salvar como tema",
  "settings.theme.saveHint":
    "Guarda cor, forma e fonte. Esquema, densidade, tamanho do texto e movimento continuam seus.",
  "settings.theme.renameTitle": "Renomear tema",
  "settings.theme.deleteTitle": "Excluir {name}?",
  "settings.theme.deleteHint":
    "Os valores em uso continuam aplicados; só o tema salvo sai.",
  "settings.theme.importTitle": "Importar um tema",
  "settings.theme.importHint":
    "Cole o JSON de um tema exportado ou escolha o arquivo.",
  "settings.theme.importText": "JSON do tema",
  "settings.theme.importFile": "Escolher arquivo",
  "settings.theme.importInvalid":
    "Isto não é um tema do equori, ou um dos valores é inválido.",
  "settings.theme.imported": "Tema {name} importado e aplicado.",
  "settings.theme.limit": "Até 50 temas salvos. Exclua um para salvar outro.",
  "settings.appearance.tuning": "Ajuste fino",
  "settings.appearance.tuningHint":
    "Cada mudança vale na hora. Alterar um valor do tema torna o visual personalizado.",
  "settings.appearance.preview": "Prévia",
  "settings.status": "Cores de estado",
  "settings.status.description":
    "Entradas, valores estourados, avisos e informações.",
  "settings.status.theme": "Do tema",
  "status.success": "Entrada",
  "status.danger": "Estouro",
  "status.warning": "Aviso",
  "status.info": "Informação",
  "appearance.preview.balance": "Saldo",
  "appearance.preview.income": "Salário",
  "appearance.preview.expense": "Mercado",
  "appearance.preview.budget": "Restaurantes",
  "appearance.preview.budgetLeft": "Acima do orçamento",
  "appearance.preview.tag": "Recorrente",
  "appearance.preview.field": "Descrição",
  "appearance.preview.primary": "Salvar",
  "appearance.preview.secondary": "Cancelar",
  "theme.equori": "equori",
  "theme.equori.description": "O visual da casa: índigo sobre grafite.",
  "theme.ledger": "Livro-caixa",
  "theme.ledger.description": "Quadrado e sóbrio, em azul-tinta.",
  "theme.paper": "Papel",
  "theme.paper.description": "Pedra quente e terracota, letra humanista.",
  "theme.forest": "Floresta",
  "theme.forest.description": "Fundos sálvia com destaques verdes.",
  "theme.ocean": "Oceano",
  "theme.ocean.description": "Ardósia e ciano, arredondado.",
  "theme.dusk": "Crepúsculo",
  "theme.dusk.description": "Cinza-ameixa e rosa, letra suave.",
  "theme.terminal": "Terminal",
  "theme.terminal.description": "Âmbar sobre zinco, monoespaçado e quadrado.",
  "theme.glass": "Vidro",
  "theme.glass.description":
    "Superfícies translúcidas sobre luz em movimento. Experimental.",
};
