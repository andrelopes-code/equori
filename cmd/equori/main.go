package main

import (
	"errors"
	"fmt"
	"os"
	_ "time/tzdata" // A book's time zone must resolve in images without a zoneinfo database (BK19).
)

func main() {
	if err := run(os.Args); err != nil {
		fmt.Fprintln(os.Stderr, err)

		if errors.Is(err, errNotWindows) {
			os.Exit(2)
		}

		os.Exit(1)
	}
}

// defaultCommand runs when no command is given. The Windows GUI build sets it to tray through
// -ldflags "-X main.defaultCommand=tray".
var defaultCommand = "serve"

func run(args []string) error {
	cmd, rest := defaultCommand, []string(nil)
	if len(args) > 1 {
		cmd, rest = args[1], args[2:]
	}

	switch cmd {
	case "serve":
		return runServe()
	case "user":
		return userCommand(args[2:])
	case "reporting":
		return reportingCommand(args[2:])
	case "portfolio":
		return portfolioCommand(args[2:])
	case "instruments":
		return instrumentsCommand(args[2:])
	case "planning":
		return planningCommand(args[2:])
	case "secrets":
		return secretsCommand(args[2:])
	case "backup":
		return backupCommand(args[2:])
	case "restore":
		return restoreCommand(args[2:])
	case "tray":
		return runTray(rest)
	case "stop":
		return runStop(args[2:])
	case "healthcheck":
		os.Exit(healthcheck())
	case "version":
		return printVersion()
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q; available: serve, user, reporting, portfolio, "+
			"instruments, planning, secrets, backup, restore, tray, stop, healthcheck, version\n", cmd)
		os.Exit(2)
	}

	return nil
}
