package apitest

import (
	"context"
	"io/fs"
	"maps"
	"os"
	"time"

	"github.com/andrelopes-code/equori/internal/platform/clock"
	"github.com/andrelopes-code/equori/internal/platform/llm"
	"github.com/andrelopes-code/equori/internal/platform/tool"
	"github.com/andrelopes-code/equori/internal/server"
)

// Option configures the harness: the server configuration and the profile of the owner of New.
type Option func(*options)

type options struct {
	cfg     server.Config
	profile Profile
}

// Today fixes the instance clock at 12:00 UTC of date (YYYY-MM-DD).
func Today(date string) Option {
	d, err := time.Parse(time.DateOnly, date)
	if err != nil {
		panic(err)
	}

	clk := clock.New(func() time.Time { return d.Add(12 * time.Hour) })

	return func(o *options) { o.cfg.Clock = &clk }
}

// Clock replaces the instance clock with now.
func Clock(now func() time.Time) Option {
	clk := clock.New(now)
	return func(o *options) { o.cfg.Clock = &clk }
}

// IdentityClock replaces the clock of sessions and second factors with now.
func IdentityClock(now func() time.Time) Option {
	return func(o *options) { o.cfg.IdentityNow = now }
}

// ExtraTools adds tool groups to the registry and the chat set.
func ExtraTools(groups ...tool.Group) Option {
	return func(o *options) { o.cfg.ExtraTools = append(o.cfg.ExtraTools, groups...) }
}

// LLM configures providers for the whole instance through server.Config.LLMProviders (BK24).
func LLM(providers ...llm.Provider) Option {
	return func(o *options) { o.cfg.LLMProviders = providers }
}

// LLMWait replaces the timer the chat waits on for a transient cooldown to end (design 2026-10-26 E6).
func LLMWait(f func(context.Context, time.Time) error) Option {
	return func(o *options) { o.cfg.LLMWait = f }
}

// LLMFactory builds the providers members configure, in place of the real adapters.
func LLMFactory(f func(api, baseURL, key string) llm.Provider) Option {
	return func(o *options) { o.cfg.LLMFactory = f }
}

// Web serves fsys as the single-page application outside /api/.
func Web(fsys fs.FS) Option {
	return func(o *options) { o.cfg.Web = fsys }
}

// WebDevPort redirects pages to a Vite server on port of the request's host.
func WebDevPort(port int) Option {
	return func(o *options) { o.cfg.WebDevPort = port }
}

// APIDocs serves the API reference at /docs and the contract at /openapi.yaml.
func APIDocs() Option {
	return func(o *options) { o.cfg.APIDocs = true }
}

// FakeDumpContent is what FakeDump writes.
const FakeDumpContent = "equori test dump\n"

// FakeDump writes FakeDumpContent to path with mode 0600, in place of pg_dump.
func FakeDump(_ context.Context, path string) error {
	return os.WriteFile(path, []byte(FakeDumpContent), 0o600)
}

// Backups turns automatic backups on in dir, with the encrypted copy folder copyDir ("" for none);
// dump replaces pg_dump.
func Backups(dir, copyDir string, dump func(ctx context.Context, path string) error) Option {
	return func(o *options) {
		o.cfg.Instance.BackupDir, o.cfg.Instance.CopyDir, o.cfg.Instance.Dump = dir, copyDir, dump
	}
}

// Version sets the version of the running app.
func Version(v string) Option {
	return func(o *options) { o.cfg.Version = v }
}

// ReleaseURL replaces the latest-release address of the version check.
func ReleaseURL(url string) Option {
	return func(o *options) { o.cfg.Instance.ReleaseURL = url }
}

// Distribution sets EQUORI_DISTRIBUTION and the mode of the instance (A194).
func Distribution(variable, mode string) Option {
	return func(o *options) { o.cfg.Instance.Distribution, o.cfg.Instance.Mode = variable, mode }
}

// SecretKey is the integration key Pluggy sets (32 bytes).
//
//nolint:gosec // G101: a fixed key for test databases only
const SecretKey = "equori-test-secret-key-32-bytes!"

// Aggregator sends the requests of aggregator id to url and enables integrations with SecretKey.
func Aggregator(id, url string) Option {
	return func(o *options) {
		if o.cfg.AggregatorURLs == nil {
			o.cfg.AggregatorURLs = map[string]string{}
		}

		o.cfg.AggregatorURLs[id], o.cfg.SecretKey = url, SecretKey
	}
}

// PriceFeeds enables the price feeds ids against the base URLs of a test server.
func PriceFeeds(ids []string, urls map[string]string) Option {
	return func(o *options) { o.cfg.PriceFeeds, o.cfg.FeedURLs = ids, urls }
}

// FeedBounds bounds one source in a catalog search and in a probe.
func FeedBounds(catalog, probe time.Duration) Option {
	return func(o *options) { o.cfg.CatalogBound, o.cfg.ProbeBound = catalog, probe }
}

// IndexFeeds enables the index feeds ids against the base URLs of a test server.
func IndexFeeds(ids []string, urls map[string]string) Option {
	return func(o *options) {
		o.cfg.IndexFeeds = ids
		if o.cfg.FeedURLs == nil {
			o.cfg.FeedURLs = map[string]string{}
		}

		maps.Copy(o.cfg.FeedURLs, urls)
	}
}

// SecretKeys replaces the integration keys; pass it after Aggregator.
func SecretKeys(current, previous string) Option {
	return func(o *options) { o.cfg.SecretKey, o.cfg.PreviousSecretKey = current, previous }
}
