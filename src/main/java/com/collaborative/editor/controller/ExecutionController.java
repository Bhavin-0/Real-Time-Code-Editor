package com.collaborative.editor.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@RestController
@RequestMapping
@CrossOrigin(originPatterns = "*")
public class ExecutionController {

    private final RestTemplate restTemplate = new RestTemplate();
    private final ConcurrentMap<String, Map<String, Object>> results = new ConcurrentHashMap<>();

    @Value("${execution.service.url:http://localhost:3001}")
    private String executionServiceUrl;

    @PostMapping("/execute")
    public ResponseEntity<Map<String, String>> execute(@RequestBody ExecuteRequest request) {
        if (request == null || request.code() == null || request.code().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "code is required"));
        }

        String jobId = UUID.randomUUID().toString();
        results.put(jobId, Map.of("status", "QUEUED"));

        CompletableFuture.runAsync(() -> {
            try {
                Map<String, Object> payload = Map.of(
                        "jobId", jobId,
                        "code", request.code()
                );
                ResponseEntity<Map> nodeResponse = restTemplate.postForEntity(
                        executionServiceUrl + "/execute",
                        payload,
                        Map.class
                );
                results.put(jobId, Map.of(
                        "status", "DISPATCHED",
                        "nodeStatus", nodeResponse.getStatusCode().value(),
                        "nodeResponse", nodeResponse.getBody() == null ? Map.of() : nodeResponse.getBody()
                ));
            } catch (Exception ex) {
                results.put(jobId, Map.of(
                        "status", "ERROR",
                        "message", ex.getMessage() == null ? "dispatch failed" : ex.getMessage()
                ));
            }
        });

        return ResponseEntity.accepted().body(Map.of("jobId", jobId));
    }

    @GetMapping("/result/{jobId}")
    public ResponseEntity<Map<String, Object>> result(@PathVariable String jobId) {
        Map<String, Object> result = results.get(jobId);
        if (result == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(result);
    }

    public record ExecuteRequest(String code) {}
}
