package com.tourist.chatbot.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tourist.chatbot.model.Destination;
import com.tourist.chatbot.repository.DestinationRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import com.tourist.chatbot.model.User;
import com.tourist.chatbot.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final DestinationRepository destinationRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void run(ApplicationArguments args) {
        try {
            seedDemoUser();

            if (destinationRepository.count() > 0) {
                log.info("Destination catalog already initialized with {} destinations.", destinationRepository.count());
                return;
            }

            log.info("Initializing destination catalog from seed data...");
            loadAndSeedDestinations();
        } catch (Exception e) {
            log.warn("MongoDB Atlas connection could not be established on startup (verify your network or MONGODB_URI): {}", e.getMessage());
        }
    }

    private void seedDemoUser() {
        try {
            if (userRepository.findByUsername("demo").isEmpty()) {
                User demoUser = User.builder()
                        .username("demo")
                        .email("demo@touristguide.com")
                        .password(passwordEncoder.encode("demo123"))
                        .fullName("Demo Traveller")
                        .bio("Travel enthusiast discovering worldwide landmarks with AI.")
                        .roles(Set.of("ROLE_USER"))
                        .build();
                userRepository.save(demoUser);
                log.info("Seed demo account created: username='demo', password='demo123'");
            }
        } catch (Exception e) {
            log.warn("Could not seed demo account: {}", e.getMessage());
        }
    }

    private void loadAndSeedDestinations() {

        try {
            ClassPathResource resource = new ClassPathResource("data/destinations.json");
            if (resource.exists()) {
                try (InputStream is = resource.getInputStream()) {
                    JsonNode root = objectMapper.readTree(is);
                    Iterator<Map.Entry<String, JsonNode>> fields = root.fields();

                    while (fields.hasNext()) {
                        Map.Entry<String, JsonNode> entry = fields.next();
                        String placeKey = entry.getKey();
                        JsonNode node = entry.getValue();

                        String formattedName = capitalizeWords(placeKey);
                        List<String> images = new ArrayList<>();
                        if (node.has("images") && node.get("images").isArray()) {
                            node.get("images").forEach(img -> images.add(img.asText()));
                        }

                        Double lat = node.has("lat") ? node.get("lat").asDouble() : null;
                        Double lng = node.has("lng") ? node.get("lng").asDouble() : null;
                        String mapsLink = node.has("maps_link") ? node.get("maps_link").asText() : "";

                        Destination dest = Destination.builder()
                                .name(formattedName)
                                .country(inferCountry(formattedName))
                                .description("Iconic world-renowned travel attraction and cultural landmark.")
                                .famousFor("Spectacular architecture, scenic views and historical significance")
                                .bestTime("October to March")
                                .latitude(lat)
                                .longitude(lng)
                                .mapsLink(mapsLink)
                                .images(images)
                                .tags(List.of("Sightseeing", "Historical", "Iconic Landmark"))
                                .build();

                        destinationRepository.save(dest);
                    }
                }
            }

            // Seed featured destinations like Ooty, Goa, Paris, Taj Mahal with rich details
            seedFeaturedDestinations();

            log.info("Destination catalog initialization complete. Total destinations: {}", destinationRepository.count());
        } catch (Exception e) {
            log.warn("Failed to initialize destinations from JSON: {}", e.getMessage());
            seedFeaturedDestinations();
        }
    }

    private void seedFeaturedDestinations() {
        List<Destination> featured = List.of(
                Destination.builder()
                        .name("Ooty")
                        .country("India")
                        .continent("Asia")
                        .description("Known as the 'Queen of Hill Stations', Ooty features picturesque tea gardens, serene lakes, cool climate, and the Nilgiri Mountain Railway.")
                        .famousFor("Tea Gardens, Ooty Lake, Botanical Gardens, Nilgiri Toy Train, Doddabetta Peak")
                        .bestTime("Oct - Jun")
                        .peakSeason("April - May")
                        .offSeason("July - August (Monsoon)")
                        .weather("18°C Mostly Cloudy")
                        .idealDuration("3 to 4 Days")
                        .unescoStatus("Nilgiri Mountain Railway UNESCO World Heritage")
                        .openingTime("08:30 AM")
                        .closingTime("06:30 PM")
                        .entryFee("₹30 - ₹50 for gardens")
                        .rating(4.8)
                        .reviewCount(3420)
                        .latitude(11.4102)
                        .longitude(76.6950)
                        .mapsLink("https://www.google.com/maps/search/?api=1&query=11.4102,76.6950")
                        .images(List.of(
                                "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=800",
                                "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800",
                                "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800"
                        ))
                        .tags(List.of("Hill Station", "Nature", "Tea Gardens", "Couples", "Family"))
                        .officialWebsite("https://www.tamilnadutourism.tn.gov.in/")
                        .travelTip("Book the Nilgiri toy train tickets weeks in advance. Carry warm clothes for chilly evenings.")
                        .attractions(List.of(
                                Map.of("name", "Ooty Lake", "rating", 4.5, "reviews", "2.3K", "image", "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=800", "description", "Picturesque artificial lake offering pedal boating and tranquil eucalyptus walks."),
                                Map.of("name", "Doddabetta Peak", "rating", 4.6, "reviews", "1.8K", "image", "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800", "description", "Highest peak in the Nilgiris with telescope house panoramic view."),
                                Map.of("name", "Botanical Garden", "rating", 4.4, "reviews", "2.1K", "image", "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800", "description", "Sprawling 55-acre heritage garden with exotic flora and fossil tree trunk."),
                                Map.of("name", "Rose Garden", "rating", 4.3, "reviews", "1.9K", "image", "https://images.unsplash.com/photo-1496062031456-07b8f162a322?w=800", "description", "Terraced garden cultivating thousands of exquisite rose species.")
                        ))
                        .hotels(List.of(
                                Map.of("name", "Savoy - IHCL SeleQtions", "tier", "Luxury", "price", "₹12,500/night", "rating", 4.7, "image", "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800"),
                                Map.of("name", "Sterling Ooty Elk Hill", "tier", "Mid-Range", "price", "₹4,800/night", "rating", 4.4, "image", "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800"),
                                Map.of("name", "Zostel Ooty", "tier", "Budget", "price", "₹1,400/night", "rating", 4.6, "image", "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800")
                        ))
                        .localFoods(List.of(
                                Map.of("name", "Ooty Homemade Chocolates", "type", "Confectionery", "description", "Rich handmade fudge, truffles, and white chocolates", "price", "₹250 / box"),
                                Map.of("name", "Nilgiri Orthodox Tea", "type", "Beverage", "description", "Fresh high-grown fragrant estate tea", "price", "₹60 / cup"),
                                Map.of("name", "Crispy Medu Vada & Filter Coffee", "type", "Traditional Breakfast", "description", "Classic South Indian breakfast staple", "price", "₹90")
                        ))
                        .travelTipsList(List.of(
                                "Mornings and evenings get surprisingly cold even in summer—carry light woolens.",
                                "Hire a certified local cab for Doddabetta and Pykara Lake circuits.",
                                "Sample fresh Ooty carrots and homemade plum chocolates at Commercial Road."
                        ))
                        .build(),

                Destination.builder()
                        .name("Manali")
                        .country("India")
                        .continent("Asia")
                        .description("High-altitude Himalayan resort town renowned for snow adventures, pine-scented valleys, hot springs, and mountain trekking.")
                        .famousFor("Solang Valley, Rohtang Pass, Hadimba Temple, Paragliding, River Rafting")
                        .bestTime("Oct - Jun")
                        .peakSeason("May - June & Dec - Jan")
                        .offSeason("July - August")
                        .weather("14°C Sunny & Crisp")
                        .idealDuration("4 to 5 Days")
                        .entryFee("Free for town; permits for Rohtang")
                        .rating(4.8)
                        .reviewCount(4210)
                        .latitude(32.2432)
                        .longitude(77.1892)
                        .mapsLink("https://www.google.com/maps/search/?api=1&query=32.2432,77.1892")
                        .images(List.of(
                                "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800",
                                "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=800"
                        ))
                        .tags(List.of("Himalayas", "Snow", "Adventure", "Hill Station", "Trekking"))
                        .officialWebsite("https://himachaltourism.gov.in/")
                        .travelTip("Rohtang Pass permits must be booked in advance online. Carry thermal layers.")
                        .attractions(List.of(
                                Map.of("name", "Solang Valley", "rating", 4.7, "reviews", "3.2K", "image", "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800", "description", "Adrenaline hub for paragliding, skiing, zorbing and snow quad biking."),
                                Map.of("name", "Rohtang Pass", "rating", 4.8, "reviews", "4.1K", "image", "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800", "description", "Breathtaking mountain pass connecting Kullu with Lahaul and Spiti Valleys."),
                                Map.of("name", "Hadimba Temple", "rating", 4.6, "reviews", "2.8K", "image", "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800", "description", "Ancient pagoda-style wooden temple nestled in towering cedar forests."),
                                Map.of("name", "Mall Road", "rating", 4.4, "reviews", "2.5K", "image", "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800", "description", "Vibrant pedestrian promenade with cafes, woolens, and handicrafts.")
                        ))
                        .hotels(List.of(
                                Map.of("name", "The Himalayan Resort", "tier", "Luxury", "price", "₹14,000/night", "rating", 4.8, "image", "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800"),
                                Map.of("name", "Snow Valley Resorts", "tier", "Mid-Range", "price", "₹4,200/night", "rating", 4.5, "image", "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800"),
                                Map.of("name", "Zostel Old Manali", "tier", "Budget", "price", "₹1,100/night", "rating", 4.6, "image", "https://images.unsplash.com/photo-1555854877-bab0e564b8d5?w=800")
                        ))
                        .localFoods(List.of(
                                Map.of("name", "Himachali Siddu", "type", "Local Bread", "description", "Steamed wheat bun stuffed with spiced walnuts and poppy seeds", "price", "₹120"),
                                Map.of("name", "Trout Fish Fry", "type", "Non-Veg Specialty", "description", "Fresh caught river trout pan-fried in mountain herbs", "price", "₹380"),
                                Map.of("name", "Tibetan Thukpa & Momos", "type", "Comfort Food", "description", "Steaming noodle soup and juicy handmade dumplings", "price", "₹150")
                        ))
                        .travelTipsList(List.of(
                                "Stay in Old Manali for quiet cafes and bohemian riverside vibes.",
                                "Book adventure sports only through authorized operators at Solang.",
                                "Acclimate for a few hours before ascending towards Rohtang Pass."
                        ))
                        .build(),

                Destination.builder()
                        .name("Kerala")
                        .country("India")
                        .continent("Asia")
                        .description("Known as 'God's Own Country', celebrated for emerald backwaters, misty tea plantations, Ayurvedic wellness, and palm-fringed coastlines.")
                        .famousFor("Alleppey Houseboats, Munnar Tea Valleys, Kovalam Beach, Kathakali, Ayurveda")
                        .bestTime("Sep - Mar")
                        .peakSeason("Nov - Feb")
                        .weather("26°C Tropical Breeze")
                        .idealDuration("5 to 7 Days")
                        .rating(4.9)
                        .reviewCount(5120)
                        .latitude(9.4981)
                        .longitude(76.3388)
                        .mapsLink("https://www.google.com/maps/search/?api=1&query=9.4981,76.3388")
                        .images(List.of(
                                "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800",
                                "https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=800"
                        ))
                        .tags(List.of("Backwaters", "Nature", "Beaches", "Ayurveda", "Houseboats"))
                        .officialWebsite("https://www.keralatourism.org/")
                        .travelTip("Spend at least one overnight journey on a traditional Alleppey kettuvallam houseboat.")
                        .attractions(List.of(
                                Map.of("name", "Alleppey Backwaters", "rating", 4.9, "reviews", "4.5K", "image", "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800", "description", "Tranquil maze of canals and lagoons navigated by traditional thatched houseboats."),
                                Map.of("name", "Munnar Tea Estates", "rating", 4.8, "reviews", "3.9K", "image", "https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=800", "description", "Rolling verdant tea hills, misty waterfalls and Anamudi mountain peak."),
                                Map.of("name", "Periyar Wildlife Sanctuary", "rating", 4.5, "reviews", "2.1K", "image", "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800", "description", "Elephant and tiger reserve surrounding a serene lake in Thekkady."),
                                Map.of("name", "Fort Kochi", "rating", 4.6, "reviews", "2.7K", "image", "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800", "description", "Colonial seaside heritage hub with cantilevered Chinese fishing nets.")
                        ))
                        .build(),

                Destination.builder()
                        .name("Goa")
                        .country("India")
                        .continent("Asia")
                        .description("India's pocket-sized coastal haven, famed for golden beaches, water sports, Portuguese churches, vibrant flea markets, and fresh seafood.")
                        .famousFor("Beaches, Water Sports, Nightclubs, Seafood, Portuguese Architecture")
                        .bestTime("Nov - Feb")
                        .weather("28°C Sunny Coastal")
                        .idealDuration("4 to 5 Days")
                        .rating(4.7)
                        .reviewCount(4890)
                        .latitude(15.2993)
                        .longitude(74.1240)
                        .mapsLink("https://www.google.com/maps/search/?api=1&query=15.2993,74.1240")
                        .images(List.of(
                                "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800",
                                "https://images.unsplash.com/photo-1614082242765-7c98ca0f3df3?w=800"
                        ))
                        .tags(List.of("Beach", "Nightlife", "Water Sports", "Relaxation", "Seafood"))
                        .officialWebsite("https://goatourism.gov.in/")
                        .travelTip("Rent a two-wheeler to hop between North Goa nightlife and South Goa tranquility.")
                        .attractions(List.of(
                                Map.of("name", "Baga Beach", "rating", 4.5, "reviews", "3.8K", "image", "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800", "description", "Lively shoreline packed with water sports, beach shacks and sunset vibes."),
                                Map.of("name", "Basilica of Bom Jesus", "rating", 4.8, "reviews", "2.9K", "image", "https://images.unsplash.com/photo-1614082242765-7c98ca0f3df3?w=800", "description", "UNESCO heritage Baroque church holding the mortal remains of St. Francis Xavier."),
                                Map.of("name", "Dudhsagar Falls", "rating", 4.7, "reviews", "2.4K", "image", "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800", "description", "Four-tiered milky cascade nestled deep in the Western Ghats jungle."),
                                Map.of("name", "Palolem Beach", "rating", 4.7, "reviews", "2.1K", "image", "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800", "description", "Scenic crescent bay in South Goa with calm swimming waters and silent discos.")
                        ))
                        .build(),

                Destination.builder()
                        .name("Paris")
                        .country("France")
                        .continent("Europe")
                        .description("France's capital and global capital of art, gastronomy, culture and fashion, set along the romantic Seine River.")
                        .famousFor("Eiffel Tower, Louvre Museum, Notre-Dame, French Haute Cuisine, Montmartre")
                        .bestTime("Apr - Oct")
                        .weather("19°C Pleasant")
                        .idealDuration("4 to 5 Days")
                        .rating(4.8)
                        .reviewCount(6200)
                        .latitude(48.8566)
                        .longitude(2.3522)
                        .mapsLink("https://www.google.com/maps/search/?api=1&query=48.8566,2.3522")
                        .images(List.of(
                                "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800",
                                "https://images.unsplash.com/photo-1511739001486-6bfe10cec9e4?w=800"
                        ))
                        .tags(List.of("Romance", "Museums", "Culinary", "Fashion", "Culture"))
                        .officialWebsite("https://en.parisinfo.com/")
                        .travelTip("Book Louvre tickets in advance online and use the Metro for speedy citywide transit.")
                        .attractions(List.of(
                                Map.of("name", "Eiffel Tower", "rating", 4.8, "reviews", "7.5K", "image", "https://images.unsplash.com/photo-1543349689-9a4d426bee8e?w=800", "description", "Iconic 330m wrought-iron lattice tower on the Champ de Mars."),
                                Map.of("name", "Louvre Museum", "rating", 4.8, "reviews", "6.1K", "image", "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800", "description", "World's largest art museum housing Leonardo's Mona Lisa and Venus de Milo."),
                                Map.of("name", "Arc de Triomphe", "rating", 4.7, "reviews", "3.4K", "image", "https://images.unsplash.com/photo-1511739001486-6bfe10cec9e4?w=800", "description", "Heroic triumphal arch honoring French military victories at the Champs-Élysées."),
                                Map.of("name", "Sacré-Cœur", "rating", 4.7, "reviews", "3.1K", "image", "https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800", "description", "White domed basilica atop the hill of Montmartre with sweeping city panoramas.")
                        ))
                        .build()
        );

        for (Destination d : featured) {
            java.util.Optional<Destination> existing = destinationRepository.findByNameIgnoreCase(d.getName());
            if (existing.isEmpty()) {
                destinationRepository.save(d);
            } else {
                Destination dest = existing.get();
                if (dest.getAttractions() == null || dest.getAttractions().isEmpty()) {
                    dest.setAttractions(d.getAttractions());
                    dest.setHotels(d.getHotels());
                    dest.setLocalFoods(d.getLocalFoods());
                    dest.setTravelTipsList(d.getTravelTipsList());
                    dest.setRating(d.getRating());
                    dest.setReviewCount(d.getReviewCount());
                    dest.setWeather(d.getWeather());
                    dest.setBestTime(d.getBestTime());
                    destinationRepository.save(dest);
                }
            }
        }
    }

    private String capitalizeWords(String input) {
        if (input == null || input.isEmpty()) return input;
        String[] words = input.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (!w.isEmpty()) {
                sb.append(Character.toUpperCase(w.charAt(0)))
                        .append(w.substring(1).toLowerCase())
                        .append(" ");
            }
        }
        return sb.toString().trim();
    }

    private String inferCountry(String name) {
        String lower = name.toLowerCase();
        if (lower.contains("taj mahal") || lower.contains("ooty") || lower.contains("goa") || lower.contains("kodaikanal") || lower.contains("hampi")) return "India";
        if (lower.contains("eiffel") || lower.contains("louvre") || lower.contains("paris")) return "France";
        if (lower.contains("colosseum") || lower.contains("rome") || lower.contains("venice")) return "Italy";
        if (lower.contains("statue of liberty") || lower.contains("new york") || lower.contains("grand canyon")) return "USA";
        if (lower.contains("machu picchu")) return "Peru";
        if (lower.contains("pyramids") || lower.contains("giza")) return "Egypt";
        if (lower.contains("kyoto") || lower.contains("tokyo") || lower.contains("fuji")) return "Japan";
        return "Worldwide Landmark";
    }
}
