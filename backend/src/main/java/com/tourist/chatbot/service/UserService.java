package com.tourist.chatbot.service;

import com.tourist.chatbot.dto.ChangePasswordRequest;
import com.tourist.chatbot.dto.UpdateProfileRequest;
import com.tourist.chatbot.dto.UserProfileResponse;
import com.tourist.chatbot.exception.BadRequestException;
import com.tourist.chatbot.exception.ResourceNotFoundException;
import com.tourist.chatbot.model.User;
import com.tourist.chatbot.repository.ChatMessageRepository;
import com.tourist.chatbot.repository.ChatRepository;
import com.tourist.chatbot.repository.FavoriteRepository;
import com.tourist.chatbot.repository.PasswordResetTokenRepository;
import com.tourist.chatbot.repository.RefreshTokenRepository;
import com.tourist.chatbot.repository.TripRepository;
import com.tourist.chatbot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class UserService {

    private static final Logger log = LoggerFactory.getLogger(UserService.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final TripRepository tripRepository;
    private final FavoriteRepository favoriteRepository;
    private final ChatRepository chatRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;

    public User getUserByUsername(String username) {
        String clean = username != null ? username.trim() : "";
        return userRepository.findByUsernameOrEmail(clean, clean.toLowerCase())
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + clean));
    }

    public UserProfileResponse getProfile(String username) {
        User user = getUserByUsername(username);
        return mapToProfileResponse(user);
    }

    public UserProfileResponse updateProfile(String username, UpdateProfileRequest request) {
        User user = getUserByUsername(username);

        if (request.getFullName() != null) user.setFullName(request.getFullName().trim());
        if (request.getPhone() != null) user.setPhone(request.getPhone().trim());
        if (request.getAddress() != null) user.setAddress(request.getAddress().trim());
        if (request.getBio() != null) user.setBio(request.getBio().trim());
        if (request.getAvatar() != null) user.setAvatar(request.getAvatar().trim());
        if (request.getTravelPreferences() != null) user.setTravelPreferences(request.getTravelPreferences());

        User saved = userRepository.save(user);
        return mapToProfileResponse(saved);
    }

    public void changePassword(String username, ChangePasswordRequest request) {
        User user = getUserByUsername(username);

        if (!passwordEncoder.matches(request.getCurrentPassword(), user.getPassword())) {
            throw new BadRequestException("Current password is incorrect");
        }

        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
    }

    public void deleteAccount(String username, String password) {
        User user = getUserByUsername(username);

        if (!passwordEncoder.matches(password, user.getPassword())) {
            throw new BadRequestException("Incorrect password. Account deletion aborted.");
        }

        String userId = user.getId();
        log.info("Deleting user account [{}] (id: {}) and all associated records...", user.getUsername(), userId);

        try {
            tripRepository.deleteAllByUserId(userId);
            favoriteRepository.deleteAllByUserId(userId);
            chatMessageRepository.deleteByUserId(userId);
            chatRepository.deleteByUserId(userId);
            refreshTokenRepository.deleteAllByUserId(userId);
            passwordResetTokenRepository.deleteAllByUserId(userId);
            userRepository.delete(user);
            log.info("Account deletion successfully completed for [{}]", user.getUsername());
        } catch (Exception e) {
            log.error("Error during account deletion for [{}]: {}", user.getUsername(), e.getMessage());
            throw new RuntimeException("Could not complete account deletion. Please try again.");
        }
    }

    public UserProfileResponse mapToProfileResponse(User user) {
        return UserProfileResponse.builder()
                .id(user.getId())
                .username(user.getUsername())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .address(user.getAddress())
                .bio(user.getBio())
                .avatar(user.getAvatar())
                .travelPreferences(user.getTravelPreferences())
                .roles(user.getRoles())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
