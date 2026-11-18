Privacy mode hides every amount on screen, including the assistant's answers and its proposal cards. Turn it on in Settings, in the account menu or in the command palette. It can also turn on by itself when you leave the tab or after 5 minutes idle, in Settings, Privacy; turn it off with the same switch.

The assistant sends your question and the data its tools read to the language model provider chosen in Settings. On a free tier that uses submitted content for training, the panel says so before the first message. Daily limits per provider and model are declared in Settings; when they are reached, or the provider's quota runs out, the assistant shows when it returns.

The assistant never changes data by itself: each change is a proposal you confirm. Conversations stay until you delete them.

Identify columns with AI, on Import statement, sends the header and up to 12 lines of the CSV file to the language model of the use ingestion.csv_columns. Each digit in a line is replaced by 9. A run of three or more letters is replaced by A for each letter; a run of one or two letters is kept. A header cell with a digit is masked the same way.

The assistant also suggests changes your request implies, such as a category that does not exist yet or a rule for a payee you categorize often. A suggestion shows the label Suggestion and the reason. A card that uses what another card creates waits until you confirm that card; Confirm all confirms the group in order.

What the assistant does not do. Every other action a member takes on a screen has a tool. For each line below the assistant says so and names the screen; it does not look for a tool that comes close.

- session: signing in and out, the second factor, passkeys and recovery codes, creating a book, switching to another book, leaving a book and accepting an invitation. They change who is signed in or which book the session reads. The account menu and Settings hold them.
- secret: access tokens, the credentials of a bank integration and a new bank connection. A secret typed in a conversation would be stored with it. Settings and the Links screen hold them.
- credential: inviting a person to the book and the password of the backup copy. Each answers or takes a token or a password. Settings holds them.
- llm: the language model providers, their keys, the chain of models of each use, the daily limits and the list of conversations. The assistant does not change its own model, keys or limits. Settings holds them; a conversation is deleted in the panel.
- erase: deleting the book and restoring an archive over it. Both erase records and ask the owner to type the name of the book. Settings, Data holds them.
- instance: the backup of the instance, the diagnostic file, the version and the update check, the market data sources, the sync schedule and the invitation of a new account. They belong to the administrator of the instance, not to a book. Settings holds them, for the administrator.
- binary: the content of an attachment and of an export archive. The assistant names the file or gives the path that downloads it.
- capture: the reading of typed lines on the Capture screen. The assistant reads the same text in the conversation and proposes the transactions with record_transaction.
