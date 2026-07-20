package com.scanny.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestJwtConfig.class)
class SecurityMatrixTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void healthIsPublic() throws Exception {
        mockMvc.perform(get("/api/health")).andExpect(status().isOk());
    }

    @Test
    void adminRequiresAuth() throws Exception {
        mockMvc.perform(get("/api/admin/dashboard/metrics")).andExpect(status().isUnauthorized());
    }

    @Test
    void merchantBusinessListRequiresAuth() throws Exception {
        mockMvc.perform(get("/api/businesses")).andExpect(status().isUnauthorized());
    }

    @Test
    void ticketListRequiresAuth() throws Exception {
        mockMvc.perform(get("/api/tickets")).andExpect(status().isUnauthorized());
    }

    @Test
    void quickPayTrackIsPublic() throws Exception {
        mockMvc.perform(get("/api/quick-payments/public/track/TRK-NOTEXIST"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    if (status == 401 || status == 403) {
                        throw new AssertionError("Public track must not require auth, got " + status);
                    }
                });
    }

    @Test
    void quickPayListRequiresAuth() throws Exception {
        mockMvc.perform(get("/api/quick-payments/codes")).andExpect(status().isUnauthorized());
    }

    @Test
    void publicMenuIsAllowed() throws Exception {
        mockMvc.perform(get("/api/businesses/demo/menu"))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    if (status == 401 || status == 403) {
                        throw new AssertionError("Public menu must not require auth, got " + status);
                    }
                });
    }
}
