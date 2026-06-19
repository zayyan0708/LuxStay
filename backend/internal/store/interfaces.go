// backend/internal/store/interfaces.go

package store

import "luxstay/backend/internal/models"

type UserRepository interface {
	GetByID(id string) (*models.User, error)
	GetByEmail(email string) (*models.User, error)
	ListStaff() ([]models.User, error)
	Create(user models.User) error
}

type TicketRepository interface {
	List(user *models.User, filters map[string]string) ([]models.Ticket, error)
	GetByID(id string) (*models.Ticket, error)
	Create(ticket models.Ticket) error
	Update(ticket models.Ticket) error
	Delete(id string) error
}

type ChatRepository interface {
	ListByTicket(ticketID string) ([]models.ChatMessage, error)
	Create(message models.ChatMessage) error
}

type EventRepository interface {
	Save(event models.Event) error
	List(limit int) ([]models.Event, error)
}
