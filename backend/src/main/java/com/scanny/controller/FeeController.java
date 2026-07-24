package com.scanny.controller;

import com.scanny.service.FeeService;
import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/fees")
public class FeeController {

    private final FeeService feeService;

    public FeeController(FeeService feeService) {
        this.feeService = feeService;
    }

    /** Public fee config so customer/merchant UIs stay aligned with backend. */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getFees() {
        return ResponseEntity.ok(Map.of(
                "serviceFeeUgx", feeService.serviceFeeUgx(),
                "psoPercent", feeService.psoPercent(),
                "currency", "UGX"
        ));
    }
}
