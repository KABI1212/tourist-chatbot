package com.tourist.chatbot.config;

import com.mongodb.client.MongoClient;
import com.tourist.chatbot.model.Chat;
import com.tourist.chatbot.model.Favorite;
import com.tourist.chatbot.model.PasswordResetToken;
import com.tourist.chatbot.model.RefreshToken;
import com.tourist.chatbot.model.Trip;
import com.tourist.chatbot.model.User;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.mongo.MongoClientSettingsBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.Index;

import java.util.concurrent.TimeUnit;

/**
 * Enterprise MongoDB Atlas configuration.
 * Configures connection pooling, socket timeouts, and ensures performance-critical
 * unique and compound indexes are created on startup.
 */
@Configuration
public class MongoConfig {

    private static final Logger log = LoggerFactory.getLogger(MongoConfig.class);

    @Bean
    public MongoClientSettingsBuilderCustomizer mongoConnectionPoolCustomizer() {
        return builder -> {
            builder.applyToConnectionPoolSettings(pool -> pool
                    .minSize(5)
                    .maxSize(30)
                    .maxWaitTime(5, TimeUnit.SECONDS)
                    .maxConnectionIdleTime(60, TimeUnit.SECONDS)
                    .maxConnectionLifeTime(30, TimeUnit.MINUTES)
            );
            builder.applyToSocketSettings(socket -> socket
                    .connectTimeout(10, TimeUnit.SECONDS)
                    .readTimeout(20, TimeUnit.SECONDS)
            );
            builder.applyToClusterSettings(cluster -> cluster
                    .serverSelectionTimeout(10, TimeUnit.SECONDS)
            );
            log.info("MongoDB connection pool and socket timeouts successfully configured.");
        };
    }

    @Bean
    public ApplicationRunner initDatabaseIndexes(MongoTemplate mongoTemplate) {
        return args -> {
            try {
                log.info("Verifying and ensuring database indexes...");

                // 1. User collection indexes
                mongoTemplate.indexOps(User.class).ensureIndex(
                        new Index().on("username", Sort.Direction.ASC).unique()
                );
                mongoTemplate.indexOps(User.class).ensureIndex(
                        new Index().on("email", Sort.Direction.ASC).unique()
                );

                // 2. RefreshToken collection indexes
                mongoTemplate.indexOps(RefreshToken.class).ensureIndex(
                        new Index().on("token", Sort.Direction.ASC).unique()
                );
                mongoTemplate.indexOps(RefreshToken.class).ensureIndex(
                        new Index().on("userId", Sort.Direction.ASC)
                );

                // 3. PasswordResetToken collection indexes
                mongoTemplate.indexOps(PasswordResetToken.class).ensureIndex(
                        new Index().on("token", Sort.Direction.ASC).unique()
                );
                mongoTemplate.indexOps(PasswordResetToken.class).ensureIndex(
                        new Index().on("userId", Sort.Direction.ASC)
                );

                // 4. Trip collection indexes
                mongoTemplate.indexOps(Trip.class).ensureIndex(
                        new Index().on("userId", Sort.Direction.ASC)
                );

                // 5. Favorite collection indexes
                mongoTemplate.indexOps(Favorite.class).ensureIndex(
                        new Index().on("userId", Sort.Direction.ASC).on("destinationName", Sort.Direction.ASC)
                );

                // 6. Chat collection indexes
                mongoTemplate.indexOps(Chat.class).ensureIndex(
                        new Index().on("username", Sort.Direction.ASC)
                );

                log.info("Database indexes successfully verified and initialized.");
            } catch (Exception e) {
                log.warn("Database index initialization skipped or deferred (MongoDB connection pending): {}", e.getMessage());
            }
        };
    }
}
