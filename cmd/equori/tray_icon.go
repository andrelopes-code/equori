package main

import "encoding/binary"

const (
	icoHeaderSize = 22 // ICONDIR (6 bytes) and one ICONDIRENTRY (16 bytes)
	icoBitCount   = 32
)

// icoFromPNG wraps a PNG as a one-image ICO, the format the Windows tray accepts. Width and
// height 0 in the entry mean 256 or more; Windows reads the real size from the PNG.
func icoFromPNG(png []byte) []byte {
	out := make([]byte, icoHeaderSize, icoHeaderSize+len(png))
	binary.LittleEndian.PutUint16(out[2:], 1)  // type: icon
	binary.LittleEndian.PutUint16(out[4:], 1)  // image count
	binary.LittleEndian.PutUint16(out[10:], 1) // color planes
	binary.LittleEndian.PutUint16(out[12:], icoBitCount)
	//nolint:gosec // G115: the icon is a 192 pixel PNG, far below 4 GiB.
	binary.LittleEndian.PutUint32(out[14:], uint32(len(png)))
	binary.LittleEndian.PutUint32(out[18:], icoHeaderSize)

	return append(out, png...)
}
