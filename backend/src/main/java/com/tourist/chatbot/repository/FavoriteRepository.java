package com.tourist.chatbot.repository;

import com.tourist.chatbot.model.Favorite;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface FavoriteRepository extends MongoRepository<Favorite, String> {

    List<Favorite> findByUserId(String userId, Sort sort);

    Optional<Favorite> findByUserIdAndDestinationName(String userId, String destinationName);

    boolean existsByUserIdAndDestinationName(String userId, String destinationName);

    void deleteByIdAndUserId(String id, String userId);
}
