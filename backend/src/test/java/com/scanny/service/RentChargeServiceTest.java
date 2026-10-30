package com.scanny.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.scanny.dto.RentDtos;
import com.scanny.entity.RentAccount;
import com.scanny.entity.RentCharge;
import com.scanny.entity.RentPayment;
import com.scanny.entity.RentProperty;
import com.scanny.entity.RentTenant;
import com.scanny.entity.RentUnit;
import com.scanny.exception.ApiException;
import com.scanny.model.enums.RentChargeStatus;
import com.scanny.model.enums.RentPaymentMethod;
import com.scanny.model.enums.RentPaymentStatus;
import com.scanny.repository.RentChargeRepository;
import com.scanny.repository.RentPaymentRepository;
import com.scanny.repository.RentTenantRepository;
import com.scanny.repository.RentUnitRepository;
import com.scanny.rent.gateway.ManualGateway;
import com.scanny.rent.gateway.RentPaymentGateway;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RentChargeServiceTest {

    @Mock private RentChargeRepository chargeRepository;
    @Mock private RentUnitRepository unitRepository;
    @Mock private RentTenantRepository tenantRepository;
    @Mock private RentPaymentRepository paymentRepository;
    @Mock private RentPropertyService propertyService;
    @Mock private AuditService auditService;
    @Mock private ManualGateway manualGateway;

    private RentChargeService chargeService;

    private RentAccount account;
    private RentProperty property;
    private RentUnit unit;
    private RentTenant tenant;

    @BeforeEach
    void setUp() {
        chargeService = new RentChargeService(
                chargeRepository, unitRepository, tenantRepository, paymentRepository,
                propertyService, auditService, manualGateway);

        account = new RentAccount();
        account.setId("RA-TEST-01");
        account.setEmail("manager@example.com");

        property = new RentProperty();
        property.setId("RP-TEST-01");
        property.setCurrency("UGX");

        unit = new RentUnit();
        unit.setId("RU-TEST-01");
        unit.setProperty(property);
        unit.setUnitNumber("A1");
        unit.setMonthlyAmount(500_000L);
        unit.setDueDayOfMonth(5);
        unit.setGracePeriodDays(3);

        tenant = new RentTenant();
        tenant.setId("RT-TEST-01");
        tenant.setUnit(unit);
        tenant.setName("John Test");
        tenant.setPhone("+256700123456");
        tenant.setActive(true);
        unit.getTenants().add(tenant);

        lenient().when(propertyService.requireProperty("RP-TEST-01")).thenReturn(property);
        lenient().doNothing().when(propertyService).requireManagerAccess(any(), any());
    }

    // ── Charge generation ──────────────────────────────────────────────────────

    @Test
    void generateChargesForPropertyCreatesOneChargePerActiveTenant() {
        when(unitRepository.findByProperty_IdOrderByUnitNumberAsc("RP-TEST-01"))
                .thenReturn(List.of(unit));
        when(chargeRepository.existsByTenant_IdAndPeriodLabel("RT-TEST-01", "2026-11"))
                .thenReturn(false);
        when(chargeRepository.save(any(RentCharge.class))).thenAnswer(inv -> inv.getArgument(0));

        var req = new RentDtos.GenerateChargesRequest("2026-11", null);
        var result = chargeService.generateCharges(account, "RP-TEST-01", req);

        assertThat(result).hasSize(1);
        ArgumentCaptor<RentCharge> captor = ArgumentCaptor.forClass(RentCharge.class);
        verify(chargeRepository).save(captor.capture());
        RentCharge saved = captor.getValue();

        assertThat(saved.getTenant().getId()).isEqualTo("RT-TEST-01");
        assertThat(saved.getUnit().getId()).isEqualTo("RU-TEST-01");
        assertThat(saved.getAmount()).isEqualTo(500_000L);
        assertThat(saved.getPeriodLabel()).isEqualTo("2026-11");
        assertThat(saved.getStatus()).isEqualTo(RentChargeStatus.UNPAID);
        // Due date should be day 5 of Nov 2026
        assertThat(saved.getDueDate()).isEqualTo(LocalDate.of(2026, 11, 5));
    }

    @Test
    void generateChargesIsIdempotent_SkipsAlreadyChargedTenants() {
        when(unitRepository.findByProperty_IdOrderByUnitNumberAsc("RP-TEST-01"))
                .thenReturn(List.of(unit));
        // Tenant already has a charge for this period
        when(chargeRepository.existsByTenant_IdAndPeriodLabel("RT-TEST-01", "2026-11"))
                .thenReturn(true);

        var req = new RentDtos.GenerateChargesRequest("2026-11", null);
        var result = chargeService.generateCharges(account, "RP-TEST-01", req);

        assertThat(result).isEmpty();
        verify(chargeRepository, never()).save(any());
    }

    @Test
    void generateChargesSkipsUnitsWithNoActiveTenant() {
        // Unit with no active tenant
        RentUnit vacantUnit = new RentUnit();
        vacantUnit.setId("RU-VACANT");
        vacantUnit.setProperty(property);
        vacantUnit.setUnitNumber("V1");
        vacantUnit.setMonthlyAmount(300_000L);
        vacantUnit.setDueDayOfMonth(5);

        when(unitRepository.findByProperty_IdOrderByUnitNumberAsc("RP-TEST-01"))
                .thenReturn(List.of(vacantUnit, unit));
        when(chargeRepository.existsByTenant_IdAndPeriodLabel("RT-TEST-01", "2026-11"))
                .thenReturn(false);
        when(chargeRepository.save(any(RentCharge.class))).thenAnswer(inv -> inv.getArgument(0));

        var req = new RentDtos.GenerateChargesRequest("2026-11", null);
        var result = chargeService.generateCharges(account, "RP-TEST-01", req);

        // Only one charge created — for the occupied unit
        assertThat(result).hasSize(1);
    }

    // ── Status derivation ─────────────────────────────────────────────────────

    @Test
    void recomputeStatus_marksPaidWhenFullAmountPaid() {
        RentCharge charge = new RentCharge();
        charge.setAmount(500_000L);
        charge.setStatus(RentChargeStatus.UNPAID);
        charge.setPayments(List.of(makePayment(500_000L, RentPaymentStatus.Completed)));

        chargeService.recomputeStatus(charge);

        assertThat(charge.getStatus()).isEqualTo(RentChargeStatus.PAID);
    }

    @Test
    void recomputeStatus_marksPartialWhenPartiallyPaid() {
        RentCharge charge = new RentCharge();
        charge.setAmount(500_000L);
        charge.setStatus(RentChargeStatus.UNPAID);
        charge.setPayments(List.of(makePayment(200_000L, RentPaymentStatus.Completed)));

        chargeService.recomputeStatus(charge);

        assertThat(charge.getStatus()).isEqualTo(RentChargeStatus.PARTIAL);
    }

    @Test
    void recomputeStatus_doesNothingWhenNoCompletedPayments() {
        RentCharge charge = new RentCharge();
        charge.setAmount(500_000L);
        charge.setStatus(RentChargeStatus.UNPAID);
        charge.setPayments(List.of(makePayment(500_000L, RentPaymentStatus.Pending)));

        chargeService.recomputeStatus(charge);

        // Status stays UNPAID because the only payment is still Pending
        assertThat(charge.getStatus()).isEqualTo(RentChargeStatus.UNPAID);
    }

    @Test
    void recomputeStatus_sumsMultipleCompletedPayments() {
        RentCharge charge = new RentCharge();
        charge.setAmount(500_000L);
        charge.setStatus(RentChargeStatus.PARTIAL);
        charge.setPayments(List.of(
                makePayment(200_000L, RentPaymentStatus.Completed),
                makePayment(300_000L, RentPaymentStatus.Completed),
                makePayment(100_000L, RentPaymentStatus.Failed) // should be ignored
        ));

        chargeService.recomputeStatus(charge);

        assertThat(charge.getStatus()).isEqualTo(RentChargeStatus.PAID);
    }

    // ── Manual payment recording ───────────────────────────────────────────────

    @Test
    void recordManualPayment_rejectsOverpaymentWithoutCreditFlag() {
        RentCharge charge = makeCharge(500_000L, 200_000L); // outstanding = 300_000
        when(propertyService.requireProperty("RP-TEST-01")).thenReturn(property);
        when(chargeRepository.findById(1L)).thenReturn(Optional.of(charge));

        var req = new RentDtos.RecordManualPaymentRequest(
                400_000L, "CASH", "REF-001", false);

        assertThatThrownBy(() -> chargeService.recordManualPayment(account, "RP-TEST-01", 1L, req))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("exceeds outstanding balance");
    }

    @Test
    void recordManualPayment_acceptsOverpaymentWithCreditFlag() {
        RentCharge charge = makeCharge(500_000L, 200_000L); // outstanding = 300_000
        when(propertyService.requireProperty("RP-TEST-01")).thenReturn(property);
        when(chargeRepository.findById(1L)).thenReturn(Optional.of(charge));
        when(manualGateway.initiate(any())).thenReturn(
                new RentPaymentGateway.GatewayResult("MAN-REF-001",
                        RentPaymentGateway.GatewayStatus.COMPLETED, "Manual"));
        when(paymentRepository.save(any(RentPayment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(chargeRepository.save(any(RentCharge.class))).thenAnswer(inv -> inv.getArgument(0));

        var req = new RentDtos.RecordManualPaymentRequest(
                400_000L, "CASH", "REF-001", true);

        var result = chargeService.recordManualPayment(account, "RP-TEST-01", 1L, req);

        assertThat(result.amount()).isEqualTo(400_000L);
        assertThat(result.paymentMethod()).isEqualTo("CASH");
        // Charge should be PAID since the sum of payments now exceeds the amount
        assertThat(charge.getStatus()).isEqualTo(RentChargeStatus.PAID);
    }

    @Test
    void recordManualPayment_rejectsInvalidMethod() {
        RentCharge charge = makeCharge(500_000L, 0);
        when(propertyService.requireProperty("RP-TEST-01")).thenReturn(property);
        when(chargeRepository.findById(1L)).thenReturn(Optional.of(charge));

        var req = new RentDtos.RecordManualPaymentRequest(
                500_000L, "CRYPTO", null, false);

        assertThatThrownBy(() -> chargeService.recordManualPayment(account, "RP-TEST-01", 1L, req))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Invalid payment method");
    }

    // ── Manual status override ─────────────────────────────────────────────────

    @Test
    void updateStatus_requiresNoteForWaive() {
        RentCharge charge = makeCharge(500_000L, 0);
        when(propertyService.requireProperty("RP-TEST-01")).thenReturn(property);
        when(chargeRepository.findById(1L)).thenReturn(Optional.of(charge));

        var req = new RentDtos.UpdateChargeStatusRequest("WAIVED", null);

        assertThatThrownBy(() -> chargeService.updateStatus(account, "RP-TEST-01", 1L, req))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("note is required");
    }

    @Test
    void updateStatus_acceptsWaiveWithNote() {
        RentCharge charge = makeCharge(500_000L, 0);
        when(propertyService.requireProperty("RP-TEST-01")).thenReturn(property);
        when(chargeRepository.findById(1L)).thenReturn(Optional.of(charge));
        when(chargeRepository.save(any(RentCharge.class))).thenAnswer(inv -> inv.getArgument(0));

        var req = new RentDtos.UpdateChargeStatusRequest("WAIVED", "Tenant vacated, balance waived");
        var result = chargeService.updateStatus(account, "RP-TEST-01", 1L, req);

        assertThat(result.status()).isEqualTo("WAIVED");
        assertThat(result.notes()).isEqualTo("Tenant vacated, balance waived");
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    private RentPayment makePayment(long amount, RentPaymentStatus status) {
        RentPayment p = new RentPayment();
        p.setAmount(amount);
        p.setStatus(status);
        p.setPaymentMethod(RentPaymentMethod.MOMO);
        p.setCreatedAt(Instant.now());
        return p;
    }

    private RentCharge makeCharge(long amount, long paidAmount) {
        RentCharge c = new RentCharge();
        c.setId(1L);
        c.setAmount(amount);
        c.setCurrency("UGX");
        c.setPeriodLabel("2026-11");
        c.setDueDate(LocalDate.of(2026, 11, 5));
        c.setStatus(RentChargeStatus.UNPAID);
        c.setUnit(unit);
        c.setTenant(tenant);
        c.setPayments(new ArrayList<>());

        if (paidAmount > 0) {
            RentPayment existing = makePayment(paidAmount, RentPaymentStatus.Completed);
            existing.setCharge(c);
            c.getPayments().add(existing);
        }
        return c;
    }
}
