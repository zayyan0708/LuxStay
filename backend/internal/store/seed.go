// backend/internal/store/seed.go

package store

import (
	"database/sql"
	"time"

	"github.com/google/uuid"

	"luxstay/backend/internal/security"
)

func SeedUsers(db *sql.DB) error {
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	now := time.Now().UTC().Format(time.RFC3339)

	users := []struct {
		Name       string
		Email      string
		Password   string
		Role       string
		RoomNumber string
		Specialty  string
	}{
		{"Admin User", "admin@luxstay.local", "admin123", "admin", "", ""},
		{"Maria Garcia", "maria@luxstay.local", "staff123", "staff", "", "plumbing"},
		{"David Chen", "david@luxstay.local", "staff123", "staff", "", "electrical"},
		{"Guest Room 101", "guest101@luxstay.local", "guest123", "guest", "101", ""},
	}

	for _, u := range users {
		hash, err := security.HashPassword(u.Password)
		if err != nil {
			return err
		}

		_, err = db.Exec(`
			INSERT INTO users(id, name, email, password_hash, role, room_number, specialty, created_at, updated_at)
			VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, uuid.NewString(), u.Name, u.Email, hash, u.Role, u.RoomNumber, u.Specialty, now, now)

		if err != nil {
			return err
		}
	}

	return nil
}
