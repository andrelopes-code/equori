# Distribution F3: Homebrew and Remote Access Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `brew install andrelopes-code/equori/equori` installs a binary that runs as a per-user service in managed mode, and a guide brings the phone to it over HTTPS.

**Architecture:** A formula template in the repository is rendered by the release job from `SHA256SUMS` and pushed to the tap repository. A macOS job installs the published formula and starts managed mode against Homebrew's `postgresql@18`. A guide documents `tailscale serve`, a reverse proxy, and the limits of plain HTTP.

**Tech Stack:** Homebrew formula DSL (Ruby), bash, GitHub Actions (`macos-latest`), Tailscale.

**Spec:** `docs/superpowers/specs/2026-10-26-distribution-design.md` (phase F3: R5, R6, D8, C4).

**Requires:** F2 complete (managed mode, `equori version`, release workflow with archives).

## Global Constraints

- Tap repository: `andrelopes-code/homebrew-equori`; formula name `equori`; file `Formula/equori.rb` in the tap.
- The formula is a formula, never a cask: casks are quarantined and Homebrew removes unsigned casks from the official tap (spec, Platform facts).
- The formula installs the prebuilt archive of the release, depends on `postgresql@18`, sets `EQUORI_POSTGRES_BIN` through a wrapper script, and declares a service with `EQUORI_HTTP_ADDR=127.0.0.1:8080`.
- While versions are `0.x`, every tag updates the formula; from 1.0, only tags without `-` (R5).
- Credentials: the secret `HOMEBREW_TAP_TOKEN`, a fine-grained token with contents read and write on the tap repository only (R6).
- Documentation examples use placeholders for regional values (`--language <code> --region <country>`), never a literal region.
- Steps marked **Owner** create or change something outside this repository or need a real device. An agent stops at them and reports; it never runs them.

## Review Focus

1. A Linux user of Homebrew: the formula must select the Linux archive for the CPU. Golden test of Task 2 covers the four URL and checksum pairs.
2. A release whose `SHA256SUMS` lacks one target: rendering must fail, not publish an empty checksum. Test in Task 2.
3. A pre-release tag after 1.0: the formula must not move. Condition in Task 3, checked by the expression test of Task 3 Step 2.
4. The service starts before the owner created a user: the page answers, and the caveats name the command that creates the first user. Task 4 checks `/healthz` on a fresh data directory.
5. A phone on plain HTTP: no installation and no offline queue; the guide must say so before the owner tries. Task 5.

---

### Task 1: Tap repository and token (Owner)

- [ ] **Step 1 (Owner):** `gh repo create andrelopes-code/homebrew-equori --public --description "Homebrew tap of equori" --add-readme`
- [ ] **Step 2 (Owner):** In GitHub settings, create a fine-grained personal access token: repository access `andrelopes-code/homebrew-equori` only, permission Contents read and write, expiry at most one year.
- [ ] **Step 3 (Owner):** `gh secret set HOMEBREW_TAP_TOKEN --repo andrelopes-code/equori` and paste the token.
- [ ] **Step 4:** An agent checks the result with `gh repo view andrelopes-code/homebrew-equori --json name -q .name && gh secret list --repo andrelopes-code/equori | grep HOMEBREW_TAP_TOKEN`. Expected: `homebrew-equori` and one secret line. Otherwise stop and report.

---

### Task 2: Formula template and renderer

**Files:**
- Create: `packaging/homebrew/equori.rb.tmpl`
- Create: `scripts/render-formula.sh` (mode 0755)
- Create: `packaging/homebrew/testdata/SHA256SUMS`, `packaging/homebrew/testdata/equori.rb.golden`
- Modify: `Makefile` (target `formula-test`; `check` runs it)

**Interfaces:**
- Produces: `scripts/render-formula.sh VERSION SHA256SUMS` writes the formula to stdout. `VERSION` has no `v` prefix. Exit status 1 when a target is missing from `SHA256SUMS`.

- [ ] **Step 1: Write the template** `packaging/homebrew/equori.rb.tmpl`:

```ruby
# Rendered by scripts/render-formula.sh on each release (ADR 021, R5); edit the template, not the tap.
class Equori < Formula
  desc "Self-hosted personal finance manager"
  homepage "https://github.com/andrelopes-code/equori"
  version "@VERSION@"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/andrelopes-code/equori/releases/download/v@VERSION@/equori_@VERSION@_darwin_arm64.tar.gz"
      sha256 "@SHA_DARWIN_ARM64@"
    end
    on_intel do
      url "https://github.com/andrelopes-code/equori/releases/download/v@VERSION@/equori_@VERSION@_darwin_amd64.tar.gz"
      sha256 "@SHA_DARWIN_AMD64@"
    end
  end
  on_linux do
    on_arm do
      url "https://github.com/andrelopes-code/equori/releases/download/v@VERSION@/equori_@VERSION@_linux_arm64.tar.gz"
      sha256 "@SHA_LINUX_ARM64@"
    end
    on_intel do
      url "https://github.com/andrelopes-code/equori/releases/download/v@VERSION@/equori_@VERSION@_linux_amd64.tar.gz"
      sha256 "@SHA_LINUX_AMD64@"
    end
  end

  depends_on "postgresql@18"

  def install
    libexec.install "equori"
    (bin/"equori").write_env_script libexec/"equori", EQUORI_POSTGRES_BIN: Formula["postgresql@18"].opt_bin
  end

  service do
    run [opt_bin/"equori", "serve"]
    environment_variables EQUORI_HTTP_ADDR: "127.0.0.1:8080"
    keep_alive true
    log_path var/"log/equori.log"
    error_log_path var/"log/equori.log"
  end

  def caveats
    <<~EOS
      Start equori in the background:
        brew services start equori
      Create the first user:
        equori user create --email you@example.com --language <code> --region <country> --admin
      Then open http://127.0.0.1:8080

      Data, backups, secret.key and settings (equori.env) live in
        ~/Library/Application Support/equori   on macOS
        ~/.local/share/equori                  on Linux
      Back up secret.key apart from the backups: equori secrets key prints it.
    EOS
  end

  test do
    assert_match "postgresql >= 18", shell_output("#{bin}/equori version")
  end
end
```

- [ ] **Step 2: Write the fixture** `packaging/homebrew/testdata/SHA256SUMS` with four lines in `sha256sum` format (two spaces between sum and name), sums `1111...` (64 × `1`) for `equori_0.1.0_darwin_amd64.tar.gz`, `2222...` for `darwin_arm64`, `3333...` for `linux_amd64`, `4444...` for `linux_arm64`.

- [ ] **Step 3: Write the renderer** `scripts/render-formula.sh`:

```bash
#!/usr/bin/env bash
# Renders the Homebrew formula of a release from its SHA256SUMS (ADR 021, R5).
set -euo pipefail
if [[ $# -ne 2 ]]; then
	echo "usage: $0 VERSION SHA256SUMS" >&2
	exit 2
fi
version=$1 sums=$2
root=$(cd "$(dirname "$0")/.." && pwd)
args=(-e "s/@VERSION@/$version/g")
for target in darwin_arm64 darwin_amd64 linux_arm64 linux_amd64; do
	sum=$(awk -v f="equori_${version}_${target}.tar.gz" '$2 == f { print $1 }' "$sums")
	if [[ ! $sum =~ ^[0-9a-f]{64}$ ]]; then
		echo "$sums has no checksum for equori_${version}_${target}.tar.gz" >&2
		exit 1
	fi
	args+=(-e "s/@SHA_${target^^}@/$sum/")
done
sed "${args[@]}" "$root/packaging/homebrew/equori.rb.tmpl"
```

- [ ] **Step 4: Generate the golden file once and read it**

Run: `scripts/render-formula.sh 0.1.0 packaging/homebrew/testdata/SHA256SUMS > packaging/homebrew/testdata/equori.rb.golden && grep -cE '@[A-Z_0-9]+@' packaging/homebrew/testdata/equori.rb.golden`
Expected: `0` (no placeholder left). Read the golden file: each `url` names the target of its block and the `sha256` beneath it is that target's fixture sum (`darwin_arm64` → `2222…`).

- [ ] **Step 5: Makefile target**

```make
# The formula renders to the reviewed golden file, and a missing target fails the render.
formula-test:
	scripts/render-formula.sh 0.1.0 packaging/homebrew/testdata/SHA256SUMS | diff -u packaging/homebrew/testdata/equori.rb.golden -
	! grep -v linux_arm64 packaging/homebrew/testdata/SHA256SUMS | scripts/render-formula.sh 0.1.0 /dev/stdin >/dev/null 2>&1
```

Add `formula-test` to `.PHONY` and as a prerequisite of `static`.

- [ ] **Step 6: Run** `make formula-test`
Expected: exit status 0.

- [ ] **Step 7: Commit**

```bash
git add packaging scripts/render-formula.sh Makefile
git commit -m "build: render a homebrew formula from release checksums" -m "The formula installs the release archive, depends on postgresql@18,
points EQUORI_POSTGRES_BIN at it through a wrapper and runs serve as a
per-user service on 127.0.0.1:8080. A golden file pins the rendering
and a release without every target fails it (ADR 021, R5)."
```

---

### Task 3: Release job that updates the tap

**Files:**
- Modify: `.github/workflows/release.yml` (new job `homebrew`)

**Interfaces:**
- Consumes: the `dist` artifact (F1), `scripts/render-formula.sh` (Task 2), secret `HOMEBREW_TAP_TOKEN` (Task 1).

- [ ] **Step 1: Add the job**

```yaml
  # R5: in 0.x every tag moves the formula; from 1.0 only a tag without a pre-release suffix.
  homebrew:
    needs: release
    if: startsWith(github.ref_name, 'v0.') || !contains(github.ref_name, '-')
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/download-artifact@v8
        with:
          name: dist
          path: dist/
      - run: scripts/render-formula.sh "${GITHUB_REF_NAME#v}" dist/SHA256SUMS > "$RUNNER_TEMP/equori.rb"
      - uses: actions/checkout@v5
        with:
          repository: andrelopes-code/homebrew-equori
          token: ${{ secrets.HOMEBREW_TAP_TOKEN }}
          path: tap
      - run: |
          mkdir -p tap/Formula
          cp "$RUNNER_TEMP/equori.rb" tap/Formula/equori.rb
          cd tap
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add Formula/equori.rb
          git commit -m "equori ${GITHUB_REF_NAME#v}"
          git push
```

- [ ] **Step 2: Check the condition for four tags.** The expression is true for `v0.3.0`, `v0.3.0-beta.1` and `v1.0.0`, and false for `v1.1.0-rc.1`. Write this table as a comment above the job, then validate the file with `docker run --rm -v "$PWD":/repo -w /repo rhysd/actionlint:1.7.7 .github/workflows/release.yml`. Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: update the homebrew tap on each release" -m "The job renders the formula from the release checksums and pushes it
to andrelopes-code/homebrew-equori with a token limited to that
repository (ADR 021, R5 and R6)."
```

---

### Task 4: macOS installation check after release

**Files:**
- Modify: `.github/workflows/release.yml` (new job `homebrew-check`)

- [ ] **Step 1: Add the job**

```yaml
  # The published formula installs, passes its test, and runs managed mode on Homebrew's postgresql@18.
  homebrew-check:
    needs: homebrew
    runs-on: macos-latest
    steps:
      - run: brew tap andrelopes-code/equori
      - run: brew install andrelopes-code/equori/equori
      - run: brew test andrelopes-code/equori/equori
      - run: test "$(equori version | head -1)" = "equori ${GITHUB_REF_NAME}"
      - run: |
          export EQUORI_DATA_DIR="$RUNNER_TEMP/equori"
          equori serve > "$RUNNER_TEMP/serve.log" 2>&1 &
          serve=$!
          for _ in $(seq 90); do curl -fsS http://127.0.0.1:8080/healthz && break; sleep 1; done
          curl -fsS http://127.0.0.1:8080/healthz
          printf 'equori-check-pass\n' | equori user create --email check@equori.test --language en --region US
          equori backup | grep -E '/backups/equori-[0-9-]+-s[0-9]+\.dump$'
          kill "$serve"
          wait "$serve" || true
          test ! -e "$EQUORI_DATA_DIR/pg/postmaster.pid"
```

`--language en --region US` is test input of the check, not a default.

- [ ] **Step 2: Validate** with the `actionlint` command of Task 3 Step 2. Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: install the released formula on macos and run managed mode" -m "After the tap moves, a macOS runner installs the formula, runs its
test, starts serve against postgresql@18, creates a user, writes a
backup and checks that a stop leaves no server behind."
```

---

### Task 5: Remote access guide (D8)

**Files:**
- Create: `docs/operations/remote-access.md`
- Modify: `README.md` (link under `## Run`)

- [ ] **Step 1: Write the guide** with these sections, in this order, impersonal and declarative:
  1. `# Remote access`: one paragraph. The phone needs HTTPS to install the application, to keep the session cookie (`Secure`, ADR 003) and to queue captures offline (ADR 021, D7).
  2. `## Tailscale`: for Homebrew (equori on `127.0.0.1:8080`) and compose. Commands: `tailscale serve --bg 8080`, `tailscale serve status` (prints the `https://<machine>.<tailnet>.ts.net` address to open on the phone), `tailscale serve reset`. HTTPS certificates must be enabled for the tailnet; the first `serve` asks for it. Serve stays inside the tailnet; Funnel publishes to the internet and is not used. The CLI syntax changed in client 1.52; `tailscale serve --help` shows the installed form.
  3. `## Reverse proxy with a domain`: a VPS or a host with a public name. Caddy example:

```
equori.example.com {
	reverse_proxy 127.0.0.1:8080
}
```

  The proxy keeps the `Host` header (Caddy's default), which the cross-origin protection of ADR 003 compares with `Origin`.
  4. `## Plain HTTP on a LAN`: a table with columns Works / Does not work. Works: login with `EQUORI_INSECURE_COOKIES=true`, every screen while the server answers. Does not work: installation on the phone, the offline capture queue, the service worker.
  5. `## Phone`: open the HTTPS address, sign in, then the browser's "Add to Home Screen" (Safari) or "Install app" (Chrome). The installed application keeps the queue's storage on iOS, where a site that is not installed loses it after 7 days without use.

- [ ] **Step 2: README.** Under `## Run`, add `Phone access over HTTPS: [docs/operations/remote-access.md](docs/operations/remote-access.md).` and a subsection `### Homebrew (macOS, Linux)` with `brew install andrelopes-code/equori/equori`, `brew services start equori`, and the user-creation command with placeholders.

- [ ] **Step 3: Commit**

```bash
git add docs/operations/remote-access.md README.md
git commit -m "docs: reach equori from a phone over https" -m "Tailscale Serve for a loopback-bound equori, a reverse proxy for a
public name, and what plain HTTP on a LAN cannot do (ADR 021, D8)."
```

---

### Task 6: Session cookie on a loopback address (C4, conditional)

- [ ] **Step 1 (Owner):** On a Mac with Safari, run `brew services start equori`, create a user, open `http://127.0.0.1:8080` in Safari, sign in, reload the page. Report one of: `session kept` or `back at login`.
- [ ] **Step 2:** On `session kept`: add to `docs/adr/021-distribution.md` the line `C4 does not apply: Safari <version> keeps a Secure cookie on http://127.0.0.1 (checked 2026-MM-DD).` Commit `docs: record that safari keeps secure cookies on loopback` and skip Steps 3 to 7.
- [ ] **Step 3 (on `back at login` only): write the failing test** in `internal/identity/identity_test.go`:

```go
// C4 of ADR 021: a browser on the loopback address drops a Secure cookie over plain HTTP.
func TestSessionCookieOnLoopbackOmitsSecure(t *testing.T) {
	t.Parallel()
	h := newHarness(t, identity.Config{SecureCookies: true})
	if _, err := h.module.CreateUser(t.Context(), email, password, identity.RoleMember, locale.Locale{Language: "pt", Region: "BR"}, "BRL"); err != nil {
		t.Fatal(err)
	}
	cookie := h.login(password).header.Get("Set-Cookie")
	if strings.Contains(cookie, "Secure") {
		t.Fatalf("Set-Cookie %q on 127.0.0.1 carries Secure", cookie)
	}
}
```

`TestSessionCookieAttributes` addresses the same `httptest` server on `127.0.0.1`, so its expectation changes with this behavior: make it send `Host: equori.example.com` (add a `host string` parameter to the harness's `login` helper, or a `loginHost` variant) and keep its `Secure` assertion. The commit body names ADR 021 C4 as the specification change.
- [ ] **Step 4: Run** `go test -run 'TestSessionCookie' ./internal/identity/` — Expected: the new test FAILS.
- [ ] **Step 5: Implement.** In `internal/identity/internal/adapter/httpapi`, a middleware on the identity routes stores `r.Host` in the context under an unexported key; `cookie(ctx, value, expires)` sets `Secure: s.secureCookies && !loopback(hostFromContext(ctx))`, where `loopback` strips the port with `net.SplitHostPort` (falling back to the raw host), and returns true for `localhost` and for an address whose `net.ParseIP(...).IsLoopback()` is true. Both callers (`CreateSession`, `DeleteSession`) pass `ctx`. Keep the existing `nolint` comment and extend its reason with `or on a loopback host (ADR 021, C4)`.
- [ ] **Step 6: Run** `go test ./internal/identity/` — Expected: PASS.
- [ ] **Step 7: Commit** `fix(identity): keep the session on a loopback address over http` with a body naming ADR 021 C4, the Safari observation, and the amendment of ADR 003 written in the same commit (`docs/adr/003-authentication.md`, a dated line under Sessions).

---

### Task 7: Phase gate

- [ ] **Step 1:** `make check` — Expected: exit status 0.
- [ ] **Step 2:** Update `docs/adr/021-distribution.md`: R5, R6 and D8 marked delivered with the tap repository's name.
- [ ] **Step 3:** Update `.claude/progress/current.md`; next action: `start docs/superpowers/plans/2026-10-26-distribution-f4-offline-capture.md Task 1` (unless F4 already ran).
- [ ] **Step 4 (Owner):** The first tag that exercises Tasks 3 and 4 is the owner's decision; report that the release jobs are ready and untested until that tag.
