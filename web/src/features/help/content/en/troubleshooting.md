# Troubleshooting

Each entry names a symptom as a screen shows it. It then gives the cause, the steps and the page that holds more.

## A connection reads Stalled

The bank has sent no new data for some hours. [Links](/accounts/links) shows how many.

1. Sync again. Choose **Sync now** in the tab **Sync** of an account of the connection.
2. If the state stays, check the connection at the site of the aggregator that the screen names.

More: [Connect a bank](/help/connect-bank).

## A connection reads Consent expiring

The permission given to the aggregator ends on the date [Links](/accounts/links) shows. After that date, syncs stop.

1. Renew the consent at the site of the aggregator that the screen names.
2. Sync again.

More: [Connect a bank](/help/connect-bank).

## The balance differs from the institution's

The comparison found a difference. A transaction is missing, a yield was not recorded, or a transaction is duplicated.

1. Open the account and the tab **Reconciliation**.
2. Record the missing transactions and choose **I recorded what was missing**.
3. For a yield, choose **Record yield**. For a difference without explanation, choose **Record adjustment**.

More: [Check an account's balance](/help/check-balance).

## A statement amount differs from the institution's

The institution may have billed a purchase near the closing date on the next statement.

1. Open the statement in [Cards](/cards).
2. Read the purchases the screen suggests moving, and move the ones the institution billed later.
3. If the totals still differ, choose **Institution's facts** and record the total the institution reports.

More: [The statement screen](/help/statement).

## A transaction appears twice

A line of a statement became a new transaction, while the same purchase was already recorded by hand.

1. Open the import that holds the line.
2. Void or correct one of the two transactions.

Importing the same file twice duplicates nothing. More: [Import a statement](/help/import-statement).

## A transaction does not appear

Three causes are common:

- The date is before the date the account **Imports from**. Lines before that day are not imported.
- The line is **Discarded** in its import.
- The connection reads **Stalled**.

Choose **Change start date** in the tab **Sync** to import earlier lines. Check the state of the line in the import. More: [Import a statement](/help/import-statement).

## The sign-in refuses the code of the second factor

The authenticator app or the passkey is not at hand.

1. On the sign-in screen, choose **Use a recovery code**.
2. Enter a **Recovery code**. Each code works once.
3. In [Settings](/settings), pane **Security**, choose **Generate new codes**. The current codes stop working.

## The last daily backup is more than 48 hours old

The pane **Backup** of [Settings](/settings) shows this message when the last daily backup is late.

1. Choose **Back up now**.
2. If the backup fails, read the server log. In the installation directory, `docker compose logs app` prints it.

When the pane reads "Automatic backups are off", set `EQUORI_BACKUP_DIR` in `.env`. More: [Install and maintain equori](/help/installation).

## The encrypted copy is late

The pane **Backup** of [Settings](/settings) names the cause:

- "No copy password. Set one below.": enter a **New copy password** of at least 12 characters, repeat it and choose **Save password**.
- "The copy folder cannot be written.": in the installation directory, run `mkdir -p copies && sudo chown 999:999 copies`.
- "The last copy failed.": read the server log with `docker compose logs app`.

The next backup writes a new copy. More: [Install and maintain equori](/help/installation).

## equori does not open in the browser

The installation command prints the address at its end. While no user exists, running the command again prints the address again.

The command can stop with "equori did not answer on http://127.0.0.1:<port>/healthz within 180 seconds". Read the log lines printed above it. In the installation directory, `docker compose logs app` prints them again.

The guide of the system lists every message of the installation, in its section Troubleshooting. More: [Install and maintain equori](/help/installation).
