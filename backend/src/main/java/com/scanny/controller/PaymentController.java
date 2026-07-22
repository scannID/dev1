package com.scanny.controller;

import com.scanny.dto.PaymentDtos;
import com.scanny.payment.service.PaymentGatewayService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    private final PaymentGatewayService paymentGatewayService;

    public PaymentController(PaymentGatewayService paymentGatewayService) {
        this.paymentGatewayService = paymentGatewayService;
    }

    @GetMapping("/providers")
    public ResponseEntity<PaymentDtos.ProvidersResponse> listProviders() {
        return ResponseEntity.ok(paymentGatewayService.listProviders());
    }

    @PostMapping("/initiate")
    public ResponseEntity<PaymentDtos.InitiateResponse> initiate(
            @Valid @RequestBody PaymentDtos.InitiateRequest request,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey
    ) {
        return ResponseEntity.ok(paymentGatewayService.initiate(request, idempotencyKey));
    }

    @GetMapping("/{paymentId}/status")
    public ResponseEntity<PaymentDtos.StatusResponse> status(@PathVariable String paymentId) {
        return ResponseEntity.ok(paymentGatewayService.refreshStatus(paymentId));
    }

    @PostMapping("/webhooks/{providerId}")
    public ResponseEntity<?> webhook(
            @PathVariable String providerId,
            @RequestBody(required = false) String rawBody,
            HttpServletRequest request) {
        Map<String, String> headers = new LinkedHashMap<>();
        request.getHeaderNames().asIterator().forEachRemaining(name -> headers.put(name, request.getHeader(name)));
        return paymentGatewayService.handleWebhook(providerId, rawBody == null ? "" : rawBody, headers)
            .<ResponseEntity<?>>map(response -> ResponseEntity.ok(response))
            .orElseGet(() -> ResponseEntity.ok(Map.of("received", true)));
    }
}
