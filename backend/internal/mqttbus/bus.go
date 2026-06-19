// backend/internal/mqttbus/bus.go

package mqttbus

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
)

type Bus struct {
	client mqtt.Client
}

type EventEnvelope struct {
	Type      string      `json:"type"`
	Entity    string      `json:"entity"`
	ID        string      `json:"id"`
	Data      interface{} `json:"data"`
	CreatedAt string      `json:"created_at"`
}

func NewBus(broker string, clientID string) (*Bus, error) {
	opts := mqtt.NewClientOptions().
		AddBroker(broker).
		SetClientID(clientID).
		SetKeepAlive(30*time.Second).
		SetCleanSession(false).
		SetWill("luxstay/system/"+clientID, `{"status":"offline"}`, 1, true)

	client := mqtt.NewClient(opts)

	token := client.Connect()
	token.Wait()
	if token.Error() != nil {
		return nil, token.Error()
	}

	return &Bus{client: client}, nil
}

func (b *Bus) Publish(topic string, event EventEnvelope) error {
	payload, err := json.Marshal(event)
	if err != nil {
		return err
	}

	token := b.client.Publish(topic, 1, false, payload)
	token.Wait()

	return token.Error()
}

func (b *Bus) Subscribe(topic string, handler func(topic string, payload []byte)) error {
	token := b.client.Subscribe(topic, 1, func(_ mqtt.Client, msg mqtt.Message) {
		handler(msg.Topic(), msg.Payload())
	})
	token.Wait()

	if token.Error() != nil {
		return fmt.Errorf("mqtt subscribe failed: %w", token.Error())
	}

	log.Println("subscribed to", topic)
	return nil
}
