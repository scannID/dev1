package com.scanny.api;

import org.springframework.http.HttpStatus;

public enum ErrorCode {

    VALIDATION_FAILED(HttpStatus.BAD_REQUEST, "Validation failed. Please check the highlighted fields."),
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "Invalid request."),
    UNAUTHORIZED(HttpStatus.UNAUTHORIZED, "Authentication is required."),
    FORBIDDEN(HttpStatus.FORBIDDEN, "You do not have permission to perform this action."),
    NOT_FOUND(HttpStatus.NOT_FOUND, "Resource was not found."),
    ORDER_NOT_FOUND(HttpStatus.NOT_FOUND, "Order was not found."),
    BUSINESS_NOT_FOUND(HttpStatus.NOT_FOUND, "Business was not found."),
    CONFLICT(HttpStatus.CONFLICT, "The request conflicts with the current state."),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "This HTTP method is not allowed for this endpoint."),
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "Too many requests. Try again shortly."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "Server error.");

    private final HttpStatus status;
    private final String defaultMessage;

    ErrorCode(HttpStatus status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    public String code() {
        return name();
    }

    public HttpStatus status() {
        return status;
    }

    public int statusValue() {
        return status.value();
    }

    public String defaultMessage() {
        return defaultMessage;
    }

    public static ErrorCode fromHttpStatus(int status) {
        return switch (status) {
            case 400 -> INVALID_REQUEST;
            case 401 -> UNAUTHORIZED;
            case 403 -> FORBIDDEN;
            case 404 -> NOT_FOUND;
            case 405 -> METHOD_NOT_ALLOWED;
            case 409 -> CONFLICT;
            case 429 -> RATE_LIMITED;
            default -> status >= 500 ? INTERNAL_ERROR : INVALID_REQUEST;
        };
    }
}
