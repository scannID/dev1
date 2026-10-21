package com.scanny.service;

import com.scanny.dto.RentDtos;
import com.scanny.entity.RentAccount;
import com.scanny.entity.RentProperty;
import com.scanny.entity.RentPropertyAccess;
import com.scanny.entity.RentTenant;
import com.scanny.entity.RentUnit;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.PropertyAccessRole;
import com.scanny.repository.RentPropertyAccessRepository;
import com.scanny.repository.RentPropertyRepository;
import com.scanny.repository.RentTenantRepository;
import com.scanny.repository.RentUnitRepository;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
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
    private final RentAccountService accountService;
    private final AuditService auditService;

    @Value("${scanny.customer-url:http://localhost:5173}")
    private String customerUrl;

    public RentPropertyService(
            RentPropertyRepository propertyRepository,
            RentPropertyAccessRepository accessRepository,
            RentUnitRepository unitRepository,
            RentTenantRepository tenantRepository,
            RentAccountService accountService,
            AuditService auditService) {
        this.propertyRepository = propertyRepository;
        this.accessRepository = accessRepository;
        this.unitRepository = unitRepository;
        this.tenantRepository = tenantRepository;
        this.accountService = accountService;
        this.auditService = auditService;
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
        property.setOwnerMomo(req.ownerMomo().trim());
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
        if (req.ownerMomo() != null && !req.ownerMomo().isBlank()) property.setOwnerMomo(req.ownerMomo().trim());
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

    // ── Portfolio ─────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<RentDtos.PortfolioEntry> getPortfolio(RentAccount account) {
        List<RentProperty> properties = propertyRepository.findAllByAccountId(account.getId());
        return properties.stream().map(p -> buildPortfolioEntry(p, account.getId())).toList();
    }

    private RentDtos.PortfolioEntry buildPortfolioEntry(RentProperty p, String accountId) {
        List<RentUnit> units = unitRepository.findByProperty_IdOrderByUnitNumberAsc(p.getId());
        int totalUnits = units.size();
        int occupied = (int) units.stream().filter(u -> u.getActiveTenant() != null).count();

        // Overdue: charges that are UNPAID/PARTIAL past due
        int overdue = 0;
        // We keep this lightweight — just count units with active tenant having unpaid charges
        // (full overdue query is in dashboard)

        PropertyAccessRole role = accessRepository
                .findByAccount_IdAndProperty_Id(accountId, p.getId())
                .map(RentPropertyAccess::getRole)
                .orElse(PropertyAccessRole.MANAGER);

        return new RentDtos.PortfolioEntry(
                p.getId(), p.getName(), p.getCity(),
                role.name(),
                totalUnits, occupied, overdue,
                0L,   // total collected — filled per-request in dashboard for performance
                p.getCurrency());
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

        RentTenant tenant = new RentTenant();
        tenant.setId(generateTenantId());
        tenant.setUnit(unit);
        tenant.setName(req.name().trim());
        tenant.setPhone(req.phone().trim());
        tenant.setEmail(req.email() != null ? req.email().trim() : "");
        if (req.moveInDate() != null && !req.moveInDate().isBlank()) {
            tenant.setMoveInDate(LocalDate.parse(req.moveInDate()));
        }
        if (req.leaseEnd() != null && !req.leaseEnd().isBlank()) {
            tenant.setLeaseEnd(LocalDate.parse(req.leaseEnd()));
        }
        tenant.setActive(true);
        tenant.setPayToken(generatePayToken());

        RentDtos.TenantSummary result = RentDtos.TenantSummary.fromWithUrl(
                tenantRepository.save(tenant), customerUrl);
        auditService.success("RENT_TENANT_ADDED", "rent_tenant", tenant.getId(),
                Map.of("unitId", unitId, "propertyId", propertyId,
                       "tenantName", tenant.getName(), "by", account.getEmail()));
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

        if (req.phone() != null && !req.phone().isBlank()) tenant.setPhone(req.phone().trim());
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
