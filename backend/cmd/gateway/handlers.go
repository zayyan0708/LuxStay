package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"

	"luxstay/backend/internal/models"
	"luxstay/backend/internal/mqttbus"
	"luxstay/backend/internal/security"
)

func ListTicketsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := security.CurrentUser(r)
		if user == nil {
			writeError(w, http.StatusUnauthorized, "not authenticated")
			return
		}

		query := `
			SELECT id, ticket_number, title, description, category, priority, status,
			       room_number, guest_id, guest_name,
			       COALESCE(assigned_to_id, ''), COALESCE(assigned_to_name, ''),
			       created_at, updated_at
			FROM tickets
			WHERE 1 = 1
		`

		args := []interface{}{}

		switch user.Role {
		case "guest":
			query += " AND room_number = ?"
			args = append(args, user.RoomNumber)
		case "staff":
			query += " AND assigned_to_id = ?"
			args = append(args, user.ID)
		case "admin":
		default:
			writeError(w, http.StatusForbidden, "invalid role")
			return
		}

		if status := r.URL.Query().Get("status"); status != "" {
			query += " AND status = ?"
			args = append(args, status)
		}

		query += " ORDER BY created_at DESC"

		rows, err := db.Query(query, args...)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not list tickets")
			return
		}
		defer rows.Close()

		tickets := []models.Ticket{}

		for rows.Next() {
			ticket := models.Ticket{}
			if err := scanTicket(rows, &ticket); err != nil {
				writeError(w, http.StatusInternalServerError, "could not read ticket")
				return
			}
			tickets = append(tickets, ticket)
		}

		writeJSON(w, http.StatusOK, tickets)
	}
}

func GetTicketHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := security.CurrentUser(r)
		id := mux.Vars(r)["id"]

		ticket, err := getTicketByID(db, id)
		if err != nil {
			writeError(w, http.StatusNotFound, "ticket not found")
			return
		}

		if !canAccessTicket(user, ticket) {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		writeJSON(w, http.StatusOK, ticket)
	}
}

func CreateTicketHandler(db *sql.DB, bus *mqttbus.Bus) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := security.CurrentUser(r)
		if user == nil {
			writeError(w, http.StatusUnauthorized, "not authenticated")
			return
		}

		var req struct {
			Title       string `json:"title"`
			Description string `json:"description"`
			Category    string `json:"category"`
			Priority    string `json:"priority"`
			RoomNumber  string `json:"room_number"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if req.Title == "" || req.Description == "" {
			writeError(w, http.StatusBadRequest, "title and description are required")
			return
		}

		roomNumber := req.RoomNumber
		if user.Role == "guest" {
			roomNumber = user.RoomNumber
		}

		if roomNumber == "" {
			writeError(w, http.StatusBadRequest, "room number is required")
			return
		}

		if req.Category == "" {
			req.Category = "general"
		}

		if req.Priority == "" {
			req.Priority = "medium"
		}

		now := time.Now().UTC().Format(time.RFC3339)

		ticket := models.Ticket{
			ID:           uuid.NewString(),
			TicketNumber: fmt.Sprintf("TKT-%d", time.Now().UnixNano()),
			Title:        req.Title,
			Description:  req.Description,
			Category:     req.Category,
			Priority:     req.Priority,
			Status:       "OPEN",
			RoomNumber:   roomNumber,
			GuestID:      user.ID,
			GuestName:    user.Name,
			CreatedAt:    now,
			UpdatedAt:    now,
		}

		_, err := db.Exec(`
			INSERT INTO tickets(
				id, ticket_number, title, description, category, priority, status,
				room_number, guest_id, guest_name, assigned_to_id, assigned_to_name,
				created_at, updated_at
			)
			VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			ticket.ID,
			ticket.TicketNumber,
			ticket.Title,
			ticket.Description,
			ticket.Category,
			ticket.Priority,
			ticket.Status,
			ticket.RoomNumber,
			ticket.GuestID,
			ticket.GuestName,
			ticket.AssignedToID,
			ticket.AssignedToName,
			ticket.CreatedAt,
			ticket.UpdatedAt,
		)

		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not create ticket")
			return
		}

		publishAndAudit(db, bus, "luxstay/tickets/created", "ticket_created", "Ticket", ticket.ID, ticket)

		writeJSON(w, http.StatusCreated, ticket)
	}
}

func UpdateTicketHandler(db *sql.DB, bus *mqttbus.Bus) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := security.CurrentUser(r)
		id := mux.Vars(r)["id"]

		ticket, err := getTicketByID(db, id)
		if err != nil {
			writeError(w, http.StatusNotFound, "ticket not found")
			return
		}

		if !canAccessTicket(user, ticket) {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		var patch map[string]string
		if err := json.NewDecoder(r.Body).Decode(&patch); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		eventType := "ticket_updated"
		topic := "luxstay/tickets/updated"

		switch user.Role {
		case "admin":
			if status, ok := patch["status"]; ok {
				if !validStatus(status) {
					writeError(w, http.StatusBadRequest, "invalid status")
					return
				}
				ticket.Status = status
			}

			if assignedID, ok := patch["assigned_to_id"]; ok {
				staff, err := getUserByID(db, assignedID)
				if err != nil || staff.Role != "staff" {
					writeError(w, http.StatusBadRequest, "assigned user must be staff")
					return
				}

				ticket.AssignedToID = staff.ID
				ticket.AssignedToName = staff.Name
				eventType = "ticket_assigned"
				topic = "luxstay/tickets/assigned"
			}

		case "staff":
			if ticket.AssignedToID != user.ID {
				writeError(w, http.StatusForbidden, "staff can update only assigned tickets")
				return
			}

			status, ok := patch["status"]
			if !ok {
				writeError(w, http.StatusBadRequest, "staff can update only status")
				return
			}

			if status != "IN_PROGRESS" && status != "RESOLVED" {
				writeError(w, http.StatusBadRequest, "staff status must be IN_PROGRESS or RESOLVED")
				return
			}

			ticket.Status = status

			if status == "RESOLVED" {
				eventType = "ticket_resolved"
				topic = "luxstay/tickets/resolved"
			}

		default:
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		ticket.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

		_, err = db.Exec(`
			UPDATE tickets
			SET status = ?, assigned_to_id = ?, assigned_to_name = ?, updated_at = ?
			WHERE id = ?
		`,
			ticket.Status,
			emptyToNil(ticket.AssignedToID),
			emptyToNil(ticket.AssignedToName),
			ticket.UpdatedAt,
			ticket.ID,
		)

		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not update ticket")
			return
		}

		publishAndAudit(db, bus, topic, eventType, "Ticket", ticket.ID, ticket)

		writeJSON(w, http.StatusOK, ticket)
	}
}

func DeleteTicketHandler(db *sql.DB, bus *mqttbus.Bus) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := security.CurrentUser(r)
		if user == nil || user.Role != "admin" {
			writeError(w, http.StatusForbidden, "only admin can delete tickets")
			return
		}

		id := mux.Vars(r)["id"]

		ticket, err := getTicketByID(db, id)
		if err != nil {
			writeError(w, http.StatusNotFound, "ticket not found")
			return
		}

		_, err = db.Exec(`DELETE FROM tickets WHERE id = ?`, id)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not delete ticket")
			return
		}

		publishAndAudit(db, bus, "luxstay/tickets/deleted", "ticket_deleted", "Ticket", ticket.ID, ticket)

		writeJSON(w, http.StatusOK, map[string]string{
			"message": "ticket deleted",
		})
	}
}

func ListStaffHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := security.CurrentUser(r)
		if user == nil || user.Role != "admin" {
			writeError(w, http.StatusForbidden, "only admin can view staff")
			return
		}

		rows, err := db.Query(`
			SELECT id, name, email, password_hash, role, COALESCE(room_number, ''), COALESCE(specialty, ''), created_at, updated_at
			FROM users
			WHERE role = 'staff'
			ORDER BY name
		`)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not list staff")
			return
		}
		defer rows.Close()

		staff := []models.User{}

		for rows.Next() {
			u := models.User{}
			if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.PasswordHash, &u.Role, &u.RoomNumber, &u.Specialty, &u.CreatedAt, &u.UpdatedAt); err != nil {
				writeError(w, http.StatusInternalServerError, "could not scan staff")
				return
			}
			staff = append(staff, u)
		}

		writeJSON(w, http.StatusOK, staff)
	}
}

func CreateStaffHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := security.CurrentUser(r)
		if user == nil || user.Role != "admin" {
			writeError(w, http.StatusForbidden, "only admin can create staff")
			return
		}

		var req struct {
			Name      string `json:"name"`
			Email     string `json:"email"`
			Password  string `json:"password"`
			Specialty string `json:"specialty"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if req.Name == "" || req.Email == "" || req.Password == "" {
			writeError(w, http.StatusBadRequest, "name, email and password are required")
			return
		}

		hash, err := security.HashPassword(req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not hash password")
			return
		}

		now := time.Now().UTC().Format(time.RFC3339)

		staff := models.User{
			ID:           uuid.NewString(),
			Name:         req.Name,
			Email:        req.Email,
			PasswordHash: hash,
			Role:         "staff",
			Specialty:    req.Specialty,
			CreatedAt:    now,
			UpdatedAt:    now,
		}

		_, err = db.Exec(`
			INSERT INTO users(id, name, email, password_hash, role, room_number, specialty, created_at, updated_at)
			VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, staff.ID, staff.Name, staff.Email, staff.PasswordHash, staff.Role, "", staff.Specialty, staff.CreatedAt, staff.UpdatedAt)

		if err != nil {
			writeError(w, http.StatusBadRequest, "could not create staff")
			return
		}

		writeJSON(w, http.StatusCreated, staff)
	}
}

func UpdateStaffHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := security.CurrentUser(r)
		if user == nil || user.Role != "admin" {
			writeError(w, http.StatusForbidden, "only admin can update staff")
			return
		}

		id := mux.Vars(r)["id"]

		var req struct {
			Name      string `json:"name"`
			Specialty string `json:"specialty"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		_, err := db.Exec(`
			UPDATE users
			SET name = COALESCE(NULLIF(?, ''), name),
			    specialty = COALESCE(NULLIF(?, ''), specialty),
			    updated_at = ?
			WHERE id = ? AND role = 'staff'
		`, req.Name, req.Specialty, time.Now().UTC().Format(time.RFC3339), id)

		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not update staff")
			return
		}

		staff, err := getUserByID(db, id)
		if err != nil {
			writeError(w, http.StatusNotFound, "staff not found")
			return
		}

		writeJSON(w, http.StatusOK, staff)
	}
}

func DeleteStaffHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := security.CurrentUser(r)
		if user == nil || user.Role != "admin" {
			writeError(w, http.StatusForbidden, "only admin can delete staff")
			return
		}

		id := mux.Vars(r)["id"]

		_, err := db.Exec(`DELETE FROM users WHERE id = ? AND role = 'staff'`, id)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not delete staff")
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{
			"message": "staff deleted",
		})
	}
}

func ListChatHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := security.CurrentUser(r)
		ticketID := r.URL.Query().Get("ticket_id")

		if ticketID == "" {
			writeError(w, http.StatusBadRequest, "ticket_id is required")
			return
		}

		ticket, err := getTicketByID(db, ticketID)
		if err != nil {
			writeError(w, http.StatusNotFound, "ticket not found")
			return
		}

		if !canAccessTicket(user, ticket) {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		rows, err := db.Query(`
			SELECT id, ticket_id, sender_id, sender_name, sender_role, message, created_at
			FROM chat_messages
			WHERE ticket_id = ?
			ORDER BY created_at ASC
		`, ticketID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not list chat")
			return
		}
		defer rows.Close()

		messages := []models.ChatMessage{}

		for rows.Next() {
			msg := models.ChatMessage{}
			if err := rows.Scan(&msg.ID, &msg.TicketID, &msg.SenderID, &msg.SenderName, &msg.SenderRole, &msg.Message, &msg.CreatedAt); err != nil {
				writeError(w, http.StatusInternalServerError, "could not scan chat")
				return
			}
			messages = append(messages, msg)
		}

		writeJSON(w, http.StatusOK, messages)
	}
}

func CreateChatHandler(db *sql.DB, bus *mqttbus.Bus) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := security.CurrentUser(r)

		var req struct {
			TicketID string `json:"ticket_id"`
			Message  string `json:"message"`
		}

		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "invalid request body")
			return
		}

		if req.TicketID == "" || strings.TrimSpace(req.Message) == "" {
			writeError(w, http.StatusBadRequest, "ticket_id and message are required")
			return
		}

		ticket, err := getTicketByID(db, req.TicketID)
		if err != nil {
			writeError(w, http.StatusNotFound, "ticket not found")
			return
		}

		if !canAccessTicket(user, ticket) {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}

		msg := models.ChatMessage{
			ID:         uuid.NewString(),
			TicketID:   req.TicketID,
			SenderID:   user.ID,
			SenderName: user.Name,
			SenderRole: user.Role,
			Message:    req.Message,
			CreatedAt:  time.Now().UTC().Format(time.RFC3339),
		}

		_, err = db.Exec(`
			INSERT INTO chat_messages(id, ticket_id, sender_id, sender_name, sender_role, message, created_at)
			VALUES(?, ?, ?, ?, ?, ?, ?)
		`, msg.ID, msg.TicketID, msg.SenderID, msg.SenderName, msg.SenderRole, msg.Message, msg.CreatedAt)

		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not create chat message")
			return
		}

		publishAndAudit(db, bus, "luxstay/chat/message", "chat_message", "ChatMessage", msg.ID, msg)

		writeJSON(w, http.StatusCreated, msg)
	}
}

func ListEventsHandler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := security.CurrentUser(r)
		if user == nil || user.Role != "admin" {
			writeError(w, http.StatusForbidden, "only admin can view events")
			return
		}

		rows, err := db.Query(`
			SELECT id, type, topic, payload, created_at
			FROM audit_events
			ORDER BY created_at DESC
			LIMIT 100
		`)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "could not list events")
			return
		}
		defer rows.Close()

		events := []models.Event{}

		for rows.Next() {
			e := models.Event{}
			if err := rows.Scan(&e.ID, &e.Type, &e.Topic, &e.Payload, &e.CreatedAt); err != nil {
				writeError(w, http.StatusInternalServerError, "could not scan event")
				return
			}
			events = append(events, e)
		}

		writeJSON(w, http.StatusOK, events)
	}
}

func getTicketByID(db *sql.DB, id string) (*models.Ticket, error) {
	ticket := &models.Ticket{}

	err := db.QueryRow(`
		SELECT id, ticket_number, title, description, category, priority, status,
		       room_number, guest_id, guest_name,
		       COALESCE(assigned_to_id, ''), COALESCE(assigned_to_name, ''),
		       created_at, updated_at
		FROM tickets
		WHERE id = ?
	`, id).Scan(
		&ticket.ID,
		&ticket.TicketNumber,
		&ticket.Title,
		&ticket.Description,
		&ticket.Category,
		&ticket.Priority,
		&ticket.Status,
		&ticket.RoomNumber,
		&ticket.GuestID,
		&ticket.GuestName,
		&ticket.AssignedToID,
		&ticket.AssignedToName,
		&ticket.CreatedAt,
		&ticket.UpdatedAt,
	)

	return ticket, err
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

func canAccessTicket(user *models.User, ticket *models.Ticket) bool {
	if user == nil || ticket == nil {
		return false
	}

	switch user.Role {
	case "admin":
		return true
	case "guest":
		return ticket.RoomNumber == user.RoomNumber
	case "staff":
		return ticket.AssignedToID == user.ID
	default:
		return false
	}
}

func scanTicket(rows *sql.Rows, ticket *models.Ticket) error {
	return rows.Scan(
		&ticket.ID,
		&ticket.TicketNumber,
		&ticket.Title,
		&ticket.Description,
		&ticket.Category,
		&ticket.Priority,
		&ticket.Status,
		&ticket.RoomNumber,
		&ticket.GuestID,
		&ticket.GuestName,
		&ticket.AssignedToID,
		&ticket.AssignedToName,
		&ticket.CreatedAt,
		&ticket.UpdatedAt,
	)
}

func publishAndAudit(db *sql.DB, bus *mqttbus.Bus, topic string, eventType string, entity string, id string, data interface{}) {
	now := time.Now().UTC().Format(time.RFC3339)

	event := mqttbus.EventEnvelope{
		Type:      eventType,
		Entity:    entity,
		ID:        id,
		Data:      data,
		CreatedAt: now,
	}

	payload, _ := json.Marshal(event)

	_ = bus.Publish(topic, event)

	_, _ = db.Exec(`
		INSERT INTO audit_events(id, type, topic, payload, created_at)
		VALUES(?, ?, ?, ?, ?)
	`, uuid.NewString(), eventType, topic, string(payload), now)
}

func validStatus(status string) bool {
	return status == "OPEN" || status == "IN_PROGRESS" || status == "RESOLVED"
}

func emptyToNil(value string) interface{} {
	if value == "" {
		return nil
	}
	return value
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
