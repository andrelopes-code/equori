import type { securityEn } from "@/i18n/catalog-security.en";

export const securityPtBR: Record<keyof typeof securityEn, string> = {
  "problem.totp_enabled": "O app autenticador já está ativado.",
  "problem.totp_code_invalid":
    "O código está errado ou expirou. Digite o código atual do app.",
  "problem.password_invalid": "A senha está incorreta.",
  "problem.passkey_invalid":
    "Não foi possível verificar a chave de acesso. Tente de novo.",
  "problem.passkey_not_found": "A chave de acesso não existe mais.",
  "problem.second_factor_invalid":
    "O código ou a chave de acesso não é válido.",
  "problem.second_factor_missing":
    "Ative o app autenticador ou adicione uma chave de acesso antes.",
  "settings.security.title": "Segurança",
  "settings.summary.security":
    "Segundo fator no login: app autenticador, chaves de acesso e códigos de recuperação.",
  "security.on": "Ativado",
  "security.off": "Desativado",
  "security.done": "Concluir",
  "security.confirm": "Confirmar",
  "security.totp.title": "App autenticador",
  "security.totp.description":
    "Um código de seis dígitos de um app autenticador, pedido depois da senha.",
  "security.totp.enable": "Configurar",
  "security.totp.disable": "Desativar",
  "security.totp.dialogTitle": "Configurar o app autenticador",
  "security.totp.scan": "Leia o código com o app ou digite a chave nele.",
  "security.totp.qr": "QR code para o app autenticador",
  "security.totp.secret": "Chave",
  "security.totp.code": "Código do app",
  "security.totp.confirm": "Ativar",
  "security.totp.disableTitle": "Desativar o app autenticador?",
  "security.totp.disableHint":
    "O login deixa de pedir o código. Digite sua senha para confirmar.",
  "security.passkeys.title": "Chaves de acesso",
  "security.passkeys.description":
    "Um dispositivo ou um gerenciador de senhas confirma o login depois da senha.",
  "security.passkeys.empty": "Nenhuma chave de acesso.",
  "security.passkeys.add": "Adicionar chave de acesso",
  "security.passkeys.unavailable":
    "Chaves de acesso exigem HTTPS ou localhost. Neste endereço, use o app autenticador.",
  "security.passkeys.name": "Nome",
  "security.passkeys.name.help":
    "Onde a chave fica guardada, como o celular ou o computador.",
  "security.passkeys.create": "Criar chave de acesso",
  "security.passkeys.created": "Adicionada em {date}",
  "security.passkeys.lastUsed": "Último uso em {date}",
  "security.passkeys.remove": "Remover",
  "security.passkeys.removeTitle": "Remover {name}?",
  "security.passkeys.removeHint":
    "A chave deixa de valer para esta conta. Digite sua senha para confirmar.",
  "security.passkeys.cancelled": "O navegador não criou a chave de acesso.",
  "security.recovery.title": "Códigos de recuperação",
  "security.recovery.description":
    "Cada código substitui o segundo fator uma vez, quando o app ou a chave não estiver à mão.",
  "security.recovery.left": "Códigos restantes: {count}",
  "security.recovery.none":
    "Os códigos de recuperação existem enquanto um segundo fator está ativo.",
  "security.recovery.regenerate": "Gerar novos códigos",
  "security.recovery.regenerateTitle": "Gerar novos códigos de recuperação?",
  "security.recovery.regenerateHint":
    "Os códigos atuais deixam de valer. Digite sua senha para confirmar.",
  "security.recovery.dialogHint":
    "Guarde estes códigos fora deste dispositivo. Cada um vale uma vez, e eles não são mostrados de novo.",
  "login.secondFactor.title": "Confirme que é você",
  "login.secondFactor.subtitle":
    "Esta conta pede um segundo fator depois da senha.",
  "login.secondFactor.passkey": "Usar chave de acesso",
  "login.secondFactor.totp": "Código do app autenticador",
  "login.secondFactor.recovery": "Código de recuperação",
  "login.secondFactor.useRecovery": "Usar um código de recuperação",
  "login.secondFactor.useTotp": "Usar o app autenticador",
  "login.secondFactor.submit": "Confirmar",
  "login.secondFactor.back": "Voltar",
  "login.secondFactor.expired": "O login expirou. Digite a senha de novo.",
  "login.secondFactor.passkeyFailed":
    "O navegador não retornou a chave de acesso.",
};
