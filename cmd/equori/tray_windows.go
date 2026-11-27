//go:build windows

package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"time"

	"fyne.io/systray"
	"golang.org/x/sys/windows"

	"github.com/andrelopes-code/equori/internal/platform/config"
	"github.com/andrelopes-code/equori/internal/platform/logfile"
	"github.com/andrelopes-code/equori/internal/platform/pgcluster"
)

const (
	logLimit    = 10 << 20
	exitTimeout = 20 * time.Second
)

// tray is the state of one `tray` process: the data directory it owns, the texts of its menu and
// the serve loop it runs.
type tray struct {
	cfg        config.Config
	texts      trayText
	logPath    string
	background bool
	stopEvent  windows.Handle
	cancel     context.CancelFunc
	served     chan struct{}
}

// runTray starts equori from a tray icon (PW3.1 to PW3.7). A second process on the same folder
// opens the browser and exits.
func runTray(args []string) error {
	texts := trayTexts(trayLanguage(preferredLanguages()))
	background := slices.Contains(args, "--background")
	dir := config.DataDir(os.Getenv)
	logPath := filepath.Join(dir, "log", "equori.log")

	// The data directory gets its DACL before the log creates it (W-M3).
	if err := pgcluster.PrepareDataDir(dir); err != nil {
		showFailure(texts, err, logPath)

		return err
	}

	// A second process leaves the log to the first: rotating a file open elsewhere fails.
	held, err := pgcluster.Held(dir)
	if err != nil {
		showFailure(texts, err, logPath)

		return err
	}

	if held {
		return openRunning(background)
	}

	if err := redirectOutput(logPath); err != nil {
		showFailure(texts, err, logPath)

		return err
	}

	cfg, _, err := setup()
	if err != nil {
		showFailure(texts, err, logPath)

		return err
	}

	t := &tray{
		cfg:        cfg,
		texts:      texts,
		logPath:    logPath,
		background: background,
		served:     make(chan struct{}),
	}

	return t.run()
}

// openRunning opens the browser at the instance that already serves the folder (PW3.1).
func openRunning(background bool) error {
	if background {
		return nil
	}

	cfg, _, err := setup()
	if err != nil {
		return err
	}

	openBrowser(localURL(cfg.HTTPAddr))

	return nil
}

func (t *tray) run() error {
	if err := t.createStopEvent(); err != nil {
		showFailure(t.texts, err, t.logPath)

		return err
	}

	defer func() { _ = windows.CloseHandle(t.stopEvent) }()

	ctx, cancel := context.WithCancel(context.Background())
	t.cancel = cancel

	defer cancel()

	systray.Run(func() { t.onReady(ctx) }, t.onExit)

	return nil
}

func (t *tray) createStopEvent() error {
	name, err := windows.UTF16PtrFromString(stopEventName(t.cfg.DataDir))
	if err != nil {
		return fmt.Errorf("encode stop event name: %w", err)
	}

	t.stopEvent, err = windows.CreateEvent(nil, 1, 0, name)
	if err != nil {
		return fmt.Errorf("create stop event: %w", err)
	}

	return nil
}

func (t *tray) onReady(ctx context.Context) {
	t.setIcon()
	systray.SetTooltip(fmt.Sprintf(t.texts.Tooltip, localURL(t.cfg.HTTPAddr)))
	systray.SetOnTapped(t.openApp)
	t.addMenu()

	go t.serve(ctx)
	go t.openWhenHealthy(ctx)
	go t.quitOnStopEvent()
}

// onExit runs when the tray closes, also at logoff (A4): it stops serve and waits for it, so
// PostgreSQL stops cleanly.
func (t *tray) onExit() {
	t.cancel()

	select {
	case <-t.served:
	case <-time.After(exitTimeout):
	}
}

func (t *tray) serve(ctx context.Context) {
	err := serve(ctx)

	close(t.served)

	if ctx.Err() != nil {
		return
	}

	if err != nil {
		showFailure(t.texts, err, t.logPath)
	}

	systray.Quit()
}

func (t *tray) quitOnStopEvent() {
	event, _ := windows.WaitForSingleObject(t.stopEvent, windows.INFINITE)
	if event == windows.WAIT_OBJECT_0 {
		systray.Quit()
	}
}

func preferredLanguages() []string {
	languages, err := windows.GetUserPreferredUILanguages(windows.MUI_LANGUAGE_NAME)
	if err != nil {
		return nil
	}

	return languages
}

// redirectOutput sends the standard output and error to the log, which a GUI process lacks
// (PW3.6). The handles are replaced too, for the child processes that inherit them.
func redirectOutput(path string) error {
	f, err := logfile.Open(path, logLimit)
	if err != nil {
		return err
	}

	os.Stdout, os.Stderr = f, f

	if err := windows.SetStdHandle(windows.STD_OUTPUT_HANDLE, windows.Handle(f.Fd())); err != nil {
		return fmt.Errorf("redirect standard output: %w", err)
	}

	if err := windows.SetStdHandle(windows.STD_ERROR_HANDLE, windows.Handle(f.Fd())); err != nil {
		return fmt.Errorf("redirect standard error: %w", err)
	}

	return nil
}

// showFailure shows the start failure box (PW3.5).
func showFailure(texts trayText, err error, logPath string) {
	body, bodyErr := windows.UTF16PtrFromString(fmt.Sprintf(texts.FailedBody, err, logPath))
	title, titleErr := windows.UTF16PtrFromString(texts.FailedTitle)

	if bodyErr != nil || titleErr != nil {
		return
	}

	_, _ = windows.MessageBox(0, body, title, windows.MB_OK|windows.MB_ICONERROR)
}
