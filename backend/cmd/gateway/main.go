package main

import (
	"log"
	"net/http"

	"github.com/gorilla/mux"

	"luxstay/backend/internal/mqttbus"
	"luxstay/backend/internal/realtime"
	"luxstay/backend/internal/security"
	"luxstay/backend/internal/store"
)

func main() {
	db, err := store.OpenSQLite("./data/luxstay.db")
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	if err := store.RunMigration(db, "./migrations/001_init.sql"); err != nil {
		log.Fatal(err)
	}

	bus, err := mqttbus.NewBus("tcp://localhost:1883", "luxstay-gateway")
	if err != nil {
		log.Fatal(err)
	}

	hub := realtime.NewHub()

	_ = bus.Subscribe("luxstay/tickets/+", func(topic string, payload []byte) {
		hub.Broadcast(payload)
	})

	_ = bus.Subscribe("luxstay/chat/+", func(topic string, payload []byte) {
		hub.Broadcast(payload)
	})

	authBaseURL := "http://localhost:8081"
	authClient := &AuthClient{
		BaseURL: authBaseURL,
		Client:  http.DefaultClient,
	}

	r := mux.NewRouter()
	r.Use(corsMiddleware)
	r.Use(security.SecurityHeaders)
	r.Use(security.OriginCheck)

	api := r.PathPrefix("/api").Subrouter()

	// These routes are proxied to the separate Auth Service.
	api.HandleFunc("/auth/login", ProxyToAuth(authBaseURL, "/api/auth/login")).Methods("POST", "OPTIONS")
	api.HandleFunc("/auth/logout", ProxyToAuth(authBaseURL, "/api/auth/logout")).Methods("POST", "OPTIONS")
	api.HandleFunc("/auth/me", ProxyToAuth(authBaseURL, "/api/auth/me")).Methods("GET", "OPTIONS")
	api.HandleFunc("/auth/register", ProxyToAuth(authBaseURL, "/api/auth/register")).Methods("POST", "OPTIONS")

	protected := api.PathPrefix("").Subrouter()
	protected.Use(AuthMiddleware(authClient))

	protected.Handle("/events/stream", hub).Methods("GET")

	protected.HandleFunc("/tickets", ListTicketsHandler(db)).Methods("GET")
	protected.HandleFunc("/tickets", CreateTicketHandler(db, bus)).Methods("POST")
	protected.HandleFunc("/tickets/{id}", GetTicketHandler(db)).Methods("GET")
	protected.HandleFunc("/tickets/{id}", UpdateTicketHandler(db, bus)).Methods("PATCH")
	protected.HandleFunc("/tickets/{id}", DeleteTicketHandler(db, bus)).Methods("DELETE")

	protected.HandleFunc("/staff", ListStaffHandler(db)).Methods("GET")
	protected.HandleFunc("/staff", CreateStaffHandler(db)).Methods("POST")
	protected.HandleFunc("/staff/{id}", UpdateStaffHandler(db)).Methods("PATCH")
	protected.HandleFunc("/staff/{id}", DeleteStaffHandler(db)).Methods("DELETE")

	protected.HandleFunc("/chat", ListChatHandler(db)).Methods("GET")
	protected.HandleFunc("/chat", CreateChatHandler(db, bus)).Methods("POST")

	protected.HandleFunc("/events", ListEventsHandler(db)).Methods("GET")

	log.Println("Gateway running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		if origin == "http://localhost:5173" || origin == "http://localhost:8080" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}
