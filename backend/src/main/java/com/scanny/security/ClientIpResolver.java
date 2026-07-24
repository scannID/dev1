package com.scanny.security;

import jakarta.servlet.http.HttpServletRequest;
import java.net.InetAddress;
import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Resolves the client IP for rate limiting and audit.
 *
 * <p>Never trusts {@code X-Forwarded-For} / {@code Forwarded} unless the immediate peer
 * is in {@code scanny.client-ip.trusted-proxies}. When trust is disabled (default),
 * only {@link HttpServletRequest#getRemoteAddr()} is used.
 */
@Component
public class ClientIpResolver {

    private final boolean trustForwardedHeaders;
    private final List<Cidr> trustedProxies;

    public ClientIpResolver(
            @Value("${scanny.client-ip.trust-forwarded-headers:false}") boolean trustForwardedHeaders,
            @Value("${scanny.client-ip.trusted-proxies:}") String trustedProxiesCsv
    ) {
        this.trustForwardedHeaders = trustForwardedHeaders;
        this.trustedProxies = parseCidrs(trustedProxiesCsv);
    }

    public String resolve(HttpServletRequest request) {
        if (request == null) {
            return "unknown";
        }
        String remote = normalize(request.getRemoteAddr());
        if (!trustForwardedHeaders || trustedProxies.isEmpty() || !isTrustedProxy(remote)) {
            return remote != null ? remote : "unknown";
        }

        String forwarded = firstForwardedClient(request);
        if (forwarded != null) {
            return forwarded;
        }
        return remote != null ? remote : "unknown";
    }

    private static String firstForwardedClient(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            String first = xff.split(",")[0].trim();
            if (!first.isEmpty()) {
                return normalize(first);
            }
        }
        String forwarded = request.getHeader("Forwarded");
        if (forwarded != null && !forwarded.isBlank()) {
            for (String part : forwarded.split(",")) {
                for (String kv : part.split(";")) {
                    String trimmed = kv.trim();
                    if (trimmed.length() > 4 && trimmed.regionMatches(true, 0, "for=", 0, 4)) {
                        String value = trimmed.substring(4).trim();
                        if (value.startsWith("\"") && value.endsWith("\"") && value.length() > 1) {
                            value = value.substring(1, value.length() - 1);
                        }
                        // Strip optional port / IPv6 brackets: [2001:db8::1]:443
                        if (value.startsWith("[")) {
                            int end = value.indexOf(']');
                            if (end > 1) {
                                value = value.substring(1, end);
                            }
                        } else if (value.contains(".") && value.contains(":")) {
                            value = value.substring(0, value.indexOf(':'));
                        }
                        if (!value.isBlank()) {
                            return normalize(value);
                        }
                    }
                }
            }
        }
        return null;
    }

    private boolean isTrustedProxy(String ip) {
        if (ip == null || ip.isBlank()) {
            return false;
        }
        try {
            InetAddress address = InetAddress.getByName(ip);
            for (Cidr cidr : trustedProxies) {
                if (cidr.contains(address)) {
                    return true;
                }
            }
        } catch (Exception ignored) {
            return false;
        }
        return false;
    }

    private static String normalize(String ip) {
        if (ip == null) {
            return null;
        }
        String trimmed = ip.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        // Strip IPv6 zone id (fe80::1%eth0)
        int zone = trimmed.indexOf('%');
        if (zone > 0) {
            trimmed = trimmed.substring(0, zone);
        }
        return trimmed;
    }

    private static List<Cidr> parseCidrs(String csv) {
        List<Cidr> result = new ArrayList<>();
        if (csv == null || csv.isBlank()) {
            return result;
        }
        for (String raw : csv.split(",")) {
            String entry = raw.trim();
            if (entry.isEmpty()) {
                continue;
            }
            try {
                result.add(Cidr.parse(entry));
            } catch (Exception ignored) {
                // Skip invalid entries rather than failing startup for a typo in one CIDR.
            }
        }
        return result;
    }

    static final class Cidr {
        private final byte[] network;
        private final int prefixLength;

        private Cidr(byte[] network, int prefixLength) {
            this.network = network;
            this.prefixLength = prefixLength;
        }

        static Cidr parse(String value) throws Exception {
            String ipPart = value;
            int prefix = -1;
            int slash = value.indexOf('/');
            if (slash >= 0) {
                ipPart = value.substring(0, slash).trim();
                prefix = Integer.parseInt(value.substring(slash + 1).trim());
            }
            InetAddress address = InetAddress.getByName(ipPart);
            byte[] bytes = address.getAddress();
            if (prefix < 0) {
                prefix = bytes.length * 8;
            }
            if (prefix < 0 || prefix > bytes.length * 8) {
                throw new IllegalArgumentException("Invalid prefix: " + prefix);
            }
            return new Cidr(bytes, prefix);
        }

        boolean contains(InetAddress address) {
            byte[] candidate = address.getAddress();
            if (candidate.length != network.length) {
                return false;
            }
            int fullBytes = prefixLength / 8;
            int remBits = prefixLength % 8;
            for (int i = 0; i < fullBytes; i++) {
                if (candidate[i] != network[i]) {
                    return false;
                }
            }
            if (remBits == 0) {
                return true;
            }
            int mask = 0xFF << (8 - remBits);
            return (candidate[fullBytes] & mask) == (network[fullBytes] & mask);
        }
    }
}
