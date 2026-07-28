package com.scanny.service;

import com.scanny.entity.Business;
import com.scanny.entity.Order;
import com.scanny.model.enums.OrderStatus;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.OrderRepository;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class DailyDigestScheduler {

    private static final Logger log = LoggerFactory.getLogger(DailyDigestScheduler.class);

    private final BusinessRepository businessRepository;
    private final OrderRepository orderRepository;
    private final WhatsAppNotificationService whatsAppNotificationService;

    public DailyDigestScheduler(
            BusinessRepository businessRepository,
            OrderRepository orderRepository,
            WhatsAppNotificationService whatsAppNotificationService
    ) {
        this.businessRepository = businessRepository;
        this.orderRepository = orderRepository;
        this.whatsAppNotificationService = whatsAppNotificationService;
    }

    @Scheduled(cron = "${scanny.digest.cron:0 0 21 * * *}")
    @Transactional(readOnly = true)
    public void sendDailyDigests() {
        Instant start = Instant.now().minus(1, ChronoUnit.DAYS);
        for (Business business : businessRepository.findAll()) {
            if (!business.isDailyDigestEnabled()) {
                continue;
            }
            List<Order> orders = orderRepository.findByBusinessIdOrderByCreatedAtDesc(business.getId()).stream()
                    .filter(order -> order.getCreatedAt().isAfter(start))
                    .toList();
            if (orders.isEmpty()) {
                continue;
            }
            long completed = orders.stream().filter(o -> o.getStatus() == OrderStatus.Completed).count();
            int revenue = orders.stream()
                    .filter(o -> o.getStatus() != OrderStatus.Cancelled)
                    .mapToInt(Order::getTotal)
                    .sum();
            String message = business.getName() + " daily summary (" + start.atZone(ZoneOffset.UTC).toLocalDate() + "): "
                    + orders.size() + " orders, " + completed + " completed, revenue UGX " + revenue + ".";

            if ("whatsapp".equalsIgnoreCase(business.getDailyDigestChannel())) {
                String phone = business.getWhatsappBusinessPhone();
                if (phone != null && !phone.isBlank()) {
                    whatsAppNotificationService.sendText(phone, message);
                }
            } else {
                log.info("Daily digest email for {} -> {}: {}", business.getId(), business.getDailyDigestEmail(), message);
            }
        }
    }
}
