package com.nova-verify.sdk.exception;

/**
 * Base exception class for all Nova Verify SDK errors.
 */
public class Nova VerifyException extends Exception {
    
    private final ErrorCode code;
    private final Object details;
    private final Integer statusCode;
    
    /**
     * Creates a new Nova VerifyException.
     * 
     * @param code the error code
     * @param message the error message
     */
    public Nova VerifyException(ErrorCode code, String message) {
        super(message);
        this.code = code;
        this.details = null;
        this.statusCode = null;
    }
    
    /**
     * Creates a new Nova VerifyException with details.
     * 
     * @param code the error code
     * @param message the error message
     * @param details additional error details
     */
    public Nova VerifyException(ErrorCode code, String message, Object details) {
        super(message);
        this.code = code;
        this.details = details;
        this.statusCode = null;
    }
    
    /**
     * Creates a new Nova VerifyException with status code.
     * 
     * @param code the error code
     * @param message the error message
     * @param statusCode the HTTP status code
     */
    public Nova VerifyException(ErrorCode code, String message, Integer statusCode) {
        super(message);
        this.code = code;
        this.details = null;
        this.statusCode = statusCode;
    }
    
    /**
     * Creates a new Nova VerifyException with cause.
     * 
     * @param code the error code
     * @param message the error message
     * @param cause the cause of the exception
     */
    public Nova VerifyException(ErrorCode code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
        this.details = null;
        this.statusCode = null;
    }
    
    /**
     * Creates a new Nova VerifyException with all fields.
     * 
     * @param code the error code
     * @param message the error message
     * @param details additional error details
     * @param statusCode the HTTP status code
     * @param cause the cause of the exception
     */
    public Nova VerifyException(ErrorCode code, String message, Object details, Integer statusCode, Throwable cause) {
        super(message, cause);
        this.code = code;
        this.details = details;
        this.statusCode = statusCode;
    }
    
    /**
     * Creates a new API error.
     * 
     * @param message the error message
     * @param statusCode the HTTP status code
     * @return the exception
     */
    public static Nova VerifyException apiError(String message, int statusCode) {
        return new Nova VerifyException(ErrorCode.API_ERROR, message, statusCode);
    }
    
    /**
     * Creates a new authentication error.
     * 
     * @param message the error message
     * @return the exception
     */
    public static Nova VerifyException authError(String message) {
        return new Nova VerifyException(ErrorCode.AUTH_ERROR, message);
    }
    
    /**
     * Creates a new validation error.
     * 
     * @param message the error message
     * @param field the field that failed validation
     * @return the exception
     */
    public static Nova VerifyException validationError(String message, String field) {
        return new Nova VerifyException(ErrorCode.VALIDATION_ERROR, message, field);
    }
    
    /**
     * Creates a new network error.
     * 
     * @param message the error message
     * @return the exception
     */
    public static Nova VerifyException networkError(String message) {
        return new Nova VerifyException(ErrorCode.NETWORK_ERROR, message);
    }
    
    /**
     * Creates a new wallet error.
     * 
     * @param message the error message
     * @param walletType the wallet type
     * @return the exception
     */
    public static Nova VerifyException walletError(String message, String walletType) {
        return new Nova VerifyException(ErrorCode.WALLET_ERROR, message, walletType);
    }
    
    /**
     * Creates a new proof error.
     * 
     * @param message the error message
     * @param proofId the proof ID
     * @return the exception
     */
    public static Nova VerifyException proofError(String message, String proofId) {
        return new Nova VerifyException(ErrorCode.PROOF_ERROR, message, proofId);
    }
    
    /**
     * Creates a new verification error.
     * 
     * @param message the error message
     * @param verificationId the verification ID
     * @return the exception
     */
    public static Nova VerifyException verificationError(String message, String verificationId) {
        return new Nova VerifyException(ErrorCode.VERIFICATION_ERROR, message, verificationId);
    }
    
    /**
     * Creates a new subscription error.
     * 
     * @param message the error message
     * @param subscriptionId the subscription ID
     * @return the exception
     */
    public static Nova VerifyException subscriptionError(String message, String subscriptionId) {
        return new Nova VerifyException(ErrorCode.SUBSCRIPTION_ERROR, message, subscriptionId);
    }
    
    /**
     * Gets the error code.
     * 
     * @return the error code
     */
    public ErrorCode getCode() {
        return code;
    }
    
    /**
     * Gets the error details.
     * 
     * @return the error details
     */
    public Object getDetails() {
        return details;
    }
    
    /**
     * Gets the HTTP status code.
     * 
     * @return the status code
     */
    public Integer getStatusCode() {
        return statusCode;
    }
    
    /**
     * Checks if this is an API error.
     * 
     * @return true if API error
     */
    public boolean isApiError() {
        return code == ErrorCode.API_ERROR;
    }
    
    /**
     * Checks if this is an authentication error.
     * 
     * @return true if auth error
     */
    public boolean isAuthError() {
        return code == ErrorCode.AUTH_ERROR;
    }
    
    /**
     * Checks if this is a validation error.
     * 
     * @return true if validation error
     */
    public boolean isValidationError() {
        return code == ErrorCode.VALIDATION_ERROR;
    }
    
    /**
     * Checks if this is a network error.
     * 
     * @return true if network error
     */
    public boolean isNetworkError() {
        return code == ErrorCode.NETWORK_ERROR;
    }
    
    /**
     * Checks if this is a wallet error.
     * 
     * @return true if wallet error
     */
    public boolean isWalletError() {
        return code == ErrorCode.WALLET_ERROR;
    }
    
    /**
     * Checks if this is a proof error.
     * 
     * @return true if proof error
     */
    public boolean isProofError() {
        return code == ErrorCode.PROOF_ERROR;
    }
    
    /**
     * Checks if this is a verification error.
     * 
     * @return true if verification error
     */
    public boolean isVerificationError() {
        return code == ErrorCode.VERIFICATION_ERROR;
    }
    
    /**
     * Checks if this is a subscription error.
     * 
     * @return true if subscription error
     */
    public boolean isSubscriptionError() {
        return code == ErrorCode.SUBSCRIPTION_ERROR;
    }
    
    @Override
    public String getMessage() {
        StringBuilder sb = new StringBuilder();
        sb.append("[").append(code).append("] ").append(super.getMessage());
        
        if (statusCode != null) {
            sb.append(" (HTTP ").append(statusCode).append(")");
        }
        
        return sb.toString();
    }
}
