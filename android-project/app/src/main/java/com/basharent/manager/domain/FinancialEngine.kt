package com.basharent.manager.domain

import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong

object FinancialEngine {

    /**
     * Converts Taka string or number into exact integer Poisha (1 BDT = 100 Poisha).
     * Never uses floating-point arithmetic for monetary balances.
     */
    fun takaToPoisha(takaStr: String): Long {
        val clean = takaStr.trim().replace(",", "")
        if (clean.isEmpty() || clean == "-") return 0L
        val isNeg = clean.startsWith("-")
        val unsigned = if (isNeg) clean.substring(1) else clean
        val parts = unsigned.split(".")
        val whole = parts[0].ifEmpty { "0" }.toLong()
        val frac = (if (parts.size > 1) parts[1] else "").padEnd(2, '0').take(2).toLong()
        val total = whole * 100L + frac
        return if (isNeg) -total else total
    }

    fun calculateMeterBillPoisha(
        prevReading: Double,
        currReading: Double,
        ratePerUnitPoisha: Long,
        fixedChargePoisha: Long,
        rolloverAuthorized: Boolean = false
    ): Pair<Double, Long> {
        require(prevReading >= 0 && currReading >= 0) { "Meter readings cannot be negative" }
        require(ratePerUnitPoisha >= 0 && fixedChargePoisha >= 0) { "Rates cannot be negative" }
        val consumption = if (currReading < prevReading) {
            require(rolloverAuthorized) { "Current reading cannot be lower than previous reading without rollover authorization" }
            currReading
        } else {
            currReading - prevReading
        }
        val totalPoisha = (consumption * ratePerUnitPoisha).roundToLong() + fixedChargePoisha
        return Pair(consumption, totalPoisha)
    }

    data class Obligation(
        val id: String,
        val billingPeriod: String,
        val outstandingPoisha: Long
    )

    data class AllocationResult(
        val allocatedByTarget: Map<String, Long>,
        val unallocatedAdvanceCreditPoisha: Long
    )

    fun allocateOldestFirst(
        amountReceivedPoisha: Long,
        obligations: List<Obligation>
    ): AllocationResult {
        require(amountReceivedPoisha > 0) { "Payment must be positive" }
        var remaining = amountReceivedPoisha
        val map = linkedMapOf<String, Long>()
        val sorted = obligations.sortedBy { it.billingPeriod }
        for (ob in sorted) {
            if (remaining <= 0L) break
            if (ob.outstandingPoisha <= 0L) continue
            val applied = min(remaining, ob.outstandingPoisha)
            map[ob.id] = applied
            remaining -= applied
        }
        return AllocationResult(map, max(0L, remaining))
    }
}
