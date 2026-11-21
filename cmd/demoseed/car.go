package main

import (
	"fmt"
	"math"
	"net/http"
	"time"
)

// The persona buys a used 2021 Hyundai HB20 1.0 at a dealer on 2025-08-15. The down payment comes from a sale of
// investments; the rest is a CDC financing of Itaú in 48 monthly installments of the
// Price table, debited from the checking account on the 15th.
const (
	carPurchase = "2025-08-15"
	carPrice    = 6190000
	carDown     = 3590000

	// carSale is what the persona redeems from the holdings of carSaleOrder, in cents: the down payment and
	// R$ 6.000,00 set aside for the policy, the IPVA and the fuel of the first year.
	carSale = carDown + 600000

	// The financed amount carries the IOF, the registration fee of the bank and the lien registry of Detran-SP.
	carIOF          = 78156
	carBankFee      = 85000
	carLienRegistry = 24590
	carFinanced     = carPrice - carDown + carIOF + carBankFee + carLienRegistry

	carRateBP       = 189 // monthly rate of the contract, in basis points
	carInstallments = 48
	carInstallment  = 88863

	// carFIPE is the FIPE value of the model in the month of the purchase; it loses carDepreciation a month.
	carFIPE         = 6250000
	carDepreciation = 0.007
)

// carSaleOrder are the holdings the persona sells, in this order, until the sale reaches carSale: the Tesouro Selic,
// then the funds that no goal names.
var carSaleOrder = []string{"LFT.20290301", "BOVA11", "IVVB11", "WRLD11", "NASD11", "BPAC11"}

// carReviewMonths are the months at whose end the persona updates the value of the car from the FIPE table.
var carReviewMonths = []time.Month{time.February, time.May, time.August, time.November}

// installment is one row of the Price table: its number, the interest of the month and the principal it repays.
type installment struct {
	n                   int
	interest, principal int64
}

// carHabits are the purchases that come with the car, from carMonths.
var carHabits = []habit{
	// With the car the persona takes a ride only to a night out or to the airport.
	{
		category: "transport.rideshare",
		payees:   []string{"Uber", "99"},
		desc:     "Corrida %s",
		count:    [2]int{3, 6},
		lo:       1400,
		hi:       5800,
		skew:     2,
		vias:     []string{"card.nubank", "card.itau"},
		weights:  []int{70, 30},
		weekday:  true,
		from:     carMonths,
	},
	{
		category: "transport.fuel",
		payees:   []string{"Shell", "Ipiranga", "Posto Petrobras"},
		desc:     "Abastecimento %s",
		count:    [2]int{2, 3},
		lo:       17000,
		hi:       30000,
		skew:     1,
		vias:     []string{"card.nubank", "card.itau"},
		weights:  []int{60, 40},
		from:     carMonths,
	},
	{
		category: "transport.parking",
		payees:   []string{"Estapar"},
		desc:     "Estacionamento %s",
		count:    [2]int{1, 3},
		lo:       2000,
		hi:       6400,
		skew:     2,
		vias:     []string{"card.nubank"},
		weights:  []int{1},
		weekend:  true,
		from:     carMonths,
	},
	{
		category: "transport.parking",
		payees:   []string{"Sem Parar"},
		desc:     "Fatura %s",
		count:    [2]int{1, 1},
		chance:   .7,
		lo:       3000,
		hi:       14000,
		skew:     1,
		vias:     []string{"card.itau"},
		weights:  []int{1},
		from:     carMonths,
	},
}

// car schedules the purchase of the car, its financing and the costs of owning it that fall on a date: the policy of
// each year, the IPVA of each January, the services and the transfer at Detran-SP. Fuel, parking and tolls are habits.
func (s *seeder) car() {
	s.carDownPayment()
	s.carPurchase()
	s.carLoan()
	s.carYearly()
	s.carServices()
}

// reviewCar states, at each review, the FIPE value of the car. The difference is resolved as an adjustment, so the
// depreciation lowers the net worth and never the expenses (A259 PA3). It runs after the history, which the
// assertions read.
func (s *seeder) reviewCar() {
	for _, end := range s.carReviews() {
		var out struct {
			Assertion struct {
				ID string `json:"id"`
			} `json:"assertion"`
		}
		s.do(
			http.MethodPost,
			"/accounts/"+s.id("car")+"/balance-assertions",
			map[string]any{
				"date":   iso(end),
				"amount": brl(carValueOn(end.AddDate(0, 0, 1))),
				"source": "manual",
			},
			&out,
		)

		if s.err != nil {
			return
		}

		s.do(
			http.MethodPost,
			"/balance-assertions/"+out.Assertion.ID+"/resolve",
			map[string]any{"resolution": "adjustment"},
			nil,
		)
	}
}

// carDownPayment sells the holdings of carSaleOrder until the proceeds reach carSale and brings them, in whole
// hundreds of reais, to the checking account the same day.
func (s *seeder) carDownPayment() {
	d := day(carPurchase).AddDate(0, 0, -3)

	s.investAt(d, func() {
		var proceeds int64

		for _, code := range carSaleOrder {
			if proceeds >= carSale {
				break
			}

			sec := s.security(code)
			price := s.priceOn(code, d)
			units := float64(carSale-proceeds) / 100 / price * math.Pow(10, float64(sec.scale))

			qty := min(int64(math.Ceil(units)), s.hold[code])
			if qty <= 0 {
				continue
			}

			s.trade(d, code, "sell", qty, price)
			proceeds += int64(float64(qty) * price * 100 / math.Pow(10, float64(sec.scale)))
		}

		ted := min(proceeds, carSale) / 10000 * 10000
		s.record(
			iso(d),
			"TED da XP para a entrada do carro",
			map[string]any{"payee_id": s.id("payee.XP Investimentos")},
			post(s.id("itau.checking"), ted),
			post(s.id("xp.cash"), -ted),
		)
	})
}

// carPurchase records the car against the down payment and the financing, whose principal carries the IOF and the
// fees of the contract, and the first tank.
func (s *seeder) carPurchase() {
	d := day(carPurchase)

	s.at(d, func() {
		s.ensure(d, "itau.checking", carDown)
		s.record(
			carPurchase,
			"Compra do Hyundai HB20 2021",
			map[string]any{"payee_id": s.id("payee.Caoa Seminovos")},
			post(s.id("car"), carPrice),
			post(s.id("tax.iof"), carIOF),
			post(s.id("fee.bank"), carBankFee),
			post(s.id("transport.vehicle_tax"), carLienRegistry),
			post(s.id("itau.checking"), -carDown),
			post(s.id("car.loan"), -carFinanced),
		)
	})

	tank := d.AddDate(0, 0, 1)
	s.at(tank, func() {
		s.expense(tank, "card.nubank", "transport.fuel", "Shell", "Abastecimento Shell", 23480)
	})
}

// carLoan pays each installment due by today: the checking account pays the installment, the financing receives the
// principal and the system account Interest the interest.
func (s *seeder) carLoan() {
	for _, r := range loanSchedule() {
		d := s.carDue(r.n)
		cents := r.interest + r.principal

		s.at(d, func() {
			s.ensure(d, "itau.checking", cents)
			s.record(
				iso(d),
				fmt.Sprintf("Parcela %d/%d do financiamento do HB20", r.n, carInstallments),
				map[string]any{"payee_id": s.id("payee.Itaú Unibanco")},
				post(s.id("itau.checking"), -cents),
				post(s.id("car.loan"), r.principal),
				post(s.id("system.interest"), r.interest),
			)
		})
	}
}

// carYearly records the policy of each year of the car in 10 installments on the Itaú card, and the IPVA of each
// January in a single payment: 4 % of the value of the car, less the 3 % discount of the single payment.
func (s *seeder) carYearly() {
	policies := []struct {
		date, desc string
		cents      int64
	}{
		{carPurchase, "Seguro do HB20, apólice 2025/2026", 278000},
		{"2026-08-14", "Seguro do HB20, apólice 2026/2027", 261800},
	}
	for _, p := range policies {
		d := day(p.date)
		s.at(d, func() {
			s.installments(
				d,
				"card.itau",
				"transport.insurance",
				"Porto Seguro",
				p.desc,
				p.cents,
				10,
			)
		})
	}

	for year := day(carPurchase).Year() + 1; year <= s.today.Year(); year++ {
		d := s.businessDay(time.Date(year, time.January, 1, 0, 0, 0, 0, time.UTC), 9)
		cents := carValueOn(d) * 4 / 100 * 97 / 100

		s.at(d, func() {
			s.expense(
				d,
				"itau.checking",
				"transport.vehicle_tax",
				"Secretaria da Fazenda SP",
				fmt.Sprintf("IPVA %d em cota única", year),
				cents,
			)
		})
	}
}

// carServices are the transfer of the car at Detran-SP and the services of the workshops.
func (s *seeder) carServices() {
	transfer := day(carPurchase).AddDate(0, 0, 5)
	s.at(transfer, func() {
		s.expense(
			transfer,
			"nubank.checking",
			"transport.vehicle_tax",
			"Detran-SP",
			"Transferência do veículo e vistoria",
			41125,
		)
	})

	review := day("2026-02-07")
	s.at(review, func() {
		s.installments(
			review,
			"card.nubank",
			"transport.maintenance",
			"Hyundai Caoa",
			"Revisão de 40.000 km do HB20",
			118000,
			3,
		)
	})

	brakes := day("2026-06-20")
	s.at(brakes, func() {
		s.expense(
			brakes,
			"card.itau",
			"transport.maintenance",
			"Auto Center Pinheiros",
			"Pastilhas de freio e alinhamento",
			64000,
		)
	})
}

// loanSchedule is the Price table of the financing. The interest is the rate on the principal left, rounded half up;
// the last installment repays the cents the rounding left.
func loanSchedule() []installment {
	rows := make([]installment, carInstallments)
	left := int64(carFinanced)

	for i := range rows {
		interest := (left*carRateBP + 5000) / 10000
		principal := carInstallment - interest

		if i == carInstallments-1 {
			principal = left
		}

		rows[i] = installment{n: i + 1, interest: interest, principal: principal}
		left -= principal
	}

	return rows
}

// loanPrincipalAfter is the principal the financing still owes after n installments.
func loanPrincipalAfter(n int) int64 {
	left := int64(carFinanced)
	for _, r := range loanSchedule()[:n] {
		left -= r.principal
	}

	return left
}

// carDue is the date of installment n: the 15th of the n-th month after the purchase, or the next business day.
func (s *seeder) carDue(n int) time.Time {
	d := day(carPurchase).AddDate(0, n, 0)
	for d.Weekday() == time.Saturday || d.Weekday() == time.Sunday || s.holidays[d] {
		d = d.AddDate(0, 0, 1)
	}

	return d
}

// carReviews are the month-ends, after the purchase and before today, on which the persona states a new value.
func (s *seeder) carReviews() []time.Time {
	var out []time.Time

	for _, m := range months(firstOfMonth(day(carPurchase)).AddDate(0, 1, 0), s.today) {
		end := m.AddDate(0, 1, -1)
		if containsMonth(carReviewMonths, m.Month()) && end.Before(s.today) {
			out = append(out, end)
		}
	}

	return out
}

// carValueOn is the value of the car on d: the purchase price until the first review before d, then the FIPE value
// of the latest review before d, rounded to hundreds of reais.
func carValueOn(d time.Time) int64 {
	value := int64(carPrice)

	for _, m := range months(firstOfMonth(day(carPurchase)).AddDate(0, 1, 0), d) {
		end := m.AddDate(0, 1, -1)
		if !containsMonth(carReviewMonths, m.Month()) || !end.Before(d) {
			continue
		}

		age := float64(monthsBetween(day(carPurchase), m))
		value = int64(math.Round(carFIPE*math.Pow(1-carDepreciation, age)/10000)) * 10000
	}

	return value
}

func monthsBetween(a, b time.Time) int {
	return (b.Year()-a.Year())*12 + int(b.Month()) - int(a.Month())
}
