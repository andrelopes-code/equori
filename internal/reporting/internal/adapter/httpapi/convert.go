package httpapi

import (
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/andrelopes-code/equori/internal/reporting/internal/app"
)

func dateOf(p app.Point) openapi_types.Date { return openapi_types.Date{Time: p.Date} }

func flowDate(f app.Flow) openapi_types.Date { return openapi_types.Date{Time: f.Date} }
