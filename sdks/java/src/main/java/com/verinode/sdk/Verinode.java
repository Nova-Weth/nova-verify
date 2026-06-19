package com.nova-verify.sdk;

import com.nova-verify.sdk.config.NovaVerifyConfig;
import com.nova-verify.sdk.services.ProofService;
import com.nova-verify.sdk.services.VerificationService;
import com.nova-verify.sdk.services.WalletService;
import com.nova-verify.sdk.types.AuthToken;
import com.nova-verify.sdk.types.User;
import com.nova-verify.sdk.exception.Nova VerifyException;

/**
 * Main client class for the Nova Verify Java SDK.
 * 
 * <p>This is the primary entry point for interacting with the Nova Verify API.
 * It provides access to all services including proofs, verifications, and wallets.</p>
 * 
 * <p>Example usage:</p>
 * <pre>{@code
 * NovaVerifyConfig config = NovaVerifyConfig.builder()
 *     .apiEndpoint("https://api.nova-verify.com")
 *     .network(NetworkType.TESTNET)
 *     .build();
 * 
 * Nova Verify client = new Nova Verify(config);
 * client.authenticate("user@example.com", "password");
 * 
 * Proof proof = client.proof().create(new ProofCreateRequest.Builder()
 *     .title("My Proof")
 *     .description("Test proof")
 *     .build());
 * }</pre>
 */
public class Nova Verify {
    
    private final NovaVerifyConfig config;
    private final HttpClient httpClient;
    private final WebSocketClient webSocketClient;
    
    // Services
    private final ProofService proofService;
    private final VerificationService verificationService;
    private final WalletService walletService;
    
    // Authentication state
    private AuthToken authToken;
    private User currentUser;
    
    /**
     * Creates a new Nova Verify client with the specified configuration.
     * 
     * @param config the configuration to use
     */
    public Nova Verify(NovaVerifyConfig config) {
        this.config = config;
        this.httpClient = new OkHttpClient(config);
        this.webSocketClient = new OkWebSocketClient(config);
        
        // Initialize services
        this.proofService = new ProofService(httpClient, config);
        this.verificationService = new VerificationService(httpClient, config);
        this.walletService = new WalletService(httpClient, webSocketClient, config);
    }
    
    /**
     * Creates a new Nova Verify client with default configuration.
     * 
     * @return a new Nova Verify client
     */
    public static Nova Verify withDefaults() {
        return new Nova Verify(NovaVerifyConfig.defaultConfig());
    }
    
    /**
     * Creates a new Nova Verify client from environment variables.
     * 
     * @return a new Nova Verify client
     * @throws Nova VerifyException if configuration is invalid
     */
    public static Nova Verify fromEnv() throws Nova VerifyException {
        NovaVerifyConfig config = NovaVerifyConfig.fromEnv();
        return new Nova Verify(config);
    }
    
    /**
     * Gets the configuration.
     * 
     * @return the configuration
     */
    public NovaVerifyConfig getConfig() {
        return config;
    }
    
    /**
     * Checks if the client is authenticated.
     * 
     * @return true if authenticated, false otherwise
     */
    public boolean isAuthenticated() {
        return authToken != null && currentUser != null;
    }
    
    /**
     * Gets the current authenticated user.
     * 
     * @return the current user, or null if not authenticated
     */
    public User getCurrentUser() {
        return currentUser;
    }
    
    /**
     * Gets the current authentication token.
     * 
     * @return the auth token, or null if not authenticated
     */
    public AuthToken getAuthToken() {
        return authToken;
    }
    
    /**
     * Checks if the SDK is properly configured.
     * 
     * @return true if ready, false otherwise
     */
    public boolean isReady() {
        return config.isValid();
    }
    
    /**
     * Gets the proof service.
     * 
     * @return the proof service
     */
    public ProofService proof() {
        return proofService;
    }
    
    /**
     * Gets the verification service.
     * 
     * @return the verification service
     */
    public VerificationService verification() {
        return verificationService;
    }
    
    /**
     * Gets the wallet service.
     * 
     * @return the wallet service
     */
    public WalletService wallet() {
        return walletService;
    }
    
    /**
     * Authenticates with email and password.
     * 
     * @param email the user email
     * @param password the user password
     * @return the authentication token
     * @throws Nova VerifyException if authentication fails
     */
    public AuthToken authenticate(String email, String password) throws Nova VerifyException {
        LoginRequest request = new LoginRequest(email, password);
        AuthResponse response = httpClient.post("/auth/login", request, AuthResponse.class);
        
        AuthToken token = response.getData();
        this.authToken = token;
        httpClient.setAuthToken(token.getAccessToken());
        
        // Get current user info
        getCurrentUser();
        
        if (config.isLoggingEnabled()) {
            config.getLogger().info("Successfully authenticated user: {}", email);
        }
        
        return token;
    }
    
    /**
     * Registers a new user account.
     * 
     * @param email the user email
     * @param password the user password
     * @param username the optional username
     * @return the authentication token
     * @throws Nova VerifyException if registration fails
     */
    public AuthToken register(String email, String password, String username) throws Nova VerifyException {
        RegisterRequest request = new RegisterRequest(email, password, username);
        AuthResponse response = httpClient.post("/auth/register", request, AuthResponse.class);
        
        AuthToken token = response.getData();
        this.authToken = token;
        httpClient.setAuthToken(token.getAccessToken());
        
        // Get current user info
        getCurrentUser();
        
        if (config.isLoggingEnabled()) {
            config.getLogger().info("Successfully registered user: {}", email);
        }
        
        return token;
    }
    
    /**
     * Logs out the current user.
     * 
     * @throws Nova VerifyException if logout fails
     */
    public void logout() throws Nova VerifyException {
        if (authToken != null) {
            try {
                httpClient.post("/auth/logout", null, Object.class);
            } catch (Exception e) {
                if (config.isLoggingEnabled()) {
                    config.getLogger().warn("Logout request failed: {}", e.getMessage());
                }
            }
        }
        
        this.authToken = null;
        this.currentUser = null;
        httpClient.setAuthToken(null);
        
        if (config.isLoggingEnabled()) {
            config.getLogger().info("User logged out");
        }
    }
    
    /**
     * Refreshes the authentication token.
     * 
     * @return the new authentication token
     * @throws Nova VerifyException if refresh fails
     */
    public AuthToken refreshToken() throws Nova VerifyException {
        if (authToken == null || authToken.getRefreshToken() == null) {
            throw new Nova VerifyException("No refresh token available");
        }
        
        RefreshTokenRequest request = new RefreshTokenRequest(authToken.getRefreshToken());
        AuthResponse response = httpClient.post("/auth/refresh", request, AuthResponse.class);
        
        AuthToken token = response.getData();
        this.authToken = token;
        httpClient.setAuthToken(token.getAccessToken());
        
        if (config.isLoggingEnabled()) {
            config.getLogger().info("Token refreshed successfully");
        }
        
        return token;
    }
    
    /**
     * Subscribes to real-time updates.
     * 
     * @param filters the subscription filters
     * @return the subscription
     * @throws Nova VerifyException if subscription fails
     */
    public Subscription subscribeToUpdates(Map<String, Object> filters) throws Nova VerifyException {
        if (!isAuthenticated()) {
            throw new Nova VerifyException("Must be authenticated to subscribe to updates");
        }
        
        return webSocketClient.subscribe(filters);
    }
    
    /**
     * Gets current user information.
     * 
     * @throws Nova VerifyException if getting user info fails
     */
    private void getCurrentUser() throws Nova VerifyException {
        UserResponse response = httpClient.get("/auth/me", UserResponse.class);
        this.currentUser = response.getData();
    }
    
    /**
     * Closes the client and cleans up resources.
     */
    public void close() {
        try {
            httpClient.close();
        } catch (Exception e) {
            if (config.isLoggingEnabled()) {
                config.getLogger().warn("Failed to close HTTP client: {}", e.getMessage());
            }
        }
        
        try {
            webSocketClient.close();
        } catch (Exception e) {
            if (config.isLoggingEnabled()) {
                config.getLogger().warn("Failed to close WebSocket client: {}", e.getMessage());
            }
        }
    }
    
    /**
     * Gets the SDK version.
     * 
     * @return the version string
     */
    public static String getVersion() {
        return "1.0.0";
    }
}
