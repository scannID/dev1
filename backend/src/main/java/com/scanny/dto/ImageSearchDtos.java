package com.scanny.dto;

import java.util.List;

public final class ImageSearchDtos {

    private ImageSearchDtos() {
    }

    public record ImageSearchResult(
            String id,
            String thumbUrl,
            String imageUrl,
            String photographer,
            String photographerUrl,
            String alt
    ) {
    }

    public record ImageSearchResponse(
            String query,
            List<ImageSearchResult> results,
            boolean configured
    ) {
    }

    public record ImportImageRequest(
            String url
    ) {
    }

    public record ImportImageResponse(
            String imageUrl
    ) {
    }
}
