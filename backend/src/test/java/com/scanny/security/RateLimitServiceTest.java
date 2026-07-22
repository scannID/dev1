package com.scanny.security;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RateLimitServiceTest {

    @Test
    void localFallbackEnforcesLimit() {
        @SuppressWarnings("unchecked")
        ObjectProvider<StringRedisTemplate> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(null);

        RateLimitService service = new RateLimitService(provider, true, 2, 2, 2, 2, 2, 2, 2, 2, 2);
        assertTrue(service.tryConsume("register:2", "1.1.1.1"));
        assertTrue(service.tryConsume("register:2", "1.1.1.1"));
        assertFalse(service.tryConsume("register:2", "1.1.1.1"));
    }
}
