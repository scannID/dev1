package com.scanny.api;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.time.Instant;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ApiErrorResponse(
        boolean success,
        String error,
        String message,
        String code,
        int status,
        String path,
        Instant timestamp,
        List<FieldErrorDetail> fieldErrors
) {

    public static ApiErrorResponse of(
            ErrorCode errorCode,
            String humanMessage,
            String path,
            List<FieldErrorDetail> fieldErrors
    ) {
        String text = (humanMessage == null || humanMessage.isBlank())
                ? errorCode.defaultMessage()
                : humanMessage;
        List<FieldErrorDetail> details = fieldErrors == null || fieldErrors.isEmpty()
                ? List.of()
                : List.copyOf(fieldErrors);
        return new ApiErrorResponse(
                false,
                text,
                text,
                errorCode.code(),
                errorCode.statusValue(),
                path,
                Instant.now(),
                details
        );
    }

    public static ApiErrorResponse of(ErrorCode errorCode, String path) {
        return of(errorCode, errorCode.defaultMessage(), path, List.of());
    }

    public static ApiErrorResponse of(ErrorCode errorCode, String humanMessage, String path) {
        return of(errorCode, humanMessage, path, List.of());
    }
}
