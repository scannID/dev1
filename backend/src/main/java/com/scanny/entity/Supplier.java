package com.scanny.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "suppliers")
public class Supplier {

    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "business_id", nullable = false)
    private Business business;

    @Column(nullable = false)
    private String name;

    @Column(name = "contact_name", nullable = false)
    private String contactName = "";

    @Column(nullable = false)
    private String phone = "";

    @Column(nullable = false)
    private String email = "";

    @Column(nullable = false, columnDefinition = "TEXT DEFAULT ''")
    private String address = "";

    @Column(nullable = false, columnDefinition = "TEXT DEFAULT ''")
    private String notes = "";

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public Business getBusiness() { return business; }
    public void setBusiness(Business business) { this.business = business; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getContactName() { return contactName; }
    public void setContactName(String contactName) { this.contactName = contactName == null ? "" : contactName; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone == null ? "" : phone; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email == null ? "" : email; }
    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address == null ? "" : address; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes == null ? "" : notes; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
