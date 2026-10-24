package com.basharent.manager.data

import androidx.room.*
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Dao
interface BashaRentDao {
    @Query("SELECT * FROM buildings ORDER BY createdAt DESC")
    suspend fun getAllBuildings(): List<BuildingEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertBuilding(building: BuildingEntity)

    @Query("SELECT * FROM rental_units WHERE buildingId = :buildingId")
    suspend fun getUnitsForBuilding(buildingId: String): List<RentalUnitEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUnit(unit: RentalUnitEntity)

    @Query("SELECT * FROM tenants")
    suspend fun getAllTenants(): List<TenantEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTenant(tenant: TenantEntity)

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertRentChargeIgnoreDuplicate(charge: RentChargeEntity): Long

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertPayment(payment: PaymentEntity)

    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertPaymentAllocations(allocations: List<PaymentAllocationEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAuditLog(log: AuditLogEntity)

    @Transaction
    suspend fun recordPaymentTransactionally(
        payment: PaymentEntity,
        allocations: List<PaymentAllocationEntity>,
        auditLog: AuditLogEntity
    ) {
        insertPayment(payment)
        insertPaymentAllocations(allocations)
        insertAuditLog(auditLog)
    }
}

@Database(
    entities = [
        UserProfileEntity::class,
        UserPermissionEntity::class,
        BuildingEntity::class,
        FloorEntity::class,
        RentalUnitEntity::class,
        TenantEntity::class,
        OccupancyEntity::class,
        LeaseAgreementEntity::class,
        RentChargeEntity::class,
        MeterReadingEntity::class,
        UtilityBillEntity::class,
        SharedChargeEntity::class,
        SharedChargeAllocationEntity::class,
        PaymentEntity::class,
        PaymentAllocationEntity::class,
        ReceiptEntity::class,
        ExpenseEntity::class,
        SecurityDepositTransactionEntity::class,
        ReminderSettingsEntity::class,
        AuditLogEntity::class,
        SyncMetadataEntity::class,
        AppSettingsEntity::class
    ],
    version = 1,
    exportSchema = true
)
abstract class BashaRentDatabase : RoomDatabase() {
    abstract fun dao(): BashaRentDao

    companion object {
        val MIGRATION_1_2 = object : Migration(1, 2) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("CREATE INDEX IF NOT EXISTS index_payments_paymentDate ON payments(paymentDate)")
            }
        }
    }
}
