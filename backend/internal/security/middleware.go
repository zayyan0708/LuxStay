package security

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"luxstay/backend/internal/models"
)

type contextKey string

const UserKey contextKey = "user"

type UserFinder interface {
	GetByID(id string) (*models.User, error)
}

type SessionResolver interface {
	Resolve(token string) (string, error)
}

func CurrentUser(r *http.Request) *models.User {
	u, _ := r.Context().Value(UserKey).(*models.User)
	return u
}

func RequireAuth(users UserFinder, sessions SessionResolver) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie("luxstay_session")
			if err != nil || cookie.Value == "" {
				http.Error(w, `{"error":"not authenticated"}`, http.StatusUnauthorized)
				return
			}

			userID, err := sessions.Resolve(cookie.Value)
			if err != nil {
				http.Error(w, `{"error":"invalid session"}`, http.StatusUnauthorized)
				return
			}

			user, err := users.GetByID(userID)
			if err != nil {
				http.Error(w, `{"error":"user not found"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), UserKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireRole(roles ...string) func(http.Handler) http.Handler {
	allowed := map[string]bool{}

	for _, role := range roles {
		allowed[role] = true
	}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := CurrentUser(r)

			if user == nil || !allowed[user.Role] {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusForbidden)

				_ = json.NewEncoder(w).Encode(map[string]string{
					"error": "forbidden",
				})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; connect-src 'self' http://localhost:8080 http://localhost:5173")

		next.ServeHTTP(w, r)
	})
}

func OriginCheck(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			next.ServeHTTP(w, r)
			return
		}

		origin := r.Header.Get("Origin")

		if origin != "" &&
			!strings.HasPrefix(origin, "http://localhost:5173") &&
			!strings.HasPrefix(origin, "http://localhost:8080") {
			http.Error(w, `{"error":"invalid origin"}`, http.StatusForbidden)
			return
		}

		next.ServeHTTP(w, r)
	})
}
