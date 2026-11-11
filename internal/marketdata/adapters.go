package marketdata

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/marketdata/httpapi"
	"github.com/andrelopes-code/equori/internal/marketdata/toolapi"
	"github.com/andrelopes-code/equori/internal/platform/auth"
	"github.com/andrelopes-code/equori/internal/platform/httpserver"
	"github.com/andrelopes-code/equori/internal/platform/tool"
)

// Tools returns the marketdata module's tools for language models (ADR 012).
func (m *Module) Tools() tool.Group {
	cals := toolapi.Calendars{
		List: func() []toolapi.Calendar {
			var out []toolapi.Calendar
			for _, c := range m.listCalendars() {
				weekend := make([]string, len(c.Weekend))
				for i, d := range c.Weekend {
					weekend[i] = string(d)
				}

				out = append(out, toolapi.Calendar{ID: c.Id, Weekend: weekend})
			}

			return out
		},
		Holidays: func(ctx context.Context, calendar string, year int) ([]toolapi.Holiday, error) {
			hs, err := m.listHolidays(ctx, calendar, year)

			out := make([]toolapi.Holiday, len(hs))
			for i, h := range hs {
				out[i] = toolapi.Holiday{Date: h.Date.Time, Name: h.Name, Source: string(h.Source)}
			}

			return out, err
		},
	}

	return tool.Group{Tools: toolapi.Tools(m, cals), Errors: tool.FromProblem(httpapi.ToProblem)}
}

func (m *Module) RegisterRoutes(mux *http.ServeMux, log *slog.Logger) {
	httpapi.NewServer(m.listHolidays, m.calendarList, m, log).Register(mux)
}

// BodyLimits raises the request body limit of a series import: 20,000 prices of 60 bytes
// pass the default 1 MiB, and the limit is 2 MiB (A222 MQ32).
func (m *Module) BodyLimits() []httpserver.BodyLimit {
	return []httpserver.BodyLimit{{Pattern: "POST /api/v1/instruments/{code}/prices", Bytes: 2 << 20}}
}

func (m *Module) listHolidays(ctx context.Context, calendar string, year int) ([]httpapi.Holiday, error) {
	hs, err := m.Holidays(ctx, calendar, year)
	if errors.Is(err, ErrUnknownCalendar) {
		return nil, httpapi.ErrNotFound
	}

	if err != nil {
		return nil, err
	}

	out := make([]httpapi.Holiday, len(hs))
	for i, h := range hs {
		out[i] = httpapi.NewHoliday(openapi_types.Date{Time: h.Date}, h.Code, h.Name, h.Source)
	}

	return out, nil
}

func (m *Module) calendarList(ctx context.Context) (httpapi.CalendarList, error) {
	l, err := m.profiles.Profile(ctx, auth.MustBooksID(ctx))
	if err != nil {
		return httpapi.CalendarList{}, fmt.Errorf("read profile: %w", err)
	}

	return httpapi.CalendarList{Items: m.listCalendars(), Default: m.DefaultCalendar(l.Region)}, nil
}

func (m *Module) listCalendars() []httpapi.Calendar {
	ids := m.calendars.IDs()

	out := make([]httpapi.Calendar, len(ids))
	for i, id := range ids {
		cal, _ := m.calendars.Get(id)

		weekend := make([]httpapi.CalendarWeekend, len(cal.Weekend))
		for j, wd := range cal.Weekend {
			weekend[j] = httpapi.CalendarWeekend(strings.ToLower(wd.String()))
		}

		out[i] = httpapi.Calendar{Id: id, Weekend: weekend}
	}

	return out
}
