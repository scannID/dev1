package com.scanny.api;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

@Component
public class ApiErrorWriter {

    private final ObjectMapper objectMapper;

    public ApiErrorWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public void write(
            HttpServletRequest request,
            HttpServletResponse response,
            ErrorCode errorCode
    ) throws IOException {
        write(request, response, errorCode, errorCode.defaultMessage());
    }

    public void write(
            HttpServletRequest request,
            HttpServletResponse response,
            ErrorCode errorCode,
            String message
    ) throws IOException {
        ApiErrorResponse body = ApiErrorResponse.of(errorCode, message, request.getRequestURI(), List.of());
        response.setStatus(errorCode.statusValue());
        response.setCharacterEncoding("UTF-8");
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        objectMapper.writeValue(response.getOutputStream(), body);
    }
}
