package com.scanny.service;

import com.scanny.payment.config.FeeProperties;
import com.scanny.payment.model.FeeSplit;
import org.springframework.stereotype.Service;

@Service
public class FeeService {

    private final FeeProperties feeProperties;

    public FeeService(FeeProperties feeProperties) {
        this.feeProperties = feeProperties;
    }

    public int serviceFeeUgx() {
        return feeProperties.getServiceFeeUgx();
    }

    public double psoPercent() {
        return feeProperties.getPsoPercent();
    }

    public FeeSplit split(int subtotal) {
        return FeeSplit.of(subtotal, feeProperties.getServiceFeeUgx(), feeProperties.getPsoPercent());
    }

    public FeeSplit split(int subtotal, int serviceFee) {
        return FeeSplit.of(subtotal, serviceFee, feeProperties.getPsoPercent());
    }
}
