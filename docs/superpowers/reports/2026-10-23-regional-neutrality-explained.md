# Neutralidade regional do equori: o que mudou e como um país novo entra

Relatório do plano `docs/superpowers/plans/2026-10-22-regional-neutrality.md` (37 tarefas, de 0 a 36) e do lote de correções de 2026-10-23. O guia técnico para contribuidores está em `docs/contributing/regions.md`. Este relatório explica o mesmo conteúdo com exemplos.

## 1. O problema de partida

Antes do plano, regras brasileiras estavam gravadas no núcleo do aplicativo. Um contribuidor de Portugal, por exemplo, precisaria editar código Go, o contrato HTTP e o schema do banco de vários módulos para usar o app com euro e com os feriados portugueses.

Exemplos do estado anterior, retirados das migrations que os substituíram:

| Área | Antes | Onde estava |
|---|---|---|
| Agregador bancário | coluna `provider` aceitava só `'pluggy'` | `ingestion_integration`, trocada na migration 00048 |
| Fontes de cotação | `source IN ('manual', 'csv', 'bcb_ptax', 'b3_cotahist')` | `marketdata_price`, trocada na 00043 |
| Bolsa | `exchange IN ('B3')` | `marketdata_instrument`, trocada na 00044 |
| Tipos de provento | lista fechada com `jcp` | `ledger_investment_income`, trocada na 00047 |
| Identificador de banco | coluna `ispb` (código do Banco Central do Brasil) | `ledger_institution`, trocada na 00045 |
| IOF do cartão | 3,5% fixo no código | substituído pela coluna `foreign_charge_bp` (00046) |
| Moeda na tela | `"BRL"` como valor padrão em telas do web | removido na Task 32 |
| Retenção de JCP | constante `JCPWithholdingBP = 1500` no domínio do ledger | removida em `d9de8bc` |

Uma lista fechada no banco (`IN ('B3')`) rejeita qualquer valor novo. Acrescentar a bolsa de Lisboa exigiria uma migration nova só para ampliar a lista.

## 2. A ideia central: pontos de extensão

Um **ponto de extensão** é um lugar do código com três partes:

1. **Uma interface:** o contrato que toda implementação cumpre. Exemplo: todo agregador bancário responde `ID()`, `Name()`, `CredentialFields()` e lê contas e transações.
2. **Uma implementação por identificador:** um pacote Go por país ou serviço. Exemplo: `internal/ingestion/internal/aggregator/pluggy/`.
3. **Um registro:** a lista das implementações disponíveis, montada no construtor do módulo. O registro rejeita, na inicialização, um identificador repetido ou malformado.

O banco deixou de guardar listas fechadas. Cada coluna dessas passou a aceitar qualquer identificador no formato `^[a-z0-9_]{2,40}$` (letras minúsculas, dígitos e `_`, de 2 a 40 caracteres). Exemplo da migration 00048:

```sql
-- antes
CHECK (provider IN ('pluggy'))
-- depois
CHECK (aggregator ~ '^[a-z0-9_]{2,40}$')
```

O banco valida só o formato. O código valida se a implementação existe. Um país novo não exige migration.

### Convenção de nomes

Um identificador regional começa pelo código do país em minúsculas: `br_banking` (calendário bancário brasileiro), `br_ispb` (código ISPB). Um identificador internacional não tem prefixo: `ecb` (Banco Central Europeu), `weekend` (calendário só com sábado e domingo), `bic` (código SWIFT).

## 3. Padrões regionais: o que muda sozinho pela região do usuário

O perfil do usuário guarda um **idioma** (código ISO 639, ex.: `pt`) e uma **região** (código ISO 3166-1, ex.: `BR`, `PT`, `DE`). A região escolhe os valores iniciais de cada área por meio de funções `switch`. Uma região sem caso próprio recebe um valor neutro.

| Função | Arquivo | `BR` | Qualquer outra região |
|---|---|---|---|
| `DefaultBaseCurrency` | `internal/ledger/region_defaults.go` | `BRL` | nenhuma: o usuário escolhe |
| `DefaultForeignChargeBP` | `internal/ledger/region_defaults.go` | 350 (IOF de 3,5%) | 0 |
| `DefaultWithholdingBP` | `internal/ledger/region_defaults.go` | 1500 para `jcp` | 0 |
| `DefaultCalendar` | `internal/marketdata/region_defaults.go` | `br_banking` | `weekend` |
| `defaultJurisdiction` | `internal/portfolio/region_defaults.go` | `br` | nenhuma |
| `ConventionsOf` | `internal/platform/locale/conventions.go` | vírgula decimal, ponto de milhar, dia/mês/ano | ponto decimal, vírgula de milhar, ano/mês/dia |

O código atual de `DefaultBaseCurrency`:

```go
func DefaultBaseCurrency(region string) (money.Currency, bool) {
	switch region {
	case "BR":
		return "BRL", true
	}
	return "", false
}
```

Um contribuidor de Portugal acrescenta duas linhas:

```go
	case "PT":
		return "EUR", true
```

## 4. Exemplos por área

### 4.1 Integrações bancárias (agregadores)

Um **agregador** é um serviço externo que lê contas bancárias em nome do usuário. O Pluggy é o único implementado hoje. Exemplos de outros países: GoCardless (Europa), Plaid (Estados Unidos).

**Antes:** a coluna aceitava só `pluggy`, e o código chamava o Pluggy diretamente. Os nomes de campo `client_id` e `client_secret` estavam fixos no contrato.

**Depois:**

- **Interface `Aggregator`** (`internal/ingestion/internal/app/integration.go`): declara o identificador, o nome, os campos de credencial, o método de conexão, o intervalo mínimo de sincronização e a leitura de contas e transações.
- **Pluggy como uma implementação:** fica em `internal/ingestion/internal/aggregator/pluggy/`. Ele declara os próprios campos:

  ```go
  func (p Port) CredentialFields() []domain.CredentialField {
  	return []domain.CredentialField{{Name: "client_id"}, {Name: "client_secret", Secret: true}}
  }
  ```

- **Credenciais como mapa:** viraram um mapa de nome para valor, validado contra os campos do agregador e guardado cifrado.
- **Listagem dos agregadores:** `GET /api/v1/aggregators` devolve cada agregador com nome e campos. Uma tela pode montar o formulário a partir dessa resposta, sem conhecer o Pluggy:

  ```json
  {"items":[{"id":"pluggy","name":"Pluggy",
    "credential_fields":[{"name":"client_id","secret":false},{"name":"client_secret","secret":true}],
    "connect_method":"reference"}]}
  ```

- **Estado normalizado:** cada agregador traduz o próprio status para um `state` comum: `ok`, `needs_owner` (o usuário precisa agir) ou `failed`. O status original continua em `provider_status`.
- **Endereço configurável:** a variável `EQUORI_AGGREGATOR_<ID>_URL` define o endereço do serviço. Ela substituiu `EQUORI_PLUGGY_URL`.
- **Termo único:** o lote de correções trocou "provider" por "aggregator" no código e nos códigos de erro (`aggregator_unauthorized`, `aggregator_unavailable`). A migration 00051 renomeou a coluna `external_item_id` para `external_id` (`e2d4fbf`).

**Como um contribuidor acrescenta o GoCardless:**

1. Cria o pacote `internal/ingestion/internal/aggregator/gocardless/` com um tipo que implementa `Aggregator`.
2. Acrescenta uma entrada em `New` e em `AggregatorIDs`, ambos em `internal/ingestion/ingestion.go`.
3. Escreve um teste contra um servidor falso, seguindo o teste do Pluggy (`port_test.go`).

Nenhuma migration, nenhuma mudança no contrato HTTP e nenhuma mudança no web são necessárias. O formulário de credenciais do web ainda não existe: ele faz parte do seu trabalho de telas e lê `GET /aggregators`. O testador de operações do admin já monta o corpo a partir dessa listagem (`e10224f`).

**Limite atual:** só existe o método de conexão `reference`, em que o usuário conecta o banco no site do agregador e informa a referência. O fluxo por redirecionamento (OAuth) ficou fora do escopo (NG-R2 da spec).

### 4.2 Arquivos de extrato (OFX e CSV)

O formato OFX já era universal. O CSV dependia de convenções brasileiras.

| Campo do perfil CSV | Função | Exemplo |
|---|---|---|
| `encoding` | codificação de caracteres do arquivo | `auto` (padrão), `windows-1252`, `shift_jis` |
| `date_layout` | ordem e separadores da data | `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD` |
| `decimal_separator` | separador decimal | `,` no Brasil, `.` nos Estados Unidos |
| `group_separator` | separador de milhar | `.` no Brasil, `'` na Suíça, vazio para nenhum |

Exemplo: um banco suíço exporta `1'234.50`. O perfil com `decimal_separator: "."` e `group_separator: "'"` lê esse texto como 1.234,50 francos. O servidor (`internal/ingestion/internal/csvfile`) e a prévia do web (`csv-preview.ts`, corrigida em `74a9c42`) aplicam a mesma regra.

As codificações aceitas estão no `switch` da função `Decoder` (`internal/ingestion/internal/charset/registry.go`). A lista atual tem 10 codificações, de `utf-8` a `big5`. Uma codificação nova é um `case` a mais.

### 4.3 Moedas

- **Catálogo ISO 4217 completo:** na inicialização, `ReconcileCurrencies` (`internal/marketdata/currencies.go`) cria um instrumento para cada código ISO 4217 que ainda não existe. A lista vem do pacote `golang.org/x/text` (ADR 017). Nenhum cadastro manual de moeda é necessário.
- **Moeda base:** sai de `DefaultBaseCurrency` pela região do usuário. Sem um caso para a região, o usuário escolhe na tela de configurações. A troca é recusada com 409 quando transações já usam a moeda atual.
- **Sem `"BRL"` no web:** a busca `grep -rn '"BRL"' web/src` fora dos testes retorna zero linhas. Enquanto a moeda não carrega, a tela mostra um esqueleto de carregamento ou omite o valor (Task 32).
- **Formatação pelo navegador:** valores e datas usam a API `Intl` do navegador com a etiqueta `idioma-região` (Task 31). Exemplos verificados nos testes de `web/src/i18n/format.test.ts`:

| Etiqueta | Valor | Texto exibido |
|---|---|---|
| `pt-BR` | 1234,56 BRL | `R$ 1.234,56` |
| `de-DE` | 1234,50 EUR | `1.234,50 €` |
| `ja-JP` | 1234 JPY | `￥1,234` |
| `en-US` | 1234,567 KWD | `KWD 1,234.567` |
| `en-GB` | 16/10/2026 | `16 Oct` |

### 4.4 Cotações e câmbio

- **Interface `Source`** (`internal/marketdata/internal/feed/feed.go`): uma fonte informa quais instrumentos cota e busca as cotações de um período.
- **Fontes atuais:** `bcb_ptax` (câmbio do Banco Central do Brasil), `b3_cotahist` (cotações da B3) e `ecb` (câmbio do Banco Central Europeu). A `ecb` é a primeira fonte não brasileira.
- **Escolha por instância:** a variável `EQUORI_PRICE_FEEDS` escolhe quais fontes rodam. `EQUORI_FEED_<ID>_URL` troca o endereço de uma fonte.
- **Erro na inicialização:** um identificador desconhecido em `EQUORI_PRICE_FEEDS` interrompe o processo, com o nome da variável e o identificador na mensagem.
- **Bolsas:** a bolsa de um ativo passou a ser um código MIC (ISO 10383) de 4 caracteres: `BVMF` para a B3, `XLIS` para Lisboa.

**Como acrescentar uma fonte:** criar o pacote em `internal/marketdata/internal/feed/<id>/`, acrescentar uma linha em `sourceEntries` (`internal/marketdata/sources.go`) e testar contra um arquivo de exemplo em `testdata/`.

### 4.5 Cartões de crédito

- **Encargo de compra no exterior:** cada cartão guarda o próprio valor em `foreign_charge_bp`, em pontos-base (350 = 3,5%). Um cartão novo começa com `DefaultForeignChargeBP` da região: 350 no Brasil (IOF) e 0 em outra região. O usuário pode alterar por cartão.
- **Calendário de vencimento:** cada regra de fatura e cada agendamento guarda o próprio calendário. Exemplo: um vencimento num feriado nacional brasileiro passa para o próximo dia útil em `br_banking`. Em `weekend`, só sábado e domingo deslocam a data.

### 4.6 Feriados (calendários)

- **Calendário como dado:** um calendário é um valor Go com fins de semana e regras de feriado (`internal/marketdata/internal/calendar/`). O `br_banking` declara cada feriado com o ano em que passou a valer. Exemplo: Dia da Consciência Negra, `From: 2024`, Lei 14.759/2023.
- **Como acrescentar um país:** criar `pt_banking.go` com os feriados de Portugal, acrescentar uma entrada em `marketdata.New`, testar contra o calendário oficial e acrescentar `case "PT"` em `DefaultCalendar`.

### 4.7 Impostos de investimento (jurisdições)

Uma **jurisdição** é o conjunto de regras fiscais de um país sobre investimentos.

- **Interface `Jurisdiction`** (`internal/portfolio/internal/domain/jurisdiction.go`): declara os tipos de provento próprios do país, a classe fiscal de um ativo e o tratamento de cada provento.
- **Tipos universais de provento:** `dividend`, `interest`, `coupon` e `distribution`. A jurisdição `br` acrescenta `jcp`.
- **JCP fora do núcleo:** a retenção padrão de 15% sobre JCP saiu do domínio do ledger e agora vem de `DefaultWithholdingBP("BR", "jcp")`. Um usuário de Portugal que registra um provento `jcp` sem informar a retenção recebe retenção zero (teste `internal/ledger/withholding_test.go`).
- **Usuário sem jurisdição:** os dados fiscais ficam nulos. Os relatórios continuam funcionando.

### 4.8 Bancos e logos

- **Identificador com esquema:** uma instituição guarda o par esquema e identificador. Exemplos: `br_ispb` + `00360305` (Caixa), `bic` + `BOFAUS3N` (Bank of America). Os esquemas e os formatos aceitos estão em `IdentifierSchemes` (`internal/ledger/internal/domain/identifier.go`).
- **Logo por esquema:** no web, `logoOf` (`web/src/features/accounts/institution-logo.ts`) escolhe a fonte do logo pelo esquema. Um esquema sem caso mostra as iniciais do banco no lugar do logo.
- **Catálogo brasileiro só no Brasil:** o catálogo de bancos brasileiros aparece só para usuários com região `BR`.

### 4.9 Idioma

- **Idiomas do web:** ficam em `web/src/i18n/languages.ts`. Cada entrada tem código, nome nativo e catálogo de mensagens. Hoje existem `en` e `pt`.
- **Idioma e região no perfil:** os dois ficam salvos no perfil (`PATCH /me`), não só no navegador. A tela de configurações edita idioma, região e moeda base (Task 35).
- **Captura de lançamentos:** a captura por texto livre ("almoço 32,50 ontem") lê as palavras por um **léxico** do idioma: `lexicon_pt.go` e `lexicon_en.go`. Números e datas seguem as convenções da região.
- **Sugestões de categoria:** o prompt que pede sugestões ao modelo de linguagem informa o idioma do usuário. Antes ele dizia "a Brazilian owner".

## 5. Roteiro completo: adicionar Portugal

| Passo | Arquivo | Alteração |
|---|---|---|
| 1 | `internal/platform/locale/regions.go`, `web/src/i18n/regions.ts` | já contém `PT`: nenhuma |
| 2 | `internal/platform/locale/conventions.go` | já contém `PT` (vírgula decimal, dia/mês/ano): nenhuma |
| 3 | `internal/ledger/region_defaults.go` | `case "PT": return "EUR", true` em `DefaultBaseCurrency` |
| 4 | `internal/marketdata/internal/calendar/pt_banking.go` | feriados portugueses e um teste |
| 5 | `internal/marketdata/region_defaults.go` | `PT` → `pt_banking` em `DefaultCalendar` |
| 6 | `internal/portfolio/internal/jurisdiction/pt/` | regras fiscais portuguesas, quando desejadas |
| 7 | `internal/ingestion/internal/aggregator/<id>/` | um agregador europeu, quando desejado |
| 8 | `.env` da instância | `EQUORI_PRICE_FEEDS=ecb` (câmbio do euro, já implementado) |
| 9 | raiz do repositório | `make check` |

O passo 1 já cobre 249 regiões. O passo 2 já cobre 14 regiões com convenções próprias. Os passos 6 e 7 são opcionais. Sem eles, o app funciona sem dados fiscais e sem sincronização bancária: OFX e CSV continuam disponíveis.

## 6. Garantias automáticas

- **Registros:** um identificador repetido ou malformado impede a inicialização.
- **Banco:** cada coluna de identificador rejeita valores fora do formato `^[a-z0-9_]{2,40}$`. Os arquivos `schema_test.go` de cada módulo violam as restrições com SQL direto e esperam a recusa.
- **Dependências:** a regra `platform` do depguard (`.golangci.yml`) impede a camada de plataforma de importar um módulo de negócio (`8c71eb4`).
- **Literais brasileiros:** a busca `grep -rn 'br_banking\|BRL\|\bB3\b\|pluggy\|IOF\|ISPB' docs/domain docs/adr` encontra só exemplos brasileiros, linhas do Brasil em tabelas e histórico de ADR (Task 36).
- **Suíte completa:** `make check` passou em `main` no commit `65ab01a`.

## 7. O que continua fora do escopo

| Item | Situação |
|---|---|
| Formulário de integração bancária no web | parte do seu trabalho de telas; deve ler `GET /aggregators` e exibir como senha os campos com `secret: true` |
| Conexão por redirecionamento (OAuth) | fora do escopo pela spec (NG-R2); só existe `reference` |
| Implementações de outros países | nenhuma além das internacionais (`ecb`, `weekend`, `bic`); cada país entra por contribuição |
| Corpo do commit `ea8afac` | sem descrição; corrigir exige reescrever o histórico de `main`, compartilhado com outras sessões |
