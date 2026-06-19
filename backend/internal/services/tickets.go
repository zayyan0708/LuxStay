// backend/internal/services/tickets.go

package services

import (
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"

	"luxstay/backend/internal/models"
	"luxstay/backend/internal/mqttbus"
	"luxstay/backend/internal/store"
)

type TicketService struct {
	tickets store.TicketRepository
	users   store.UserRepository
	bus     *mqttbus.Bus
}

func NewTicketService(
	tickets store.TicketRepository,
	users store.UserRepository,
	bus *mqttbus.Bus,
) *TicketService {
	return &TicketService{
		tickets: tickets,
		users:   users,
		bus:     bus,
	}
}

type CreateTicketInput struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Category    string `json:"category"`
	Priority    string `json:"priority"`
}

func (s *TicketService) Create(user *models.User, input CreateTicketInput) (*models.Ticket, error) {
	if user.Role != "guest" && user.Role != "admin" {
		return nil, errors.New("only guests/admin can create tickets")
	}

	if input.Title == "" || input.Description == "" {
		return nil, errors.New("title and description are required")
	}

	room := user.RoomNumber
	if user.Role == "admin" && room == "" {
		room = "ADMIN"
	}

	now := time.Now().UTC().Format(time.RFC3339)

	t := models.Ticket{
		ID:           uuid.NewString(),
		TicketNumber: fmt.Sprintf("TKT-%d", time.Now().Unix()),
		Title:        input.Title,
		Description:  input.Description,
		Category:     input.Category,
		Priority:     input.Priority,
		Status:       "OPEN",
		RoomNumber:   room,
		GuestID:      user.ID,
		GuestName:    user.Name,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.tickets.Create(t); err != nil {
		return nil, err
	}

	_ = s.bus.Publish("luxstay/tickets/created", mqttbus.EventEnvelope{
		Type:      "create",
		Entity:    "Ticket",
		ID:        t.ID,
		Data:      t,
		CreatedAt: now,
	})

	return &t, nil
}

func (s *TicketService) Update(user *models.User, id string, patch map[string]string) (*models.Ticket, error) {
	t, err := s.tickets.GetByID(id)
	if err != nil {
		return nil, err
	}

	switch user.Role {
	case "guest":
		if t.GuestID != user.ID {
			return nil, errors.New("guest can update only own ticket")
		}
		return nil, errors.New("guest cannot update ticket status")
	case "staff":
		if t.AssignedToID != user.ID {
			return nil, errors.New("staff can update only assigned tickets")
		}
		if status, ok := patch["status"]; ok {
			if status != "IN_PROGRESS" && status != "RESOLVED" {
				return nil, errors.New("invalid staff status")
			}
			t.Status = status
		}
	case "admin":
		if status, ok := patch["status"]; ok {
			t.Status = status
		}
		if assignedID, ok := patch["assigned_to_id"]; ok {
			staff, err := s.users.GetByID(assignedID)
			if err != nil {
				return nil, err
			}
			if staff.Role != "staff" {
				return nil, errors.New("assigned user must be staff")
			}
			t.AssignedToID = staff.ID
			t.AssignedToName = staff.Name
		}
	default:
		return nil, errors.New("invalid role")
	}

	t.UpdatedAt = time.Now().UTC().Format(time.RFC3339)

	if err := s.tickets.Update(*t); err != nil {
		return nil, err
	}

	eventType := "update"
	if _, ok := patch["assigned_to_id"]; ok {
		eventType = "assigned"
	}
	if t.Status == "RESOLVED" {
		eventType = "resolved"
	}

	_ = s.bus.Publish("luxstay/tickets/"+eventType, mqttbus.EventEnvelope{
		Type:      "update",
		Entity:    "Ticket",
		ID:        t.ID,
		Data:      t,
		CreatedAt: t.UpdatedAt,
	})

	return t, nil
}
