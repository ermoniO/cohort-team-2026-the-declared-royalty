package org.dsd.cohort2026fall.tdr.invoiceautomationservice.controller;

import org.dsd.cohort2026fall.tdr.invoiceautomationservice.api.UsersApi;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.entity.UserEntity;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.UserCreateRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.UserResponse;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.model.UserUpdateRequest;
import org.dsd.cohort2026fall.tdr.invoiceautomationservice.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@RestController
public class UserController implements UsersApi {

    private final UserRepository userRepository;

    public UserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    @Override
    public ResponseEntity<UserResponse> createUser(UserCreateRequest request) {
        UserEntity entity = new UserEntity();
        entity.setUserId(UUID.randomUUID());
        entity.setUserName(request.getUsername());
        entity.setEmail(request.getEmail());
        entity.setRole(request.getRole() != null ? request.getRole() : "ADMIN");
        entity.setStatus(request.getIsActive() != null ? request.getIsActive() : "ACTIVE");
        entity.setCreatedAt(OffsetDateTime.now());
        entity.setUpdatedAt(OffsetDateTime.now());

        UserEntity saved = userRepository.save(entity);
        return ResponseEntity.status(HttpStatus.CREATED).body(toResponse(saved));
    }

    @Override
    public ResponseEntity<List<UserResponse>> getUsers() {
        List<UserResponse> users = userRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
        return ResponseEntity.ok(users);
    }

    @Override
    public ResponseEntity<UserResponse> getUserByUserId(UUID userId) {
        UserEntity entity = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return ResponseEntity.ok(toResponse(entity));
    }

    @Override
    public ResponseEntity<UserResponse> updateUserByUserId(UUID userId, UserUpdateRequest request) {
        UserEntity entity = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        if (request.getUsername() != null) {
            entity.setUserName(request.getUsername());
        }
        if (request.getEmail() != null) {
            entity.setEmail(request.getEmail());
        }
        if (request.getRole() != null) {
            entity.setRole(request.getRole());
        }
        if (request.getIsActive() != null) {
            entity.setStatus(request.getIsActive());
        }
        entity.setUpdatedAt(OffsetDateTime.now());

        UserEntity updated = userRepository.save(entity);
        return ResponseEntity.ok(toResponse(updated));
    }

    @Override
    public ResponseEntity<Void> deactivateUserByUserId(UUID userId) {
        UserEntity entity = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        entity.setStatus("INACTIVE");
        entity.setUpdatedAt(OffsetDateTime.now());
        userRepository.save(entity);
        return ResponseEntity.noContent().build();
    }

    private UserResponse toResponse(UserEntity entity) {
        UserResponse response = new UserResponse();
        response.setUserId(entity.getUserId());
        response.setUsername(entity.getUserName());
        response.setEmail(entity.getEmail());
        response.setRole(entity.getRole());
        response.setIsActive(entity.getStatus());
        response.setCreatedAt(entity.getCreatedAt());
        response.setUpdatedAt(entity.getUpdatedAt());
        return response;
    }
}
