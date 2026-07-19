CREATE TABLE platform_configs (
    section     VARCHAR(64) PRIMARY KEY,
    payload     TEXT NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by  VARCHAR(255)
);

INSERT INTO platform_configs (section, payload) VALUES
(
    'platform',
    '{"platformName":"Scanny","supportEmail":"support@scanny.app","qrScanBaseUrl":"http://localhost:5173/b","merchantPortalUrl":"http://localhost:5173"}'
),
(
    'auth',
    '{"keycloakUrl":"http://localhost:8080","realm":"scanny","merchantClientId":"scanny-client","adminClientId":"scanny-admin"}'
),
(
    'payments',
    '{"defaultCurrency":"UGX","minOrderAmount":1000,"maxOrderAmount":5000000,"paymentGatewayUrl":"https://payments.scanny.app"}'
),
(
    'orders',
    '{"orderTimeoutMinutes":30,"maxItemsPerOrder":20,"autoCompleteAfterHours":2,"orderIdPrefix":"ORD-"}'
),
(
    'qr',
    '{"qrTokenPrefix":"SIT-","qrCodeSizePx":220,"scanRateLimitPerMin":60,"trackScanLocation":false}'
),
(
    'notifications',
    '{"orderSmsAlerts":true,"paymentConfirmationEmail":true,"systemAlertEmails":true,"smsGatewayUrl":"https://sms.scanny.app"}'
),
(
    'features',
    '{"merchantSelfRegistration":true,"customerAccounts":true,"mobileMoneyPayments":true,"cardPayments":true,"qrScanAnalytics":true,"multiBusinessMerchants":false,"customerOrderHistory":true,"maintenanceMode":false}'
);
