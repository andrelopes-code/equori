package main

type money struct {
	Amount   int64  `json:"amount"`
	Currency string `json:"currency"`
}

func brl(cents int64) money { return money{Amount: cents, Currency: "BRL"} }

type posting struct {
	AccountID string `json:"account_id"`
	Amount    money  `json:"amount"`
}

func post(account string, cents int64) posting {
	return posting{AccountID: account, Amount: brl(cents)}
}
