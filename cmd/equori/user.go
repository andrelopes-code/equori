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
	"github.com/andrelopes-code/equori/internal/ledger"
	"github.com/andrelopes-code/equori/internal/platform/locale"
	"github.com/andrelopes-code/equori/internal/platform/money"
)

const userUsage = `usage: equori user create --email EMAIL --language LANG --region REGION [--currency CODE] [--admin]

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
	language := fs.String("language", "", "")
	region := fs.String("region", "", "")
	currency := fs.String("currency", "", "")
	admin := fs.Bool("admin", false, "")
	if err := fs.Parse(args[1:]); err != nil || *email == "" || *language == "" || *region == "" || fs.NArg() > 0 {
		fmt.Fprintln(os.Stderr, userUsage)
		return errUsage
	}
	l, base, err := userSettings(*language, *region, *currency)
	if err != nil {
		return err
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
	db, err := openDatabase(ctx, cfg, log, false)
	if err != nil {
		return err
	}
	defer db.Close(log)

	role := identity.RoleMember
	if *admin {
		role = identity.RoleAdmin
	}
	user, err := identity.New(db.Pool, identity.Config{}, log).CreateUser(ctx, *email, password, role, l, base)
	if err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	fmt.Fprintf(os.Stderr, "created %s user %s (id %d)\n", user.Role, user.Email, user.ID)
	return nil
}

// userSettings resolves the profile and base currency of a new user; without a currency the region default applies.
func userSettings(language, region, currency string) (locale.Locale, money.Currency, error) {
	l := locale.Locale{Language: language, Region: region}
	if !locale.ValidLanguage(language) {
		return l, "", fmt.Errorf("--language %q must be an ISO 639 language code", language)
	}
	if !locale.ValidRegion(region) {
		return l, "", fmt.Errorf("--region %q must be an ISO 3166-1 alpha-2 code", region)
	}
	if currency == "" {
		base, ok := ledger.DefaultBaseCurrency(region)
		if !ok {
			return l, "", fmt.Errorf("--currency is required for region %s", region)
		}
		return l, base, nil
	}
	base, err := money.ParseCurrency(currency)
	if err != nil {
		return l, "", fmt.Errorf("--currency: %w", err)
	}
	return l, base, nil
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
