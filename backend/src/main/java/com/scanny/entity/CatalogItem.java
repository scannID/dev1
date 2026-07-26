package com.scanny.entity;

import com.scanny.model.enums.ItemKind;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "catalog_items")
public class CatalogItem {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private int price;

    /** Knock-off percent from list price (0 = no discount). */
    @Column(name = "discount_percent", nullable = false)
    private int discountPercent = 0;

    @Column(nullable = false)
    private String description = "";

    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    @Column(nullable = false, columnDefinition = "TEXT DEFAULT ''")
    private String details = "";

    @Column(name = "ingredients_json", nullable = false, columnDefinition = "TEXT DEFAULT '[]'")
    private String ingredientsJson = "[]";

    @Column(nullable = false)
    private boolean available = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "item_kind", nullable = false)
    private ItemKind itemKind = ItemKind.FOOD;

    @Column(name = "image_urls", nullable = false, columnDefinition = "TEXT DEFAULT '[]'")
    private String imageUrlsJson = "[]";

    @Column(nullable = false)
    private int capacity = 0;

    @Column(name = "amenities_json", nullable = false, columnDefinition = "TEXT DEFAULT '[]'")
    private String amenitiesJson = "[]";

    @Column(name = "units_available", nullable = false)
    private int unitsAvailable = 0;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public Business getBusiness() {
        return business;
    }

    public void setBusiness(Business business) {
        this.business = business;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public int getPrice() {
        return price;
    }

    public void setPrice(int price) {
        this.price = price;
    }

    public int getDiscountPercent() {
        return discountPercent;
    }

    public void setDiscountPercent(int discountPercent) {
        this.discountPercent = discountPercent;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public String getDetails() {
        return details;
    }

    public void setDetails(String details) {
        this.details = details;
    }

    public String getIngredientsJson() {
        return ingredientsJson;
    }

    public void setIngredientsJson(String ingredientsJson) {
        this.ingredientsJson = ingredientsJson == null || ingredientsJson.isBlank() ? "[]" : ingredientsJson;
    }

    public boolean isAvailable() {
        return available;
    }

    public void setAvailable(boolean available) {
        this.available = available;
    }

    public ItemKind getItemKind() {
        return itemKind == null ? ItemKind.FOOD : itemKind;
    }

    public void setItemKind(ItemKind itemKind) {
        this.itemKind = itemKind == null ? ItemKind.FOOD : itemKind;
    }

    public String getImageUrlsJson() {
        return imageUrlsJson;
    }

    public void setImageUrlsJson(String imageUrlsJson) {
        this.imageUrlsJson = imageUrlsJson == null || imageUrlsJson.isBlank() ? "[]" : imageUrlsJson;
    }

    public int getCapacity() {
        return capacity;
    }

    public void setCapacity(int capacity) {
        this.capacity = Math.max(0, capacity);
    }

    public String getAmenitiesJson() {
        return amenitiesJson;
    }

    public void setAmenitiesJson(String amenitiesJson) {
        this.amenitiesJson = amenitiesJson == null || amenitiesJson.isBlank() ? "[]" : amenitiesJson;
    }

    public int getUnitsAvailable() {
        return unitsAvailable;
    }

    public void setUnitsAvailable(int unitsAvailable) {
        this.unitsAvailable = Math.max(0, unitsAvailable);
    }

    public boolean isLodging() {
        ItemKind kind = getItemKind();
        return kind == ItemKind.ROOM || kind == ItemKind.SUITE;
    }
}
