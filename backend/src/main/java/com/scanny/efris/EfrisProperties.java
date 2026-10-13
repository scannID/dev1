package com.scanny.efris;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

/**
 * Bound from {@code scanny.efris.*} in application.yml.
 *
 * <p>When {@code enabled = false} (the default), {@link EfrisApiClient} runs in
 * stub mode — every submission is answered with a fake FDN and verification URL
 * so the full outbox → submission → receipt pipeline can be exercised in dev
 * without URA credentials.
 *
 * <p>To go live, set:
 * <pre>
 *   EFRIS_ENABLED=true
 *   EFRIS_API_URL=https://efris.ura.go.ug/efrisws/ws/tapin/getInformation
 * </pre>
 * and configure each merchant's TIN + device key via the merchant config endpoint.
 */
@Component
@ConfigurationProperties(prefix = "scanny.efris")
public class EfrisProperties {

    /** Master switch. False = stub mode (no URA calls). */
    private boolean enabled = false;

    /** URA EFRIS API endpoint. */
    private String apiUrl = "https://efris.ura.go.ug/efrisws/ws/tapin/getInformation";

    /** HTTP connect timeout in milliseconds. */
    private int connectTimeoutMs = 5000;

    /** HTTP read timeout in milliseconds. */
    private int readTimeoutMs = 10000;

    /** Maximum retry attempts before marking a submission FAILED. */
    private int maxRetries = 3;

    /**
     * Uganda standard VAT rate for tax-inclusive decomposition.
     * 0.18 = 18 %. Tax = total × rate / (1 + rate).
     */
    private double vatRate = 0.18;

    // ── Getters / setters ─────────────────────────────────────────────────────

    public boolean isEnabled()                     { return enabled; }
    public void setEnabled(boolean enabled)        { this.enabled = enabled; }

    public String getApiUrl()                      { return apiUrl; }
    public void setApiUrl(String apiUrl)           { this.apiUrl = apiUrl; }

    public int getConnectTimeoutMs()               { return connectTimeoutMs; }
    public void setConnectTimeoutMs(int v)         { this.connectTimeoutMs = v; }

    public int getReadTimeoutMs()                  { return readTimeoutMs; }
    public void setReadTimeoutMs(int v)            { this.readTimeoutMs = v; }

    public int getMaxRetries()                     { return maxRetries; }
    public void setMaxRetries(int maxRetries)      { this.maxRetries = maxRetries; }

    public double getVatRate()                     { return vatRate; }
    public void setVatRate(double vatRate)         { this.vatRate = vatRate; }
}
