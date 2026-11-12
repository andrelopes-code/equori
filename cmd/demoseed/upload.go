package main

import (
	"bytes"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/textproto"
)

// upload posts content as the multipart field "file" of path.
func (s *seeder) upload(path string, fields map[string]string, name string, content []byte) {
	var body bytes.Buffer

	w := multipart.NewWriter(&body)
	for k, v := range fields {
		_ = w.WriteField(k, v)
	}

	h := textproto.MIMEHeader{}
	h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, name))
	h.Set("Content-Type", "application/octet-stream")

	part, err := w.CreatePart(h)
	if err != nil {
		s.fail("multipart: %w", err)
		return
	}

	_, _ = part.Write(content)
	_ = w.Close()

	//nolint:gosec // the address is the operator's own instance.
	req, err := http.NewRequestWithContext(s.ctx, http.MethodPost, s.base+"/api/v1"+path, &body)
	if err != nil {
		s.fail("build upload %s: %w", path, err)
		return
	}

	req.Header.Set("Content-Type", w.FormDataContentType())

	//nolint:gosec // the address is the operator's own instance.
	resp, err := s.http.Do(req)
	if err != nil {
		s.fail("upload %s: %w", path, err)
		return
	}
	defer resp.Body.Close()

	s.calls++
	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		var raw bytes.Buffer
		_, _ = raw.ReadFrom(resp.Body)
		s.fail("upload %s: status %d: %s", path, resp.StatusCode, truncate(raw.Bytes()))
	}
}
