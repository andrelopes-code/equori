package view

// Plot is the drawing of a view's rows (answer views design, V35): the label column, then each
// series as a column of the rows with how it is drawn, and the marks laid over the plot.
type Plot struct {
	Label       int          `json:"label"`
	Orientation string       `json:"orientation,omitempty"`
	StackMode   string       `json:"stack_mode,omitempty"`
	Series      []PlotSeries `json:"series"`
	Marks       []PlotMark   `json:"marks"`
}

// PlotSeries is one drawn column of the rows.
type PlotSeries struct {
	Column int    `json:"column"`
	Kind   string `json:"kind"`
	Axis   string `json:"axis,omitempty"`
	Stack  bool   `json:"stack,omitempty"`
	Curve  string `json:"curve,omitempty"`
	Tone   string `json:"tone,omitempty"`
}

// PlotMark is a line over the plot: the average of a column, with its value.
type PlotMark struct {
	Kind   string `json:"kind"`
	Column int    `json:"column"`
	Value  Value  `json:"value"`
}
