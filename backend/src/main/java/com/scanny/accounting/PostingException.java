package com.scanny.accounting;

/** Thrown when the PostingService cannot post a journal entry. */
public class PostingException extends RuntimeException {
    public PostingException(String message) {
        super(message);
    }
    public PostingException(String message, Throwable cause) {
        super(message, cause);
    }
}
