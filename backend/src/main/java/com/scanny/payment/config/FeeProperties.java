package com.scanny.payment.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "scanny.fees")
public class FeeProperties {

    /** Flat service fee (UGX) charged on top of order subtotal. Placeholder until commercial rate is fixed. */
    private int serviceFeeUgx = 700;

    /** PSO share of the service fee (0–1). Remainder goes to Scanny. */
    private double psoPercent = 0.30;

    public int getServiceFeeUgx() {
        return serviceFeeUgx;
    }

    public void setServiceFeeUgx(int serviceFeeUgx) {
        this.serviceFeeUgx = Math.max(0, serviceFeeUgx);
    }

    public double getPsoPercent() {
        return psoPercent;
    }

    public void setPsoPercent(double psoPercent) {
        if (Double.isNaN(psoPercent) || psoPercent < 0) {
            this.psoPercent = 0;
        } else if (psoPercent > 1) {
            this.psoPercent = 1;
        } else {
            this.psoPercent = psoPercent;
        }
    }
}
