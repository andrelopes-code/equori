//go:build windows

package main

import (
	"context"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"strings"
	"time"

	"fyne.io/systray"
	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"

	"github.com/andrelopes-code/equori/web"
)

const (
	runKeyPath         = `Software\Microsoft\Windows\CurrentVersion\Run`
	runValueName       = "equori"
	healthPollInterval = 500 * time.Millisecond
	healthTimeout      = 120 * time.Second
)

func (t *tray) setIcon() {
	png, err := fs.ReadFile(web.Dist(), "icon-192.png")
	if err != nil {
		return
	}

	systray.SetIcon(icoFromPNG(png))
}

// addMenu builds the menu of PW3.3 and starts the loop that handles its clicks.
func (t *tray) addMenu() {
	open := systray.AddMenuItem(t.texts.Open, "")
	start := systray.AddMenuItemCheckbox(t.texts.StartWithWindows, "", runValueSet())

	systray.AddSeparator()

	quit := systray.AddMenuItem(t.texts.Quit, "")

	go func() {
		for {
			select {
			case <-open.ClickedCh:
				t.openApp()
			case <-start.ClickedCh:
				toggleRunValue(start)
			case <-quit.ClickedCh:
				systray.Quit()

				return
			}
		}
	}()
}

func (t *tray) openApp() { openBrowser(localURL(t.cfg.HTTPAddr)) }

// openWhenHealthy opens the browser once /healthz answers (PW3.2): at the content of setup.url
// when the file exists, else at the configured address. `--background` opens nothing.
func (t *tray) openWhenHealthy(ctx context.Context) {
	if t.background {
		return
	}

	base := localURL(t.cfg.HTTPAddr)
	deadline := time.Now().Add(healthTimeout)

	for time.Now().Before(deadline) {
		if healthy(ctx, base+"healthz") {
			openBrowser(t.landingURL(base))

			return
		}

		select {
		case <-ctx.Done():
			return
		case <-time.After(healthPollInterval):
		}
	}
}

func (t *tray) landingURL(base string) string {
	b, err := os.ReadFile(setupFile(t.cfg))
	if err != nil || strings.TrimSpace(string(b)) == "" {
		return base
	}

	return strings.TrimSpace(string(b))
}

func healthy(ctx context.Context, url string) bool {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return false
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false
	}

	_ = resp.Body.Close()

	return resp.StatusCode == http.StatusOK
}

func openBrowser(url string) {
	verb, verbErr := windows.UTF16PtrFromString("open")
	target, targetErr := windows.UTF16PtrFromString(url)

	if verbErr != nil || targetErr != nil {
		return
	}

	_ = windows.ShellExecute(0, verb, target, nil, nil, windows.SW_SHOWNORMAL)
}

// runValueData is the command that starts equori at logon (PW2.4, A2).
func runValueData() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("locate executable: %w", err)
	}

	return `"` + exe + `" tray --background`, nil
}

func runValueSet() bool {
	want, err := runValueData()
	if err != nil {
		return false
	}

	key, err := registry.OpenKey(registry.CURRENT_USER, runKeyPath, registry.QUERY_VALUE)
	if err != nil {
		return false
	}

	defer func() { _ = key.Close() }()

	got, _, err := key.GetStringValue(runValueName)

	return err == nil && strings.EqualFold(got, want)
}

// toggleRunValue writes or deletes the Run value and flips the check mark to match.
func toggleRunValue(item *systray.MenuItem) {
	key, _, err := registry.CreateKey(
		registry.CURRENT_USER,
		runKeyPath,
		registry.SET_VALUE|registry.QUERY_VALUE,
	)
	if err != nil {
		return
	}

	defer func() { _ = key.Close() }()

	if item.Checked() {
		if key.DeleteValue(runValueName) == nil {
			item.Uncheck()
		}

		return
	}

	data, err := runValueData()
	if err == nil && key.SetStringValue(runValueName, data) == nil {
		item.Check()
	}
}
