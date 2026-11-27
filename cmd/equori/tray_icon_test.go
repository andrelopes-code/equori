package main

import (
	"bytes"
	"testing"
)

// The ICO holds one entry whose payload is the PNG as given.
func TestIcoFromPNG(t *testing.T) {
	t.Parallel()

	out := icoFromPNG([]byte{1, 2, 3})

	want := []byte{
		0, 0, 1, 0, 1, 0, // header: reserved, type icon, one image
		0, 0, 0, 0, // width and height 0 (256 or more), no palette, reserved
		1, 0, 32, 0, // planes, bits per pixel
		3, 0, 0, 0, // payload size
		22, 0, 0, 0, // payload offset
		1, 2, 3,
	}
	if len(out) != 25 || !bytes.Equal(out, want) {
		t.Fatalf("icoFromPNG = %v, want %v", out, want)
	}
}
