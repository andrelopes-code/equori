# Performance

`make perf` measures N05, N06 and N09 (`docs/domain/08-non-functional-requirements.md`, section 8.3). It runs `TestPerformanceOnDemoDataset` in `cmd/demoseed/perf_test.go` under the build tag `perf`; `make check` never runs it.

```sh
make perf
```

## Method

- Dataset: one user seeded by `cmd/demoseed` over `apitest.New`: 24 months of history, about 90 accounts and categories, two cards with their statements. It is smaller than the reference dataset of section 8.1.
- Server: the HTTP handler of `internal/server` inside the test process, against the test database `db-test`.
- Latency: the 95th percentile of 50 sequential calls per endpoint.
- Memory: VmRSS of `/proc/self/status` after the calls. The test process holds the server, the seeder and the Go test runtime, so the figure is an upper bound of the server's RSS.

| Requirement | Endpoint | Assertion |
|---|---|---|
| N05 | `listTransactions`, `listAccounts`, `listStatements`, `getCategoryTotals` (`accrual` and `cash`, 12 months), `getNetWorth` | p95 below 200 ms |
| N06 | `getAccountBalance` at a date one year back | p95 below 50 ms |
| N09 | the test process | VmRSS below 256 MiB |

## Last run

2026-10-26, commit after `41b2034`, Intel Xeon E5-2683 v4 at 2.10 GHz, 8 CPUs, Go 1.27.2.

| Endpoint | p95 |
|---|---|
| `listTransactions` | 14.3 ms |
| `listAccounts` | 3.5 ms |
| `listStatements` | 8.5 ms |
| `getCategoryTotals`, accrual | 5.1 ms |
| `getCategoryTotals`, cash | 60.6 ms |
| `getNetWorth` | 15.6 ms |
| `getAccountBalance` | 5.6 ms |

VmRSS: 64 MiB.
