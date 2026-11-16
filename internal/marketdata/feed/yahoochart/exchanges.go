package yahoochart

import "github.com/andrelopes-code/equori/internal/platform/money"

// micSuffixes maps the MIC of an exchange to the suffix Yahoo appends to a code (A222 MQ19).
// An empty suffix means the code is requested as is, with `.` read as `-`.
var micSuffixes = map[string]string{
	"BVMF": ".SA",
	"XNYS": "", "XNAS": "", "ARCX": "", "BATS": "", "XASE": "",
	"XTSE": ".TO", "XLON": ".L", "XETR": ".DE", "XFRA": ".F", "XPAR": ".PA",
	"XAMS": ".AS", "XBRU": ".BR", "XLIS": ".LS", "XMIL": ".MI", "XMAD": ".MC",
	"XSWX": ".SW", "XSTO": ".ST", "XCSE": ".CO", "XHEL": ".HE", "XOSL": ".OL",
	"XWBO": ".VI", "XDUB": ".IR", "XASX": ".AX", "XTKS": ".T", "XHKG": ".HK",
	"XKRX": ".KS", "XNSE": ".NS", "XMEX": ".MX", "XBUE": ".BA", "XJSE": ".JO",
	"XSES": ".SI",
}

// micCurrencies maps the MIC of an exchange to the currency Yahoo quotes it in, so that a search
// listing states its currency (A223 RM8). Region-dependent. XLON and XJSE are absent: they quote
// in a subunit (pence, cents), which no currency instrument holds.
var micCurrencies = map[string]money.Currency{
	"BVMF": "BRL",
	"XNYS": "USD", "XNAS": "USD", "ARCX": "USD", "BATS": "USD", "XASE": "USD",
	"XTSE": "CAD", "XETR": "EUR", "XFRA": "EUR", "XPAR": "EUR", "XAMS": "EUR", "XBRU": "EUR",
	"XLIS": "EUR", "XMIL": "EUR", "XMAD": "EUR", "XHEL": "EUR", "XWBO": "EUR", "XDUB": "EUR",
	"XSWX": "CHF", "XSTO": "SEK", "XCSE": "DKK", "XOSL": "NOK", "XASX": "AUD", "XTKS": "JPY",
	"XHKG": "HKD", "XKRX": "KRW", "XNSE": "INR", "XMEX": "MXN", "XBUE": "ARS", "XSES": "SGD",
}

// yahooExchanges maps the exchange code of a Yahoo search answer to a MIC, for a symbol without a
// suffix (plan 3 D8). Region-dependent: a US listing is the only case without a suffix.
var yahooExchanges = map[string]string{"NMS": "XNAS", "NYQ": "XNYS", "PCX": "ARCX"}
