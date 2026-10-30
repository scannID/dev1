package com.scanny.controller;

import com.scanny.dto.RentDtos;
import com.scanny.entity.RentAccount;
import com.scanny.entity.RentCharge;
import com.scanny.entity.RentProperty;
import com.scanny.entity.RentUnit;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.RentChargeStatus;
import com.scanny.repository.RentChargeRepository;
import com.scanny.repository.RentMaintenanceRepository;
import com.scanny.repository.RentPaymentRepository;
import com.scanny.repository.RentUnitRepository;
import com.scanny.service.RentAccountService;
import com.scanny.service.RentChargeService;
import com.scanny.service.LeaseService;
import com.scanny.service.RentPropertyService;
import com.scanny.service.RentQrService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.io.IOException;
import java.io.PrintWriter;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Authenticated rent dashboard API.
 *
 * <p>Supports two authentication modes — the endpoint signature accepts both on
 * every request and the private {@link #resolveAccount} helper picks the right one:
 * <ol>
 *   <li><strong>Keycloak JWT</strong> (preferred) — Bearer token with the
 *       {@code RENT_MANAGER} realm role, injected by Spring as an
 *       {@code @AuthenticationPrincipal Jwt}.</li>
 *   <li><strong>Legacy access key</strong> — the {@code X-Rent-Access-Key} header
 *       ("RAK-XXXXXXXX") that was the original credential.  Kept for backward
 *       compatibility; the header is optional ({@code required = false}).</li>
 * </ol>
 *
 * <p>All paths are under {@code /api/public/rent/dashboard/**} which is already
 * {@code permitAll()} in SecurityConfig (the legacy key flow required no JWT).
 * Keycloak-authenticated requests carry a valid JWT anyway, so adding a secondary
 * {@code @AuthenticationPrincipal Jwt} parameter costs nothing.
 */
@RestController
@RequestMapping("/api/public/rent/dashboard")
public class RentDashboardController {

    private static final String ACCESS_KEY_HEADER = "X-Rent-Access-Key";

    private final RentAccountService accountService;
    private final RentPropertyService propertyService;
    private final RentChargeService chargeService;
    private final LeaseService leaseService;
    private final RentUnitRepository unitRepository;
    private final RentChargeRepository chargeRepository;
    private final RentPaymentRepository paymentRepository;
    private final RentQrService rentQrService;
    private final RentMaintenanceRepository maintenanceRepository;

    @Value("${scanny.customer-url}")
    private String customerUrl;

    public RentDashboardController(
            RentAccountService accountService,
            RentPropertyService propertyService,
            RentChargeService chargeService,
            LeaseService leaseService,
            RentUnitRepository unitRepository,
            RentChargeRepository chargeRepository,
            RentPaymentRepository paymentRepository,
            RentQrService rentQrService,
            RentMaintenanceRepository maintenanceRepository) {
        this.accountService = accountService;
        this.propertyService = propertyService;
        this.chargeService = chargeService;
        this.leaseService = leaseService;
        this.unitRepository = unitRepository;
        this.chargeRepository = chargeRepository;
        this.paymentRepository = paymentRepository;
        this.rentQrService = rentQrService;
        this.maintenanceRepository = maintenanceRepository;
    }

    // ── Auth resolution ───────────────────────────────────────────────────────

    /**
     * Resolves the calling {@link RentAccount} from either:
     * <ul>
     *   <li>A Keycloak JWT with the {@code RENT_MANAGER} role (preferred), or</li>
     *   <li>The legacy {@code X-Rent-Access-Key} header.</li>
     * </ul>
     * Throws {@link ApiException} 401 if neither is present or valid.
     */
    private RentAccount resolveAccount(Jwt jwt, String accessKey) {
        // JWT path — Keycloak-authenticated users
        if (jwt != null) {
            return accountService.handleLogin(jwt);
        }
        // Legacy key path
        if (accessKey != null && !accessKey.isBlank()) {
            return accountService.requireByAccessKey(accessKey);
        }
        throw new ApiException(401, "Authentication required: provide a Bearer token or X-Rent-Access-Key header");
    }

    // ── Account ───────────────────────────────────────────────────────────────

    @GetMapping("/me")
    public RentDtos.AccountResponse getMe(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey) {
        return RentDtos.AccountResponse.from(resolveAccount(jwt, accessKey));
    }

    // ── Portfolio ─────────────────────────────────────────────────────────────

    @GetMapping("/portfolio")
    public List<RentDtos.PortfolioEntry> getPortfolio(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey) {
        RentAccount account = resolveAccount(jwt, accessKey);
        return propertyService.getPortfolio(account);
    }

    @PostMapping("/properties")
    @ResponseStatus(HttpStatus.CREATED)
    public RentDtos.PropertyResponse createProperty(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @Valid @RequestBody RentDtos.CreatePropertyRequest request) {
        RentAccount account = resolveAccount(jwt, accessKey);
        return propertyService.createProperty(account, request);
    }

    @PostMapping("/properties/{propertyId}/update")
    public RentDtos.PropertyResponse updateProperty(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @Valid @RequestBody RentDtos.UpdatePropertyRequest request) {
        RentAccount account = resolveAccount(jwt, accessKey);
        return propertyService.updateProperty(account, propertyId, request);
    }

    // ── Property dashboard ────────────────────────────────────────────────────

    @GetMapping("/properties/{propertyId}")
    public RentDtos.PropertyDashboard getPropertyDashboard(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @RequestParam(required = false) String period) {
        return propertyService.getPropertyDashboard(resolveAccount(jwt, accessKey), propertyId, period);
    }

    // ── Unit management ───────────────────────────────────────────────────────

    @PostMapping("/properties/{propertyId}/units")
    @ResponseStatus(HttpStatus.CREATED)
    public RentDtos.UnitResponse addUnit(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @Valid @RequestBody RentDtos.CreateUnitRequest request) {
        return propertyService.addUnit(resolveAccount(jwt, accessKey), propertyId, request);
    }

    @PostMapping("/properties/{propertyId}/units/{unitId}/update")
    public RentDtos.UnitResponse updateUnit(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @PathVariable String unitId,
            @Valid @RequestBody RentDtos.UpdateUnitRequest request) {
        return propertyService.updateUnit(resolveAccount(jwt, accessKey), propertyId, unitId, request);
    }

    @GetMapping("/properties/{propertyId}/units")
    public List<RentDtos.UnitResponse> listUnits(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId) {
        RentAccount account = resolveAccount(jwt, accessKey);
        propertyService.requireAnyAccess(account, propertyService.requireProperty(propertyId));
        return propertyService.listUnits(propertyId);
    }

    // ── Tenant management ─────────────────────────────────────────────────────

    @PostMapping("/properties/{propertyId}/units/{unitId}/tenants")
    @ResponseStatus(HttpStatus.CREATED)
    public RentDtos.TenantSummary addTenant(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @PathVariable String unitId,
            @Valid @RequestBody RentDtos.CreateTenantRequest request) {
        return propertyService.addTenant(resolveAccount(jwt, accessKey), propertyId, unitId, request);
    }

    @PostMapping("/properties/{propertyId}/units/{unitId}/tenants/{tenantId}/deactivate")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deactivateTenant(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @PathVariable String unitId,
            @PathVariable String tenantId) {
        propertyService.deactivateTenant(resolveAccount(jwt, accessKey), propertyId, tenantId);
    }

    @PostMapping("/properties/{propertyId}/units/{unitId}/tenants/{tenantId}/update")
    public RentDtos.TenantSummary updateTenant(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @PathVariable String unitId,
            @PathVariable String tenantId,
            @Valid @RequestBody RentDtos.UpdateTenantRequest request) {
        return propertyService.updateTenant(resolveAccount(jwt, accessKey), propertyId, tenantId, request);
    }

    // ── Access management ─────────────────────────────────────────────────────

    @PostMapping("/properties/{propertyId}/access")
    @ResponseStatus(HttpStatus.CREATED)
    public void grantAccess(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @Valid @RequestBody RentDtos.GrantAccessRequest request) {
        propertyService.grantAccessByEmail(resolveAccount(jwt, accessKey), propertyId, request);
    }

    @GetMapping("/properties/{propertyId}/access")
    public List<RentDtos.PropertyAccessResponse> listAccess(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId) {
        RentAccount account = resolveAccount(jwt, accessKey);
        propertyService.requireAnyAccess(account, propertyService.requireProperty(propertyId));
        return propertyService.listAccess(propertyId);
    }

    // ── Lease lookup ──────────────────────────────────────────────────────────

    /**
     * Returns the active lease for a unit, if any.
     */
    @GetMapping("/properties/{propertyId}/units/{unitId}/lease")
    public RentDtos.LeaseResponse getUnitLease(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @PathVariable String unitId) {
        RentAccount account = resolveAccount(jwt, accessKey);
        propertyService.requireAnyAccess(account, propertyService.requireProperty(propertyId));
        var unit = unitRepository.findById(unitId)
                .filter(u -> u.getProperty().getId().equals(propertyId))
                .orElseThrow(() -> new ApiException(404, "Unit not found"));
        return leaseService.findActiveLease(unitId)
                .map(leaseService::toResponse)
                .orElseThrow(() -> new ApiException(404, "No active lease for this unit"));
    }

    // ── Charge management ─────────────────────────────────────────────────────

    @PostMapping("/properties/{propertyId}/charges/generate")
    @ResponseStatus(HttpStatus.CREATED)
    public List<RentDtos.ChargeResponse> generateCharges(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @Valid @RequestBody RentDtos.GenerateChargesRequest request) {
        return chargeService.generateCharges(resolveAccount(jwt, accessKey), propertyId, request);
    }

    @PostMapping("/properties/{propertyId}/units/{unitId}/charges/generate")
    @ResponseStatus(HttpStatus.CREATED)
    public RentDtos.ChargeResponse generateChargeForUnit(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @PathVariable String unitId,
            @Valid @RequestBody RentDtos.GenerateChargesRequest request) {
        return chargeService.generateChargeForUnit(resolveAccount(jwt, accessKey), propertyId, unitId, request);
    }

    @GetMapping("/properties/{propertyId}/charges")
    public List<RentDtos.ChargeResponse> listCharges(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @RequestParam(required = false) String period) {
        String p = period != null && !period.isBlank() ? period : YearMonth.now().toString();
        return chargeService.getChargesForProperty(resolveAccount(jwt, accessKey), propertyId, p);
    }

    @PostMapping("/properties/{propertyId}/charges/{chargeId}/status")
    public RentDtos.ChargeResponse updateChargeStatus(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @PathVariable Long chargeId,
            @Valid @RequestBody RentDtos.UpdateChargeStatusRequest request) {
        return chargeService.updateStatus(resolveAccount(jwt, accessKey), propertyId, chargeId, request);
    }

    // ── Manual payment recording ──────────────────────────────────────────────

    /**
     * Records a manual payment (cash, MoMo transfer, bank deposit) against a
     * charge. Overpayment is rejected unless {@code carryCredit = true}.
     */
    @PostMapping("/properties/{propertyId}/charges/{chargeId}/payments")
    @ResponseStatus(HttpStatus.CREATED)
    public RentDtos.PaymentSummary recordManualPayment(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @PathVariable Long chargeId,
            @Valid @RequestBody RentDtos.RecordManualPaymentRequest request) {
        return chargeService.recordManualPayment(
                resolveAccount(jwt, accessKey), propertyId, chargeId, request);
    }

    // ── QR token regeneration ─────────────────────────────────────────────────

    @PostMapping("/properties/{propertyId}/units/{unitId}/tenants/{tenantId}/regenerate-token")
    public RentDtos.TenantSummary regenerateTenantPayToken(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @PathVariable String unitId,
            @PathVariable String tenantId) {
        return propertyService.regenerateTenantPayToken(resolveAccount(jwt, accessKey), propertyId, tenantId);
    }

    @PostMapping("/properties/{propertyId}/regenerate-token")
    public RentDtos.PropertyResponse regeneratePropertyQrToken(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId) {
        return propertyService.regeneratePropertyQrToken(resolveAccount(jwt, accessKey), propertyId);
    }

    // ── QR image download ─────────────────────────────────────────────────────

    @GetMapping("/properties/{propertyId}/units/{unitId}/qr")
    public void downloadUnitQr(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @PathVariable String unitId,
            @RequestParam(defaultValue = "png") String format,
            @RequestParam(defaultValue = "300") int size,
            HttpServletResponse response) throws IOException {

        RentAccount account = resolveAccount(jwt, accessKey);
        propertyService.requireAnyAccess(account, propertyService.requireProperty(propertyId));

        RentUnit unit = unitRepository.findById(unitId)
                .filter(u -> u.getProperty().getId().equals(propertyId))
                .orElseThrow(() -> new ApiException(404, "Unit not found"));

        if (unit.getQrToken() == null || unit.getQrToken().isBlank()) {
            throw new ApiException(409, "Unit does not have a QR token yet");
        }

        String payUrl   = customerUrl + "/rent/pay/" + unit.getQrToken();
        int safeSize    = Math.max(100, Math.min(size, 1200));
        String filename = "unit-" + unit.getUnitNumber().replaceAll("[^a-zA-Z0-9_-]", "_");

        if ("svg".equalsIgnoreCase(format)) {
            response.setContentType("image/svg+xml");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + filename + ".svg\"");
            response.getWriter().write(rentQrService.svgString(payUrl, safeSize));
        } else {
            response.setContentType("image/png");
            response.setHeader("Content-Disposition", "attachment; filename=\"" + filename + ".png\"");
            response.getOutputStream().write(rentQrService.pngBytes(payUrl, safeSize));
        }
    }

    @PostMapping("/properties/{propertyId}/units/{unitId}/regenerate-qr")
    public RentDtos.UnitResponse regenerateUnitQrToken(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @PathVariable String unitId) {
        return propertyService.regenerateUnitQrToken(resolveAccount(jwt, accessKey), propertyId, unitId);
    }

    @GetMapping("/properties/{propertyId}/qr-bulk")
    public void downloadBulkQrPdf(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            HttpServletResponse response) throws IOException {

        RentAccount account = resolveAccount(jwt, accessKey);
        RentProperty property = propertyService.requireProperty(propertyId);
        propertyService.requireAnyAccess(account, property);

        List<RentUnit> units = unitRepository.findByProperty_IdOrderByUnitNumberAsc(propertyId);
        String filename = property.getName().replaceAll("[^a-zA-Z0-9_-]", "_") + "_QR_codes.pdf";

        response.setContentType("application/pdf");
        response.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
        response.getOutputStream().write(rentQrService.bulkPdfBytes(property, units));
    }

    // ── CSV export ────────────────────────────────────────────────────────────

    @GetMapping("/properties/{propertyId}/export")
    public void exportCsv(
            @AuthenticationPrincipal Jwt jwt,
            @RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @PathVariable String propertyId,
            @RequestParam(required = false) String period,
            HttpServletResponse response) throws IOException {

        RentAccount account = resolveAccount(jwt, accessKey);
        RentProperty property = propertyService.requireProperty(propertyId);
        propertyService.requireAnyAccess(account, property);

        String p = (period != null && !period.isBlank()) ? period.trim() : YearMonth.now().toString();
        List<RentCharge> charges = chargeRepository.findByPropertyIdAndPeriodLabel(propertyId, p);

        String filename = property.getName().replaceAll("[^a-zA-Z0-9_-]", "_") + "_" + p + ".csv";
        response.setContentType("text/csv;charset=UTF-8");
        response.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");

        try (PrintWriter writer = response.getWriter()) {
            writer.println("Unit,Tenant,Amount,Currency,Period,Due Date,Status,Paid Amount,Outstanding,Notes");
            for (RentCharge c : charges) {
                writer.printf("\"%s\",\"%s\",%d,\"%s\",\"%s\",\"%s\",\"%s\",%d,%d,\"%s\"%n",
                        escapeCsv(c.getUnit().getUnitNumber()),
                        escapeCsv(c.getTenant().getName()),
                        c.getAmount(), c.getCurrency(), c.getPeriodLabel(),
                        c.getDueDate() != null ? c.getDueDate().toString() : "",
                        c.getStatus().name(),
                        c.getPaidAmount(), c.getOutstandingAmount(),
                        escapeCsv(c.getNotes() != null ? c.getNotes() : ""));
            }
        }
    }

    private static String escapeCsv(String value) {
        if (value == null) return "";
        return value.replace("\"", "\"\"");
    }

    // ── Maintenance ───────────────────────────────────────────────────────────

    @GetMapping("/properties/{propertyId}/maintenance")
    public java.util.List<RentDtos.MaintenanceRequest> listMaintenance(
            @org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt,
            @org.springframework.web.bind.annotation.RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @org.springframework.web.bind.annotation.PathVariable String propertyId) {
        resolveAccount(jwt, accessKey); // auth check
        return maintenanceRepository.findByPropertyIdOrderBySubmittedAtDesc(propertyId)
                .stream().map(RentDtos.MaintenanceRequest::from).toList();
    }

    @org.springframework.web.bind.annotation.PostMapping("/properties/{propertyId}/maintenance/{requestId}/status")
    public RentDtos.MaintenanceRequest updateMaintenanceStatus(
            @org.springframework.security.core.annotation.AuthenticationPrincipal org.springframework.security.oauth2.jwt.Jwt jwt,
            @org.springframework.web.bind.annotation.RequestHeader(value = ACCESS_KEY_HEADER, required = false) String accessKey,
            @org.springframework.web.bind.annotation.PathVariable String propertyId,
            @org.springframework.web.bind.annotation.PathVariable String requestId,
            @org.springframework.web.bind.annotation.RequestBody RentDtos.UpdateMaintenanceStatusRequest req) {
        resolveAccount(jwt, accessKey);
        var r = maintenanceRepository.findById(requestId)
                .orElseThrow(() -> new ApiException(404, "Request not found"));
        if (!r.getProperty().getId().equals(propertyId)) throw new ApiException(403, "Forbidden");
        r.setStatus(req.status());
        if ("RESOLVED".equals(req.status()) && r.getResolvedAt() == null) r.setResolvedAt(java.time.Instant.now());
        maintenanceRepository.save(r);
        return RentDtos.MaintenanceRequest.from(r);
    }
}
