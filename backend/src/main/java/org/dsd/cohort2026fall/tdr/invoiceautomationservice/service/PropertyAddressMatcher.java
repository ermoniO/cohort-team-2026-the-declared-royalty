package org.dsd.cohort2026fall.tdr.invoiceautomationservice.service;

import lombok.RequiredArgsConstructor;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.PropertyEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.PropertyRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Finds the properties an address on a bill refers to, e.g. "125 Industrial Way, Springfield, IL 62701",
 * optionally narrowed by the property's name as printed on the bill.
 * Ignores case, punctuation and common abbreviations ("Street" = "St"). A property matches when its
 * street address appears in the text and its ZIP code does too; when the text has no ZIP code, its
 * city and state must appear instead. More than one match means the address is ambiguous.
 */
@Service
@RequiredArgsConstructor
public class PropertyAddressMatcher {

    private static final Pattern NOT_ALPHANUMERIC = Pattern.compile("[^a-z0-9]+");
    private static final Pattern HAS_ZIP = Pattern.compile(" \\d{5} ");

    private static final Map<String, String> ABBREVIATIONS = Map.ofEntries(
            Map.entry("street", "st"), Map.entry("avenue", "ave"), Map.entry("road", "rd"),
            Map.entry("drive", "dr"), Map.entry("boulevard", "blvd"), Map.entry("lane", "ln"),
            Map.entry("court", "ct"), Map.entry("place", "pl"), Map.entry("parkway", "pkwy"),
            Map.entry("highway", "hwy"), Map.entry("terrace", "ter"), Map.entry("circle", "cir"),
            Map.entry("suite", "ste"), Map.entry("apartment", "apt"), Map.entry("building", "bldg"),
            Map.entry("north", "n"), Map.entry("south", "s"), Map.entry("east", "e"), Map.entry("west", "w"));

    private final PropertyRepository propertyRepository;

    public List<PropertyEntity> findMatches(String address) {
        return findMatches(address, null);
    }

    /**
     * Properties at this address. Several businesses can share one street address, so when the bill
     * names the property (e.g. "Alder Creek Workshop") only properties with that name count.
     */
    // Loads every property: fine at today's scale, revisit with a normalized-address column if it grows
    @Transactional(readOnly = true)
    public List<PropertyEntity> findMatches(String address, String name) {
        String text = normalize(address);
        if (text.isEmpty()) {
            return List.of();
        }
        String padded = " " + text + " ";
        String wantedName = normalize(name);
        return propertyRepository.findAll().stream()
                .filter(property -> !"INACTIVE".equals(property.getStatus()))
                .filter(property -> matches(property, padded))
                .filter(property -> wantedName.isEmpty() || wantedName.equals(normalize(property.getName())))
                .toList();
    }

    static boolean matches(PropertyEntity property, String paddedText) {
        String street = normalize(property.getStreetAddress());
        if (street.isEmpty() || !paddedText.contains(" " + street + " ")) {
            return false;
        }
        String zip = zip5(property.getZipCode());
        if (zip != null && HAS_ZIP.matcher(paddedText).find()) {
            return paddedText.contains(" " + zip + " ");
        }
        String city = normalize(property.getCity());
        String state = normalize(property.getState());
        return !city.isEmpty() && paddedText.contains(" " + city + " ")
                && !state.isEmpty() && paddedText.contains(" " + state + " ");
    }

    static String normalize(String value) {
        if (value == null) {
            return "";
        }
        String words = NOT_ALPHANUMERIC.matcher(value.toLowerCase(Locale.ROOT)).replaceAll(" ").trim();
        if (words.isEmpty()) {
            return "";
        }
        return Arrays.stream(words.split(" "))
                .map(word -> ABBREVIATIONS.getOrDefault(word, word))
                .collect(Collectors.joining(" "));
    }

    private static String zip5(String zip) {
        String digits = zip == null ? "" : zip.replaceAll("\\D", "");
        return digits.length() >= 5 ? digits.substring(0, 5) : null;
    }
}
