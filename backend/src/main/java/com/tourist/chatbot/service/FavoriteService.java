package com.tourist.chatbot.service;

import com.tourist.chatbot.dto.FavoriteRequest;
import com.tourist.chatbot.model.Favorite;
import com.tourist.chatbot.repository.FavoriteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class FavoriteService {

    private final FavoriteRepository favoriteRepository;

    public Favorite addFavorite(FavoriteRequest request, String userId) {
        return favoriteRepository.findByUserIdAndDestinationName(userId, request.getDestinationName())
                .orElseGet(() -> {
                    Favorite fav = Favorite.builder()
                            .userId(userId)
                            .destinationId(request.getDestinationId())
                            .destinationName(request.getDestinationName())
                            .country(request.getCountry())
                            .notes(request.getNotes())
                            .build();
                    return favoriteRepository.save(fav);
                });
    }

    public List<Favorite> getUserFavorites(String userId) {
        return favoriteRepository.findByUserId(userId, Sort.by(Sort.Direction.DESC, "savedAt"));
    }

    public void removeFavorite(String id, String userId) {
        favoriteRepository.deleteByIdAndUserId(id, userId);
    }

    public boolean isFavorite(String destinationName, String userId) {
        return favoriteRepository.existsByUserIdAndDestinationName(userId, destinationName);
    }
}
