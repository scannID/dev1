package com.scanny.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.scanny.dto.RentDtos;
import com.scanny.entity.RentAccount;
import com.scanny.entity.RentProperty;
import com.scanny.entity.RentTenant;
import com.scanny.entity.RentUnit;
import com.scanny.exception.ApiException;
import com.scanny.repository.RentChargeRepository;
import com.scanny.repository.RentPaymentRepository;
import com.scanny.repository.RentPropertyAccessRepository;
import com.scanny.repository.RentPropertyRepository;
import com.scanny.repository.RentTenantRepository;
import com.scanny.repository.RentUnitRepository;
import com.scanny.service.LeaseService;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Tests for the one-active-tenant-per-unit rule in {@link RentPropertyService}.
 *
 * <p>The rule: when adding a new tenant to a unit that already has an active
 * tenant, the existing tenant is deactivated first (move-out), and the new
 * tenant takes over. Never more than one active tenant per unit.
 */
@ExtendWith(MockitoExtension.class)
class RentTenantServiceTest {

    @Mock private RentPropertyRepository propertyRepository;
    @Mock private RentPropertyAccessRepository accessRepository;
    @Mock private RentUnitRepository unitRepository;
    @Mock private RentTenantRepository tenantRepository;
    @Mock private RentChargeRepository chargeRepository;
    @Mock private RentPaymentRepository paymentRepository;
    @Mock private RentAccountService accountService;
    @Mock private AuditService auditService;
    @Mock private LeaseService leaseService;

    private RentPropertyService propertyService;

    private RentAccount account;
    private RentProperty property;
    private RentUnit unit;
    private RentTenant existingTenant;

    @BeforeEach
    void setUp() {
        propertyService = new RentPropertyService(
                propertyRepository, accessRepository, unitRepository, tenantRepository,
                chargeRepository, paymentRepository, accountService, auditService, leaseService);

        account = new RentAccount();
        account.setId("RA-TEST-01");
        account.setEmail("manager@example.com");
        account.setAccessKey("RAK-TEST");

        property = new RentProperty();
        property.setId("RP-TEST-01");
        property.setCurrency("UGX");

        unit = new RentUnit();
        unit.setId("RU-TEST-01");
        unit.setProperty(property);
        unit.setUnitNumber("A1");
        unit.setMonthlyAmount(500_000L);
        unit.setDueDayOfMonth(5);

        existingTenant = new RentTenant();
        existingTenant.setId("RT-OLD-01");
        existingTenant.setUnit(unit);
        existingTenant.setName("Old Tenant");
        existingTenant.setPhone("+256700000000");
        existingTenant.setActive(true);
        unit.getTenants().add(existingTenant);

        lenient().when(propertyRepository.findById("RP-TEST-01")).thenReturn(Optional.of(property));
        lenient().when(accessRepository.findByAccount_IdAndProperty_Id("RA-TEST-01", "RP-TEST-01"))
                .thenReturn(Optional.empty()); // requireManagerAccess mocked separately
        lenient().when(accessRepository.existsByAccount_IdAndProperty_Id("RA-TEST-01", "RP-TEST-01"))
                .thenReturn(true);
    }

    @Test
    void addTenant_deactivatesExistingActiveTenantBeforeAdding() {
        // Unit has an existing active tenant
        when(unitRepository.findById("RU-TEST-01")).thenReturn(Optional.of(unit));
        when(tenantRepository.findByUnit_IdAndActiveTrue("RU-TEST-01"))
                .thenReturn(Optional.of(existingTenant));
        when(tenantRepository.save(any(RentTenant.class))).thenAnswer(inv -> inv.getArgument(0));
        when(tenantRepository.existsByPayToken(any())).thenReturn(false);

        // Stub requireManagerAccess to pass (it's called internally)
        lenient().when(accessRepository.findByAccount_IdAndProperty_Id("RA-TEST-01", "RP-TEST-01"))
                .thenReturn(Optional.empty()); // need to return something with canManage = true

        // We need to stub the access check. Since canManage() is on the entity,
        // and we're mocking the repository, we need to provide a real access entry.
        // Instead, let's verify the tenant deactivation directly.
        // The service calls findByUnit_IdAndActiveTrue first, deactivates, then adds new tenant.

        var req = new RentDtos.CreateTenantRequest(
                "New Tenant", "0700123456", "new@example.com", "2026-11-01", 12, "2026-11-01", null, null);

        // We need to mock requireManagerAccess properly — use a mock accessor
        var access = new com.scanny.entity.RentPropertyAccess();
        access.setAccount(account);
        access.setProperty(property);
        access.setRole(com.scanny.model.enums.PropertyAccessRole.OWNER_MANAGER);
        access.setGrantedAt(Instant.now());
        when(accessRepository.findByAccount_IdAndProperty_Id("RA-TEST-01", "RP-TEST-01"))
                .thenReturn(Optional.of(access));

        RentDtos.TenantSummary result = propertyService.addTenant(account, "RP-TEST-01", "RU-TEST-01", req);

        // The old tenant should be deactivated — save called twice (old deactivation + new tenant)
        ArgumentCaptor<RentTenant> oldCaptor = ArgumentCaptor.forClass(RentTenant.class);
        verify(tenantRepository, org.mockito.Mockito.times(2)).save(oldCaptor.capture());
        // First save is the deactivation, second is the new tenant
        // Check that the old tenant was deactivated
        assertThat(existingTenant.isActive()).isFalse();

        // The new tenant should be active
        assertThat(result.name()).isEqualTo("New Tenant");
        assertThat(result.active()).isTrue();

        // Phone should be normalised
        assertThat(result.phone()).isEqualTo("+256700123456");
    }

    @Test
    void addTenant_addsToVacantUnitWithoutDeactivation() {
        // Unit has no active tenant
        RentUnit vacantUnit = new RentUnit();
        vacantUnit.setId("RU-VACANT");
        vacantUnit.setProperty(property);
        vacantUnit.setUnitNumber("V1");
        vacantUnit.setMonthlyAmount(300_000L);
        vacantUnit.setDueDayOfMonth(5);

        when(unitRepository.findById("RU-VACANT")).thenReturn(Optional.of(vacantUnit));
        when(tenantRepository.findByUnit_IdAndActiveTrue("RU-VACANT"))
                .thenReturn(Optional.empty());
        when(tenantRepository.save(any(RentTenant.class))).thenAnswer(inv -> inv.getArgument(0));
        when(tenantRepository.existsByPayToken(any())).thenReturn(false);

        var access = new com.scanny.entity.RentPropertyAccess();
        access.setAccount(account);
        access.setProperty(property);
        access.setRole(com.scanny.model.enums.PropertyAccessRole.OWNER_MANAGER);
        access.setGrantedAt(Instant.now());
        when(accessRepository.findByAccount_IdAndProperty_Id("RA-TEST-01", "RP-TEST-01"))
                .thenReturn(Optional.of(access));

        var req = new RentDtos.CreateTenantRequest(
                "First Tenant", "0712345678", null, null, null, null, null, null);

        var result = propertyService.addTenant(account, "RP-TEST-01", "RU-VACANT", req);

        assertThat(result.name()).isEqualTo("First Tenant");
        assertThat(result.active()).isTrue();
        assertThat(result.phone()).isEqualTo("+256712345678");
    }
}
