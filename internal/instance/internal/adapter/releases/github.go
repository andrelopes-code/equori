// Package releases reads the latest release from the GitHub API.
package releases

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Client requests the latest release from url.
type Client struct {
	url  string
	http *http.Client
}

func NewClient(url string) *Client {
	return &Client{url: url, http: &http.Client{Timeout: 30 * time.Second}}
}

// Latest returns the tag and the notes URL of the latest release. The request carries no header
// beyond User-Agent and Accept (A159.2).
func (c *Client) Latest(ctx context.Context) (string, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.url, nil)
	if err != nil {
		return "", "", fmt.Errorf("build release request: %w", err)
	}

	req.Header.Set("User-Agent", "equori")
	req.Header.Set("Accept", "application/vnd.github+json")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", "", fmt.Errorf("request latest release: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode > 299 {
		return "", "", fmt.Errorf("request latest release: status %d", resp.StatusCode)
	}

	var body struct {
		TagName string `json:"tag_name"`
		HTMLURL string `json:"html_url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return "", "", fmt.Errorf("decode latest release: %w", err)
	}

	return body.TagName, body.HTMLURL, nil
}
