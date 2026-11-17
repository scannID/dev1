package com.scanny.model.enums;

/**
 * Type of QR token being bound to a device.
 * 
 * - UNIT: Unit-level QR (on apartment door)
 * - TENANT_PAY: Tenant personal payment link
 */
public enum TokenType {
    UNIT,
    TENANT_PAY
}
