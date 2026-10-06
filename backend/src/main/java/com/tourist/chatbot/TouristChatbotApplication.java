package com.tourist.chatbot;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.mongodb.config.EnableMongoAuditing;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.util.List;

@SpringBootApplication
@EnableMongoAuditing
public class TouristChatbotApplication {

    private static final Logger log = LoggerFactory.getLogger(TouristChatbotApplication.class);

    public static void main(String[] args) {
        loadDotEnv();
        SpringApplication.run(TouristChatbotApplication.class, args);
    }

    /**
     * Reads .env file from working directory or parent directories if present,
     * populating System properties so Spring Boot placeholders resolve seamlessly.
     */
    private static void loadDotEnv() {
        List<File> potentialEnvFiles = List.of(
                new File(".env"),
                new File("../.env"),
                new File("../../.env")
        );

        for (File envFile : potentialEnvFiles) {
            if (envFile.exists() && envFile.isFile()) {
                log.info("Loading environment variables from: {}", envFile.getAbsolutePath());
                try (BufferedReader reader = new BufferedReader(new FileReader(envFile))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        line = line.trim();
                        if (line.isEmpty() || line.startsWith("#") || !line.contains("=")) {
                            continue;
                        }
                        int idx = line.indexOf('=');
                        String key = line.substring(0, idx).trim();
                        String val = line.substring(idx + 1).trim();

                        // Strip optional surrounding quotes
                        if ((val.startsWith("\"") && val.endsWith("\"")) ||
                            (val.startsWith("'") && val.endsWith("'"))) {
                            val = val.substring(1, val.length() - 1);
                        }

                        System.setProperty(key, val);
                    }
                } catch (Exception e) {
                    log.warn("Could not read .env file {}: {}", envFile.getPath(), e.getMessage());
                }
                break;
            }
        }
    }
}
