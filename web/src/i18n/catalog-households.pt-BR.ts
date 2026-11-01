import type { householdsEn } from "@/i18n/catalog-households.en";

export const householdsPtBR: Record<keyof typeof householdsEn, string> = {
  "problem.book_role_required":
    "Seu papel neste livro não permite esta alteração.",
  "problem.books_not_found": "O livro não existe ou você não é membro dele.",
  "problem.member_not_found": "O membro não faz parte deste livro.",
  "problem.last_owner":
    "O livro precisa de pelo menos um dono. Torne outro membro dono antes.",
  "problem.email_taken": "Já existe um membro com este e-mail.",
  "problem.already_member": "Este e-mail já é membro do livro.",
  "problem.invitation_not_found": "O convite não existe ou expirou.",
  "problem.invitation_email_mismatch":
    "O convite é para outro e-mail. Saia e entre com o e-mail convidado.",
  "shell.readOnly":
    "Seu acesso a este livro é somente leitura. Alterações são recusadas.",
  "books.label": "Livros",
  "books.new": "Novo livro",
  "books.name": "Nome",
  "books.name.help": "Como o livro aparece na lista de livros.",
  "books.region.help": "A moeda base do novo livro segue esta região.",
  "books.create": "Criar livro",
  "settings.members.title": "Membros",
  "settings.summary.members":
    "Quem acessa os dados deste livro e com qual papel.",
  "members.role": "Papel",
  "members.role.owner": "Dono",
  "members.role.write": "Editor",
  "members.role.read": "Leitor",
  "members.role.owner.help":
    "Gerencia membros, convites e as configurações do livro.",
  "members.role.write.help": "Registra e altera dados.",
  "members.role.read.help": "Vê e exporta os dados.",
  "members.you": "Você",
  "members.since": "Membro desde {date}",
  "members.remove": "Remover",
  "members.removeTitle": "Remover {email}?",
  "members.removeHint":
    "O membro perde o acesso a este livro. As sessões, os tokens de acesso e as conversas com o assistente dele neste livro são apagados.",
  "members.leave": "Sair deste livro",
  "members.leaveTitle": "Sair deste livro?",
  "members.leaveHint":
    "Você perde o acesso aos dados deste livro e suas conversas com o assistente nele são apagadas. A sessão termina.",
  "accounts.invite.title": "Contas desta instância",
  "accounts.invite.description":
    "Crie uma conta separada, com livro próprio, para outra pessoa.",
  "accounts.invite.create": "Criar conta",
  "accounts.invite.dialogTitle": "Nova conta",
  "accounts.invite.hint":
    "A pessoa recebe um link, escolhe a senha e vê apenas um livro só dela.",
  "accounts.invite.linkTitle": "Link para {email}",
  "accounts.invite.linkHint":
    "Envie este link para {email}. Funciona uma vez, expira em {date} e não será mostrado de novo.",
  "accounts.invite.copy": "Copiar link",
  "invite.accountSummary": "{inviter} criou uma conta para {email}.",
  "invitations.title": "Convites",
  "invitations.empty": "Nenhum convite pendente.",
  "invitations.create": "Convidar",
  "invitations.email": "E-mail",
  "invitations.expires": "Expira em {date}",
  "invitations.revoke": "Revogar",
  "invitations.linkTitle": "Link do convite",
  "invitations.linkHint":
    "Envie este link para {email}. Ele vale uma vez, até {date}, e não é mostrado de novo.",
  "invitations.done": "Concluir",
  "invite.title": "Convite",
  "invite.summary":
    "{inviter} convida {email} para o livro {books} como {role}.",
  "invite.newMember": "Escolha uma senha para criar seu acesso.",
  "invite.existingMember": "Entre como {email} para aceitar.",
  "invite.accept": "Aceitar convite",
  "invite.tokenMissing":
    "O endereço não contém convite. Abra de novo o link recebido.",
};
