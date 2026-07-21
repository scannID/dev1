package com.scanny.config;

import com.scanny.entity.Business;
import com.scanny.entity.CatalogItem;
import com.scanny.entity.Order;
import com.scanny.entity.OrderLineItem;
import com.scanny.model.enums.BusinessType;
import com.scanny.util.CatalogCategories;
import com.scanny.model.enums.OrderStatus;
import com.scanny.model.enums.PaymentStatus;
import com.scanny.repository.BusinessRepository;
import com.scanny.repository.OrderRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds demo merchants and completed orders for local H2 dev (Flyway disabled on h2 profile).
 */
@Component
@Profile("h2")
@org.springframework.core.annotation.Order(0)
public class DevDemoDataRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DevDemoDataRunner.class);

    private final BusinessRepository businessRepository;
    private final OrderRepository orderRepository;

    public DevDemoDataRunner(BusinessRepository businessRepository, OrderRepository orderRepository) {
        this.businessRepository = businessRepository;
        this.orderRepository = orderRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        boolean hasCompletedOrders = orderRepository.findAll().stream()
            .anyMatch(order -> order.getStatus() == OrderStatus.Completed);
        if (hasCompletedOrders) {
            return;
        }

        Business kampala = ensureBusiness(
            "kampala-grill",
            "MER-KGL-1001",
            "SIT-KGL-1001",
            "Kampala Grill",
            "James Okello",
            BusinessType.Restaurant,
            "Table or area",
            "PAY-KGL-1001",
            "#2563eb",
            List.of(
                item("beef-plate", "Beef Plate", "Meals", 18000),
                item("chicken-wrap", "Chicken Wrap", "Meals", 14500),
                item("passion-juice", "Passion Juice", "Drinks", 6000)
            )
        );

        Business cityLounge = ensureBusiness(
            "city-lounge",
            "MER-CLG-1002",
            "SIT-CLG-1002",
            "City Lounge",
            "Sarah Nambi",
            BusinessType.Bar,
            "Seat or area",
            "PAY-CLG-1002",
            "#7c3aed",
            List.of(
                item("mocktail", "House Mocktail", "Drinks", 12000),
                item("wings", "Spicy Wings", "Bites", 22000),
                item("vip-ticket", "Friday VIP Ticket", "Tickets", 30000)
            )
        );

        seedCompletedOrder("demo-ord-001", kampala, "Amina K.", 18000, 2, List.of(line("beef-plate", "Beef Plate", 18000, 1)));
        seedCompletedOrder("demo-ord-002", kampala, "Brian M.", 20500, 5, List.of(
            line("chicken-wrap", "Chicken Wrap", 14500, 1),
            line("passion-juice", "Passion Juice", 6000, 1)
        ));
        seedCompletedOrder("demo-ord-003", kampala, "Carol W.", 36000, 8, List.of(line("beef-plate", "Beef Plate", 18000, 2)));
        seedCompletedOrder("demo-ord-004", kampala, "David O.", 14500, 12, List.of(line("chicken-wrap", "Chicken Wrap", 14500, 1)));
        seedCompletedOrder("demo-ord-005", kampala, "Esther N.", 24000, 18, List.of(
            line("beef-plate", "Beef Plate", 18000, 1),
            line("passion-juice", "Passion Juice", 6000, 1)
        ));
        seedCompletedOrder("demo-ord-006", kampala, "Frank T.", 18000, 24, List.of(line("beef-plate", "Beef Plate", 18000, 1)));
        seedCompletedOrder("demo-ord-007", kampala, "Grace L.", 29000, 3, List.of(
            line("chicken-wrap", "Chicken Wrap", 14500, 2)
        ));
        seedCompletedOrder("demo-ord-008", kampala, "Henry P.", 6000, 6, List.of(line("passion-juice", "Passion Juice", 6000, 1)));
        seedCompletedOrder("demo-ord-009", kampala, "Irene S.", 32500, 15, List.of(
            line("beef-plate", "Beef Plate", 18000, 1),
            line("chicken-wrap", "Chicken Wrap", 14500, 1)
        ));
        seedCompletedOrder("demo-ord-010", kampala, "Joel R.", 18000, 20, List.of(line("beef-plate", "Beef Plate", 18000, 1)));

        seedCompletedOrder("demo-ord-011", cityLounge, "Kevin A.", 22000, 4, List.of(line("wings", "Spicy Wings", 22000, 1)));
        seedCompletedOrder("demo-ord-012", cityLounge, "Lydia B.", 30000, 10, List.of(line("vip-ticket", "Friday VIP Ticket", 30000, 1)));
        seedCompletedOrder("demo-ord-013", cityLounge, "Martin C.", 34000, 16, List.of(
            line("mocktail", "House Mocktail", 12000, 1),
            line("wings", "Spicy Wings", 22000, 1)
        ));
        seedCompletedOrder("demo-ord-014", cityLounge, "Nora D.", 12000, 22, List.of(line("mocktail", "House Mocktail", 12000, 1)));
        seedCompletedOrder("demo-ord-015", cityLounge, "Oscar E.", 52000, 7, List.of(
            line("vip-ticket", "Friday VIP Ticket", 30000, 1),
            line("mocktail", "House Mocktail", 12000, 1),
            line("wings", "Spicy Wings", 22000, 1)
        ));
        seedCompletedOrder("demo-ord-016", cityLounge, "Patricia F.", 22000, 14, List.of(line("wings", "Spicy Wings", 22000, 1)));
        seedCompletedOrder("demo-ord-017", cityLounge, "Quincy G.", 12000, 1, List.of(line("mocktail", "House Mocktail", 12000, 1)));

        log.info("Seeded {} demo completed orders for local admin dashboard", 17);
    }

    private Business ensureBusiness(
        String id,
        String merchantId,
        String qrToken,
        String name,
        String ownerName,
        BusinessType type,
        String tableLabel,
        String paymentReference,
        String accent,
        List<CatalogItem> catalog
    ) {
        Business business = businessRepository.findById(id).orElseGet(Business::new);
        boolean isNew = business.getId() == null;
        if (isNew) {
            business.setId(id);
            business.setCreatedAt(Instant.now().minus(45, ChronoUnit.DAYS));
        }
        business.setMerchantId(merchantId);
        business.setQrToken(qrToken);
        business.setName(name);
        business.setOwnerName(ownerName);
        business.setType(type);
        business.setTableLabel(tableLabel);
        business.setPaymentReference(paymentReference);
        business.setAccent(accent);

        if (business.getCustomCategories() == null || business.getCustomCategories().isEmpty()) {
            business.setCustomCategories(new ArrayList<>(CatalogCategories.defaultNames(type)));
            for (CatalogItem catalogItem : catalog) {
                business.addCustomCategory(catalogItem.getCategory());
            }
        }

        if (business.getItems().isEmpty()) {
            for (CatalogItem catalogItem : catalog) {
                catalogItem.setBusiness(business);
                business.getItems().add(catalogItem);
            }
        }

        return businessRepository.save(business);
    }

    private void seedCompletedOrder(
        String id,
        Business business,
        String customerName,
        int total,
        int daysAgo,
        List<OrderLineItem> lines
    ) {
        if (orderRepository.existsById(id)) {
            return;
        }

        Order order = new Order();
        order.setId(id);
        order.setPublicId(UUID.randomUUID());
        order.setBusiness(business);
        order.setMerchantId(business.getMerchantId());
        order.setQrToken(business.getQrToken());
        order.setPaymentReference(business.getPaymentReference());
        order.setBusinessName(business.getName());
        order.setCustomerName(customerName);
        order.setCustomerPhone("+256700000000");
        order.setTotal(total);
        order.setStatus(OrderStatus.Completed);
        order.setPaymentStatus(PaymentStatus.Paid);
        order.setCreatedAt(Instant.now().minus(daysAgo, ChronoUnit.DAYS));
        order.setUpdatedAt(order.getCreatedAt().plus(1, ChronoUnit.HOURS));
        lines.forEach(order::addItem);
        orderRepository.save(order);
    }

    private static CatalogItem item(String id, String name, String category, int price) {
        CatalogItem catalogItem = new CatalogItem();
        catalogItem.setId(id);
        catalogItem.setName(name);
        catalogItem.setCategory(category);
        catalogItem.setPrice(price);
        catalogItem.setDescription("");
        catalogItem.setAvailable(true);
        return catalogItem;
    }

    private static OrderLineItem line(String itemId, String name, int price, int quantity) {
        OrderLineItem line = new OrderLineItem();
        line.setItemId(itemId);
        line.setName(name);
        line.setPrice(price);
        line.setQuantity(quantity);
        line.setLineTotal(price * quantity);
        return line;
    }
}
