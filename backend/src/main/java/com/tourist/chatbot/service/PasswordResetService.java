package com.tourist.chatbot.service;

import com.tourist.chatbot.dto.ResetAuthResponse;
import com.tourist.chatbot.dto.ResetPasswordRequest;
import com.tourist.chatbot.exception.BadRequestException;
import com.tourist.chatbot.exception.ResourceNotFoundException;
import com.tourist.chatbot.model.PasswordResetToken;
import com.tourist.chatbot.model.User;
import com.tourist.chatbot.repository.PasswordResetTokenRepository;
import com.tourist.chatbot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Dedicated service for managing password recovery and reset authorizations.
 *
 * Architecture Note for Future Phase:
 * This service encapsulates password-reset state, token validation, rate-limiting,
 * and database updates. When production email delivery (SMTP / SendGrid / AWS SES) is
 * ready to be integrated:
 * 1. Inject an EmailService component here.
 * 2. In verifyAccountAndCreateResetAuth(), dispatch a secure reset link or 6-digit OTP
 *    to user.getEmail() rather than returning the resetToken in the response body.
 * 3. Add an OTP verification step before setting the new password.
 */
@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

    private static final int TOKEN_EXPIRATION_MINUTES = 15;
    private static final int MAX_ATTEMPTS_PER_WINDOW = 5;
    private static final long RATE_LIMIT_WINDOW_SECONDS = 900; // 15 minutes

    private final UserRepository userRepository;
    private final PasswordResetTokenRepository resetTokenRepository;
    private final PasswordEncoder passwordEncoder;

    // In-memory sliding window rate limiter per identifier: [identifier -> (count, firstAttemptTime)]
    private final Map<String, RateLimitTracker> rateLimitMap = new ConcurrentHashMap<>();

    private static class RateLimitTracker {
        int count;
        Instant windowStart;

        RateLimitTracker() {
            this.count = 1;
            this.windowStart = Instant.now();
        }
    }

    /**
     * Verifies that the user account exists and issues a temporary, short-lived reset authorization.
     *
     * @param identifier Registered email address or username
     * @return ResetAuthResponse with authorization token and validity duration
     */
    public ResetAuthResponse verifyAccountAndCreateResetAuth(String identifier) {
        if (identifier == null || identifier.trim().isEmpty()) {
            throw new BadRequestException("Email address or username is required");
        }

        String cleanIdentifier = identifier.trim().toLowerCase();

        // 1. Enforce rate limiting
        checkRateLimit(cleanIdentifier);

        // 2. Verify account exists in database
        User user = userRepository.findByEmail(cleanIdentifier)
                .or(() -> userRepository.findByUsername(cleanIdentifier))
                .orElseThrow(() -> new ResourceNotFoundException("No registered account found for: " + cleanIdentifier));

        // 3. Invalidate any existing unused reset tokens for this user
        try {
            resetTokenRepository.deleteAllByUserId(user.getId());
        } catch (Exception e) {
            log.warn("Could not clear previous reset tokens: {}", e.getMessage());
        }

        // 4. Generate a secure, short-lived reset authorization token
        String token = UUID.randomUUID().toString();
        Instant now = Instant.now();
        Instant expiresAt = now.plus(Duration.ofMinutes(TOKEN_EXPIRATION_MINUTES));

        PasswordResetToken resetTokenDoc = PasswordResetToken.builder()
                .token(token)
                .userId(user.getId())
                .email(user.getEmail())
                .expiresAt(expiresAt)
                .used(false)
                .createdAt(now)
                .build();

        resetTokenRepository.save(resetTokenDoc);

        // 5. Future Email Integration Hook
        dispatchEmailHook(user, token);

        log.info("Password reset authorization created for user [id={}], valid for {} minutes.",
                user.getId(), TOKEN_EXPIRATION_MINUTES);

        return ResetAuthResponse.builder()
                .resetToken(token)
                .email(user.getEmail())
                .username(user.getUsername())
                .expiresInMinutes(TOKEN_EXPIRATION_MINUTES)
                .notice("Account verified. In this development phase, you may now set a new password without email delivery.")
                .build();
    }

    /**
     * Resets the user's password using a verified reset token.
     *
     * @param request ResetPasswordRequest containing token, newPassword, and confirmPassword
     */
    public void resetPassword(ResetPasswordRequest request) {
        if (request.getNewPassword() == null || request.getNewPassword().length() < 6) {
            throw new BadRequestException("New password must be at least 6 characters long.");
        }

        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new BadRequestException("New password and confirm password do not match.");
        }

        // 1. Fetch token
        PasswordResetToken tokenDoc = resetTokenRepository.findByToken(request.getResetToken())
                .orElseThrow(() -> new BadRequestException("Invalid or unrecognized password reset token."));

        // 2. Validate token has not been used
        if (tokenDoc.isUsed()) {
            throw new BadRequestException("This reset authorization has already been used. Please request a new one.");
        }

        // 3. Validate token has not expired
        if (Instant.now().isAfter(tokenDoc.getExpiresAt())) {
            throw new BadRequestException("This reset authorization has expired. Please request a new one.");
        }

        // 4. Retrieve user account
        User user = userRepository.findById(tokenDoc.getUserId())
                .orElseThrow(() -> new ResourceNotFoundException("User account associated with this token no longer exists."));

        // 5. Encode and update password securely
        user.setPassword(passwordEncoder.encode(request.getNewPassword()));
        user.setUpdatedAt(Instant.now());
        userRepository.save(user);

        // 6. Mark token as consumed (single-use enforcement)
        tokenDoc.setUsed(true);
        resetTokenRepository.save(tokenDoc);

        // Invalidate all tokens for this user
        try {
            resetTokenRepository.deleteAllByUserId(user.getId());
        } catch (Exception ignored) {
        }

        log.info("Password reset successfully completed for user [id={}]. Session invalidated.", user.getId());
    }

    /**
     * Rate limiting check to prevent brute-force abuse of the email verification endpoint.
     */
    private synchronized void checkRateLimit(String identifier) {
        Instant now = Instant.now();
        RateLimitTracker tracker = rateLimitMap.get(identifier);

        if (tracker == null || Duration.between(tracker.windowStart, now).getSeconds() > RATE_LIMIT_WINDOW_SECONDS) {
            rateLimitMap.put(identifier, new RateLimitTracker());
        } else {
            if (tracker.count >= MAX_ATTEMPTS_PER_WINDOW) {
                long remainingSec = RATE_LIMIT_WINDOW_SECONDS - Duration.between(tracker.windowStart, now).getSeconds();
                throw new BadRequestException(String.format(
                        "Too many password reset requests for this account. Please wait %d minutes before trying again.",
                        Math.max(1, remainingSec / 60)
                ));
            }
            tracker.count++;
        }
    }

    /**
     * Architecture hook for future email / SMS OTP service integration.
     */
    private void dispatchEmailHook(User user, String token) {
        // In this phase, email integration is omitted as instructed.
        // When email provider is configured, inject EmailService and invoke:
        // emailService.sendPasswordResetEmail(user.getEmail(), token);
        log.debug("Email delivery skipped (temporary email-free development mode enabled).");
    }
}
