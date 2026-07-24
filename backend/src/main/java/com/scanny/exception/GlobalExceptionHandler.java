package com.scanny.exception;

import com.scanny.api.ApiErrorResponse;
import com.scanny.api.ErrorCode;
import com.scanny.api.FieldErrorDetail;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiErrorResponse> handleApiException(ApiException ex, HttpServletRequest request) {
        ErrorCode code = ex.getCode() != null ? ex.getCode() : ErrorCode.fromHttpStatus(ex.getStatus());
        ApiErrorResponse body = ApiErrorResponse.of(code, ex.getMessage(), path(request), List.of(), ex.getStatus());
        return ResponseEntity.status(ex.getStatus()).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorResponse> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex,
            HttpServletRequest request
    ) {
        List<FieldErrorDetail> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(this::toFieldError)
                .toList();
        String message = fieldErrors.isEmpty()
                ? ErrorCode.VALIDATION_FAILED.defaultMessage()
                : fieldErrors.getFirst().message();
        ApiErrorResponse body = ApiErrorResponse.of(
                ErrorCode.VALIDATION_FAILED,
                message,
                path(request),
                fieldErrors
        );
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleConstraintViolation(
            ConstraintViolationException ex,
            HttpServletRequest request
    ) {
        List<FieldErrorDetail> fieldErrors = ex.getConstraintViolations().stream()
                .map(violation -> new FieldErrorDetail(
                        violation.getPropertyPath() != null ? violation.getPropertyPath().toString() : null,
                        violation.getInvalidValue(),
                        violation.getMessage(),
                        violation.getConstraintDescriptor() != null
                                ? violation.getConstraintDescriptor().getAnnotation().annotationType().getSimpleName()
                                : null
                ))
                .toList();
        String message = fieldErrors.isEmpty()
                ? ErrorCode.VALIDATION_FAILED.defaultMessage()
                : fieldErrors.getFirst().message();
        return ResponseEntity.badRequest().body(
                ApiErrorResponse.of(ErrorCode.VALIDATION_FAILED, message, path(request), fieldErrors)
        );
    }

    @ExceptionHandler(BindException.class)
    public ResponseEntity<ApiErrorResponse> handleBindException(BindException ex, HttpServletRequest request) {
        List<FieldErrorDetail> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(this::toFieldError)
                .toList();
        String message = fieldErrors.isEmpty()
                ? ErrorCode.VALIDATION_FAILED.defaultMessage()
                : fieldErrors.getFirst().message();
        return ResponseEntity.badRequest().body(
                ApiErrorResponse.of(ErrorCode.VALIDATION_FAILED, message, path(request), fieldErrors)
        );
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiErrorResponse> handleMissingParameter(
            MissingServletRequestParameterException ex,
            HttpServletRequest request
    ) {
        String message = "Required parameter '" + ex.getParameterName() + "' is missing.";
        FieldErrorDetail detail = new FieldErrorDetail(ex.getParameterName(), null, message, "MissingParameter");
        return ResponseEntity.badRequest().body(
                ApiErrorResponse.of(ErrorCode.VALIDATION_FAILED, message, path(request), List.of(detail))
        );
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiErrorResponse> handleTypeMismatch(
            MethodArgumentTypeMismatchException ex,
            HttpServletRequest request
    ) {
        String message = "Invalid value for parameter '" + ex.getName() + "'.";
        FieldErrorDetail detail = new FieldErrorDetail(ex.getName(), ex.getValue(), message, "TypeMismatch");
        return ResponseEntity.badRequest().body(
                ApiErrorResponse.of(ErrorCode.INVALID_REQUEST, message, path(request), List.of(detail))
        );
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorResponse> handleBadJson(HttpServletRequest request) {
        return ResponseEntity.badRequest().body(
                ApiErrorResponse.of(ErrorCode.INVALID_REQUEST, "Invalid JSON request body.", path(request))
        );
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiErrorResponse> handleMethodNotSupported(
            HttpRequestMethodNotSupportedException ex,
            HttpServletRequest request
    ) {
        return ResponseEntity.status(ErrorCode.METHOD_NOT_ALLOWED.status()).body(
                ApiErrorResponse.of(
                        ErrorCode.METHOD_NOT_ALLOWED,
                        "This action is not available yet. Restart the backend to load the latest API.",
                        path(request)
                )
        );
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorResponse> handleAccessDenied(
            AccessDeniedException ex,
            HttpServletRequest request
    ) {
        return ResponseEntity.status(ErrorCode.FORBIDDEN.status()).body(
                ApiErrorResponse.of(ErrorCode.FORBIDDEN, path(request))
        );
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiErrorResponse> handleAuthentication(
            AuthenticationException ex,
            HttpServletRequest request
    ) {
        return ResponseEntity.status(ErrorCode.UNAUTHORIZED.status()).body(
                ApiErrorResponse.of(ErrorCode.UNAUTHORIZED, path(request))
        );
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorResponse> handleDataIntegrity(
            DataIntegrityViolationException ex,
            HttpServletRequest request
    ) {
        logger.warn("Data integrity violation on {}: {}", path(request), ex.getMostSpecificCause().getMessage());
        return ResponseEntity.status(ErrorCode.CONFLICT.status()).body(
                ApiErrorResponse.of(ErrorCode.CONFLICT, path(request))
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorResponse> handleGeneric(Exception ex, HttpServletRequest request) {
        logger.error("Unhandled exception on {}", path(request), ex);
        return ResponseEntity.status(ErrorCode.INTERNAL_ERROR.status()).body(
                ApiErrorResponse.of(ErrorCode.INTERNAL_ERROR, path(request))
        );
    }

    private FieldErrorDetail toFieldError(FieldError error) {
        String message = error.getDefaultMessage() != null ? error.getDefaultMessage() : "Validation failed.";
        return new FieldErrorDetail(
                error.getField(),
                error.getRejectedValue(),
                message,
                error.getCode()
        );
    }

    private static String path(HttpServletRequest request) {
        return request != null ? request.getRequestURI() : null;
    }
}
