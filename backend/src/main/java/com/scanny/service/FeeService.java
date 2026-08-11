package com.scanny.service;

import com.scanny.entity.Merchant;
import com.scanny.payment.config.FeeProperties;
import com.scanny.payment.model.FeeSplit;
import com.scanny.repository.MerchantRepository;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class FeeService {

    private final FeeProperties feeProperties;
    private final MerchantRepository merchantRepository;

    public FeeService(FeeProperties feeProperties, MerchantRepository merchantRepository) {
        this.feeProperties = feeProperties;
        this.merchantRepository = merchantRepository;
    }

    public int serviceFeeUgx() {
        return feeProperties.getServiceFeeUgx();
    }

    public double psoPercent() {
        return feeProperties.getPsoPercent();
    }

    /** Simple split using global PSO percent and no merchant commission. */
    public FeeSplit split(int subtotal) {
        return FeeSplit.of(subtotal, feeProperties.getServiceFeeUgx(), feeProperties.getPsoPercent(), 0);
    }

    /** Split with an explicit service fee override and no merchant commission. */
    public FeeSplit split(int subtotal, int serviceFee) {
        return FeeSplit.of(subtotal, serviceFee, feeProperties.getPsoPercent(), 0);
    }

    /**
     * Merchant-aware split. Looks up the merchant by UUID string, reads their
     * {@code serviceFeeMerchantPercent}, and applies it to the service-fee split.
     * Falls back to 0 (platform keeps full fee) when the merchant is not found.
     */
    public FeeSplit split(int subtotal, String merchantId) {
        int merchantCommissionPct = resolveMerchantCommission(merchantId);
        return FeeSplit.of(
                subtotal,
                feeProperties.getServiceFeeUgx(),
                feeProperties.getPsoPercent(),
                merchantCommissionPct
        );
    }

    // ── private helpers ───────────────────────────────────────────────────────

    private int resolveMerchantCommission(String merchantId) {
        if (merchantId == null || merchantId.isBlank()) {
            return 0;
        }
        try {
            return merchantRepository.findById(UUID.fromString(merchantId))
                    .map(Merchant::getServiceFeeMerchantPercent)
                    .orElse(0);
        } catch (IllegalArgumentException ex) {
            return 0;
        }
    }
}
