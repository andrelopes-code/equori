A **Card account** is a liability account for a credit card; its **Card** entries are the plastic or virtual cards. The **Billing cycle rule** sets the closing day and the due day; a purchase is **Billed on** the **Statement** its date falls into. The **Credit limit** and the purchases give the available limit.

A **Statement** has a **Statement status**: open, closed, paid, partially paid, overdue or financed. The statement is one bill line: previous balance plus purchases minus credits and payments equals the total; terms equal to zero are left out. A **Statement payment** moves money from a balance account to the card. **Statement financing** turns the unpaid amount into installments. You can record the total and due date the bank states and confirm the amount due to reconcile the statement.

On Cards, each credit card is a card face with a ticket under it. The ticket shows the word of the statement it leads with (to pay, due soon, overdue, paid in part or open), the amount, the time left and the limit used. A closed statement still owing has a Pay button. The details that open on the ticket show the closing and due dates, the share already paid, the position in the billing cycle, the other statement and the purchases of the week.

On Card, the settings hold the card's appearance, billing cycle and credit limit. The appearance is the colour (from a set or any colour), the art, the chip, the orientation and how the issuer's brand is drawn; it shows on the card in every screen. The tool set_card_face does the same with account_id, color (lower case #rrggbb), art (plain, aurora, waves, orbits, band, contour, dots, carbon, brushed or holo), chip (gold or silver), orientation (horizontal or vertical) and brand (auto, plate, name or none). It replaces the whole appearance: a value left out returns to the default, so repeat what stays. get_statement_analytics splits what a statement bills into purchases, installments, charges (interest and fees) and credits (refunds, negative), in total and per category, with statement_id; with account_id it returns that split for the 12 latest closed statements of the card, oldest first. Each plastic card has a network (Visa, Mastercard, American Express and, by region, others), chosen when the card is added or edited; a plastic card can have none. The form that creates a credit card offers the appearance and the network of each plastic card too, and both can be changed later in the card's settings.

See cards on Cards, a card's statements and settings on Card, and a statement's lines, payment and financing on Statement.

The Overview draws the cards that owe something as a deck of their faces, the card to pay first in front: the total to pay with its deadline, the amount each card owes on its face, and, for the card chosen, its open billing cycle on a line (the days gone, the closing date and the days up to the due date), its last twelve statements as bars on its face, what it owes, its open statement and its free limit.

The tools. get_account_details lists the statements of a card with their IDs, its plastic cards, limit and cycle, the statement a purchase date falls on (purchase_date) and the installments committed to a month (month). get_statement returns one statement with its amounts, status, dates and every line.

manage_card changes the setup of a credit card account, with account_id and action.

- add_card: holder and last_four; virtual marks a virtual card; network is the card network, a lower case key such as visa, mastercard, amex, elo or hipercard; foreign_charge_bp is the charge on purchases in another currency, in basis points from 0 to 10000.
- edit_card: card_id with the holder, the last_four or the network that changes. remove_card: card_id.
- set_card_active: card_id and active, true or false.
- set_credit_limit: amount, positive, and effective_from, the first date of the limit.
- set_billing_cycle: closing_day and due_day, and effective_from, any date of the first statement month the cycle applies to. closing_mode day closes on closing_day; before_due closes closing_days_before_due days (1 to 28) before the due date. closing_adjustment and due_date_adjustment shift a date that is not a business day: none keeps it, following takes the next business day, preceding the one before, modified_following the next one unless it falls in another month, then the one before. closing_day_assignment says where a purchase on the closing day goes: next, the next statement, or closing, the one that closes. calendar is the business-day calendar; the calendar of the region when absent.

settle_statement acts on one statement, with statement_id and action.

- pay: amount, from_account_id and date.
- finance: installment_count and installment_amount turn the unpaid amount into installments on the next statements.
- confirm_amount_due: amount is the total the institution charges for a statement that has closed. It confirms the statement when that total equals the total of the book; a different amount is refused and the answer states the difference, which is then found line by line.
- set_facts: what the statement of the institution states: amount (its total), due_date, closing_date and minimum. remove_facts clears them.
- defer_postings: transaction_ids whose card posting the institution billed on the next statement.

handle_card_purchase records an event on one card purchase, with transaction_id and action.

- refund: amount, full or partial, and date.
- open_dispute opens a dispute; resolve_dispute closes it with outcome won, which refunds the remaining charged amount, or lost, which keeps the charge.
- cancel_installments cancels the purchase: the installments not yet billed are reversed on their statements and the ones already billed are credited.
- anticipate_installments pays installments early: from_installment and to_installment, and amount, the amount paid.

statement names the statement month (YYYY-MM) that receives the credit or the anticipated installments; the next open statement when absent.

On a phone, the lines of a statement read as the transactions do: grouped by day with each day's net, each line with its description, the installment or the role of a credit or a payment under it, the amount at the end, and the commands of a purchase in the menu beside it. A line the bank has not reported or a provisional one says so first.
