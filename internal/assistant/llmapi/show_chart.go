package llmapi

// chartSchema is the chart spec of show with form chart (answer views design, V28).
const chartSchema = `{"type":"object","additionalProperties":false,
"required":["title","items","x","series"],
"properties":{
"title":{"type":"string","minLength":1,"maxLength":60,
 "description":"what the chart shows, in the member's language, with no figure"},
"items":{"type":"string","pattern":"^[a-z_][a-z0-9_]*(\\.[a-z_][a-z0-9_]*)*$",
 "description":"dot path of the array of records in the read's output, such as days"},
"where":{"type":"array","maxItems":4,"items":{"type":"object","additionalProperties":false,
 "required":["field","op","value"],"properties":{
 "field":{"type":"string"},
 "op":{"type":"string","enum":["eq","ne","gt","gte","lt","lte","contains"]},
 "value":{"type":"string","description":"a text, a date, or a number such as 0 or -10.5"}}}},
"x":{"type":"object","additionalProperties":false,"required":["field"],"properties":{
 "field":{"type":"string","description":"field of a record that places it: a date, a month or a name"},
 "bucket":{"type":"string","enum":["day","month","year"]},
 "from":{"type":"string","format":"date","description":"first date the axis holds"},
 "to":{"type":"string","format":"date","description":"last date the axis holds"},
 "label":{"type":"string","maxLength":40},
 "sort":{"type":"string","enum":["x","desc","asc"]},
 "limit":{"type":"integer","minimum":1,"maximum":24}}},
"split":{"type":"object","additionalProperties":false,"required":["field"],"properties":{
 "field":{"type":"string","description":"one series per value of this field"},
 "limit":{"type":"integer","minimum":2,"maximum":8}}},
"series":{"type":"array","minItems":1,"maxItems":6,"items":{"type":"object",
 "additionalProperties":false,"required":["agg","kind","label"],"properties":{
 "field":{"type":"string","description":"field holding an amount or an integer; none for count"},
 "agg":{"type":"string","enum":["sum","count","avg","min","max","first","last"]},
 "sign":{"type":"string","enum":["as_is","negate","abs"]},
 "derive":{"type":"string","enum":["cumulative","share","change","change_percent"],
  "description":"over the rows: running total, percent of total, change, change in percent"},
 "kind":{"type":"string","enum":["bar","line","area","pie"]},
 "label":{"type":"string","minLength":1,"maxLength":40},
 "axis":{"type":"string","enum":["start","end"]},
 "stack":{"type":"boolean"},
 "curve":{"type":"string","enum":["linear","monotone","step"]},
 "tone":{"type":"string","enum":["success","danger","warning","info","neutral"]}}}},
"orientation":{"type":"string","enum":["vertical","horizontal"]},
"stack_mode":{"type":"string","enum":["normal","percent"]},
"average":{"type":"array","maxItems":6,"items":{"type":"integer","minimum":0},
 "description":"indexes of series whose mean is drawn as a dashed line"}}}`

// chartDescription tells the model how to describe a chart of any read.
const chartDescription = "form chart works on the output of any read: chart names the array of " +
	"records (items), the field that places each row (x: dates grouped by day, month or year, or " +
	"names ranked by value), and up to 6 series that aggregate a field (sum, count, avg, min, max, " +
	"first, last) drawn as bar, line, area or pie. where keeps records, sign negate shows outflows " +
	"as positive, split draws one series per value of a field (stacked when stack), axis end reads a " +
	"second unit, average marks the mean. derive turns a series into its running total " +
	"(cumulative), its percent of the total (share) or its change from the row before (change, " +
	"change_percent); a share or a percent beside amounts takes axis end. Use it when no form " +
	"draws what the member asks, or when " +
	"the member asks for a drawing; the server computes every figure, so never write one in the spec. " +
	"items may cross an array, such as transactions.postings: each inner object is a record that " +
	"also holds the fields of the object above it (date, payee_name). Pass the first page of a " +
	"paged read, read with limit 50: the server reads the pages that follow. The result holds the computed rows (head, rows, average); " +
	"rows_omitted counts the rows past the first 100.\n"
