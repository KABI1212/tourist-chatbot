package com.tourist.chatbot.controller;

import com.tourist.chatbot.dto.ApiResponse;
import com.tourist.chatbot.dto.FavoriteRequest;
import com.tourist.chatbot.model.Favorite;
import com.tourist.chatbot.model.User;
import com.tourist.chatbot.service.FavoriteService;
import com.tourist.chatbot.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/favorites")
@RequiredArgsConstructor
public class FavoriteController {

    private final FavoriteService favoriteService;
    private final UserService userService;

    @PostMapping
    public ResponseEntity<ApiResponse<Favorite>> addFavorite(
            @Valid @RequestBody FavoriteRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.getUserByUsername(userDetails.getUsername());
        Favorite fav = favoriteService.addFavorite(request, user.getId());
        return ResponseEntity.ok(ApiResponse.success("Added to favorites", fav));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<Favorite>>> getUserFavorites(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.getUserByUsername(userDetails.getUsername());
        List<Favorite> favorites = favoriteService.getUserFavorites(user.getId());
        return ResponseEntity.ok(ApiResponse.success(favorites));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Map<String, String>>> removeFavorite(
            @PathVariable("id") String id,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.getUserByUsername(userDetails.getUsername());
        favoriteService.removeFavorite(id, user.getId());
        return ResponseEntity.ok(ApiResponse.success("Removed from favorites", Map.of("id", id)));
    }
}
