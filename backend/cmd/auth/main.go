package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"luxstay/backend/internal/models"
	"luxstay/backend/internal/security"
	"luxstay/backend/internal/store"
)

const sessionCookieName = "luxstay_session"

func main() {
	db, err := store.OpenSQLite("./data/luxstay.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := store.RunMigration(db, "./migrations/001_init.sql"); err != nil {
		log.Fatal(err)
	}

	if err := store.SeedUsers(db); err != nil {
		log.Fatal(err)
	}

	r := mux.NewRouter()
	api := r.PathPrefix("/api/auth").Subrouter()

	api.HandleFunc("/login", loginHandler(db)).Methods("POST")
	api.HandleFunc("/logout", logoutHandler(db)).Methods("POST")
	api.HandleFunc("/register", registerHandler(db)).Methods("POST")
	api.HandleFunc("/me", meHandler(db)).Methods("GET")
	api.HandleFunc("/verify", verifyHandler(db)).Methods("POST")

	log.Println("Auth service running on http://localhost:8081")
	log.Fatal(http.ListenAndServe(":8081", r))
}

func loginHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Email    string `json:"email"`
			Password string `json:"password"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		user, err := getUserByEmail(db, req.Email)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid email or password")
			return
		}

		if !security.CheckPassword(user.PasswordHash, req.Password) {
			writeError(w, http.StatusUnauthorized, "invalid email or password")
			return
		}

		token := uuid.NewString()
		expiresAt := time.Now().Add(24 * time.Hour)

		_, err = db.Exec(
			`INSERT INTO sessions(token, user_id, expires_at) VALUES(?, ?, ?)`,
			token,
			user.ID,
			expiresAt.UTC().Format(time.RFC3339),
		)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not create session")
			return
		}

		http.SetCookie(w, &http.Cookie{
			Name:     sessionCookieName,
			Value:    token,
			Path:     "/",
			Expires:  expiresAt,
			MaxAge:   24 * 60 * 60,
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
		})

		writeJSON(w, http.StatusOK, user)
	}
}

func logoutHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookieName)
		if err == nil && cookie.Value != "" {
			_, _ = db.Exec(`DELETE FROM sessions WHERE token = ?`, cookie.Value)
		}

		http.SetCookie(w, &http.Cookie{
			Name:     sessionCookieName,
			Value:    "",
			Path:     "/",
			MaxAge:   -1,
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
		})

		writeJSON(w, http.StatusOK, map[string]string{
			"message": "logged out",
		})
	}
}

func registerHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Name       string `json:"name"`
			Email      string `json:"email"`
			Password   string `json:"password"`
			RoomNumber string `json:"room_number"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if req.Name == "" || req.Email == "" || req.Password == "" || req.RoomNumber == "" {
			writeError(w, http.StatusBadRequest, "name, email, password and room number are required")
			return
		}

		hash, err := security.HashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not hash password")
			return
		}

		now := time.Now().UTC().Format(time.RFC3339)
		user := models.User{
			ID:           uuid.NewString(),
			Name:         req.Name,
			Email:        req.Email,
			PasswordHash: hash,
			Role:         "guest",
			RoomNumber:   req.RoomNumber,
			CreatedAt:    now,
			UpdatedAt:    now,
		}

		_, err = db.Exec(`
			INSERT INTO users(id, name, email, password_hash, role, room_number, specialty, created_at, updated_at)
			VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, user.ID, user.Name, user.Email, user.PasswordHash, user.Role, user.RoomNumber, user.Specialty, user.CreatedAt, user.UpdatedAt)

		if err != nil {
			writeError(w, http.StatusBadRequest, "email already exists or invalid data")
			return
		}

		writeJSON(w, http.StatusCreated, user)
	}
}

func meHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie(sessionCookieName)
		if err != nil || cookie.Value == "" {
			writeError(w, http.StatusUnauthorized, "not authenticated")
			return
		}

		user, err := userFromSession(db, cookie.Value)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid session")
			return
		}

		writeJSON(w, http.StatusOK, user)
	}
}

func verifyHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req struct {
			Token string `json:"token"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		user, err := userFromSession(db, req.Token)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "invalid session")
			return
		}

		writeJSON(w, http.StatusOK, user)
	}
}

func userFromSession(db *sql.DB, token string) (*models.User, error) {
	var userID string
	var expiresAtRaw string

	err := db.QueryRow(`
		SELECT user_id, expires_at
		FROM sessions
		WHERE token = ?
	`, token).Scan(&userID, &expiresAtRaw)

	if err != nil {
		return nil, err
	}

	expiresAt, err := time.Parse(time.RFC3339, expiresAtRaw)
	if err != nil {
		return nil, err
	}

	if time.Now().After(expiresAt) {
		_, _ = db.Exec(`DELETE FROM sessions WHERE token = ?`, token)
		return nil, errors.New("session expired")
	}

	return getUserByID(db, userID)
}

func getUserByID(db *sql.DB, id string) (*models.User, error) {
	user := &models.User{}

	err := db.QueryRow(`
		SELECT id, name, email, password_hash, role, COALESCE(room_number, ''), COALESCE(specialty, ''), created_at, updated_at
		FROM users
		WHERE id = ?
	`, id).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.RoomNumber,
		&user.Specialty,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	return user, err
}

func getUserByEmail(db *sql.DB, email string) (*models.User, error) {
	user := &models.User{}

	err := db.QueryRow(`
		SELECT id, name, email, password_hash, role, COALESCE(room_number, ''), COALESCE(specialty, ''), created_at, updated_at
		FROM users
		WHERE email = ?
	`, email).Scan(
		&user.ID,
		&user.Name,
		&user.Email,
		&user.PasswordHash,
		&user.Role,
		&user.RoomNumber,
		&user.Specialty,
		&user.CreatedAt,
		&user.UpdatedAt,
	)

	return user, err
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{
		"error": msg,
	})
}
