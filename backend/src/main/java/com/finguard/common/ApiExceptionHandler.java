package com.finguard.common;

import jakarta.validation.ConstraintViolationException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.PessimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {
    public record ApiError(String code, String message, Map<String, String> fields) { }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> handleApi(ApiException exception) {
        return error(exception.getStatus(), exception.getCode(), exception.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException exception) {
        Map<String, String> fields = new LinkedHashMap<>();
        exception.getBindingResult().getFieldErrors().forEach(
                field -> fields.putIfAbsent(field.getField(), field.getDefaultMessage()));
        return ResponseEntity.badRequest().body(new ApiError("VALIDATION_ERROR", "Request validation failed", fields));
    }

    @ExceptionHandler({ConstraintViolationException.class, MethodArgumentTypeMismatchException.class,
            HttpMessageNotReadableException.class, MissingServletRequestParameterException.class})
    ResponseEntity<ApiError> handleInvalidRequest(Exception exception) {
        // Never echo raw payloads, database errors, or stack traces to API clients.
        return error(HttpStatus.BAD_REQUEST, "INVALID_REQUEST", "Invalid ID, parameter, or request body");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    ResponseEntity<ApiError> handleIntegrity(DataIntegrityViolationException exception) {
        return error(HttpStatus.CONFLICT, "DATA_CONFLICT", "Request conflicts with existing data or database constraints");
    }

    @ExceptionHandler(PessimisticLockingFailureException.class)
    ResponseEntity<ApiError> handleLock(PessimisticLockingFailureException exception) {
        return error(HttpStatus.CONFLICT, "ACCOUNT_BUSY", "Account is busy; retry after checking transaction history");
    }

    private ResponseEntity<ApiError> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(new ApiError(code, message, Map.of()));
    }
}
