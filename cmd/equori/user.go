package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"

	"golang.org/x/term"

	"github.com/andrelopes-code/equori/internal/identity"
)

const userUsage = `usage: equori user create --email <email> [--admin]

The password is read from stdin: prompted without echo on a terminal,
otherwise the first line of input.`

var errUsage = errors.New("invalid arguments")

func userCommand(args []string) error {
	if len(args) == 0 || args[0] != "create" {
		fmt.Fprintln(os.Stderr, userUsage)
		return errUsage
	}
	fs := flag.NewFlagSet("user create", flag.ContinueOnError)
	fs.SetOutput(io.Discard)
	email := fs.String("email", "", "")
	admin := fs.Bool("admin", false, "")
	if err := fs.Parse(args[1:]); err != nil || *email == "" || fs.NArg() > 0 {
		fmt.Fprintln(os.Stderr, userUsage)
		return errUsage
	}

	password, err := readPassword()
	if err != nil {
		return err
	}

	cfg, log, err := setup()
	if err != nil {
		return err
	}
	ctx := context.Background()
	pool, err := openDatabase(ctx, cfg, log)
	if err != nil {
		return err
	}
	defer pool.Close()

	role := identity.RoleMember
	if *admin {
		role = identity.RoleAdmin
	}
	user, err := identity.New(pool, identity.Config{}, log).CreateUser(ctx, *email, password, role)
	if err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	fmt.Fprintf(os.Stderr, "created %s user %s (id %d)\n", user.Role, user.Email, user.ID)
	return nil
}

func readPassword() (string, error) {
	fd := int(os.Stdin.Fd()) //nolint:gosec // file descriptors fit in int.
	if term.IsTerminal(fd) {
		fmt.Fprint(os.Stderr, "Password: ")
		b, err := term.ReadPassword(fd)
		fmt.Fprintln(os.Stderr)
		return string(b), err
	}
	line, err := bufio.NewReader(os.Stdin).ReadString('\n')
	if err != nil && !errors.Is(err, io.EOF) {
		return "", fmt.Errorf("read password: %w", err)
	}
	return strings.TrimRight(line, "\r\n"), nil
}
