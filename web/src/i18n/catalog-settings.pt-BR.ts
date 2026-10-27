import type { settingsEn } from "@/i18n/catalog-settings.en";

// The words of the settings screen in pt-BR, spread into catalogPtBR.
export const settingsPtBR: Record<keyof typeof settingsEn, string> = {
  "settings.group.personal": "Pessoal",
  "settings.group.books": "Livros",
  "settings.group.connections": "Conexões",
  "settings.group.system": "Sistema",
  "settings.summary.account": "Identidade conectada, papel e sessão.",
  "settings.summary.appearance":
    "Tema, cores, forma, texto e movimento da interface.",
  "settings.summary.language": "Idioma, e como datas e números são escritos.",
  "settings.summary.privacy": "Valores ocultos na tela.",
  "settings.summary.finances": "Moeda base e instrumentos.",
  "settings.summary.calendars": "Feriados que deslocam datas agendadas.",
  "settings.summary.integrations": "Credenciais de agregadores.",
  "settings.summary.assistant":
    "Provedores de modelos de linguagem, usos e gastos.",
  "settings.summary.data": "Exportação e importação dos livros.",
  "settings.browserOnly.tag": "Este navegador",
  "settings.account.session": "Sessão",
  "settings.account.logoutDescription":
    "Encerra a sessão neste navegador. Outros dispositivos continuam conectados.",
  "settings.language.help": "Palavras da interface.",
  "settings.region.help":
    "Formatos de data e número, e os catálogos regionais.",
  "settings.language.exampleDescription":
    "A data de hoje e um número, como a região escolhida os escreve.",
  "settings.ledger.instrumentsTitle": "Instrumentos",
  "settings.ledger.instrumentsDescription": "Moedas, ativos e seus preços.",
  "settings.preview": "Pré-visualização",
  "settings.preview.description": "Cada escolha abaixo se aplica aqui na hora.",
  "settings.preview.heading": "Revisão do mês",
  "settings.preview.body": "Doze transações aguardam uma categoria.",
  "settings.preview.primary": "Confirmar",
  "settings.preview.secondary": "Revisar",
  "settings.preview.tertiary": "Depois",
  "settings.preview.accent": "Previsto",
  "settings.preview.success": "Pago",
  "settings.preview.warning": "Vence logo",
  "settings.preview.danger": "Atrasado",
  "settings.preview.switch": "Notificar",
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
};
