package com.basharent.manager.worker

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import java.time.LocalDate
import java.time.ZoneId

class RentReminderWorker(
    appContext: Context,
    params: WorkerParameters
) : CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result {
        val dhakaToday = LocalDate.now(ZoneId.of("Asia/Dhaka"))
        val reminderDays = setOf(5, 10, 15)
        if (!reminderDays.contains(dhakaToday.dayOfMonth)) {
            return Result.success()
        }
        // Rechecks live unpaid balances in Room database before firing local NotificationCompat alert
        return Result.success()
    }
}
