package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"luxstay/backend/internal/models"
	"luxstay/backend/internal/security"
)

type AuthClient struct {
	BaseURL string
	Client  *http.Client
}

func (a *AuthClient) Verify(token string) (*models.User, error) {
	body, _ := json.Marshal(map[string]string{
		"token": token,
	})

	req, err := http.NewRequest(http.MethodPost, a.BaseURL+"/api/auth/verify", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")

	client := a.Client
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, errors.New("auth verification failed")
	}

	var user models.User
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, err
	}

	return &user, nil
}

func AuthMiddleware(authClient *AuthClient) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie("luxstay_session")
			if err != nil || cookie.Value == "" {
				writeError(w, http.StatusUnauthorized, "not authenticated")
				return
			}

			user, err := authClient.Verify(cookie.Value)
			if err != nil {
				writeError(w, http.StatusUnauthorized, "invalid session")
				return
			}

			ctx := context.WithValue(r.Context(), security.UserKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
