# Criar uma regra de categoria

Uma regra dá a categoria certa a uma transação assim que ela chega, importada ou registrada à mão.

## Montar a regra

![Vídeo: a criação de uma regra de categoria, até salvar](category-rule.video)

1. Em [Categorias](/categories), abra a aba **Regras** e escolha **Nova regra**.
   ![A aba Regras, com o botão Nova regra marcado](rule-new)
2. Em **Se a transação**, adicione as condições: por exemplo, a descrição contém uma palavra, ou o valor está numa faixa. Todas as condições precisam valer ao mesmo tempo. Comparações de texto ignoram maiúsculas e acentos.
   ![O editor de regra, com as condições marcadas](rule-conditions)
3. Em **Então**, adicione as ações: a categoria, o favorecido, as tags ou a divisão entre categorias. As ações são aplicadas na ordem da lista.
   ![O editor de regra, com as ações marcadas](rule-actions)
4. Confira a prévia: ela mostra quantas transações do último ano a regra categorizaria e quantas já categorizadas ela mudaria.
   ![O editor de regra, com a prévia marcada](rule-preview)
5. Escolha **Salvar regra**.
   ![O editor de regra, com o botão Salvar regra marcado](rule-save)

Nos valores, saídas são negativas, como no extrato do banco.

## A ordem das regras

As regras rodam na ordem da lista. Marque **Parar as regras depois desta quando ela combinar** para que nenhuma regra seguinte mude a transação. Use **Mover para o topo** para dar prioridade a uma regra.

## Aplicar às transações que já existem

**Executar regras** aplica as regras às transações que ainda estão sem categoria. As transações já categorizadas não mudam.

O equori também sugere regras a partir das categorias que você escolhe à mão. Uma sugestão vira regra quando você escolhe **Criar regra**.
