package com.scanny.service;

import com.scanny.dto.OperationsDtos;
import com.scanny.entity.Order;
import com.scanny.exception.ApiException;
import com.scanny.repository.OrderRepository;
import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PrintReceiptService {

    private static final DateTimeFormatter TIME_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm").withZone(ZoneId.systemDefault());

    private final OrderRepository orderRepository;

    public PrintReceiptService(OrderRepository orderRepository) {
        this.orderRepository = orderRepository;
    }

    @Transactional(readOnly = true)
    public OperationsDtos.PrintReceiptResponse printOrder(String businessId, String orderId) {
        Order order = orderRepository.findWithItemsById(orderId)
                .orElseThrow(() -> new ApiException(404, "Order was not found."));
        if (!order.getBusiness().getId().equals(businessId)) {
            throw new ApiException(404, "Order was not found.");
        }

        List<OperationsDtos.PrintReceiptResponse.PrintLineItem> lines = order.getItems().stream()
                .map(item -> new OperationsDtos.PrintReceiptResponse.PrintLineItem(
                        item.getName(),
                        item.getQuantity(),
                        item.getLineTotal()
                ))
                .toList();

        String receiptNumber = "RCPT-" + order.getId();
        String escPos = buildEscPos(
                order.getBusinessName(),
                receiptNumber,
                order.getId(),
                order.getCustomerName(),
                order.getCustomerLocation(),
                TIME_FMT.format(order.getCreatedAt()),
                lines,
                order.getTotal()
        );

        return new OperationsDtos.PrintReceiptResponse(
                receiptNumber,
                order.getBusinessName(),
                order.getId(),
                order.getCreatedAt(),
                order.getTotal(),
                lines,
                order.getCustomerName(),
                order.getCustomerLocation(),
                Base64.getEncoder().encodeToString(escPos.getBytes(StandardCharsets.ISO_8859_1))
        );
    }

    /** Minimal ESC/POS text receipt (initialize + align + cut). */
    static String buildEscPos(
            String businessName,
            String receiptNumber,
            String orderId,
            String customerName,
            String location,
            String createdAt,
            List<OperationsDtos.PrintReceiptResponse.PrintLineItem> items,
            int total
    ) {
        StringBuilder sb = new StringBuilder();
        sb.append((char) 0x1B).append('@'); // init
        sb.append((char) 0x1B).append('a').append((char) 1); // center
        sb.append(safe(businessName)).append('\n');
        sb.append(safe(receiptNumber)).append('\n');
        sb.append((char) 0x1B).append('a').append((char) 0); // left
        sb.append("Order: ").append(safe(orderId)).append('\n');
        sb.append("Time: ").append(safe(createdAt)).append('\n');
        if (customerName != null && !customerName.isBlank()) {
            sb.append("Guest: ").append(safe(customerName)).append('\n');
        }
        if (location != null && !location.isBlank()) {
            sb.append("Table: ").append(safe(location)).append('\n');
        }
        sb.append("-------------------------------\n");
        for (var item : items) {
            String left = item.quantity() + "x " + safe(item.name());
            String right = String.valueOf(item.lineTotal());
            sb.append(padLine(left, right, 32)).append('\n');
        }
        sb.append("-------------------------------\n");
        sb.append(padLine("TOTAL", String.valueOf(total), 32)).append('\n');
        sb.append('\n').append('\n');
        sb.append((char) 0x1D).append('V').append((char) 0); // full cut
        return sb.toString();
    }

    private static String padLine(String left, String right, int width) {
        String l = left.length() > width - right.length() - 1
                ? left.substring(0, Math.max(1, width - right.length() - 1))
                : left;
        int spaces = Math.max(1, width - l.length() - right.length());
        return l + " ".repeat(spaces) + right;
    }

    private static String safe(String value) {
        if (value == null) {
            return "";
        }
        return value.replace('\n', ' ').replace('\r', ' ');
    }
}
