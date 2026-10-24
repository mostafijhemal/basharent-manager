package com.basharent.manager.data

import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(tableName = "user_profiles")
data class UserProfileEntity(
    @PrimaryKey val id: String,
    val name: String,
    val role: String, // OWNER or MANAGER
    val phone: String,
    val active: Boolean
)

@Entity(
    tableName = "user_permissions",
    foreignKeys = [ForeignKey(
        entity = UserProfileEntity::class,
        parentColumns = ["id"],
        childColumns = ["userId"],
        onDelete = ForeignKey.CASCADE
    )],
    indices = [Index("userId")]
)
data class UserPermissionEntity(
    @PrimaryKey val userId: String,
    val viewBuildings: Boolean,
    val manageTenants: Boolean,
    val recordPayments: Boolean,
    val enterUtilities: Boolean,
    val recordExpenses: Boolean,
    val generateReceipts: Boolean,
    val viewReports: Boolean,
    val manageDocuments: Boolean,
    val editSettings: Boolean,
    val manageUsers: Boolean
)

@Entity(tableName = "buildings")
data class BuildingEntity(
    @PrimaryKey val id: String,
    val name: String,
    val address: String,
    val notes: String,
    val photoUri: String?,
    val status: String,
    val defaultDueDay: Int,
    val createdAt: String
)

@Entity(
    tableName = "floors",
    foreignKeys = [ForeignKey(
        entity = BuildingEntity::class,
        parentColumns = ["id"],
        childColumns = ["buildingId"],
        onDelete = ForeignKey.CASCADE
    )],
    indices = [Index("buildingId")]
)
data class FloorEntity(
    @PrimaryKey val id: String,
    val buildingId: String,
    val nameOrNumber: String,
    val floorOrder: Int,
    val notes: String
)

@Entity(
    tableName = "rental_units",
    foreignKeys = [
        ForeignKey(entity = BuildingEntity::class, parentColumns = ["id"], childColumns = ["buildingId"], onDelete = ForeignKey.CASCADE),
        ForeignKey(entity = FloorEntity::class, parentColumns = ["id"], childColumns = ["floorId"], onDelete = ForeignKey.CASCADE)
    ],
    indices = [Index("buildingId"), Index("floorId")]
)
data class RentalUnitEntity(
    @PrimaryKey val id: String,
    val buildingId: String,
    val floorId: String,
    val unitNumber: String,
    val unitType: String,
    val bedrooms: Int,
    val defaultRentPoisha: Long, // Exact integer minor currency (1 BDT = 100 Poisha)
    val serviceChargePoisha: Long,
    val status: String, // VACANT, OCCUPIED, MAINTENANCE, UNAVAILABLE
    val notes: String
)

@Entity(tableName = "tenants", indices = [Index("currentBuildingId"), Index("currentUnitId")])
data class TenantEntity(
    @PrimaryKey val id: String,
    val fullName: String,
    val photoPrivatePath: String?,
    val primaryPhone: String,
    val altPhone: String,
    val nidNumber: String,
    val nidDocPrivatePath: String?,
    val presentAddress: String,
    val permanentAddress: String,
    val occupation: String,
    val emergencyContact: String,
    val familyMembersInfo: String,
    val moveInDate: String,
    val moveOutDate: String?,
    val leaseStartDate: String,
    val leaseEndDate: String,
    val monthlyRentPoisha: Long,
    val dueDay: Int,
    val securityDepositPoisha: Long,
    val advanceRentCreditPoisha: Long,
    val status: String, // ACTIVE, ARCHIVED
    val agreementPrivatePath: String?,
    val notes: String,
    val currentBuildingId: String,
    val currentUnitId: String,
    val createdAt: String
)

@Entity(
    tableName = "occupancies",
    foreignKeys = [
        ForeignKey(entity = TenantEntity::class, parentColumns = ["id"], childColumns = ["tenantId"], onDelete = ForeignKey.RESTRICT),
        ForeignKey(entity = RentalUnitEntity::class, parentColumns = ["id"], childColumns = ["unitId"], onDelete = ForeignKey.RESTRICT)
    ],
    indices = [Index("tenantId"), Index("unitId")]
)
data class OccupancyEntity(
    @PrimaryKey val id: String,
    val tenantId: String,
    val buildingId: String,
    val unitId: String,
    val startDate: String,
    val endDate: String?,
    val agreedRentPoisha: Long,
    val isActive: Boolean
)

@Entity(tableName = "lease_agreements", indices = [Index("tenantId"), Index("unitId")])
data class LeaseAgreementEntity(
    @PrimaryKey val id: String,
    val tenantId: String,
    val unitId: String,
    val startDate: String,
    val endDate: String,
    val monthlyRentPoisha: Long,
    val securityDepositPoisha: Long,
    val documentPrivatePath: String?,
    val createdAt: String
)

@Entity(
    tableName = "rent_charges",
    indices = [
        Index(value = ["unitId", "tenantId", "billingPeriod", "category"], unique = true),
        Index("buildingId"),
        Index("tenantId")
    ]
)
data class RentChargeEntity(
    @PrimaryKey val id: String,
    val buildingId: String,
    val unitId: String,
    val tenantId: String,
    val billingPeriod: String, // YYYY-MM in Asia/Dhaka
    val category: String, // RENT or SERVICE_CHARGE
    val originalAmountPoisha: Long,
    val adjustedAmountPoisha: Long,
    val paidAmountPoisha: Long,
    val dueDate: String,
    val isProrated: Boolean,
    val notes: String,
    val createdAt: String
)

@Entity(tableName = "meter_readings", indices = [Index("unitId", "billingPeriod")])
data class MeterReadingEntity(
    @PrimaryKey val id: String,
    val unitId: String,
    val utilityType: String,
    val billingPeriod: String,
    val prevReading: Double,
    val currReading: Double,
    val consumptionUnits: Double,
    val ratePerUnitPoisha: Long,
    val fixedChargePoisha: Long,
    val rolloverAuthorized: Boolean,
    val readingDate: String,
    val notes: String
)

@Entity(tableName = "utility_bills", indices = [Index("buildingId"), Index("unitId"), Index("tenantId")])
data class UtilityBillEntity(
    @PrimaryKey val id: String,
    val buildingId: String,
    val unitId: String,
    val tenantId: String,
    val billingPeriod: String,
    val utilityType: String,
    val billingMode: String,
    val prevReading: Double?,
    val currReading: Double?,
    val consumptionUnits: Double?,
    val ratePerUnitPoisha: Long?,
    val fixedChargePoisha: Long?,
    val meterRolloverAuthorized: Boolean,
    val totalAmountPoisha: Long,
    val paidAmountPoisha: Long,
    val readingDate: String,
    val notes: String,
    val sharedChargeId: String?,
    val createdAt: String
)

@Entity(tableName = "shared_charges")
data class SharedChargeEntity(
    @PrimaryKey val id: String,
    val buildingId: String,
    val billingPeriod: String,
    val title: String,
    val totalAmountPoisha: Long,
    val posted: Boolean,
    val notes: String,
    val createdAt: String
)

@Entity(tableName = "shared_charge_allocations", indices = [Index("sharedChargeId"), Index("unitId")])
data class SharedChargeAllocationEntity(
    @PrimaryKey val id: String,
    val sharedChargeId: String,
    val unitId: String,
    val tenantId: String,
    val amountPoisha: Long
)

@Entity(
    tableName = "payments",
    indices = [Index(value = ["receiptNumber"], unique = true), Index("tenantId"), Index("buildingId")]
)
data class PaymentEntity(
    @PrimaryKey val id: String,
    val receiptNumber: String,
    val timestamp: String,
    val paymentDate: String,
    val buildingId: String,
    val unitId: String,
    val tenantId: String,
    val method: String,
    val amountReceivedPoisha: Long,
    val unallocatedCreditPoisha: Long,
    val transactionRef: String,
    val notes: String,
    val recordedByUserId: String,
    val recordedByName: String,
    val previousBalancePoisha: Long,
    val remainingBalancePoisha: Long,
    val isReversed: Boolean
)

@Entity(
    tableName = "payment_allocations",
    foreignKeys = [ForeignKey(
        entity = PaymentEntity::class,
        parentColumns = ["id"],
        childColumns = ["paymentId"],
        onDelete = ForeignKey.CASCADE
    )],
    indices = [Index("paymentId"), Index("targetId")]
)
data class PaymentAllocationEntity(
    @PrimaryKey val id: String,
    val paymentId: String,
    val targetType: String, // RENT_CHARGE, UTILITY_BILL, ADVANCE_CREDIT
    val targetId: String,
    val billingPeriod: String,
    val label: String,
    val amountPoisha: Long
)

@Entity(tableName = "receipts", indices = [Index(value = ["receiptNumber"], unique = true)])
data class ReceiptEntity(
    @PrimaryKey val id: String,
    val paymentId: String,
    val receiptNumber: String,
    val generatedAt: String,
    val pdfFilePath: String?,
    val imageFilePath: String?
)

@Entity(tableName = "expenses", indices = [Index("buildingId")])
data class ExpenseEntity(
    @PrimaryKey val id: String,
    val buildingId: String,
    val unitId: String?,
    val category: String,
    val amountPoisha: Long,
    val date: String,
    val description: String,
    val method: String,
    val vendor: String,
    val attachmentPath: String?,
    val recordedByName: String,
    val createdAt: String
)

@Entity(tableName = "security_deposit_transactions", indices = [Index("tenantId")])
data class SecurityDepositTransactionEntity(
    @PrimaryKey val id: String,
    val tenantId: String,
    val buildingId: String,
    val unitId: String,
    val type: String, // DEPOSIT_COLLECTED, DEPOSIT_DEDUCTION, DEPOSIT_REFUND, ADVANCE_COLLECTED
    val amountPoisha: Long,
    val date: String,
    val method: String,
    val reason: String,
    val recordedByName: String,
    val createdAt: String
)

@Entity(tableName = "reminder_settings")
data class ReminderSettingsEntity(
    @PrimaryKey val id: String = "singleton",
    val enabled: Boolean,
    val reminderDaysCsv: String, // "5,10,15"
    val templateEn: String,
    val templateBn: String
)

@Entity(tableName = "audit_logs", indices = [Index("timestamp"), Index("buildingId")])
data class AuditLogEntity(
    @PrimaryKey val id: String,
    val timestamp: String,
    val eventType: String,
    val entityId: String,
    val buildingId: String?,
    val userId: String,
    val userName: String,
    val summaryEn: String,
    val summaryBn: String
)

@Entity(tableName = "sync_metadata")
data class SyncMetadataEntity(
    @PrimaryKey val deviceId: String,
    val syncEnabled: Boolean,
    val endpointUrl: String,
    val accountWorkspaceId: String,
    val lastSyncedAt: String?,
    val pendingOutboxCount: Int,
    val conflictCount: Int
)

@Entity(tableName = "app_settings")
data class AppSettingsEntity(
    @PrimaryKey val id: String = "singleton",
    val appName: String,
    val ownerName: String,
    val ownerPhone: String,
    val ownerSignature: String,
    val language: String,
    val pinEnabled: Boolean,
    val pinCodeHash: String,
    val pinLength: Int,
    val biometricEnabled: Boolean,
    val prorationPolicy: String
)
