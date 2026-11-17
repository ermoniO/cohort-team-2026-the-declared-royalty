CREATE TABLE auto_pay_settings
(
    setting_id INTEGER PRIMARY KEY,
    enabled    BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT check_auto_pay_singleton CHECK (setting_id = 1)
);

INSERT INTO auto_pay_settings (setting_id, enabled) VALUES (1, FALSE);
