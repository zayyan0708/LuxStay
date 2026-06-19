package main

import (
	"io"
	"net/http"
)

func ProxyToAuth(baseURL string, path string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		targetURL := baseURL + path

		req, err := http.NewRequestWithContext(r.Context(), r.Method, targetURL, r.Body)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not create auth request")
			return
		}

		req.Header = r.Header.Clone()

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			writeError(w, http.StatusBadGateway, "auth service is not running")
			return
		}
		defer resp.Body.Close()

		for key, values := range resp.Header {
			if key == "Content-Length" {
				continue
			}

			for _, value := range values {
				w.Header().Add(key, value)
			}
		}

		w.WriteHeader(resp.StatusCode)
		_, _ = io.Copy(w, resp.Body)
	}
}
