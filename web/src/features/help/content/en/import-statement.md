# Import a statement

A statement file is the file your bank or card offers for download. equori reads **OFX** and **CSV** files of up to 10 MB.

## Send the file

1. Open the account in [Accounts](/accounts).
2. Choose **Import statement** and select the file.
3. For a CSV, say how it is read: the separator, how many header rows it has, the date format, and which columns hold the date, the description and the amount. The first lines show as they will be read, so you can check before importing.
4. Choose **Import**.

Lines that came in an earlier import are recognised and skipped. Importing the same file twice duplicates nothing.

## What happens to each line

The import page shows the state of each line:

- **Matched**: the line is a transaction you had already recorded. Nothing new was created.
- **Created**: the line became a new transaction, still without a category.
- **To review**: the line looks like one or more transactions, but not enough to decide on its own.
- **Discarded**: you chose to leave the line out of your records.

## Review a line

Choose the line to see the **similar transactions**, each with a score. The score adds points for a close date, amount and payee.

- **This is the transaction** matches the line to the chosen transaction.
- **Create a new transaction** records the line as a new transaction.
- **Discard the line** leaves the line out.

When the file carries the account's balance, it is recorded as the institution's balance and serves the [balance check](/help/check-balance).
