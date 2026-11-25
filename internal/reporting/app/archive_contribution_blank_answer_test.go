package app

import "testing"

// A version 34 archive holds a no where the investor gave no answer to a question with a fact; the
// step turns it blank and keeps every other answer (CQ2).
func TestBlankContributionAnswers(t *testing.T) {
	t.Parallel()

	answer := func(q, yes string) []byte {
		return []byte(`{"class_id":"c","member_position":0,"question_position":` + q + `,"yes":` +
			yes + `}`)
	}
	v34 := []ArchiveTable{
		{Name: "portfolio_contribution_answer", Rows: [][]byte{
			answer("0", "false"), answer("1", "true"), answer("2", "false"),
		}},
		{Name: "portfolio_contribution_question", Rows: [][]byte{
			[]byte(`{"class_id":"c","fact":"piotroski_p1","position":0,"text":"P1"}`),
			[]byte(`{"class_id":"c","fact":"piotroski_p2","position":1,"text":"P2"}`),
			[]byte(`{"class_id":"c","fact":null,"position":2,"text":"Own"}`),
		}},
	}

	got, err := blankContributionAnswers(v34)
	if err != nil {
		t.Fatal(err)
	}

	for i, want := range [][]byte{answer("0", "null"), answer("1", "true"), answer("2", "false")} {
		if string(got[0].Rows[i]) != string(want) {
			t.Errorf("answer %d = %s, want %s", i, got[0].Rows[i], want)
		}
	}

	if string(v34[0].Rows[0]) != string(answer("0", "false")) {
		t.Fatalf("the step changed its input: %s", v34[0].Rows[0])
	}
}
