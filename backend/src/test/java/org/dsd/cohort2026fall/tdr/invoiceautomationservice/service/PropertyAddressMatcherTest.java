package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PropertyRepository;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PropertyAddressMatcherTest {

    private final PropertyRepository repository = mock(PropertyRepository.class);
    private final PropertyAddressMatcher matcher = new PropertyAddressMatcher(repository);

    private static PropertyEntity property(String street, String city, String state, String zip) {
        return PropertyEntity.builder()
                .propertyId(UUID.randomUUID()).name(street)
                .streetAddress(street).city(city).state(state).zipCode(zip).status("ACTIVE")
                .build();
    }

    private final PropertyEntity industrial = property("125 Industrial Way", "Springfield", "IL", "62701");
    private final PropertyEntity riverside = property("48 Riverside Court", "Springfield", "IL", "62702");

    @Test
    void matchesTheAddressAsPrintedOnABill_ignoringCasePunctuationAndAbbreviations() {
        when(repository.findAll()).thenReturn(List.of(industrial, riverside));

        assertThat(matcher.findMatches("125 Industrial Way, Springfield, IL 62701")).containsExactly(industrial);
        assertThat(matcher.findMatches("Service address: 125 INDUSTRIAL WAY\nSPRINGFIELD IL 62701-4410")).containsExactly(industrial);
        assertThat(matcher.findMatches("48 Riverside Ct., Springfield, IL 62702")).containsExactly(riverside);
    }

    @Test
    void needsTheZipToAgree_orCityAndStateWhenThereIsNoZip() {
        when(repository.findAll()).thenReturn(List.of(industrial));

        assertThat(matcher.findMatches("125 Industrial Way, Springfield, IL 62799")).isEmpty();
        assertThat(matcher.findMatches("125 Industrial Way, Springfield, IL")).containsExactly(industrial);
        assertThat(matcher.findMatches("125 Industrial Way, Chicago, IL")).isEmpty();
    }

    @Test
    void doesNotMatchADifferentHouseNumberOrPartOfAWord() {
        when(repository.findAll()).thenReturn(List.of(industrial));

        assertThat(matcher.findMatches("1125 Industrial Way, Springfield, IL 62701")).isEmpty();
        assertThat(matcher.findMatches("125 Industrial Wayside, Springfield, IL 62701")).isEmpty();
    }

    @Test
    void returnsEveryMatch_soDuplicatesShowUpAsAmbiguous() {
        PropertyEntity copy = property("125 Industrial Way", "Springfield", "IL", "62701");
        when(repository.findAll()).thenReturn(List.of(industrial, copy));

        assertThat(matcher.findMatches("125 Industrial Way, Springfield, IL 62701")).containsExactly(industrial, copy);
    }

    @Test
    void withAName_onlyTheNamedPropertyAtThatAddressMatches() {
        PropertyEntity park = property("125 Industrial Way", "Springfield", "IL", "62701");
        park.setName("Industrial Business Park");
        PropertyEntity workshop = property("125 Industrial Way", "Springfield", "IL", "62701");
        workshop.setName("Alder Creek Workshop");
        PropertyEntity design = property("125 Industrial Way", "Springfield", "IL", "62701");
        design.setName("Harborlight Design Co.");
        when(repository.findAll()).thenReturn(List.of(park, workshop, design));

        String address = "125 Industrial Way, Springfield, IL 62701";
        assertThat(matcher.findMatches(address, "Alder Creek Workshop")).containsExactly(workshop);
        assertThat(matcher.findMatches(address, "HARBORLIGHT DESIGN CO")).containsExactly(design);
        // A name nobody at the address has: no match, rather than falling back to another property
        assertThat(matcher.findMatches(address, "Cedar Valley Market")).isEmpty();
        // Without a name, everything at the address counts
        assertThat(matcher.findMatches(address, null)).containsExactly(park, workshop, design);
        // The name alone isn't enough: the address must match too
        assertThat(matcher.findMatches("48 Riverside Court, Springfield, IL 62702", "Alder Creek Workshop")).isEmpty();
    }

    @Test
    void skipsInactiveProperties_andBlankAddresses() {
        PropertyEntity inactive = property("125 Industrial Way", "Springfield", "IL", "62701");
        inactive.setStatus("INACTIVE");
        when(repository.findAll()).thenReturn(List.of(inactive));

        assertThat(matcher.findMatches("125 Industrial Way, Springfield, IL 62701")).isEmpty();
        assertThat(matcher.findMatches("  ")).isEmpty();
        assertThat(matcher.findMatches(null)).isEmpty();
    }
}
