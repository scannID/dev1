package com.scanny.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

class ClientIpResolverTest {

    @Test
    void ignoresSpoofedXffWhenTrustDisabled() {
        ClientIpResolver resolver = new ClientIpResolver(false, "10.0.0.0/8");
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("203.0.113.10");
        when(request.getHeader("X-Forwarded-For")).thenReturn("1.2.3.4");

        assertEquals("203.0.113.10", resolver.resolve(request));
    }

    @Test
    void ignoresXffWhenPeerIsNotTrustedProxy() {
        ClientIpResolver resolver = new ClientIpResolver(true, "10.0.0.0/8");
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("203.0.113.10");
        when(request.getHeader("X-Forwarded-For")).thenReturn("1.2.3.4");

        assertEquals("203.0.113.10", resolver.resolve(request));
    }

    @Test
    void usesXffWhenPeerIsTrustedProxy() {
        ClientIpResolver resolver = new ClientIpResolver(true, "10.0.0.0/8,127.0.0.1/32");
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("10.0.0.5");
        when(request.getHeader("X-Forwarded-For")).thenReturn("198.51.100.20, 10.0.0.5");

        assertEquals("198.51.100.20", resolver.resolve(request));
    }

    @Test
    void exactIpTrustedProxyWorks() {
        ClientIpResolver resolver = new ClientIpResolver(true, "127.0.0.1");
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getRemoteAddr()).thenReturn("127.0.0.1");
        when(request.getHeader("X-Forwarded-For")).thenReturn("198.51.100.7");

        assertEquals("198.51.100.7", resolver.resolve(request));
        assertNotEquals("127.0.0.1", resolver.resolve(request));
    }
}
