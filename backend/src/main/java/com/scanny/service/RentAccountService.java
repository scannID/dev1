package com.scanny.service;

import com.scanny.dto.RentDtos;
import com.scanny.entity.RentAccount;
import com.scanny.exception.ApiException;
import com.scanny.repository.RentAccountRepository;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Manages rent accounts.
 *
 * <p>Authentication is Keycloak-based (same pattern as {@code MerchantService}):
 * the {@code keycloakUserId} (JWT {@code sub} claim) is the primary key linking
 * a Keycloak user to a {@link RentAccount}.  On first login the account is
 * either found by Keycloak ID, linked by email, or auto-provisioned.
 *
 * <p>The legacy {@code accessKey} ("RAK-XXXXXXXX") is retained for backward
 * compatibility with the dashboard controller's {@code X-Rent-Access-Key} header
 * and for the public pay-page token resolution.  New code authenticates via JWT.
 */
@Service
public class RentAccountService {

    private static final Logger log = LoggerFactory.getLogger(RentAccountService.class);

    private final RentAccountRepository accountRepository;
    private final KeycloakAdminService keycloakAdminService;

    @Value("${scanny.customer-url}")
    private String customerUrl;

    public RentAccountService(
            RentAccountRepository accountRepository,
            KeycloakAdminService keycloakAdminService) {
        this.accountRepository = accountRepository;
        this.keycloakAdminService = keycloakAdminService;
    }

    // ── Keycloak registration ─────────────────────────────────────────────────

    /**
     * Registers a new rent-manager account.
     * <ol>
     *   <li>Creates a Keycloak user with the {@code RENT_MANAGER} realm role.</li>
     *   <li>Creates (or returns existing) {@link RentAccount} linked to that user.</li>
     * </ol>
     * Idempotent on email — if the email already has a {@code RentAccount} the
     * existing record is returned (same behaviour as merchant registration).
     */
    @Transactional
    public RentDtos.AccountResponse register(RentDtos.RegisterRentManagerRequest req) {
        String email = req.email().trim().toLowerCase(Locale.ROOT);

        // Return existing account if the email is already registered
        return accountRepository.findByEmail(email)
                .map(RentDtos.AccountResponse::from)
                .orElseGet(() -> {
                    // Create user in Keycloak first
                    UUID keycloakUserId = keycloakAdminService.createUser(
                            email,
                            req.name().trim(),
                            "",
                            "RENT_MANAGER");

                    RentAccount account = new RentAccount();
                    account.setId(generateId());
                    account.setKeycloakUserId(keycloakUserId);
                    account.setName(req.name().trim());
                    account.setEmail(email);
                    account.setPhone(req.phone() != null ? req.phone().trim() : "");
                    account.setAccessKey(generateAccessKey());
                    account.setCreatedAt(Instant.now());

                    log.info("Registered new rent manager: {} ({}), Keycloak ID: {}",
                            req.name(), email, keycloakUserId);
                    return RentDtos.AccountResponse.from(accountRepository.save(account));
                });
    }

    // ── Post-login resolution (Keycloak JWT) ──────────────────────────────────

    /**
     * Full post-login payload.  Called from the authenticated {@code /me} endpoint
     * after the JWT has been validated by Spring Security.
     */
    @Transactional
    public RentDtos.AccountResponse getMe(Jwt jwt) {
        RentAccount account = handleLogin(jwt);
        return RentDtos.AccountResponse.from(account);
    }

    /**
     * Resolves (or provisions) the {@link RentAccount} for an authenticated
     * Keycloak user.  Three strategies, same as {@code MerchantService}:
     * <ol>
     *   <li>Find by {@code keycloakUserId} — primary, O(1).</li>
     *   <li>Link by email — email already has a pre-Keycloak row; stamps the UUID.</li>
     *   <li>Auto-provision — first login after Keycloak user was created externally.</li>
     * </ol>
     */
    @Transactional
    public RentAccount handleLogin(Jwt jwt) {
        UUID keycloakUserId = UUID.fromString(jwt.getSubject());

        RentAccount account = accountRepository.findByKeycloakUserId(keycloakUserId)
                .or(() -> linkByEmail(jwt, keycloakUserId))
                .orElseGet(() -> provision(jwt, keycloakUserId));

        account.setUpdatedAt(Instant.now());
        return accountRepository.save(account);
    }

    private java.util.Optional<RentAccount> linkByEmail(Jwt jwt, UUID keycloakUserId) {
        String email = extractEmail(jwt);
        if (email == null) return java.util.Optional.empty();
        return accountRepository.findByEmail(email).map(existing -> {
            existing.setKeycloakUserId(keycloakUserId);
            log.info("Linked RentAccount {} to Keycloak user {}", email, keycloakUserId);
            return accountRepository.save(existing);
        });
    }

    private RentAccount provision(Jwt jwt, UUID keycloakUserId) {
        String email = extractEmail(jwt);
        if (email == null || email.isBlank()) {
            throw new ApiException(400,
                    "No rent-manager account found for this Keycloak user. " +
                    "Please register first at /rent/create.");
        }
        if (accountRepository.existsByEmail(email)) {
            throw new ApiException(409,
                    "Email already registered under a different Keycloak account.");
        }
        String name = extractName(jwt, email);
        RentAccount account = new RentAccount();
        account.setId(generateId());
        account.setKeycloakUserId(keycloakUserId);
        account.setName(name);
        account.setEmail(email);
        account.setAccessKey(generateAccessKey());
        account.setCreatedAt(Instant.now());
        log.info("Auto-provisioned RentAccount for Keycloak user {} ({})", email, keycloakUserId);
        return accountRepository.saveAndFlush(account);
    }

    // ── Legacy access-key helpers (kept for dashboard controller + pay page) ──

    /**
     * Creates a new rent account using the legacy key-based flow.
     * If an account with the same email already exists, returns it (idempotent).
     * Used by the public {@code POST /api/public/rent/accounts} endpoint.
     */
    @Transactional
    public RentDtos.AccountResponse createAccount(RentDtos.CreateAccountRequest req) {
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        return accountRepository.findByEmail(email)
                .map(RentDtos.AccountResponse::from)
                .orElseGet(() -> {
                    RentAccount account = new RentAccount();
                    account.setId(generateId());
                    account.setName(req.name().trim());
                    account.setEmail(email);
                    account.setPhone(req.phone() != null ? req.phone().trim() : "");
                    account.setAccessKey(generateAccessKey());
                    account.setCreatedAt(Instant.now());
                    return RentDtos.AccountResponse.from(accountRepository.save(account));
                });
    }

    @Transactional(readOnly = true)
    public RentDtos.AccountResponse getByAccessKey(String accessKey) {
        return RentDtos.AccountResponse.from(requireByAccessKey(accessKey));
    }

    @Transactional(readOnly = true)
    public RentAccount requireByAccessKey(String accessKey) {
        if (accessKey == null || accessKey.isBlank()) {
            throw new ApiException(400, "Access key is required");
        }
        return accountRepository.findByAccessKey(accessKey.trim())
                .orElseThrow(() -> new ApiException(401, "Invalid access key"));
    }

    /**
     * Finds an existing account by email, or creates a stub account if none
     * exists. Used when granting access to an account that hasn't signed up yet.
     */
    @Transactional
    public RentAccount findOrCreateByEmail(String email) {
        String norm = email.trim().toLowerCase(Locale.ROOT);
        return accountRepository.findByEmail(norm).orElseGet(() -> {
            RentAccount account = new RentAccount();
            account.setId(generateId());
            account.setName(norm);
            account.setEmail(norm);
            account.setAccessKey(generateAccessKey());
            account.setCreatedAt(Instant.now());
            return accountRepository.save(account);
        });
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static String extractEmail(Jwt jwt) {
        String email = jwt.getClaimAsString("email");
        if (email != null && !email.isBlank()) return email.trim().toLowerCase(Locale.ROOT);
        String preferred = jwt.getClaimAsString("preferred_username");
        if (preferred != null && preferred.contains("@")) return preferred.trim().toLowerCase(Locale.ROOT);
        return null;
    }

    private static String extractName(Jwt jwt, String email) {
        String name = jwt.getClaimAsString("name");
        if (name != null && !name.isBlank()) return name.trim();
        String given = jwt.getClaimAsString("given_name");
        String family = jwt.getClaimAsString("family_name");
        if (given != null && !given.isBlank()) {
            return family != null && !family.isBlank() ? (given + " " + family).trim() : given.trim();
        }
        // Fall back to email prefix
        return email.contains("@") ? email.split("@")[0] : email;
    }

    private String generateId() {
        return "RA-" + UUID.randomUUID().toString().replace("-", "").substring(0, 10).toUpperCase();
    }

    private String generateAccessKey() {
        for (int i = 0; i < 8; i++) {
            String key = "RAK-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
            if (!accountRepository.existsByAccessKey(key)) return key;
        }
        throw new IllegalStateException("Could not generate unique rent access key after 8 attempts");
    }
}
