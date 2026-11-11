// Package releases reads the newest release from the GitHub API.
package releases

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
)

// Client requests the releases of url, the releases endpoint of a repository.
type Client struct {
	url  string
	http *http.Client
}

func NewClient(url string) *Client {
	return &Client{url: url, http: &http.Client{Timeout: 30 * time.Second}}
}

// Latest returns the tag and the notes URL of the newest release: of url/latest, which skips
// pre-releases, or with prerelease of the first entry of the list. The request carries no
// header beyond User-Agent and Accept (A159.2).
func (c *Client) Latest(ctx context.Context, prerelease bool) (string, string, error) {
	url := c.url + "/latest"
	if prerelease {
		url = c.url + "?per_page=1"
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
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

	if !prerelease {
		var body release
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			return "", "", fmt.Errorf("decode latest release: %w", err)
		}

		return body.TagName, body.HTMLURL, nil
	}

	var list []release
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		return "", "", fmt.Errorf("decode release list: %w", err)
	}

	if len(list) == 0 {
		return "", "", errors.New("decode release list: no release")
	}

	return list[0].TagName, list[0].HTMLURL, nil
}

type release struct {
	TagName string `json:"tag_name"`
	HTMLURL string `json:"html_url"`
}
