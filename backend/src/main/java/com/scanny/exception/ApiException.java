package com.scanny.exception;

import com.scanny.api.ErrorCode;

public class ApiException extends RuntimeException {

    private final int status;
    private final ErrorCode code;

    public ApiException(int status, String message) {
        super(message);
        this.status = status;
        this.code = ErrorCode.fromHttpStatus(status);
    }

    public ApiException(ErrorCode code, String message) {
        super(message != null && !message.isBlank() ? message : code.defaultMessage());
        this.code = code;
        this.status = code.statusValue();
    }

    public ApiException(ErrorCode code) {
        this(code, code.defaultMessage());
    }

    public int getStatus() {
        return status;
    }

    public ErrorCode getCode() {
        return code;
    }

    public static ApiException of(ErrorCode code) {
        return new ApiException(code);
    }

    public static ApiException of(ErrorCode code, String overrideMessage) {
        return new ApiException(code, overrideMessage);
    }

    public static ApiException badRequest(String message) {
        return new ApiException(ErrorCode.INVALID_REQUEST, message);
    }

    public static ApiException badRequest(ErrorCode code, String message) {
        return new ApiException(code, message);
    }

    public static ApiException notFound(String message) {
        return new ApiException(ErrorCode.NOT_FOUND, message);
    }

    public static ApiException notFound(ErrorCode code) {
        return new ApiException(code);
    }

    public static ApiException notFound(ErrorCode code, String message) {
        return new ApiException(code, message);
    }

    public static ApiException forbidden(String message) {
        return new ApiException(ErrorCode.FORBIDDEN, message);
    }

    public static ApiException conflict(String message) {
        return new ApiException(ErrorCode.CONFLICT, message);
    }

    public static ApiException unauthorized(String message) {
        return new ApiException(ErrorCode.UNAUTHORIZED, message);
    }
}
