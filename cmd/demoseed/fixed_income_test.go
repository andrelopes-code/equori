package main

import "testing"

// The code of a contract derives from its application id (A236 FC2): two books seeded on one
// instance need their own ids, and a second seeding of the same book replays the same ones.
func TestApplicationIDBelongsToTheBook(t *testing.T) {
	const (
		book  = "01a1f1b2-b438-7737-9531-b2d66c7bdef6"
		other = "01a1f1b2-b5e7-796a-baf0-aaf465350895"
	)

	if applicationID(book, 0) != applicationID(book, 0) {
		t.Error("the same brokerage and index give two ids, want one")
	}

	if applicationID(book, 0) == applicationID(other, 0) {
		t.Error("two brokerages give the same id, want one each")
	}

	if applicationID(book, 0) == applicationID(book, 1) {
		t.Error("two applications of one brokerage give the same id, want one each")
	}
}
