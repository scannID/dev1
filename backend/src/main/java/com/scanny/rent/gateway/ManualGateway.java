package com.scanny.rent.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;

/**
 * Manual / offline payment gateway.
 *
 * <p>Used when a landlord or manager records a payment that was collected
 * directly (cash, MoMo manual transfer, bank deposit, etc.) without any
 * automated push being involved.  The payment is assumed settled immediately —
 * {@link #initiate} returns {@link GatewayStatus#COMPLETED} straight away.
 *
 * <p>No external calls are made. The {@code status()} and {@code parseCallback()}
 * methods are no-ops that always return {@link GatewayStatus#COMPLETED} because
 * manual payments have no async lifecycle.
 */
@Component
public class ManualGateway implements RentPaymentGateway {

    private static final Logger log = LoggerFactory.getLogger(ManualGateway.class);
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    @Override
    public String id() {
        return "manual";
    }

    /**
     * Records a manual payment. Generates a unique transaction reference of the
     * form {@code MAN-<timestamp>-<random>} so records remain traceable without
     * external coordination.
     */
    @Override
    public GatewayResult initiate(GatewayCommand command) {
        String ref = generateRef(command);
        log.info("[ManualGateway] Payment recorded — ref={} chargeId={} amount={} method=manual recordedBy={}",
                ref, command.charge().getId(), command.amount(), command.recordedBy());
        return new GatewayResult(ref, GatewayStatus.COMPLETED, "Manual payment recorded");
    }

    /**
     * Manual payments have no async status to poll — always COMPLETED.
     */
    @Override
    public GatewayStatus status(String transactionRef) {
        return GatewayStatus.COMPLETED;
    }

    /**
     * Manual gateway never receives callbacks — returns COMPLETED unconditionally.
     */
    @Override
    public GatewayStatus parseCallback(String rawPayload) {
        return GatewayStatus.COMPLETED;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static String generateRef(GatewayCommand cmd) {
        // Use external reference if manager supplied one, prefixed so it's recognisable
        if (cmd.reference() != null && !cmd.reference().isBlank()) {
            return "MAN-" + cmd.reference().trim().replaceAll("[^A-Za-z0-9_\\-]", "").toUpperCase();
        }
        // Otherwise: MAN-<epochSeconds>-<8 random chars>
        byte[] random = new byte[6];
        SECURE_RANDOM.nextBytes(random);
        String rand = Base64.getUrlEncoder().withoutPadding().encodeToString(random).toUpperCase();
        return "MAN-" + Instant.now().getEpochSecond() + "-" + rand;
    }
}
