package org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.AutoPaySettingEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AutoPaySettingRepository extends JpaRepository<AutoPaySettingEntity, Integer> {
}
