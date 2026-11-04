package com.tourist.chatbot.controller;

import com.tourist.chatbot.dto.ApiResponse;
import com.tourist.chatbot.dto.ChangePasswordRequest;
import com.tourist.chatbot.dto.UpdateProfileRequest;
import com.tourist.chatbot.dto.UserProfileResponse;
import com.tourist.chatbot.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<UserProfileResponse>> getProfile(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        UserProfileResponse profile = userService.getProfile(userDetails.getUsername());
        return ResponseEntity.ok(ApiResponse.success(profile));
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<UserProfileResponse>> updateProfile(
            @Valid @RequestBody UpdateProfileRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        UserProfileResponse updated = userService.updateProfile(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.success("Profile updated successfully", updated));
    }

    @PostMapping("/change-password")
    public ResponseEntity<ApiResponse<Map<String, String>>> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        userService.changePassword(userDetails.getUsername(), request);
        return ResponseEntity.ok(ApiResponse.success("Password changed successfully", Map.of("status", "changed")));
    }

    @DeleteMapping("/account")
    public ResponseEntity<ApiResponse<Map<String, String>>> deleteAccount(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        String password = body != null ? body.get("password") : null;
        if (password == null || password.isBlank()) {
            return ResponseEntity.badRequest().body(ApiResponse.error("Password is required to confirm account deletion", 400));
        }
        userService.deleteAccount(userDetails.getUsername(), password);
        return ResponseEntity.ok(ApiResponse.success("Account and all associated travel records deleted successfully", Map.of("status", "deleted")));
    }
}
