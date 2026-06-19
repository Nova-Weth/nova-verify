package nova-verify

import (
	"github.com/Great-2025/nova-verify-go/pkg/nova-verify/internal"
)

// HTTPClient constructor
func NewHTTPClient(config *Config) HTTPClient {
	return internal.NewHTTPClient(config)
}

// WebSocketClient constructor
func NewWebSocketClient(config *Config) WebSocketClient {
	return internal.NewWebSocketClient(config)
}
