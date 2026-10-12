package com.tourist.chatbot.service;

import com.tourist.chatbot.model.Destination;
import com.tourist.chatbot.repository.DestinationRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

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

    /** Pattern → destination, ordered so longer names take precedence. */
    private volatile Map<Pattern, Destination> patternMap = Map.of();

    @PostConstruct
    @Scheduled(fixedDelay = 10 * 60 * 1000L)
    public void refresh() {
        try {
            List<Destination> all = destinationRepository.findAll();
            Map<Pattern, Destination> built = new LinkedHashMap<>();

            for (Destination d : all) {
                Set<String> terms = new LinkedHashSet<>();
                if (d.getName() != null && !d.getName().isBlank()) {
                    terms.add(d.getName().trim());
                }
                if (d.getAliases() != null) {
                    d.getAliases().forEach(a -> {
                        if (a != null && !a.isBlank()) terms.add(a.trim());
                    });
                }
                for (String term : terms) {
                    String regex = "\\b" + Pattern.quote(term.toLowerCase()) + "\\b";
                    built.put(Pattern.compile(regex), d);
                }
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
