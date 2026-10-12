package com.tourist.chatbot.service;

import com.tourist.chatbot.model.Destination;
import com.tourist.chatbot.repository.DestinationRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * M4: Cached destination matcher.
 * <p>
 * Loads all destinations once on startup (and refreshes every 10 minutes) to avoid
 * calling {@code findAll()} on every chat message. Supports both the canonical name
 * and any {@code aliases} stored on the {@link Destination}.
 * Uses word-boundary regex so "Ooty" does not match "Mootyard".
 */
@Service
@RequiredArgsConstructor
public class DestinationMatcher {

    private static final Logger log = LoggerFactory.getLogger(DestinationMatcher.class);

    private final DestinationRepository destinationRepository;

    private static final Map<String, List<String>> MULTILINGUAL_ALIASES = Map.ofEntries(
            Map.entry("ooty", List.of("ஊட்டி", "உதகமண்டலம்", "ऊटी", "उधगमंडलम", "udhagamandalam", "ootacamund")),
            Map.entry("chennai", List.of("சென்னை", "மதராஸ்", "चेन्नई", "मद्रास", "madras")),
            Map.entry("kodaikanal", List.of("கொடைக்கானல்", "கொடை", "कोडाइकनाल")),
            Map.entry("madurai", List.of("மதுரை", "மதூரை", "मदुरै")),
            Map.entry("rameswaram", List.of("ராமேஸ்வரம்", "இராமேஸ்வரம்", "रामेश्वरम")),
            Map.entry("goa", List.of("கோவா", "गोवा")),
            Map.entry("manali", List.of("மணாலி", "மனாப்", "मनाली")),
            Map.entry("munnar", List.of("மூணார்", "முன்னார்", "मुन्नार")),
            Map.entry("coorg", List.of("கூர்க்", "कूर्ग", "madikeri", "மடிக்கேரி")),
            Map.entry("mysore", List.of("மைசூர்", "मैसूर", "mysuru")),
            Map.entry("delhi", List.of("டெல்லி", "புது டெல்லி", "दिल्ली", "नई दिल्ली")),
            Map.entry("mumbai", List.of("மும்பை", "मुंबई", "bombay")),
            Map.entry("kanyakumari", List.of("கன்னியாகுமரி", "कन्याकुमारी")),
            Map.entry("taj mahal", List.of("தாஜ்மஹால்", "ताज महल", "agra", "ஆக்ரா", "आगरा")),
            Map.entry("paris", List.of("பாரிஸ்", "पेरिस")),
            Map.entry("london", List.of("லண்டன்", "लंदन")),
            Map.entry("dubai", List.of("துபாய்", "दुबई")),
            Map.entry("tokyo", List.of("டோக்கியோ", "टोक्यो")),
            Map.entry("singapore", List.of("சிங்கப்பூர்", "सिंगापुर"))
    );

    /** Pattern → destination, ordered so longer names take precedence. */
    private volatile Map<Pattern, Destination> patternMap = Map.of();

    @PostConstruct
    @Scheduled(fixedDelay = 10 * 60 * 1000L)
    public void refresh() {
        try {
            List<Destination> all = destinationRepository.findAll();
            Map<Pattern, Destination> built = new LinkedHashMap<>();

            // Sort longer terms first
            List<Map.Entry<String, Destination>> entries = new ArrayList<>();

            for (Destination d : all) {
                Set<String> terms = new LinkedHashSet<>();
                if (d.getName() != null && !d.getName().isBlank()) {
                    String normName = d.getName().trim().toLowerCase();
                    terms.add(normName);
                    // Add built-in multilingual aliases
                    if (MULTILINGUAL_ALIASES.containsKey(normName)) {
                        terms.addAll(MULTILINGUAL_ALIASES.get(normName));
                    }
                }
                if (d.getAliases() != null) {
                    d.getAliases().forEach(a -> {
                        if (a != null && !a.isBlank()) terms.add(a.trim().toLowerCase());
                    });
                }
                for (String term : terms) {
                    entries.add(Map.entry(term, d));
                }
            }

            // Order so longer terms take precedence
            entries.sort((a, b) -> Integer.compare(b.getKey().length(), a.getKey().length()));

            for (Map.Entry<String, Destination> entry : entries) {
                String term = entry.getKey();
                // Check if term contains non-ASCII characters (e.g. Tamil, Devanagari)
                boolean isNonAscii = term.codePoints().anyMatch(cp -> cp > 127);
                String regex = isNonAscii
                        ? "(?i)(?U)(?<!\\p{L})" + Pattern.quote(term)
                        : "(?i)\\b" + Pattern.quote(term) + "\\b";
                built.put(Pattern.compile(regex), entry.getValue());
            }

            this.patternMap = built;
            log.debug("DestinationMatcher refreshed with {} patterns from {} destinations.",
                    built.size(), all.size());
        } catch (Exception e) {
            // DB might not be reachable on startup; keep the existing map.
            log.warn("DestinationMatcher refresh skipped ({}): {}", e.getClass().getSimpleName(), e.getMessage());
        }
    }

    /**
     * Returns the first destination whose name or any alias appears as a whole word in {@code text}.
     */
    public Optional<Destination> find(String text) {
        if (text == null || text.isBlank()) return Optional.empty();
        String lower = text.toLowerCase();
        for (Map.Entry<Pattern, Destination> entry : patternMap.entrySet()) {
            if (entry.getKey().matcher(lower).find()) {
                return Optional.of(entry.getValue());
            }
        }
        return Optional.empty();
    }
}
