# Connect a bank

A bank connection brings the accounts and transactions of an institution without a file. An aggregator, an outside service, reads the institution and sends the data to equori.

## Add the credentials

The administrator of the installation does this once. The credentials come from the site of the aggregator. When your region has its own steps, they are at the end of this page.

1. Open [Settings](/settings) and choose **Integrations**.
   ![The settings, with the Integrations section marked](connect-settings)
2. Choose **Add integration**.
   ![The Integrations section, with the Add integration button marked](connect-add)
3. Choose the **Aggregator**, give a **Name** and enter the credentials the aggregator supplies.
   ![The Add integration dialog, with the aggregator, the name and the credentials marked](connect-credentials)
4. Choose **Create**.
   ![The Add integration dialog, with the Create button marked](connect-create)

equori stores the credentials sealed and never shows them again. To change them, choose **Replace credentials**.

## Connect each bank

Repeat for each bank. A bank added later at the aggregator's site also needs these steps.

1. In [Links](/accounts/links), choose **Connect bank**.
2. Write the **Bank name** and choose **Continue**.
3. Log in to the aggregator, choose that bank and authorize. No code is copied.
4. Choose **Link accounts**, or **Connect another bank** to repeat.

Each connection keeps the name you gave. Choose **Rename** to change it.

If the connection is not saved, choose **Try again** before closing the window. There is no need to log in to the aggregator again.

## Link each account

The accounts of a connected bank appear in [Links](/accounts/links). Each account waits for a link: your account in equori that receives its transactions.

1. In [Links](/accounts/links), find the account that **Waiting for a link** marks.
2. Choose **Link**.
3. Choose your account, or create one. The field **Imports from** sets the first date imported.
4. Choose **Link and sync**.

Choose **Ignore** for an account you do not want to follow.

## Read the summary of a sync

Each sync appears under **Recent syncs**, with one line per linked account. The line counts the lines created, matched, to review, changed and withdrawn. A line reads "no change" when the account was already up to date.

Lines to review wait in the import, as in [Import a statement](/help/import-statement).

## When a connection stops

The state of a connection shows on [Links](/accounts/links):

- **Stalled**: the bank has sent no new data for some hours.
- **Consent expiring**: the permission given to the aggregator expires on the date shown.
- **Needs you**: the aggregator waits for an action only the account holder can take.

Each state names the site of the aggregator where the action is taken. [Troubleshooting](/help/troubleshooting) lists the steps. For the idea behind these screens, read [Bank connections](/help/bank-connections).
