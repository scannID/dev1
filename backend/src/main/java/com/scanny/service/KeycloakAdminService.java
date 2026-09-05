package com.scanny.service;

import com.scanny.config.KeycloakConfig;
import com.scanny.exception.ApiException;
import jakarta.ws.rs.core.Response;
import org.keycloak.admin.client.Keycloak;
import org.keycloak.admin.client.resource.RealmResource;
import org.keycloak.admin.client.resource.UserResource;
import org.keycloak.admin.client.resource.UsersResource;
import org.keycloak.representations.idm.CredentialRepresentation;
import org.keycloak.representations.idm.RoleRepresentation;
import org.keycloak.representations.idm.UserRepresentation;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
public class KeycloakAdminService {

    private static final Logger logger = LoggerFactory.getLogger(KeycloakAdminService.class);
    
    private final Keycloak keycloak;
    private final KeycloakConfig keycloakConfig;

    public KeycloakAdminService(Keycloak keycloak, KeycloakConfig keycloakConfig) {
        this.keycloak = keycloak;
        this.keycloakConfig = keycloakConfig;
    }

    /**
     * Create a new user in Keycloak
     */
    public UUID createUser(String email, String firstName, String lastName, String role) {
        try {
            RealmResource realmResource = keycloak.realm(keycloakConfig.getRealm());
            UsersResource usersResource = realmResource.users();
            
            // Check if user already exists
            List<UserRepresentation> existingUsers = usersResource.searchByEmail(email, true);
            if (!existingUsers.isEmpty()) {
                throw new ApiException(400, "User with this email already exists in Keycloak");
            }
            
            // Create user representation
            UserRepresentation user = new UserRepresentation();
            user.setEmail(email);
            user.setUsername(email);  // Use email as username
            user.setFirstName(firstName);
            user.setLastName(lastName);
            user.setEnabled(true);
            user.setEmailVerified(false);  // Requires email verification
            
            // Create user
            Response response = usersResource.create(user);
            
            if (response.getStatus() != 201) {
                String error = response.readEntity(String.class);
                logger.error("Failed to create Keycloak user: {}", error);
                throw new ApiException(500, "Failed to create user in Keycloak: " + error);
            }
            
            // Extract user ID from location header
            String locationHeader = response.getHeaderString("Location");
            String userId = locationHeader.substring(locationHeader.lastIndexOf('/') + 1);
            response.close();
            
            // Assign role to user
            assignRoleToUser(userId, role);
            
            // Send verification email
            sendVerificationEmail(userId);
            
            logger.info("Created Keycloak user: {} with role: {}", email, role);
            
            return UUID.fromString(userId);
            
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Error creating Keycloak user", e);
            throw new ApiException(500, "Failed to create user: " + e.getMessage());
        }
    }

    /**
     * Create a staff user (or reuse existing by email) and email Keycloak's
     * UPDATE_PASSWORD + VERIFY_EMAIL actions so they set up credentials.
     */
    public UUID createOrInviteStaffUser(String email, String displayName) {
        try {
            RealmResource realmResource = keycloak.realm(keycloakConfig.getRealm());
            UsersResource usersResource = realmResource.users();

            String trimmedEmail = email.trim().toLowerCase();
            List<UserRepresentation> existing = usersResource.searchByEmail(trimmedEmail, true);
            String userId;
            if (!existing.isEmpty()) {
                userId = existing.get(0).getId();
                ensureRealmRole(userId, "STAFF");
            } else {
                String firstName = displayName;
                String lastName = "";
                String[] parts = displayName.trim().split("\\s+", 2);
                if (parts.length >= 1 && !parts[0].isBlank()) {
                    firstName = parts[0];
                }
                if (parts.length == 2) {
                    lastName = parts[1];
                }

                UserRepresentation user = new UserRepresentation();
                user.setEmail(trimmedEmail);
                user.setUsername(trimmedEmail);
                user.setFirstName(firstName);
                user.setLastName(lastName);
                user.setEnabled(true);
                user.setEmailVerified(false);

                Response response = usersResource.create(user);
                if (response.getStatus() != 201) {
                    String error = response.readEntity(String.class);
                    logger.error("Failed to create Keycloak staff user: {}", error);
                    throw new ApiException(500, "Failed to create staff user in Keycloak: " + error);
                }
                String locationHeader = response.getHeaderString("Location");
                userId = locationHeader.substring(locationHeader.lastIndexOf('/') + 1);
                response.close();
                assignRoleToUser(userId, "STAFF");
            }

            sendPasswordSetupEmail(userId);
            logger.info("Invited Keycloak staff user: {}", trimmedEmail);
            return UUID.fromString(userId);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Error creating Keycloak staff user", e);
            throw new ApiException(500, "Failed to invite staff: " + e.getMessage());
        }
    }

    public void resendPasswordSetupEmail(UUID keycloakUserId) {
        sendPasswordSetupEmail(keycloakUserId.toString());
    }

    private void ensureRealmRole(String userId, String roleName) {
        try {
            RealmResource realmResource = keycloak.realm(keycloakConfig.getRealm());
            UserResource userResource = realmResource.users().get(userId);
            boolean hasRole = userResource.roles().realmLevel().listAll().stream()
                    .anyMatch(r -> roleName.equalsIgnoreCase(r.getName()));
            if (!hasRole) {
                assignRoleToUser(userId, roleName);
            }
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Failed to ensure role {} for user {}", roleName, userId, e);
            throw new ApiException(500, "Failed to assign staff role: " + e.getMessage());
        }
    }

    private void sendPasswordSetupEmail(String userId) {
        try {
            RealmResource realmResource = keycloak.realm(keycloakConfig.getRealm());
            UserResource userResource = realmResource.users().get(userId);
            userResource.executeActionsEmail(List.of("VERIFY_EMAIL", "UPDATE_PASSWORD"));
            logger.info("Sent Keycloak password-setup email to user {}", userId);
        } catch (Exception e) {
            logger.warn("Failed to send Keycloak password-setup email for {}", userId, e);
            // Don't fail invite if email sending fails — merchant can resend
        }
    }

    /**
     * Assign a role to a user
     */
    private void assignRoleToUser(String userId, String roleName) {
        try {
            RealmResource realmResource = keycloak.realm(keycloakConfig.getRealm());
            
            // Get the role
            RoleRepresentation role = realmResource.roles().get(roleName).toRepresentation();
            
            // Assign role to user
            UserResource userResource = realmResource.users().get(userId);
            userResource.roles().realmLevel().add(Collections.singletonList(role));
            
            logger.info("Assigned role {} to user {}", roleName, userId);
            
        } catch (Exception e) {
            logger.error("Failed to assign role to user", e);
            throw new ApiException(500, "Failed to assign role: " + e.getMessage());
        }
    }

    /**
     * Send email verification
     */
    private void sendVerificationEmail(String userId) {
        try {
            RealmResource realmResource = keycloak.realm(keycloakConfig.getRealm());
            UsersResource usersResource = realmResource.users();
            
            // Send verification email
            usersResource.get(userId).sendVerifyEmail();
            
            logger.info("Sent verification email to user {}", userId);
            
        } catch (Exception e) {
            logger.warn("Failed to send verification email", e);
            // Don't fail the registration if email sending fails
        }
    }

    /**
     * Set user password (used when user verifies email)
     */
    public void setUserPassword(String userId, String password) {
        try {
            RealmResource realmResource = keycloak.realm(keycloakConfig.getRealm());
            UserResource userResource = realmResource.users().get(userId);
            
            // Create credential
            CredentialRepresentation credential = new CredentialRepresentation();
            credential.setType(CredentialRepresentation.PASSWORD);
            credential.setValue(password);
            credential.setTemporary(false);
            
            // Set password
            userResource.resetPassword(credential);
            
            logger.info("Set password for user {}", userId);
            
        } catch (Exception e) {
            logger.error("Failed to set user password", e);
            throw new ApiException(500, "Failed to set password: " + e.getMessage());
        }
    }

    /**
     * Mark email as verified
     */
    public void markEmailVerified(String userId) {
        try {
            RealmResource realmResource = keycloak.realm(keycloakConfig.getRealm());
            UserResource userResource = realmResource.users().get(userId);
            
            UserRepresentation user = userResource.toRepresentation();
            user.setEmailVerified(true);
            
            userResource.update(user);
            
            logger.info("Marked email as verified for user {}", userId);
            
        } catch (Exception e) {
            logger.error("Failed to mark email as verified", e);
            throw new ApiException(500, "Failed to verify email: " + e.getMessage());
        }
    }

    /**
     * Get user by ID
     */
    public UserRepresentation getUser(String userId) {
        try {
            RealmResource realmResource = keycloak.realm(keycloakConfig.getRealm());
            return realmResource.users().get(userId).toRepresentation();
        } catch (Exception e) {
            logger.error("Failed to get user", e);
            throw new ApiException(404, "User not found in Keycloak");
        }
    }

    /**
     * Disable user (suspend account)
     */
    public void disableUser(String userId) {
        try {
            RealmResource realmResource = keycloak.realm(keycloakConfig.getRealm());
            UserResource userResource = realmResource.users().get(userId);
            
            UserRepresentation user = userResource.toRepresentation();
            user.setEnabled(false);
            
            userResource.update(user);
            
            logger.info("Disabled user {}", userId);
            
        } catch (Exception e) {
            logger.error("Failed to disable user", e);
            throw new ApiException(500, "Failed to disable user: " + e.getMessage());
        }
    }

    /**
     * Enable user (reactivate account)
     */
    public void enableUser(String userId) {
        try {
            RealmResource realmResource = keycloak.realm(keycloakConfig.getRealm());
            UserResource userResource = realmResource.users().get(userId);
            
            UserRepresentation user = userResource.toRepresentation();
            user.setEnabled(true);
            
            userResource.update(user);
            
            logger.info("Enabled user {}", userId);
            
        } catch (Exception e) {
            logger.error("Failed to enable user", e);
            throw new ApiException(500, "Failed to enable user: " + e.getMessage());
        }
    }

    /**
     * Create or reuse a Keycloak user for an invited sub-admin.
     * Assigns the ADMIN realm role and sends a password-setup email.
     */
    public UUID createOrInviteAdminUser(String email, String displayName) {
        try {
            RealmResource realmResource = keycloak.realm(keycloakConfig.getRealm());
            UsersResource usersResource = realmResource.users();

            String trimmedEmail = email.trim().toLowerCase();
            List<UserRepresentation> existing = usersResource.searchByEmail(trimmedEmail, true);
            String userId;
            if (!existing.isEmpty()) {
                userId = existing.get(0).getId();
                ensureRealmRole(userId, "ADMIN");
            } else {
                String firstName = displayName;
                String lastName = "";
                String[] parts = displayName.trim().split("\\s+", 2);
                if (parts.length >= 1 && !parts[0].isBlank()) firstName = parts[0];
                if (parts.length == 2) lastName = parts[1];

                UserRepresentation user = new UserRepresentation();
                user.setEmail(trimmedEmail);
                user.setUsername(trimmedEmail);
                user.setFirstName(firstName);
                user.setLastName(lastName);
                user.setEnabled(true);
                user.setEmailVerified(false);

                Response response = usersResource.create(user);
                if (response.getStatus() != 201) {
                    String error = response.readEntity(String.class);
                    logger.error("Failed to create Keycloak admin user: {}", error);
                    throw new ApiException(500, "Failed to create admin user in Keycloak: " + error);
                }
                String locationHeader = response.getHeaderString("Location");
                userId = locationHeader.substring(locationHeader.lastIndexOf('/') + 1);
                response.close();
                assignRoleToUser(userId, "ADMIN");
            }

            sendPasswordSetupEmail(userId);
            logger.info("Invited Keycloak admin user: {}", trimmedEmail);
            return UUID.fromString(userId);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            logger.error("Error creating Keycloak admin user", e);
            throw new ApiException(500, "Failed to invite admin: " + e.getMessage());
        }
    }

    /**
     * Delete user
     */
    public void deleteUser(String userId) {
        try {
            RealmResource realmResource = keycloak.realm(keycloakConfig.getRealm());
            realmResource.users().delete(userId);
            
            logger.info("Deleted user {}", userId);
            
        } catch (Exception e) {
            logger.error("Failed to delete user", e);
            throw new ApiException(500, "Failed to delete user: " + e.getMessage());
        }
    }
}
