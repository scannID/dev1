package com.scanny.controller;

import com.scanny.dto.OperationsDtos;
import com.scanny.service.CustomerEngagementService;
import com.scanny.service.OperationsService;
import com.scanny.service.TableService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/public")
public class PublicOperationsController {

    private final OperationsService operationsService;
    private final CustomerEngagementService customerEngagementService;
    private final TableService tableService;

    public PublicOperationsController(
            OperationsService operationsService,
            CustomerEngagementService customerEngagementService,
            TableService tableService
    ) {
        this.operationsService = operationsService;
        this.customerEngagementService = customerEngagementService;
        this.tableService = tableService;
    }

    @GetMapping("/businesses/{businessId}/operations-status")
    public Map<String, Object> operationsStatus(@PathVariable String businessId) {
        return operationsService.publicOperationsStatus(businessId);
    }

    @PostMapping("/orders/{publicId}/feedback")
    public Map<String, OperationsDtos.FeedbackResponse> submitFeedback(
            @PathVariable UUID publicId,
            @Valid @RequestBody OperationsDtos.SubmitFeedbackRequest request
    ) {
        return Map.of("feedback", customerEngagementService.submitFeedback(publicId, request));
    }

    @GetMapping("/orders/{publicId}/splits")
    public Map<String, OperationsDtos.SplitBillSummary> getSplits(@PathVariable UUID publicId) {
        return Map.of("bill", tableService.getPublicSplitBill(publicId));
    }

    @PostMapping("/orders/{publicId}/splits/equal")
    public Map<String, List<OperationsDtos.SplitPaymentResponse>> createEqualSplits(
            @PathVariable UUID publicId,
            @Valid @RequestBody OperationsDtos.CreateEqualSplitsRequest request
    ) {
        return Map.of("splits", tableService.createPublicEqualSplits(publicId, request));
    }

    @PostMapping("/orders/{publicId}/splits/custom")
    public Map<String, List<OperationsDtos.SplitPaymentResponse>> createCustomSplits(
            @PathVariable UUID publicId,
            @Valid @RequestBody OperationsDtos.CreateCustomSplitsRequest request
    ) {
        return Map.of("splits", tableService.createPublicCustomSplits(publicId, request));
    }

    @PostMapping("/customer/history/request-code")
    public Map<String, String> requestHistoryCode(@Valid @RequestBody OperationsDtos.CustomerHistoryRequest request) {
        customerEngagementService.requestHistoryCode(request);
        return Map.of("status", "code_sent");
    }

    @PostMapping("/customer/history/verify")
    public OperationsDtos.CustomerHistoryResponse verifyHistory(
            @Valid @RequestBody OperationsDtos.CustomerHistoryVerifyRequest request
    ) {
        return customerEngagementService.verifyHistory(request);
    }

    @GetMapping("/customer/history")
    public OperationsDtos.CustomerHistoryResponse listHistory(
            @RequestHeader("X-Customer-Session") String sessionToken
    ) {
        return customerEngagementService.listHistory(sessionToken);
    }
}
