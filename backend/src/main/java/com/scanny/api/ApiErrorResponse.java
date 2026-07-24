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

    public static ApiErrorResponse of(ErrorCode errorCode, String path) {
        return of(errorCode, errorCode.defaultMessage(), path, List.of(), 0);
    }

    public static ApiErrorResponse of(ErrorCode errorCode, String humanMessage, String path) {
        return of(errorCode, humanMessage, path, List.of(), 0);
    }

    public static ApiErrorResponse of(
            ErrorCode errorCode,
            String humanMessage,
            String path,
            List<FieldErrorDetail> fieldErrors
    ) {
        return of(errorCode, humanMessage, path, fieldErrors, 0);
    }

    public static ApiErrorResponse of(
            ErrorCode errorCode,
            String humanMessage,
            String path,
            List<FieldErrorDetail> fieldErrors,
            int statusOverride
    ) {
        String text = (humanMessage == null || humanMessage.isBlank())
                ? errorCode.defaultMessage()
                : humanMessage;
        List<FieldErrorDetail> details = fieldErrors == null || fieldErrors.isEmpty()
                ? List.of()
                : List.copyOf(fieldErrors);
        int status = statusOverride > 0 ? statusOverride : errorCode.statusValue();
        return new ApiErrorResponse(
                false,
                text,
                text,
                errorCode.code(),
                status,
                path,
                Instant.now(),
                details
        );
    }
}
