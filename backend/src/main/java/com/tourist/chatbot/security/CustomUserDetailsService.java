package com.tourist.chatbot.security;

import com.tourist.chatbot.model.User;
import com.tourist.chatbot.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String identifier) throws UsernameNotFoundException {
        if (identifier == null || identifier.trim().isEmpty()) {
            throw new UsernameNotFoundException("Identifier cannot be blank");
        }
        String clean = identifier.trim();
        User user = userRepository.findByUsernameOrEmail(clean, clean.toLowerCase())
                .orElseThrow(() -> new UsernameNotFoundException("User not found with username or email: " + clean));

        return new CustomUserDetails(user);
    }
}
