// backend/cmd/notifier/main.go

package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"luxstay/backend/internal/mqttbus"
)

type RecentEvent struct {
	Topic     string `json:"topic"`
	Payload   string `json:"payload"`
	CreatedAt string `json:"created_at"`
}

type Buffer struct {
	mu     sync.Mutex
	events []RecentEvent
	max    int
}

func (b *Buffer) Add(e RecentEvent) {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.events = append([]RecentEvent{e}, b.events...)
	if len(b.events) > b.max {
		b.events = b.events[:b.max]
	}
}

func (b *Buffer) List() []RecentEvent {
	b.mu.Lock()
	defer b.mu.Unlock()

	cp := make([]RecentEvent, len(b.events))
	copy(cp, b.events)
	return cp
}

func main() {
	buffer := &Buffer{max: 50}

	bus, err := mqttbus.NewBus("tcp://localhost:1883", "luxstay-notifier")
	if err != nil {
		log.Fatal(err)
	}

	handler := func(topic string, payload []byte) {
		log.Printf("[MQTT] %s => %s\n", topic, string(payload))
		buffer.Add(RecentEvent{
			Topic:     topic,
			Payload:   string(payload),
			CreatedAt: time.Now().UTC().Format(time.RFC3339),
		})
	}

	_ = bus.Subscribe("luxstay/tickets/+", handler)
	_ = bus.Subscribe("luxstay/chat/+", handler)

	http.HandleFunc("/api/notifier/events", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(buffer.List())
	})

	log.Println("Notifier running on http://localhost:8090")
	log.Fatal(http.ListenAndServe(":8090", nil))
}
