package com.scanny.accounting.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "accounts", schema = "accounting")
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @Column(nullable = false, unique = true, length = 20)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "account_type", nullable = false, length = 12)
    private String accountType;   // ASSET | LIABILITY | EQUITY | REVENUE | EXPENSE

    @Column(name = "normal_balance", nullable = false, length = 6)
    private String normalBalance;  // DEBIT | CREDIT

    @Column(name = "module_tag", nullable = false, length = 16)
    private String moduleTag = "ALL";

    @Column(name = "is_control", nullable = false)
    private boolean isControl = false;

    @Column(name = "is_system", nullable = false)
    private boolean isSystem = false;

    @Column(name = "is_active", nullable = false)
    private boolean isActive = true;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    // ── Getters ──────────────────────────────────────────────────────────────

    public Integer getId()            { return id; }
    public String  getCode()          { return code; }
    public String  getName()          { return name; }
    public String  getAccountType()   { return accountType; }
    public String  getNormalBalance() { return normalBalance; }
    public String  getModuleTag()     { return moduleTag; }
    public boolean isControl()        { return isControl; }
    public boolean isSystem()         { return isSystem; }
    public boolean isActive()         { return isActive; }
    public String  getDescription()   { return description; }
}
