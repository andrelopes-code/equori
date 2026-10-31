package backup

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"

	"filippo.io/age"
)

const (
	copySuffix = ".age"
	ageHeader  = "age-encryption.org/v1"
)

var (
	ErrFolderNotWritable = errors.New("the copy folder cannot be written")
	ErrCopyPassword      = errors.New("the copy password does not open this file")
)

// Encrypt writes src encrypted with age's scrypt recipient of password to dir/<base(src)>.age,
// mode 0644, through <name>.age.partial and a rename; it returns the file name (ADR 031).
func Encrypt(src, dir, password string) (string, error) {
	recipient, err := age.NewScryptRecipient(password)
	if err != nil {
		return "", fmt.Errorf("encrypt copy: %w", err)
	}

	in, err := os.Open(src) //nolint:gosec // G304: the backup path is the owner's configuration.
	if err != nil {
		return "", fmt.Errorf("open %s: %w", src, err)
	}
	defer in.Close()

	name := filepath.Base(src) + copySuffix
	path := filepath.Join(dir, name)
	partial := path + ".partial"

	out, err := os.OpenFile(partial, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o644) //nolint:gosec // G302, G304: a copy is read by the host user of the folder; the folder is the owner's configuration.
	if errors.Is(err, fs.ErrPermission) || errors.Is(err, fs.ErrNotExist) {
		return "", fmt.Errorf("%w: %w", ErrFolderNotWritable, err)
	}

	if err != nil {
		return "", fmt.Errorf("create %s: %w", partial, err)
	}

	if err := encryptTo(out, in, recipient); err != nil {
		_ = os.Remove(partial)
		return "", err
	}

	// The umask can narrow the mode given to OpenFile.
	if err := os.Chmod(partial, 0o644); err != nil { //nolint:gosec // G302: as above.
		_ = os.Remove(partial)
		return "", fmt.Errorf("set mode of %s: %w", partial, err)
	}

	if err := os.Rename(partial, path); err != nil {
		_ = os.Remove(partial)
		return "", fmt.Errorf("finish %s: %w", path, err)
	}

	return name, nil
}

// Decrypt writes the plaintext of the age file src to dst, created with mode 0600.
func Decrypt(src, dst, password string) error {
	identity, err := age.NewScryptIdentity(password)
	if err != nil {
		return fmt.Errorf("decrypt copy: %w", err)
	}

	in, err := os.Open(src) //nolint:gosec // G304: the copy path is the operator's argument.
	if err != nil {
		return fmt.Errorf("open %s: %w", src, err)
	}
	defer in.Close()

	plain, err := age.Decrypt(in, identity)

	var noMatch *age.NoIdentityMatchError
	if errors.As(err, &noMatch) {
		return ErrCopyPassword
	}

	if err != nil {
		return fmt.Errorf("decrypt %s: %w", src, err)
	}

	out, err := os.OpenFile(dst, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600) //nolint:gosec // G304: the destination is chosen by the caller.
	if err != nil {
		return fmt.Errorf("create %s: %w", dst, err)
	}

	_, err = io.Copy(out, plain)
	if cerr := out.Close(); err == nil {
		err = cerr
	}

	if err != nil {
		_ = os.Remove(dst)
		return fmt.Errorf("decrypt %s: %w", src, err)
	}

	return nil
}

// IsCopy reports whether the file starts with the age header "age-encryption.org/v1".
func IsCopy(path string) (bool, error) {
	f, err := os.Open(path) //nolint:gosec // G304: the path is the operator's argument.
	if err != nil {
		return false, fmt.Errorf("open %s: %w", path, err)
	}
	defer f.Close()

	head := make([]byte, len(ageHeader))

	_, err = io.ReadFull(f, head)
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return false, nil
	}

	if err != nil {
		return false, fmt.Errorf("read %s: %w", path, err)
	}

	return bytes.Equal(head, []byte(ageHeader)), nil
}

// PruneCopies deletes all but the keep newest files dir/<prefix>-*.dump.age.
func PruneCopies(dir, prefix string, keep int) error {
	names, err := filepath.Glob(filepath.Join(dir, prefix+"-*.dump"+copySuffix))
	if err != nil {
		return fmt.Errorf("list copies: %w", err)
	}

	slices.Sort(names)

	for _, name := range names[:max(0, len(names)-keep)] {
		if err := os.Remove(name); err != nil {
			return fmt.Errorf("prune copy: %w", err)
		}
	}

	return nil
}

func encryptTo(out *os.File, in io.Reader, recipient age.Recipient) error {
	w, err := age.Encrypt(out, recipient)
	if err == nil {
		_, err = io.Copy(w, in)
	}

	if err == nil {
		err = w.Close()
	}

	if cerr := out.Close(); err == nil {
		err = cerr
	}

	if err != nil {
		return fmt.Errorf("encrypt copy: %w", err)
	}

	return nil
}
