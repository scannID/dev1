package com.scanny.controller;

import com.scanny.dto.ImageSearchDtos;
import com.scanny.service.ImageSearchService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/images")
public class ImageSearchController {

    private final ImageSearchService imageSearchService;

    public ImageSearchController(ImageSearchService imageSearchService) {
        this.imageSearchService = imageSearchService;
    }

    @GetMapping("/search")
    public ImageSearchDtos.ImageSearchResponse search(
            @RequestParam String q,
            @RequestParam(required = false, defaultValue = "8") int perPage
    ) {
        return imageSearchService.search(q, perPage);
    }

    @PostMapping("/import")
    public ImageSearchDtos.ImportImageResponse importImage(
            @RequestBody ImageSearchDtos.ImportImageRequest request
    ) {
        return imageSearchService.importImage(request == null ? null : request.url());
    }
}
