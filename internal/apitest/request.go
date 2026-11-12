package apitest

import (
	"bytes"
	"encoding/json/v2"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"testing"
)

type Response struct {
	Status int
	Header http.Header
	Body   []byte
}

func (r Response) Decode(t testing.TB, v any) {
	t.Helper()

	if err := json.Unmarshal(r.Body, v); err != nil {
		t.Fatalf("decode %s: %v", r.Body, err)
	}
}

func (h *Harness) Call(c *http.Client, method, path string, body any) Response {
	h.t.Helper()

	var reader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			h.t.Fatal(err)
		}

		reader = strings.NewReader(string(b))
	}

	req, err := http.NewRequestWithContext(h.t.Context(), method, h.server.URL+path, reader)
	if err != nil {
		h.t.Fatal(err)
	}

	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	return h.send(c, req)
}

// URL is the base URL of the test server, for requests the JSON helpers cannot build.
func (h *Harness) URL() string { return h.server.URL }

// Send executes a request built by the test with the given client.
func (h *Harness) Send(c *http.Client, req *http.Request) Response {
	h.t.Helper()
	return h.send(c, req)
}

func (h *Harness) send(c *http.Client, req *http.Request) Response {
	h.t.Helper()

	resp, err := c.Do(req) //nolint:gosec // tests address the harness's own httptest server
	if err != nil {
		h.t.Fatal(err)
	}
	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	if err != nil {
		h.t.Fatal(err)
	}

	return Response{Status: resp.StatusCode, Header: resp.Header, Body: b}
}

// Upload posts content as the multipart/form-data field "file".
func (h *Harness) Upload(path, fileName string, content []byte) Response {
	h.t.Helper()
	return h.UploadAs(h.Client, path, nil, fileName, content)
}

// UploadWith posts content as the field "file" with other form fields.
func (h *Harness) UploadWith(
	path string,
	fields map[string]string,
	fileName string,
	content []byte,
) Response {
	h.t.Helper()
	return h.UploadAs(h.Client, path, fields, fileName, content)
}

// Import uploads a statement file in format (ofx or csv) to the account.
func (h *Harness) Import(account, format, name string, content []byte) Response {
	return h.UploadWith(
		"/api/v1/accounts/"+account+"/imports",
		map[string]string{"format": format},
		name,
		content,
	)
}

// UploadAs posts a multipart form with the given client.
func (h *Harness) UploadAs(
	c *http.Client,
	path string,
	fields map[string]string,
	fileName string,
	content []byte,
) Response {
	h.t.Helper()
	var body bytes.Buffer

	w := multipart.NewWriter(&body)
	for k, v := range fields {
		if err := w.WriteField(k, v); err != nil {
			h.t.Fatal(err)
		}
	}

	part, err := w.CreateFormFile("file", fileName)
	if err != nil {
		h.t.Fatal(err)
	}

	if _, err := part.Write(content); err != nil {
		h.t.Fatal(err)
	}

	if err := w.Close(); err != nil {
		h.t.Fatal(err)
	}

	req, err := http.NewRequestWithContext(h.t.Context(), http.MethodPost, h.server.URL+path, &body)
	if err != nil {
		h.t.Fatal(err)
	}

	req.Header.Set("Content-Type", w.FormDataContentType())

	return h.send(c, req)
}

func (h *Harness) Do(method, path string, body any) Response {
	h.t.Helper()
	return h.Call(h.Client, method, path, body)
}

// MustDo fails the test unless the response has status; out, when not nil, receives the body.
func (h *Harness) MustDo(method, path string, body any, status int, out any) {
	h.t.Helper()

	r := h.Do(method, path, body)
	if r.Status != status {
		h.t.Fatalf("%s %s = %d, want %d: %s", method, path, r.Status, status, r.Body)
	}

	if out != nil {
		r.Decode(h.t, out)
	}
}

// ExpectProblem checks an RFC 9457 response; field, when not empty, must be the first field error.
func (h *Harness) ExpectProblem(r Response, status int, code, field string) {
	h.t.Helper()

	if r.Status != status {
		h.t.Fatalf("status = %d, want %d: %s", r.Status, status, r.Body)
	}

	var p struct {
		Code   string `json:"code"`
		Errors []struct {
			Field string `json:"field"`
		} `json:"errors"`
	}
	r.Decode(h.t, &p)

	if p.Code != code {
		h.t.Fatalf("code = %q, want %q: %s", p.Code, code, r.Body)
	}

	if field != "" && (len(p.Errors) == 0 || p.Errors[0].Field != field) {
		h.t.Fatalf("field errors = %+v, want %q", p.Errors, field)
	}
}
