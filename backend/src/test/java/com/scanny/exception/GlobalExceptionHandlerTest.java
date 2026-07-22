package com.scanny.exception;

import static org.assertj.core.api.Assertions.assertThat;

import com.scanny.api.ApiErrorResponse;
import com.scanny.api.ErrorCode;
import jakarta.validation.constraints.NotBlank;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.ResponseEntity;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.validation.BeanPropertyBindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler handler;
    private MockHttpServletRequest request;

    @BeforeEach
    void setUp() {
        handler = new GlobalExceptionHandler();
        request = new MockHttpServletRequest();
        request.setRequestURI("/api/orders/abc");
    }

    @Test
    void apiExceptionReturnsStatusCodeAndErrorFields() {
        ApiException ex = new ApiException(ErrorCode.ORDER_NOT_FOUND, "Order was not found.");

        ResponseEntity<ApiErrorResponse> response = handler.handleApiException(ex, request);

        assertThat(response.getStatusCode().value()).isEqualTo(404);
        ApiErrorResponse body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.success()).isFalse();
        assertThat(body.error()).isEqualTo("Order was not found.");
        assertThat(body.message()).isEqualTo("Order was not found.");
        assertThat(body.code()).isEqualTo("ORDER_NOT_FOUND");
        assertThat(body.status()).isEqualTo(404);
        assertThat(body.path()).isEqualTo("/api/orders/abc");
        assertThat(body.timestamp()).isNotNull();
        assertThat(body.fieldErrors()).isEmpty();
    }

    @Test
    void legacyApiExceptionDerivesCodeFromStatus() {
        ApiException ex = new ApiException(404, "Order was not found.");

        ResponseEntity<ApiErrorResponse> response = handler.handleApiException(ex, request);

        assertThat(response.getStatusCode().value()).isEqualTo(404);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().code()).isEqualTo("NOT_FOUND");
        assertThat(response.getBody().error()).isEqualTo("Order was not found.");
    }

    @Test
    void validationFailureReturnsFieldErrors() throws Exception {
        BeanPropertyBindingResult bindingResult = new BeanPropertyBindingResult(new SampleRequest(""), "sampleRequest");
        bindingResult.addError(new FieldError(
                "sampleRequest",
                "name",
                "",
                false,
                new String[] {"NotBlank"},
                null,
                "Name is required"
        ));
        MethodParameter parameter = new MethodParameter(
                SampleController.class.getDeclaredMethod("create", SampleRequest.class),
                0
        );
        MethodArgumentNotValidException ex = new MethodArgumentNotValidException(parameter, bindingResult);

        ResponseEntity<ApiErrorResponse> response = handler.handleMethodArgumentNotValid(ex, request);

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        ApiErrorResponse body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.code()).isEqualTo("VALIDATION_FAILED");
        assertThat(body.error()).isEqualTo("Name is required");
        assertThat(body.fieldErrors()).hasSize(1);
        assertThat(body.fieldErrors().getFirst().field()).isEqualTo("name");
        assertThat(body.fieldErrors().getFirst().message()).isEqualTo("Name is required");
        assertThat(body.fieldErrors().getFirst().code()).isEqualTo("NotBlank");
    }

    @Test
    void badJsonReturnsInvalidRequest() {
        ResponseEntity<ApiErrorResponse> response = handler.handleBadJson(request);

        assertThat(response.getStatusCode().value()).isEqualTo(400);
        ApiErrorResponse body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.code()).isEqualTo("INVALID_REQUEST");
        assertThat(body.error()).isEqualTo("Invalid JSON request body.");
        assertThat(body.message()).isEqualTo("Invalid JSON request body.");
        assertThat(body.fieldErrors()).isEmpty();
    }

    @Test
    void genericExceptionReturnsInternalErrorWithoutLeak() {
        ResponseEntity<ApiErrorResponse> response = handler.handleGeneric(
                new RuntimeException("secret db password=hunter2"),
                request
        );

        assertThat(response.getStatusCode().value()).isEqualTo(500);
        ApiErrorResponse body = response.getBody();
        assertThat(body).isNotNull();
        assertThat(body.code()).isEqualTo("INTERNAL_ERROR");
        assertThat(body.error()).isEqualTo("Server error.");
        assertThat(body.message()).doesNotContain("hunter2");
        assertThat(body.message()).doesNotContain("secret");
    }

    @Test
    void apiErrorResponseFactoryKeepsErrorAndMessageAligned() {
        ApiErrorResponse body = ApiErrorResponse.of(
                ErrorCode.FORBIDDEN,
                "Nope",
                "/api/admin",
                List.of()
        );

        assertThat(body.success()).isFalse();
        assertThat(body.error()).isEqualTo("Nope");
        assertThat(body.message()).isEqualTo("Nope");
        assertThat(body.code()).isEqualTo("FORBIDDEN");
        assertThat(body.status()).isEqualTo(403);
    }

    static class SampleRequest {
        @NotBlank
        private final String name;

        SampleRequest(String name) {
            this.name = name;
        }

        public String getName() {
            return name;
        }
    }

    static class SampleController {
        public void create(SampleRequest request) {
            // test fixture only
        }
    }
}
