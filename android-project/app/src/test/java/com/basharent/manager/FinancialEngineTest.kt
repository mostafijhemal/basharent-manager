package com.basharent.manager

import com.basharent.manager.domain.FinancialEngine
import com.basharent.manager.security.BackupCryptoManager
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Test

class FinancialEngineTest {

    @Test
    fun testTakaToPoishaExactPrecision() {
        assertEquals(2400000L, FinancialEngine.takaToPoisha("24,000"))
        assertEquals(895L, FinancialEngine.takaToPoisha("8.95"))
    }

    @Test
    fun testFifoAllocationAndOverpaymentAdvanceCredit() {
        val obligations = listOf(
            FinancialEngine.Obligation("rc_1", "2026-09", 1000000L),
            FinancialEngine.Obligation("rc_2", "2026-10", 2000000L)
        )
        val result = FinancialEngine.allocateOldestFirst(3500000L, obligations)
        assertEquals(1000000L, result.allocatedByTarget["rc_1"])
        assertEquals(2000000L, result.allocatedByTarget["rc_2"])
        assertEquals(500000L, result.unallocatedAdvanceCreditPoisha)
    }

    @Test
    fun testBackupEncryptionAndDecryptionRoundtrip() {
        val raw = """{"buildings":2,"tenants":5}""".toByteArray()
        val pass = "StrongPass2026".toCharArray()
        val encrypted = BackupCryptoManager.encryptBackup(raw, pass)
        val decrypted = BackupCryptoManager.decryptBackup(encrypted, "StrongPass2026".toCharArray())
        assertArrayEquals(raw, decrypted)
    }
}
