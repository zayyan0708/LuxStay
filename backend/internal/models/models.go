// backend/internal/models/models.go

package models

type User struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Email        string `json:"email"`
	Role         string `json:"role"`
	RoomNumber   string `json:"room_number,omitempty"`
	Specialty    string `json:"specialty,omitempty"`
	PasswordHash string `json:"-"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

type Ticket struct {
	ID             string `json:"id"`
	TicketNumber   string `json:"ticket_number"`
	Title          string `json:"title"`
	Description    string `json:"description"`
	Category       string `json:"category"`
	Priority       string `json:"priority"`
	Status         string `json:"status"`
	RoomNumber     string `json:"room_number"`
	GuestID        string `json:"guest_id"`
	GuestName      string `json:"guest_name"`
	AssignedToID   string `json:"assigned_to_id,omitempty"`
	AssignedToName string `json:"assigned_to_name,omitempty"`
	CreatedAt      string `json:"created_date"`
	UpdatedAt      string `json:"updated_date"`
}

type ChatMessage struct {
	ID         string `json:"id"`
	TicketID   string `json:"ticket_id"`
	SenderID   string `json:"sender_id"`
	SenderName string `json:"sender_name"`
	SenderRole string `json:"sender_role"`
	Message    string `json:"message"`
	CreatedAt  string `json:"created_date"`
}

type Event struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	Topic     string `json:"topic"`
	Payload   string `json:"payload"`
	CreatedAt string `json:"created_date"`
}
