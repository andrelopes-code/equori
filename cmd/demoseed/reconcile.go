package main

import (
	"bytes"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strings"
)

// entry is one posting of the generated history, kept to build statement files that match existing transactions.
type entry struct {
	date    string
	account string
	cents   int64
	desc    string
}

// snapshots records the balance of the banking accounts on the last day of each month, for the balance assertions.
func (s *seeder) snapshots() {
	for _, m := range months(s.start, s.today) {
		d := m.AddDate(0, 1, -1)
		s.at(d, func() {
			s.snap[ym(m)] = map[string]int64{
				"itau.checking":   s.bal[s.id("itau.checking")],
				"nubank.checking": s.bal[s.id("nubank.checking")],
			}
		})
	}
}

// assertBalances reports the institution balances of the last six month-ends. They agree with the ledger, so those months read as reconciled.
func (s *seeder) assertBalances() {
	for i := 6; i >= 1; i-- {
		m := firstOfMonth(s.today).AddDate(0, -i, 0)
		for _, key := range []string{"itau.checking", "nubank.checking"} {
			cents, ok := s.snap[ym(m)][key]
			if !ok {
				continue
			}
			s.do(http.MethodPost, "/accounts/"+s.id(key)+"/balance-assertions", map[string]any{"date": iso(m.AddDate(0, 1, -1)), "amount": brl(cents), "source": "manual"}, nil)
		}
	}
	// The reserve yields on its own; the institution balance is higher than the ledger and the difference resolves as yield.
	var res struct {
		Assertion struct {
			ID string `json:"id"`
		} `json:"assertion"`
		Resolution string `json:"resolution"`
	}
	d := s.today.AddDate(0, 0, -1)
	s.do(http.MethodPost, "/accounts/"+s.id("nubank.reserve")+"/balance-assertions", map[string]any{"date": iso(d), "amount": brl(s.bal[s.id("nubank.reserve")] + 187342), "source": "manual"}, &res)
	if s.err == nil && res.Resolution == "" {
		s.do(http.MethodPost, "/balance-assertions/"+res.Assertion.ID+"/resolve", map[string]any{"resolution": "yield"}, nil)
	}
	// An unexplained difference stays open on the salary account: the institution shows a Pix the ledger lacks.
	s.do(http.MethodPost, "/accounts/"+s.id("itau.checking")+"/balance-assertions", map[string]any{"date": iso(d), "amount": brl(s.bal[s.id("itau.checking")] + 3840), "source": "manual"}, nil)
}

// reconcileStatements confirms the amount due of the closed statements of the last three months, except the latest of the Nubank card, which the institution reports with a difference.
func (s *seeder) reconcileStatements() {
	for _, card := range []string{"card.itau", "card.nubank"} {
		var out struct {
			Items []struct {
				ID        string `json:"id"`
				Reference string `json:"reference"`
				DueDate   string `json:"due_date"`
				Status    string `json:"status"`
				AmountDue money  `json:"amount_due"`
				Closing   string `json:"closing_date"`
			} `json:"items"`
		}
		q := fmt.Sprintf("?from=%s&to=%s", ym(s.today.AddDate(0, -4, 0)), ym(s.today))
		s.do(http.MethodGet, "/accounts/"+s.id(card)+"/statements"+q, nil, &out)
		for i, st := range out.Items {
			if s.err != nil || st.Status == "open" || st.AmountDue.Amount <= 0 {
				continue
			}
			s.do(http.MethodPut, "/statements/"+st.ID+"/facts", map[string]any{"closing_date": st.Closing, "due_date": st.DueDate, "total": st.AmountDue}, nil)
			amount := st.AmountDue
			if card == "card.nubank" && i == len(out.Items)-2 {
				amount.Amount += 1290
			}
			s.do(http.MethodPost, "/statements/"+st.ID+"/reconcile", map[string]any{"amount_due": amount}, nil)
			s.tolerate("difference_remains")
		}
	}
}

// bankOFX writes an OFX 1.x checking statement. The balance is the closing balance reported by the institution.
func bankOFX(from, to string, balance int64, lines []ofxLine) []byte {
	var b strings.Builder
	b.WriteString("OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\nCHARSET:UTF-8\n\n<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><CURDEF>BRL\n")
	fmt.Fprintf(&b, "<BANKTRANLIST><DTSTART>%s<DTEND>%s\n", from, to)
	for _, l := range lines {
		fmt.Fprintf(&b, "<STMTTRN><TRNTYPE>OTHER<DTPOSTED>%s<TRNAMT>%s<FITID>%s<NAME>%s</STMTTRN>\n", l.date, l.amount, l.fitid, l.name)
	}
	fmt.Fprintf(&b, "</BANKTRANLIST><LEDGERBAL><BALAMT>%s<DTASOF>%s</LEDGERBAL></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>\n", reais(balance), to)
	return []byte(b.String())
}

func cardOFX(from, to string, lines []ofxLine) []byte {
	var b strings.Builder
	b.WriteString("OFXHEADER:100\nDATA:OFXSGML\nVERSION:102\n\n<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><CURDEF>BRL\n")
	fmt.Fprintf(&b, "<BANKTRANLIST><DTSTART>%s<DTEND>%s\n", from, to)
	for _, l := range lines {
		fmt.Fprintf(&b, "<STMTTRN><TRNTYPE>OTHER<DTPOSTED>%s<TRNAMT>%s<FITID>%s<MEMO>%s</STMTTRN>\n", l.date, l.amount, l.fitid, l.name)
	}
	b.WriteString("</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>\n")
	return []byte(b.String())
}

type ofxLine struct{ date, amount, fitid, name string }

func reais(cents int64) string {
	sign := ""
	if cents < 0 {
		sign, cents = "-", -cents
	}
	return fmt.Sprintf("%s%d.%02d", sign, cents/100, cents%100)
}

// upload posts content as the multipart field "file" of path.
func (s *seeder) upload(path string, fields map[string]string, name string, content []byte) {
	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	for k, v := range fields {
		_ = w.WriteField(k, v)
	}
	h := textproto.MIMEHeader{}
	h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, name))
	h.Set("Content-Type", "application/octet-stream")
	part, err := w.CreatePart(h)
	if err != nil {
		s.fail("multipart: %w", err)
		return
	}
	_, _ = part.Write(content)
	_ = w.Close()
	req, err := http.NewRequestWithContext(s.ctx, http.MethodPost, s.base+"/api/v1"+path, &body)
	if err != nil {
		s.fail("build upload %s: %w", path, err)
		return
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	resp, err := s.http.Do(req) //nolint:gosec // the address is the operator's own instance.
	if err != nil {
		s.fail("upload %s: %w", path, err)
		return
	}
	defer resp.Body.Close()
	s.calls++
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		var raw bytes.Buffer
		_, _ = raw.ReadFrom(resp.Body)
		s.fail("upload %s: status %d: %s", path, resp.StatusCode, truncate(raw.Bytes()))
	}
}

// recent returns the outflows of an account in the last days, newest last.
func (s *seeder) recent(key string, days int) []entry {
	var out []entry
	cutoff := iso(s.today.AddDate(0, 0, -days))
	for _, e := range s.entries {
		if e.account == s.id(key) && e.cents < 0 && e.date >= cutoff {
			out = append(out, e)
		}
	}
	return out
}

func compact(date string) string { return strings.ReplaceAll(date, "-", "") }

// importStatements uploads the October statements of the Nubank account and of the Itaú card. Lines equal to recorded ones match; the others become uncategorized and the rules decide them.
func (s *seeder) importStatements() {
	from, to := compact(iso(s.today.AddDate(0, 0, -21))), compact(iso(s.today))
	var lines []ofxLine
	var added int64
	n := 0
	for _, e := range s.recent("nubank.checking", 21) {
		n++
		lines = append(lines, ofxLine{compact(e.date), reais(e.cents), fmt.Sprintf("NU%s%02d", compact(e.date), n), "Pix enviado " + e.desc})
	}
	for _, l := range []struct {
		date, name string
		cents      int64
	}{
		{"2026-10-15", "Pix enviado Padaria Bella Paulista", -2490},
		{"2026-10-16", "Compra no debito PAO DE ACUCAR-0731 SAO PAULO", -21430},
		{"2026-10-17", "Compra no debito DROGASIL 0442 SAO PAULO", -6790},
		{"2026-10-17", "Compra no debito CARREFOUR HIPER 0217 OSASCO", -38640},
		{"2026-10-18", "Pix enviado MERCADO*LOJA 22", -7800},
		{"2026-10-20", "Pix recebido Rafael Mendes", 18000},
		{"2026-10-22", "Pix enviado Joana S", -15000},
	} {
		n++
		lines = append(lines, ofxLine{compact(l.date), reais(l.cents), fmt.Sprintf("NU%s%02d", compact(l.date), n), l.name})
		added += l.cents
	}
	s.ensure(s.today, "nubank.checking", -added+30000)
	s.upload("/accounts/"+s.id("nubank.checking")+"/imports", map[string]string{"format": "ofx"}, "nubank-outubro.ofx", bankOFX(from, to, s.bal[s.id("nubank.checking")]+added, lines))

	var cards []ofxLine
	n = 0
	for _, e := range s.recent("card.itau", 21) {
		n++
		cards = append(cards, ofxLine{compact(e.date), reais(e.cents), fmt.Sprintf("IT%s%02d", compact(e.date), n), strings.ToUpper(e.desc)})
	}
	for _, l := range []struct {
		date, name string
		cents      int64
	}{
		{"2026-10-16", "AMAZON MARKETPLACE", -12990},
		{"2026-10-21", "STARBUCKS PINHEIROS", -2490},
		{"2026-10-22", "KABUM*PEDIDO 9918", -28900},
		{"2026-10-23", "UBER *EATS", -4790},
	} {
		n++
		cards = append(cards, ofxLine{compact(l.date), reais(l.cents), fmt.Sprintf("IT%s%02d", compact(l.date), n), l.name})
	}
	s.upload("/accounts/"+s.id("card.itau")+"/imports", map[string]string{"format": "ofx"}, "fatura-itau-outubro.ofx", cardOFX(from, to, cards))
}

// importCSV saves the CSV profiles of two accounts and imports an Itaú checking export of the last three weeks: recorded lines match, two new lines wait for a category.
func (s *seeder) importCSV() {
	s.do(http.MethodPut, "/accounts/"+s.id("itau.checking")+"/csv-profile", map[string]any{
		"delimiter": "semicolon", "header_rows": 1, "date_column": "Data", "date_layout": "DD/MM/YYYY", "decimal_separator": ",",
		"description_column": "Lançamento", "amount_column": "Valor", "id_column": "Documento",
	}, nil)
	s.do(http.MethodPut, "/accounts/"+s.id("card.itau")+"/csv-profile", map[string]any{
		"delimiter": "semicolon", "header_rows": 1, "date_column": "Data", "date_layout": "DD/MM/YYYY", "decimal_separator": ",",
		"description_column": "Estabelecimento", "amount_column": "Valor", "amount_sign": "inverted",
	}, nil)
	var b strings.Builder
	b.WriteString("Data;Lançamento;Valor;Documento\n")
	n := 0
	line := func(date, name string, cents int64) {
		n++
		d := day(date)
		fmt.Fprintf(&b, "%s;%s;%s;%s\n", d.Format("02/01/2006"), name, strings.ReplaceAll(reais(cents), ".", ","), fmt.Sprintf("DOC%s%03d", compact(date), n))
	}
	for _, e := range s.recent("itau.checking", 21) {
		if strings.HasPrefix(e.desc, "TED") || strings.HasPrefix(e.desc, "Aporte") || strings.HasPrefix(e.desc, "Resgate") {
			continue
		}
		line(e.date, strings.ToUpper(e.desc), e.cents)
	}
	line(iso(s.today.AddDate(0, 0, -2)), "PIX TRANSF MARIA L", -8000)
	line(iso(s.today.AddDate(0, 0, -1)), "TARIFA SAQUE OUTRA REDE", -690)
	s.ensure(s.today, "itau.checking", 8690+10000)
	s.upload("/accounts/"+s.id("itau.checking")+"/imports", map[string]string{"format": "csv"}, "extrato-itau.csv", []byte(b.String()))
}

// touchOccurrences changes two upcoming occurrences: one is skipped and one moves to another day.
func (s *seeder) touchOccurrences() {
	var out struct {
		Items []struct {
			ID         string `json:"id"`
			ScheduleID string `json:"schedule_id"`
			ExpectedOn string `json:"expected_on"`
			State      string `json:"state"`
		} `json:"items"`
	}
	s.do(http.MethodGet, "/occurrences?from="+iso(s.today)+"&to="+iso(s.today.AddDate(0, 0, 40)), nil, &out)
	for _, o := range out.Items {
		// A realized or skipped occurrence refuses both changes (409 occurrence_closed).
		if o.State != "expected" {
			continue
		}
		switch o.ScheduleID {
		case s.ids["schedule.donation"]:
			s.do(http.MethodPost, "/occurrences/"+o.ID+"/skip", map[string]any{"reason": "Doação adiantada para dezembro"}, nil)
			s.ids["schedule.donation"] = ""
		case s.ids["schedule.gas"]:
			s.do(http.MethodPost, "/occurrences/"+o.ID+"/move", map[string]any{"date": iso(day(o.ExpectedOn).AddDate(0, 0, 3))}, nil)
			s.ids["schedule.gas"] = ""
		}
	}
}
