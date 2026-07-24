package com.scanny.payment.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "scanny.payments")
public class PaymentProperties {

    private String defaultProvider = "stub";
    private boolean fallbackToStub = false;
    /** Scanny account/wallet that receives serviceFee - psoFee after split settlement. */
    private String scannyFeeDestination = "";

    private Stub stub = new Stub();
    private ProviderConfig mtnMomo = new ProviderConfig();
    private ProviderConfig airtelMoney = new ProviderConfig();

    public String getDefaultProvider() {
        return defaultProvider;
    }

    public void setDefaultProvider(String defaultProvider) {
        this.defaultProvider = defaultProvider;
    }

    public boolean isFallbackToStub() {
        return fallbackToStub;
    }

    public void setFallbackToStub(boolean fallbackToStub) {
        this.fallbackToStub = fallbackToStub;
    }

    public String getScannyFeeDestination() {
        return scannyFeeDestination;
    }

    public void setScannyFeeDestination(String scannyFeeDestination) {
        this.scannyFeeDestination = scannyFeeDestination != null ? scannyFeeDestination : "";
    }

    public Stub getStub() {
        return stub;
    }

    public void setStub(Stub stub) {
        this.stub = stub;
    }

    public ProviderConfig getMtnMomo() {
        return mtnMomo;
    }

    public void setMtnMomo(ProviderConfig mtnMomo) {
        this.mtnMomo = mtnMomo;
    }

    public ProviderConfig getAirtelMoney() {
        return airtelMoney;
    }

    public void setAirtelMoney(ProviderConfig airtelMoney) {
        this.airtelMoney = airtelMoney;
    }

    public static class Stub {
        /** Dev helper: auto-mark payments paid after N seconds (0 = disabled). */
        private int autoCompleteSeconds = 0;

        public int getAutoCompleteSeconds() {
            return autoCompleteSeconds;
        }

        public void setAutoCompleteSeconds(int autoCompleteSeconds) {
            this.autoCompleteSeconds = autoCompleteSeconds;
        }
    }

    public static class ProviderConfig {
        private boolean enabled;
        private String apiUrl = "";
        private String apiKey = "";
        private String apiSecret = "";
        private String subscriptionKey = "";
        private String callbackUrl = "";

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getApiUrl() {
            return apiUrl;
        }

        public void setApiUrl(String apiUrl) {
            this.apiUrl = apiUrl;
        }

        public String getApiKey() {
            return apiKey;
        }

        public void setApiKey(String apiKey) {
            this.apiKey = apiKey;
        }

        public String getApiSecret() {
            return apiSecret;
        }

        public void setApiSecret(String apiSecret) {
            this.apiSecret = apiSecret;
        }

        public String getSubscriptionKey() {
            return subscriptionKey;
        }

        public void setSubscriptionKey(String subscriptionKey) {
            this.subscriptionKey = subscriptionKey;
        }

        public String getCallbackUrl() {
            return callbackUrl;
        }

        public void setCallbackUrl(String callbackUrl) {
            this.callbackUrl = callbackUrl;
        }

        public boolean isConfigured() {
            return enabled && apiUrl != null && !apiUrl.isBlank() && apiKey != null && !apiKey.isBlank();
        }
    }
}
