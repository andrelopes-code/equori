equori imports OFX and CSV statement files into an account. Each file is an **Import batch**; each line is an **External record** that is matched to an existing transaction, creates a new one, or waits for your review when the match is ambiguous. The **Deduplication key** stops a line from being imported twice.

A bank connection through an aggregator imports lines automatically. Adding the aggregator's credentials and connecting a bank happen on the Links screen and only you can do them; the assistant cannot handle credentials. After connecting, map each bank account to an equori account and sync.

Import a file on Import statement of the account; review a batch on Import batch; manage connections on Links.
