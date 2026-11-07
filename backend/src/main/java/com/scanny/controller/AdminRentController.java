package com.scanny.controller;

import com.scanny.dto.RentDtos;
import com.scanny.entity.RentProperty;
import com.scanny.entity.RentTenant;
import com.scanny.entity.RentUnit;
import com.scanny.repository.RentChargeRepository;
import com.scanny.repository.RentPaymentRepository;
import com.scanny.repository.RentPropertyRepository;
import com.scanny.repository.RentTenantRepository;
import com.scanny.repository.RentUnitRepository;
import com.scanny.service.RentPropertyService;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.transaction.annotation.Transactional;

/**
 * Admin-console endpoints for the rent/property management module.
 *
 * <p>All paths are under {@code /api/admin/rent/**} which is secured by the
 * Spring SecurityConfig requiring {@code SCOPE_admin} or an admin JWT role.
 *
 * <p>Admins can:
 * <ul>
 *   <li>List all properties across all managers</li>
 *   <li>View detailed stats per property</li>
 *   <li>Update fee configuration (platform fee override, late fee)</li>
 *   <li>See platform-wide rent totals</li>
 * </ul>
 */
@RestController
@RequestMapping("/api/admin/rent")
public class AdminRentController {

    private final RentPropertyRepository propertyRepository;
    private final RentTenantRepository tenantRepository;
    private final RentChargeRepository chargeRepository;
    private final RentUnitRepository unitRepository;
    private final RentPropertyService propertyService;
    private final RentPaymentRepository paymentRepository;

    @Value("${scanny.customer-url:https://scanny.app}")
    private String customerUrl;

    public AdminRentController(
            RentPropertyRepository propertyRepository,
            RentTenantRepository tenantRepository,
            RentChargeRepository chargeRepository,
            RentUnitRepository unitRepository,
            RentPropertyService propertyService,
            RentPaymentRepository paymentRepository) {
        this.propertyRepository = propertyRepository;
        this.tenantRepository   = tenantRepository;
        this.chargeRepository   = chargeRepository;
        this.unitRepository     = unitRepository;
        this.propertyService    = propertyService;
        this.paymentRepository  = paymentRepository;
    }

    // ── Accounting summary ────────────────────────────────────────────────────

    @GetMapping("/accounting")
    @Transactional(readOnly = true)
    public RentAccountingSummary getAccountingSummary() {
        String currentPeriod = java.time.YearMonth.now().toString();
        String prevPeriod    = java.time.YearMonth.now().minusMonths(1).toString();

        long totalCollectedAllTime = paymentRepository.sumCollectedAllTime();
        long collectedThisMonth    = paymentRepository.sumCollectedAllPropertiesForPeriod(currentPeriod);
        long collectedLastMonth    = paymentRepository.sumCollectedAllPropertiesForPeriod(prevPeriod);
        long totalPayments         = paymentRepository.countByStatus(com.scanny.model.enums.RentPaymentStatus.Completed);
        long overdueCharges        = chargeRepository.countByStatus(com.scanny.model.enums.RentChargeStatus.OVERDUE);
        long unpaidCharges         = chargeRepository.countByStatus(com.scanny.model.enums.RentChargeStatus.UNPAID);
        long totalProperties       = propertyRepository.count();
        long activeTenants         = tenantRepository.countByActiveTrue();

        List<PropertyRevenue> perProperty = paymentRepository.sumCollectedPerProperty().stream()
            .map(r -> new PropertyRevenue((String) r[0], (String) r[1], (Long) r[2]))
            .toList();

        return new RentAccountingSummary(
            totalCollectedAllTime, collectedThisMonth, collectedLastMonth,
            totalPayments, overdueCharges, unpaidCharges,
            totalProperties, activeTenants, currentPeriod, perProperty);
    }

    public record PropertyRevenue(String propertyId, String propertyName, long totalCollected) {}

    public record RentAccountingSummary(
        long totalCollectedAllTime,
        long collectedThisMonth,
        long collectedLastMonth,
        long totalPayments,
        long overdueCharges,
        long unpaidCharges,
        long totalProperties,
        long activeTenants,
        String currentPeriod,
        List<PropertyRevenue> perPropertyRevenue
    ) {}

    // ── Platform summary ──────────────────────────────────────────────────────

    /**
     * Returns high-level platform-wide rent stats for the admin overview cards.
     */
    @GetMapping("/summary")
    @Transactional(readOnly = true)
    public AdminRentSummary getSummary() {
        long totalProperties = propertyRepository.count();
        long totalTenants    = tenantRepository.countByActiveTrue();
        long totalUnits      = unitRepository.count();
        long overdueCharges  = chargeRepository.countByStatus(
                com.scanny.model.enums.RentChargeStatus.OVERDUE);
        return new AdminRentSummary(totalProperties, totalTenants, totalUnits, overdueCharges);
    }

    public record AdminRentSummary(
            long totalProperties,
            long activeTenants,
            long totalUnits,
            long overdueCharges
    ) {}

    // ── Properties list ───────────────────────────────────────────────────────

    /**
     * Paginated list of all properties across all managers.
     * Supports optional {@code search} filter on property name or city.
     */
    @GetMapping("/properties")
    @Transactional(readOnly = true)
    public AdminPropertiesResponse listProperties(
            @RequestParam(defaultValue = "1")  int page,
            @RequestParam(defaultValue = "25") int limit,
            @RequestParam(required = false)    String search) {

        int pageIndex = Math.max(0, page - 1);
        int pageSize  = Math.min(100, Math.max(1, limit));

        List<RentProperty> all = propertyRepository
                .findAllWithUnitsForAdmin();

        // Simple in-memory filter — property table is not expected to be huge
        List<RentProperty> filtered = (search == null || search.isBlank())
                ? all
                : all.stream()
                    .filter(p -> p.getName().toLowerCase().contains(search.toLowerCase())
                              || p.getCity().toLowerCase().contains(search.toLowerCase())
                              || p.getOwnerName().toLowerCase().contains(search.toLowerCase()))
                    .toList();

        int total = filtered.size();
        int fromIdx = pageIndex * pageSize;
        int toIdx   = Math.min(fromIdx + pageSize, total);

        List<AdminPropertyRow> rows = (fromIdx >= total)
                ? List.of()
                : filtered.subList(fromIdx, toIdx).stream()
                    .map(this::toAdminRow)
                    .toList();

        return new AdminPropertiesResponse(rows, total, page, pageSize);
    }

    public record AdminPropertiesResponse(
            List<AdminPropertyRow> properties,
            int total,
            int page,
            int limit
    ) {}

    public record AdminPropertyRow(
            String id,
            String name,
            String city,
            String ownerName,
            String ownerMomo,
            String currency,
            String lateFeeType,
            long lateFeeAmount,
            long platformFeeOverride,
            int unitCount,
            int activeTenantCount,
            long overdueCount,
            Instant createdAt
    ) {}

    private AdminPropertyRow toAdminRow(RentProperty p) {
        int units  = p.getUnits() != null ? p.getUnits().size() : 0;
        int active = p.getUnits() != null
                ? (int) p.getUnits().stream().filter(u -> u.getActiveTenant() != null).count()
                : 0;
        long overdue = chargeRepository.countOverdueByPropertyId(p.getId());
        return new AdminPropertyRow(
                p.getId(), p.getName(), p.getCity(),
                p.getOwnerName(), p.getOwnerMomo(), p.getCurrency(),
                p.getLateFeeType(), p.getLateFeeAmount(), p.getPlatformFeeOverride(),
                units, active, overdue, p.getCreatedAt());
    }

    // ── Per-property detail ───────────────────────────────────────────────────

    /**
     * Returns the full dashboard DTO for a single property.
     * Proxies to {@link RentPropertyService#getPropertyDashboard} but bypasses
     * the account-level access check (admin sees everything).
     */
    @GetMapping("/properties/{propertyId}")
    @Transactional(readOnly = true)
    public AdminPropertyDetail getProperty(@PathVariable String propertyId) {
        RentProperty property = propertyRepository.findByIdWithUnitsAndTenantsForAdmin(propertyId)
                .orElseThrow(() -> new com.scanny.exception.ApiException(404, "Property not found"));

        List<RentUnit> units = property.getUnits();
        int totalUnits    = units != null ? units.size() : 0;
        int occupiedUnits = units != null
                ? (int) units.stream().filter(u -> u.getActiveTenant() != null).count()
                : 0;
        long overdueCount = chargeRepository.countOverdueByPropertyId(propertyId);

        List<AdminTenantRow> tenants = (units == null) ? List.of()
                : units.stream()
                    .filter(u -> u.getActiveTenant() != null)
                    .map(u -> {
                        RentTenant t = u.getActiveTenant();
                        return new AdminTenantRow(
                                t.getId(), t.getName(), t.getPhone(), t.getEmail(),
                                u.getUnitNumber(), u.getMonthlyAmount(),
                                t.getMoveInDate() != null ? t.getMoveInDate().toString() : null,
                                t.getLeaseEnd()   != null ? t.getLeaseEnd().toString()   : null,
                                t.isActive());
                    })
                    .toList();

        return new AdminPropertyDetail(
                RentDtos.PropertyResponse.from(property, customerUrl),
                totalUnits, occupiedUnits, overdueCount, tenants);
    }

    public record AdminPropertyDetail(
            RentDtos.PropertyResponse property,
            int totalUnits,
            int occupiedUnits,
            long overdueCount,
            List<AdminTenantRow> tenants
    ) {}

    public record AdminTenantRow(
            String id,
            String name,
            String phone,
            String email,
            String unitNumber,
            long monthlyAmount,
            String moveInDate,
            String leaseEnd,
            boolean active
    ) {}

    // ── Fee configuration ─────────────────────────────────────────────────────

    /**
     * Admin updates the fee settings for a specific property.
     * Does not require the property manager's account — admin access only.
     */
    @PostMapping("/properties/{propertyId}/fees")
    @ResponseStatus(HttpStatus.OK)
    @Transactional
    public RentDtos.PropertyResponse updatePropertyFees(
            @PathVariable String propertyId,
            @Valid @RequestBody UpdateFeesRequest req) {

        RentProperty property = propertyRepository.findById(propertyId)
                .orElseThrow(() -> new com.scanny.exception.ApiException(404, "Property not found"));

        if (req.lateFeeType() != null) {
            String type = req.lateFeeType().toUpperCase();
            if (!type.equals("NONE") && !type.equals("FLAT") && !type.equals("PERCENT")) {
                throw new com.scanny.exception.ApiException(400,
                        "lateFeeType must be NONE, FLAT, or PERCENT");
            }
            property.setLateFeeType(type);
        }
        if (req.lateFeeAmount() != null)       property.setLateFeeAmount(req.lateFeeAmount());
        if (req.platformFeeOverride() != null)  property.setPlatformFeeOverride(req.platformFeeOverride());

        property.setUpdatedAt(Instant.now());
        return RentDtos.PropertyResponse.from(propertyRepository.save(property), customerUrl);
    }

    public record UpdateFeesRequest(
            /** NONE | FLAT | PERCENT */
            String lateFeeType,
            /** Flat UGX amount or percentage × 100 (500 = 5.00%). */
            Long lateFeeAmount,
            /** Per-property platform fee override in UGX. 0 = use platform default. */
            Long platformFeeOverride
    ) {}
}
