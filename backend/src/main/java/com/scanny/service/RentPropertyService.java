package com.scanny.service;

import com.scanny.dto.RentDtos;
import com.scanny.entity.RentAccount;
import com.scanny.entity.RentCharge;
import com.scanny.entity.RentProperty;
import com.scanny.entity.RentPropertyAccess;
import com.scanny.entity.RentTenant;
import com.scanny.entity.RentUnit;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.PropertyAccessRole;
import com.scanny.model.enums.RentChargeStatus;
import com.scanny.repository.RentChargeRepository;
import com.scanny.repository.RentPaymentRepository;
import com.scanny.repository.RentPropertyAccessRepository;
import com.scanny.repository.RentPropertyRepository;
import com.scanny.repository.RentTenantRepository;
import com.scanny.repository.RentUnitRepository;
import com.scanny.service.LeaseService;
import com.scanny.util.PhoneNormalizer;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Base64;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages property portfolio operations: creating properties, adding units
 * and tenants, granting access, and fetching portfolio/unit data.
 */
@Service
public class RentPropertyService {

    private final RentPropertyRepository propertyRepository;
    private final RentPropertyAccessRepository accessRepository;
    private final RentUnitRepository unitRepository;
    private final RentTenantRepository tenantRepository;
    private final RentChargeRepository chargeRepository;
    private final RentPaymentRepository paymentRepository;
    private final RentAccountService accountService;
    private final AuditService auditService;
    private final LeaseService leaseService;

    @Value("${scanny.customer-url}")
    private String customerUrl;

    public RentPropertyService(
            RentPropertyRepository propertyRepository,
            RentPropertyAccessRepository accessRepository,
            RentUnitRepository unitRepository,
            RentTenantRepository tenantRepository,
            RentChargeRepository chargeRepository,
            RentPaymentRepository paymentRepository,
            RentAccountService accountService,
            AuditService auditService,
            LeaseService leaseService) {
        this.propertyRepository = propertyRepository;
        this.accessRepository = accessRepository;
        this.unitRepository = unitRepository;
        this.tenantRepository = tenantRepository;
        this.chargeRepository = chargeRepository;
        this.paymentRepository = paymentRepository;
        this.accountService = accountService;
        this.auditService = auditService;
        this.leaseService = leaseService;
    }

    // ── Property CRUD ─────────────────────────────────────────────────────────

    /**
     * Creates a property and immediately grants the creating account
     * {@code OWNER_MANAGER} access (self-managed default).
     * If {@code ownerEmail} is provided and differs from the creating account's
     * email, an {@code OWNER} access row is also created for that account.
     */
    @Transactional
    public RentDtos.PropertyResponse createProperty(
            RentAccount creator,
            RentDtos.CreatePropertyRequest req) {

        RentProperty property = new RentProperty();
        property.setId(generatePropertyId());
        property.setName(req.name().trim());
        property.setAddress(req.address() != null ? req.address().trim() : "");
        property.setCity(req.city() != null ? req.city().trim() : "");
        property.setOwnerName(req.ownerName().trim());
        property.setOwnerMomo(PhoneNormalizer.normalize(req.ownerMomo().trim()));
        property.setCurrency(req.currency() != null && !req.currency().isBlank()
                ? req.currency().trim() : "UGX");
        property.setTimezone(req.timezone() != null && !req.timezone().isBlank()
                ? req.timezone().trim() : "Africa/Kampala");
        property.setPartialPaymentAllowed(
                req.partialPaymentAllowed() == null || req.partialPaymentAllowed());
        property.setMinPaymentAmount(
                req.minPaymentAmount() != null ? req.minPaymentAmount() : 0);
        property.setQrToken(generateQrToken());
        property.setCreatedAt(Instant.now());
        property.setCreatedBy(creator.getEmail());

        // If an owner email is provided, link or create that owner account
        if (req.ownerEmail() != null && !req.ownerEmail().isBlank()) {
            String ownerEmail = req.ownerEmail().trim().toLowerCase(Locale.ROOT);
            if (!ownerEmail.equals(creator.getEmail())) {
                RentAccount ownerAccount = accountService.findOrCreateByEmail(ownerEmail);
                property.setOwnerAccount(ownerAccount);
            } else {
                property.setOwnerAccount(creator);
            }
        }

        property = propertyRepository.save(property);

        // Creating account always gets OWNER_MANAGER (or MANAGER if owner is someone else)
        PropertyAccessRole creatorRole = (property.getOwnerAccount() == null
                || property.getOwnerAccount().getId().equals(creator.getId()))
                ? PropertyAccessRole.OWNER_MANAGER
                : PropertyAccessRole.MANAGER;
        grantAccess(creator, property, creatorRole, creator);

        // If owner account differs from creator, grant them OWNER access
        if (property.getOwnerAccount() != null
                && !property.getOwnerAccount().getId().equals(creator.getId())) {
            grantAccess(property.getOwnerAccount(), property, PropertyAccessRole.OWNER, creator);
        }

        auditService.success("RENT_PROPERTY_CREATED", "rent_property", property.getId(),
                Map.of("name", property.getName(), "createdBy", creator.getEmail()));

        return RentDtos.PropertyResponse.from(property, customerUrl);
    }

    @Transactional(readOnly = true)
    public RentProperty requireProperty(String propertyId) {
        return propertyRepository.findById(propertyId)
                .orElseThrow(() -> new ApiException(404, "Property not found: " + propertyId));
    }

    @Transactional(readOnly = true)
    public RentProperty requirePropertyByToken(String qrToken) {
        return propertyRepository.findByQrToken(qrToken)
                .orElseThrow(() -> new ApiException(404, "QR code not found"));
    }

    @Transactional
    public RentDtos.PropertyResponse updateProperty(
            RentAccount account, String propertyId, RentDtos.UpdatePropertyRequest req) {

        RentProperty property = requireProperty(propertyId);
        requireManagerAccess(account, property);

        if (req.name() != null && !req.name().isBlank())         property.setName(req.name().trim());
        if (req.address() != null)                                property.setAddress(req.address().trim());
        if (req.city() != null)                                   property.setCity(req.city().trim());
        if (req.ownerName() != null && !req.ownerName().isBlank()) property.setOwnerName(req.ownerName().trim());
        if (req.ownerMomo() != null && !req.ownerMomo().isBlank()) property.setOwnerMomo(PhoneNormalizer.normalize(req.ownerMomo().trim()));
        if (req.currency() != null && !req.currency().isBlank())  property.setCurrency(req.currency().trim());
        if (req.timezone() != null && !req.timezone().isBlank())  property.setTimezone(req.timezone().trim());
        if (req.partialPaymentAllowed() != null)                   property.setPartialPaymentAllowed(req.partialPaymentAllowed());
        if (req.minPaymentAmount() != null)                        property.setMinPaymentAmount(req.minPaymentAmount());

        property.setUpdatedAt(Instant.now());
        RentDtos.PropertyResponse result = RentDtos.PropertyResponse.from(
                propertyRepository.save(property), customerUrl);
        auditService.success("RENT_PROPERTY_UPDATED", "rent_property", propertyId,
                Map.of("by", account.getEmail()));
        return result;
    }

    // ── Property dashboard ────────────────────────────────────────────────────

    /**
     * Assembles the full property dashboard DTO inside one read transaction.
     * Required because {@code spring.jpa.open-in-view=false} — lazy collections
     * (units/tenants/payments) must be touched before the session closes.
     */
    @Transactional(readOnly = true)
    public RentDtos.PropertyDashboard getPropertyDashboard(
            RentAccount account, String propertyId, String period) {

        RentProperty property = requireProperty(propertyId);
        requireAnyAccess(account, property);

        String currentPeriod = period != null && !period.isBlank()
                ? period.trim()
                : YearMonth.now().toString();

        List<RentUnit> units = unitRepository.findByPropertyIdWithTenants(propertyId).stream()
                .sorted(Comparator.comparing(RentUnit::getUnitNumber, String.CASE_INSENSITIVE_ORDER))
                .toList();
        List<RentCharge> periodCharges = chargeRepository.findByPropertyIdAndPeriodLabelForDashboard(
                propertyId, currentPeriod);

        Map<String, RentCharge> chargeByUnitId = periodCharges.stream()
                .collect(Collectors.toMap(
                        c -> c.getUnit().getId(),
                        Function.identity(),
                        (a, b) -> a));

        List<RentDtos.UnitDashboardRow> rows = units.stream().map(u -> {
            RentCharge charge = chargeByUnitId.get(u.getId());
            return new RentDtos.UnitDashboardRow(
                    RentDtos.UnitResponse.from(u, customerUrl),
                    charge != null ? RentDtos.ChargeResponse.from(charge) : null);
        }).toList();

        long totalUnits = units.size();
        long occupied = units.stream().filter(u -> u.getActiveTenant() != null).count();
        long paid = periodCharges.stream().filter(c -> c.getStatus() == RentChargeStatus.PAID).count();
        long unpaid = periodCharges.stream()
                .filter(c -> c.getStatus() == RentChargeStatus.UNPAID || c.getStatus() == RentChargeStatus.PARTIAL)
                .count();
        long overdueCount = chargeRepository.countOverdueByPropertyId(propertyId, LocalDate.now());
        long totalCollected = paymentRepository.sumCollectedByPropertyIdAndPeriod(propertyId, currentPeriod);

        List<RentDtos.PaymentSummary> recentPayments = paymentRepository
                .findRecentCompletedByPropertyId(propertyId, PageRequest.of(0, 20))
                .stream().map(RentDtos.PaymentSummary::from).toList();

        List<RentDtos.PropertyAccessResponse> accessList = listAccess(propertyId);

        // Prefer already-fetched unit counts so PropertyResponse does not touch a lazy collection.
        return new RentDtos.PropertyDashboard(
                new RentDtos.PropertyResponse(
                        property.getId(), property.getName(), property.getAddress(), property.getCity(),
                        property.getOwnerName(), property.getOwnerMomo(), property.getCurrency(),
                        property.getTimezone(), property.isPartialPaymentAllowed(), property.getMinPaymentAmount(),
                        property.getQrToken(),
                        customerUrl + "/rent/pay/" + property.getQrToken(),
                        (int) totalUnits, (int) occupied, property.getCreatedAt()),
                currentPeriod, totalUnits, occupied,
                paid, unpaid, overdueCount, totalCollected,
                rows, recentPayments, accessList);
    }

    // ── Portfolio ─────────────────────────────────────────────────────────────

    /**
     * Returns the portfolio for an account in 2 DB round-trips regardless of
     * how many properties the account has:
     * <ol>
     *   <li>One aggregation query for unit counts + role per property.</li>
     *   <li>One aggregation query for occupied (active-tenant) counts across all properties.</li>
     * </ol>
     * Previously this was O(N) queries (one per property) due to per-property
     * unit list + access role lookups.
     */
    @Transactional(readOnly = true)
    public List<RentDtos.PortfolioEntry> getPortfolio(RentAccount account) {
        List<com.scanny.repository.projection.PortfolioSummaryProjection> summaries =
                propertyRepository.findPortfolioSummary(account.getId());
        if (summaries.isEmpty()) return List.of();

        // Build a map of propertyId → occupiedCount in one query
        Map<String, Long> occupancy = propertyRepository.findOccupancyByAccountId(account.getId())
                .stream()
                .collect(Collectors.toMap(
                        com.scanny.repository.projection.PropertyOccupancyProjection::getPropertyId,
                        com.scanny.repository.projection.PropertyOccupancyProjection::getOccupiedCount));

        return summaries.stream().map(s -> new RentDtos.PortfolioEntry(
                s.getPropertyId(),
                s.getPropertyName(),
                s.getCity(),
                s.getRole().name(),
                (int) s.getTotalUnits(),
                occupancy.getOrDefault(s.getPropertyId(), 0L).intValue(),
                0,     // overdueCount — not included in portfolio for perf; shown in the full dashboard
                0L,    // totalCollectedThisMonth — fetched on demand in the full dashboard
                s.getCurrency()
        )).toList();
    }

    // ── Access management ─────────────────────────────────────────────────────

    /**
     * Grants (or updates) an account's access to a property.
     * Requires that the requesting account has MANAGER or OWNER_MANAGER role.
     */
    @Transactional
    public void grantAccessByEmail(
            RentAccount requestingAccount,
            String propertyId,
            RentDtos.GrantAccessRequest req) {

        RentProperty property = requireProperty(propertyId);
        requireManagerAccess(requestingAccount, property);

        PropertyAccessRole role = parseRole(req.role());
        RentAccount target = accountService.findOrCreateByEmail(req.email());
        grantAccess(target, property, role, requestingAccount);
        auditService.success("RENT_ACCESS_GRANTED", "rent_property_access", propertyId,
                Map.of("grantedTo", req.email(), "role", role.name(),
                       "by", requestingAccount.getEmail()));
    }

    private void grantAccess(
            RentAccount account,
            RentProperty property,
            PropertyAccessRole role,
            RentAccount grantedBy) {

        accessRepository.findByAccount_IdAndProperty_Id(account.getId(), property.getId())
                .ifPresentOrElse(existing -> {
                    existing.setRole(role);
                    accessRepository.save(existing);
                }, () -> {
                    RentPropertyAccess access = new RentPropertyAccess();
                    access.setAccount(account);
                    access.setProperty(property);
                    access.setRole(role);
                    access.setGrantedAt(Instant.now());
                    access.setGrantedBy(grantedBy);
                    accessRepository.save(access);
                });
    }

    @Transactional(readOnly = true)
    public List<RentDtos.PropertyAccessResponse> listAccess(String propertyId) {
        return accessRepository.findByProperty_Id(propertyId).stream()
                .map(RentDtos.PropertyAccessResponse::from)
                .toList();
    }

    // ── Units ─────────────────────────────────────────────────────────────────

    @Transactional
    public RentDtos.UnitResponse addUnit(
            RentAccount account, String propertyId, RentDtos.CreateUnitRequest req) {

        RentProperty property = requireProperty(propertyId);
        requireManagerAccess(account, property);

        if (unitRepository.existsByProperty_IdAndUnitNumber(propertyId, req.unitNumber().trim())) {
            throw new ApiException(409, "Unit '" + req.unitNumber() + "' already exists in this property");
        }

        RentUnit unit = new RentUnit();
        unit.setId(generateUnitId());
        unit.setProperty(property);
        unit.setUnitNumber(req.unitNumber().trim());
        unit.setFloor(req.floor() != null ? req.floor().trim() : "");
        unit.setMonthlyAmount(req.monthlyAmount());
        unit.setDepositAmount(Math.max(0, req.depositAmount()));
        // due-day: 1–28, default 5 if not provided
        if (req.dueDayOfMonth() != null) {
            unit.setDueDayOfMonth(req.dueDayOfMonth());
        }
        // grace period: >= 0, default 0
        if (req.gracePeriodDays() != null) {
            unit.setGracePeriodDays(req.gracePeriodDays());
        }
        // Auto-generate a unique 128-bit URL-safe QR token for this unit
        unit.setQrToken(generateUnitQrToken());
        unit.setCreatedAt(Instant.now());
        unit.setCreatedBy(account.getEmail());

        RentDtos.UnitResponse result = RentDtos.UnitResponse.from(unitRepository.save(unit), customerUrl);
        auditService.success("RENT_UNIT_ADDED", "rent_unit", unit.getId(),
                Map.of("propertyId", propertyId, "unitNumber", unit.getUnitNumber(),
                       "by", account.getEmail()));
        return result;
    }

    @Transactional
    public RentDtos.UnitResponse updateUnit(
            RentAccount account, String propertyId, String unitId, RentDtos.UpdateUnitRequest req) {

        RentProperty property = requireProperty(propertyId);
        requireManagerAccess(account, property);

        RentUnit unit = unitRepository.findById(unitId)
                .filter(u -> u.getProperty().getId().equals(propertyId))
                .orElseThrow(() -> new ApiException(404, "Unit not found"));

        if (req.unitNumber() != null && !req.unitNumber().isBlank()) {
            unit.setUnitNumber(req.unitNumber().trim());
        }
        if (req.floor() != null) unit.setFloor(req.floor().trim());
        if (req.monthlyAmount() != null && req.monthlyAmount() >= 0) {
            unit.setMonthlyAmount(req.monthlyAmount());
        }
        if (req.depositAmount() != null && req.depositAmount() >= 0) {
            unit.setDepositAmount(req.depositAmount());
        }
        if (req.dueDayOfMonth() != null) {
            unit.setDueDayOfMonth(req.dueDayOfMonth());
        }
        if (req.gracePeriodDays() != null) {
            unit.setGracePeriodDays(req.gracePeriodDays());
        }

        return RentDtos.UnitResponse.from(unitRepository.save(unit), customerUrl);
    }

    @Transactional(readOnly = true)
    public List<RentDtos.UnitResponse> listUnits(String propertyId) {
        return unitRepository.findByProperty_IdOrderByUnitNumberAsc(propertyId).stream()
                .map(u -> RentDtos.UnitResponse.from(u, customerUrl))
                .toList();
    }

    // ── Tenants ───────────────────────────────────────────────────────────────

    @Transactional
    public RentDtos.TenantSummary addTenant(
            RentAccount account, String propertyId, String unitId, RentDtos.CreateTenantRequest req) {

        RentProperty property = requireProperty(propertyId);
        requireManagerAccess(account, property);

        RentUnit unit = unitRepository.findById(unitId)
                .filter(u -> u.getProperty().getId().equals(propertyId))
                .orElseThrow(() -> new ApiException(404, "Unit not found"));

        // Deactivate any existing active tenant
        tenantRepository.findByUnit_IdAndActiveTrue(unitId).ifPresent(existing -> {
            existing.setActive(false);
            tenantRepository.save(existing);
        });

        // Resolve activation date: prefer req.activationDate, fall back to moveInDate, then today
        LocalDate activationDate;
        if (req.activationDate() != null && !req.activationDate().isBlank()) {
            activationDate = LocalDate.parse(req.activationDate());
        } else if (req.moveInDate() != null && !req.moveInDate().isBlank()) {
            activationDate = LocalDate.parse(req.moveInDate());
        } else {
            activationDate = LocalDate.now();
        }

        int termMonths = (req.termMonths() != null && req.termMonths() >= 1) ? req.termMonths() : 12;
        LocalDate computedLeaseEnd = com.scanny.entity.RentLease
                .clampedDatePlusMonths(activationDate, termMonths);

        RentTenant tenant = new RentTenant();
        tenant.setId(generateTenantId());
        tenant.setUnit(unit);
        tenant.setName(req.name().trim());
        tenant.setPhone(PhoneNormalizer.normalize(req.phone().trim()));
        tenant.setEmail(req.email() != null ? req.email().trim() : "");
        tenant.setMoveInDate(activationDate);   // activation date is also the move-in date
        tenant.setLeaseEnd(computedLeaseEnd);
        if (req.nationalIdNumber() != null && !req.nationalIdNumber().isBlank()) {
            tenant.setNationalIdNumber(req.nationalIdNumber().trim());
        }
        tenant.setActive(true);
        tenant.setPayToken(generatePayToken());
        tenant.setCreatedBy(account.getEmail());

        RentTenant saved = tenantRepository.save(tenant);

        // Create the lease — this also generates all current/past cycle charges
        leaseService.createLease(saved, unit, property, activationDate, termMonths, account.getEmail());

        RentDtos.TenantSummary result = RentDtos.TenantSummary.fromWithUrl(saved, customerUrl);
        auditService.success("RENT_TENANT_ADDED", "rent_tenant", saved.getId(),
                Map.of("unitId", unitId, "propertyId", propertyId,
                       "tenantName", saved.getName(), "by", account.getEmail(),
                       "activationDate", activationDate.toString(), "termMonths", termMonths));
        return result;
    }

    @Transactional
    public RentDtos.TenantSummary updateTenant(
            RentAccount account, String propertyId, String tenantId, RentDtos.UpdateTenantRequest req) {

        RentProperty property = requireProperty(propertyId);
        requireManagerAccess(account, property);

        RentTenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ApiException(404, "Tenant not found"));
        if (!tenant.getUnit().getProperty().getId().equals(propertyId)) {
            throw new ApiException(403, "Tenant does not belong to this property");
        }

        if (req.phone() != null && !req.phone().isBlank()) tenant.setPhone(PhoneNormalizer.normalize(req.phone().trim()));
        if (req.email() != null)                           tenant.setEmail(req.email().trim());
        if (req.leaseEnd() != null) {
            tenant.setLeaseEnd(req.leaseEnd().isBlank() ? null : LocalDate.parse(req.leaseEnd()));
        }

        RentDtos.TenantSummary result = RentDtos.TenantSummary.fromWithUrl(
                tenantRepository.save(tenant), customerUrl);
        auditService.success("RENT_TENANT_UPDATED", "rent_tenant", tenantId,
                Map.of("propertyId", propertyId, "by", account.getEmail()));
        return result;
    }

    @Transactional
    public void deactivateTenant(RentAccount account, String propertyId, String tenantId) {
        RentProperty property = requireProperty(propertyId);
        requireManagerAccess(account, property);

        RentTenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ApiException(404, "Tenant not found"));
        tenant.setActive(false);
        tenantRepository.save(tenant);
        auditService.success("RENT_TENANT_DEACTIVATED", "rent_tenant", tenantId,
                Map.of("propertyId", propertyId, "by", account.getEmail()));
    }

    /**
     * Regenerates the tenant's personal pay token so that any previously shared
     * QR codes / links are immediately invalidated. The old token stops resolving
     * on the pay page as soon as this method returns.
     *
     * @return the updated TenantSummary containing the new payToken and payUrl
     */
    @Transactional
    public RentDtos.TenantSummary regenerateTenantPayToken(
            RentAccount account, String propertyId, String tenantId) {

        RentProperty property = requireProperty(propertyId);
        requireManagerAccess(account, property);

        RentTenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ApiException(404, "Tenant not found"));

        // Guard: tenant must belong to this property
        if (!tenant.getUnit().getProperty().getId().equals(propertyId)) {
            throw new ApiException(403, "Tenant does not belong to this property");
        }

        tenant.setPayToken(generatePayToken());
        RentDtos.TenantSummary result = RentDtos.TenantSummary.fromWithUrl(
                tenantRepository.save(tenant), customerUrl);
        auditService.success("RENT_TENANT_TOKEN_REGENERATED", "rent_tenant", tenantId,
                Map.of("propertyId", propertyId, "by", account.getEmail()));
        return result;
    }

    /**
     * Regenerates the property-level QR token so that any previously printed
     * building-entrance QR codes are immediately invalidated.
     *
     * @return the updated PropertyResponse containing the new qrToken and qrCodeUrl
     */
    @Transactional
    public RentDtos.PropertyResponse regeneratePropertyQrToken(
            RentAccount account, String propertyId) {

        RentProperty property = requireProperty(propertyId);
        requireManagerAccess(account, property);

        property.setQrToken(generateQrToken());
        property.setUpdatedAt(Instant.now());
        RentDtos.PropertyResponse result = RentDtos.PropertyResponse.from(
                propertyRepository.save(property), customerUrl);
        auditService.success("RENT_PROPERTY_QR_REGENERATED", "rent_property", propertyId,
                Map.of("by", account.getEmail()));
        return result;
    }

    /**
     * Regenerates the per-unit QR token, invalidating any previously printed
     * door-sticker QR codes for this unit.
     *
     * @return the updated UnitResponse containing the new qrToken and qrCodeUrl
     */
    @Transactional
    public RentDtos.UnitResponse regenerateUnitQrToken(
            RentAccount account, String propertyId, String unitId) {

        RentProperty property = requireProperty(propertyId);
        requireManagerAccess(account, property);

        RentUnit unit = unitRepository.findById(unitId)
                .filter(u -> u.getProperty().getId().equals(propertyId))
                .orElseThrow(() -> new ApiException(404, "Unit not found"));

        unit.setQrToken(generateUnitQrToken());
        RentDtos.UnitResponse result = RentDtos.UnitResponse.from(
                unitRepository.save(unit), customerUrl);
        auditService.success("RENT_UNIT_QR_REGENERATED", "rent_unit", unitId,
                Map.of("propertyId", propertyId, "by", account.getEmail()));
        return result;
    }

    // ── Authorization helpers ─────────────────────────────────────────────────

    public void requireManagerAccess(RentAccount account, RentProperty property) {
        boolean hasAccess = accessRepository
                .findByAccount_IdAndProperty_Id(account.getId(), property.getId())
                .map(RentPropertyAccess::canManage)
                .orElse(false);
        if (!hasAccess) {
            throw new ApiException(403, "You do not have manager access to this property");
        }
    }

    public void requireAnyAccess(RentAccount account, RentProperty property) {
        if (!accessRepository.existsByAccount_IdAndProperty_Id(account.getId(), property.getId())) {
            throw new ApiException(403, "You do not have access to this property");
        }
    }

    // ── Token/ID generators ───────────────────────────────────────────────────

    private String generatePropertyId() {
        return "RP-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
    }

    private String generateUnitId() {
        return "RU-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
    }

    private String generateTenantId() {
        return "RT-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
    }

    private String generateQrToken() {
        for (int i = 0; i < 8; i++) {
            String token = UUID.randomUUID().toString().replace("-", "");
            if (!propertyRepository.existsByQrToken(token)) return token;
        }
        throw new IllegalStateException("Could not generate unique property QR token");
    }

    /**
     * Generates a 128-bit URL-safe token for a unit's door-sticker QR code.
     * Uses {@link SecureRandom} to ensure unpredictability. The token is
     * base64url-encoded (no padding) producing a 22-character string.
     */
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private String generateUnitQrToken() {
        for (int i = 0; i < 8; i++) {
            byte[] bytes = new byte[16]; // 128 bits
            SECURE_RANDOM.nextBytes(bytes);
            String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
            if (!unitRepository.existsByQrToken(token)) return token;
        }
        throw new IllegalStateException("Could not generate unique unit QR token");
    }

    private String generatePayToken() {
        for (int i = 0; i < 8; i++) {
            String token = "TPT-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase();
            if (!tenantRepository.existsByPayToken(token)) return token;
        }
        throw new IllegalStateException("Could not generate unique tenant pay token");
    }

    private PropertyAccessRole parseRole(String role) {
        try {
            return PropertyAccessRole.valueOf(role.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new ApiException(400, "Invalid role: " + role + ". Must be OWNER, MANAGER, or OWNER_MANAGER");
        }
    }
}
