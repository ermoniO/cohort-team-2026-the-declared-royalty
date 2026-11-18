package org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Table(name = "auto_pay_settings")
public class AutoPaySettingEntity {
    public static final int SINGLETON_ID = 1;

    @Id
    @Column(name = "setting_id")
    private Integer settingId;

    @Column(name = "enabled", nullable = false)
    private boolean enabled;
}
