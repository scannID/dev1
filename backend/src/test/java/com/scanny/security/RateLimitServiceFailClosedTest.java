package com.scanny.security;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

class RateLimitServiceFailClosedTest {

    @Test
    void failClosedDeniesWhenRedisErrors() {
        @SuppressWarnings("unchecked")
        ObjectProvider<StringRedisTemplate> provider = mock(ObjectProvider.class);
        StringRedisTemplate redis = mock(StringRedisTemplate.class);
        @SuppressWarnings("unchecked")
        ValueOperations<String, String> ops = mock(ValueOperations.class);
        when(provider.getIfAvailable()).thenReturn(redis);
        when(redis.opsForValue()).thenReturn(ops);
        when(ops.increment(anyString())).thenThrow(new RuntimeException("redis down"));

        RateLimitService failClosed = new RateLimitService(
                provider, true, true, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10);
        assertFalse(failClosed.tryConsume("register:10", "1.1.1.1"));

        RateLimitService failOpen = new RateLimitService(
                provider, true, false, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10);
        assertTrue(failOpen.tryConsume("register:10", "1.1.1.1"));
    }
}
