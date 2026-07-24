package com.scanny.payment.model;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class FeeSplitTest {

    @Test
    void psoTakesPercentOfServiceFeeRemainderToScanny() {
        FeeSplit split = FeeSplit.of(10_000, 700, 0.30);
        assertThat(split.subtotal()).isEqualTo(10_000);
        assertThat(split.serviceFee()).isEqualTo(700);
        assertThat(split.psoFee()).isEqualTo(210);
        assertThat(split.platformFee()).isEqualTo(490);
        assertThat(split.merchantPayout()).isEqualTo(10_000);
        assertThat(split.grossCharged()).isEqualTo(10_700);
    }

    @Test
    void zeroSubtotalStillSplitsFee() {
        FeeSplit split = FeeSplit.of(0, 700, 0.30);
        assertThat(split.grossCharged()).isEqualTo(700);
        assertThat(split.merchantPayout()).isEqualTo(0);
        assertThat(split.platformFee()).isEqualTo(490);
    }
}
