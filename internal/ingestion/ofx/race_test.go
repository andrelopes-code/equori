//go:build race

package ofx

// slowdown scales the parse budget: the race detector slows the parse by a factor of 8 to 14.
const slowdown = 20
