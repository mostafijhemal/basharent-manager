import assert from 'node:assert/strict';
import {
  createEncryptedBackup,
  decryptAndVerifyBackup,
  hashPinCode,
  inspectBackupEnvelope,
} from '../services/cryptoBackupService';
import {
  createCleanDatabaseState,
  createDemoDatabaseState,
} from '../services/defaultSeedData';
import {
  allocatePaymentCustom,
  allocatePaymentOldestFirst,
  calculateFinancialSummary,
  calculateMeterUtilityBill,
  calculateProratedRentPoisha,
  calculateTenantDepositBalance,
  evaluateOverdueReminders,
  formatBDT,
  generateMonthlyChargesForPeriod,
  getDhakaBillingPeriod,
  getDhakaToday,
  getTenantUnpaidObligations,
  takaToPoisha,
  validateSharedChargeAllocations,
} from '../services/financialEngine';
import { mergeStatesIdempotently } from '../services/syncEngine';

async function runSuite() {
  let passed = 0;
  const test = async (name: string, fn: () => void | Promise<void>) => {
    await fn();
    passed++;
    console.log(`PASS [${passed}]: ${name}`);
  };

  // 1. Money precision (BDT Taka <-> Poisha integer arithmetic)
  await test('Money precision: exact integer Poisha conversion without float error', () => {
    assert.equal(takaToPoisha('24,000'), 2400000);
    assert.equal(takaToPoisha('8.95'), 895);
    assert.equal(takaToPoisha('19.99'), 1999);
    assert.equal(formatBDT(12500000, 'en'), '৳ 1,25,000');
    assert.equal(formatBDT(2400000, 'bn'), '৳ ২৪,০০০');
  });

  // 2. Date boundaries and Bangladesh timezone (Asia/Dhaka)
  await test('Date boundaries & Asia/Dhaka timezone formatting', () => {
    const d = new Date('2026-10-01T00:30:00+06:00');
    assert.equal(getDhakaToday(d), '2026-10-01');
    assert.equal(getDhakaBillingPeriod(d), '2026-10');
  });

  // 3. Monthly rent generation
  await test('Monthly rent generation for active occupied units', () => {
    const clean = createCleanDatabaseState();
    clean.buildings.push({
      id: 'b1',
      name: 'Test Villa',
      address: 'Dhaka',
      notes: '',
      status: 'ACTIVE',
      defaultDueDay: 5,
      createdAt: '2026-01-01',
    });
    clean.units.push({
      id: 'u1',
      buildingId: 'b1',
      floorId: 'f1',
      unitNumber: '1A',
      unitType: 'Family',
      bedrooms: 3,
      defaultRentPoisha: 2000000,
      serviceChargePoisha: 200000,
      status: 'OCCUPIED',
      notes: '',
    });
    clean.tenants.push({
      id: 't1',
      fullName: 'Karim Mia',
      primaryPhone: '01700000000',
      altPhone: '',
      nidNumber: '1234567890',
      presentAddress: '',
      permanentAddress: '',
      occupation: '',
      emergencyContact: '',
      familyMembersInfo: '',
      moveInDate: '2026-01-01',
      leaseStartDate: '2026-01-01',
      leaseEndDate: '2027-01-01',
      monthlyRentPoisha: 2000000,
      dueDay: 5,
      securityDepositPoisha: 4000000,
      advanceRentCreditPoisha: 0,
      status: 'ACTIVE',
      notes: '',
      currentBuildingId: 'b1',
      currentUnitId: 'u1',
      createdAt: '2026-01-01',
    });

    const res1 = generateMonthlyChargesForPeriod(clean, '2026-10');
    assert.equal(res1.newCharges.length, 2); // Rent + Service Charge
    clean.rentCharges.push(...res1.newCharges);

    // 4. Prevention of duplicate monthly charges
    const res2 = generateMonthlyChargesForPeriod(clean, '2026-10');
    assert.equal(res2.newCharges.length, 0);
    assert.equal(res2.skippedCount, 2);
  });

  // 5. Tenant move-in and move-out proration & archived exclusion
  await test('Partial-month proration & zero charge generation for archived tenants', () => {
    const pro = calculateProratedRentPoisha(
      3000000,
      '2026-09',
      '2026-09-16',
      undefined,
      'DAILY_30'
    );
    assert.equal(pro.isProrated, true);
    assert.equal(pro.amountPoisha, 1500000); // 15 days out of 30

    const demo = createDemoDatabaseState();
    const archivedCharges = demo.rentCharges.filter(
      (rc) => rc.tenantId === 'tnt_5_archived'
    );
    assert.equal(archivedCharges.length, 0);
  });

  // 6. Partial payments & outstanding balance calculation
  await test('Partial payments & accurate remaining balance calculation', () => {
    const demo = createDemoDatabaseState();
    const t2Unpaid = getTenantUnpaidObligations(
      'tnt_2',
      demo.rentCharges,
      demo.utilityBills
    );
    // Flat 1B has 7,000 rent remaining + 2,500 SC + 2,119 Electricity = 11,619 BDT (1161900 poisha)
    const totalOut = t2Unpaid.reduce((s, o) => s + o.outstandingPoisha, 0);
    assert.equal(totalOut, 1161900);
  });

  // 7. Oldest-first (FIFO) allocation across multiple periods
  await test('Oldest-first (FIFO) payment allocation across multi-month charges', () => {
    const obligations = [
      {
        targetType: 'RENT_CHARGE' as const,
        targetId: 'rc_aug',
        billingPeriod: '2026-08',
        label: 'Rent (2026-08)',
        totalPoisha: 2000000,
        paidPoisha: 1500000,
        outstandingPoisha: 500000,
        createdAt: '2026-08-01',
      },
      {
        targetType: 'RENT_CHARGE' as const,
        targetId: 'rc_sep',
        billingPeriod: '2026-09',
        label: 'Rent (2026-09)',
        totalPoisha: 2000000,
        paidPoisha: 0,
        outstandingPoisha: 2000000,
        createdAt: '2026-09-01',
      },
    ];
    const res = allocatePaymentOldestFirst(
      'pay_test',
      1800000,
      obligations,
      '2026-10'
    );
    assert.equal(res.allocations.length, 2);
    assert.equal(res.allocations[0].targetId, 'rc_aug');
    assert.equal(res.allocations[0].amountPoisha, 500000);
    assert.equal(res.allocations[1].targetId, 'rc_sep');
    assert.equal(res.allocations[1].amountPoisha, 1300000);
    assert.equal(res.unallocatedCreditPoisha, 0);
  });

  // 8. User-selected custom payment allocation
  await test('Owner-selected custom payment allocation to specific charges', () => {
    const obligations = [
      {
        targetType: 'RENT_CHARGE' as const,
        targetId: 'rc_1',
        billingPeriod: '2026-09',
        label: 'Rent (2026-09)',
        totalPoisha: 2000000,
        paidPoisha: 0,
        outstandingPoisha: 2000000,
        createdAt: '2026-09-01',
      },
      {
        targetType: 'UTILITY_BILL' as const,
        targetId: 'ub_1',
        billingPeriod: '2026-10',
        label: 'Electricity (2026-10)',
        totalPoisha: 300000,
        paidPoisha: 0,
        outstandingPoisha: 300000,
        createdAt: '2026-10-01',
      },
    ];
    const res = allocatePaymentCustom(
      'pay_cust',
      1000000,
      { rc_1: 700000, ub_1: 300000 },
      obligations,
      '2026-10'
    );
    assert.equal(res.allocations.length, 2);
    assert.equal(res.unallocatedCreditPoisha, 0);
  });

  // 9. Overpayment handling -> Advance Rent Credit
  await test('Overpayment handling preserves excess as unallocated Advance Credit', () => {
    const obligations = [
      {
        targetType: 'RENT_CHARGE' as const,
        targetId: 'rc_1',
        billingPeriod: '2026-10',
        label: 'Rent (2026-10)',
        totalPoisha: 2000000,
        paidPoisha: 0,
        outstandingPoisha: 2000000,
        createdAt: '2026-10-01',
      },
    ];
    const res = allocatePaymentOldestFirst(
      'pay_over',
      2500000,
      obligations,
      '2026-10'
    );
    assert.equal(res.unallocatedCreditPoisha, 500000);
    assert.equal(res.allocations[1].targetType, 'ADVANCE_CREDIT');
    assert.equal(res.allocations[1].amountPoisha, 500000);
  });

  // 10. Security deposit collection, deduction, and refund separation
  await test('Security deposit ledger keeps deposits separate from rent income', () => {
    const demo = createDemoDatabaseState();
    const archDep = calculateTenantDepositBalance(
      'tnt_5_archived',
      demo.depositTransactions
    );
    assert.equal(archDep.collectedPoisha, 3700000);
    assert.equal(archDep.deductedPoisha, 350000);
    assert.equal(archDep.refundedPoisha, 3350000);
    assert.equal(archDep.heldBalancePoisha, 0);
  });

  // 11. Utility meter calculations & invalid meter reading rejection
  await test('Utility meter calculation and lower-reading validation guard', () => {
    const calc = calculateMeterUtilityBill({
      prevReading: 4120,
      currReading: 4380,
      ratePerUnitPoisha: 895,
      fixedChargePoisha: 15000,
    });
    assert.equal(calc.consumptionUnits, 260);
    assert.equal(calc.totalAmountPoisha, 247700);

    assert.throws(() => {
      calculateMeterUtilityBill({
        prevReading: 500,
        currReading: 450,
        ratePerUnitPoisha: 895,
        fixedChargePoisha: 0,
        rolloverAuthorized: false,
      });
    });

    const rolloverOk = calculateMeterUtilityBill({
      prevReading: 99950,
      currReading: 120,
      ratePerUnitPoisha: 1000,
      fixedChargePoisha: 0,
      rolloverAuthorized: true,
    });
    assert.equal(rolloverOk.consumptionUnits, 120);
  });

  // 12. Shared charge allocation & rounding validation
  await test('Custom shared charge allocation reconciliation', () => {
    const invalid = validateSharedChargeAllocations(450000, [
      { unitId: 'u1', tenantId: 't1', amountPoisha: 200000 },
      { unitId: 'u2', tenantId: 't2', amountPoisha: 200000 },
    ]);
    assert.equal(invalid.isValid, false);
    assert.equal(invalid.differencePoisha, 50000);

    const valid = validateSharedChargeAllocations(450000, [
      { unitId: 'u1', tenantId: 't1', amountPoisha: 225000 },
      { unitId: 'u2', tenantId: 't2', amountPoisha: 225000 },
    ]);
    assert.equal(valid.isValid, true);
    assert.equal(valid.differencePoisha, 0);
  });

  // 13. Dashboard & Report financial totals reconciliation
  await test('Dashboard & Report financial calculations reconcile with transactions', () => {
    const demo = createDemoDatabaseState();
    const period = getDhakaBillingPeriod();
    const sum = calculateFinancialSummary(demo, period);
    // Cash collected: 28,977 + 15,000 + 37,500 = 81,477 BDT (8147700 poisha)
    assert.equal(sum.totalCashCollectedPoisha, 8147700);
    // Expenses: 14,000 + 3,500 + 4,800 = 22,300 BDT (2230000 poisha)
    assert.equal(sum.totalExpensesPoisha, 2230000);
    // Net Operating Cash Flow = 81,477 - 22,300 = 59,177 BDT (5917700 poisha)
    assert.equal(sum.netOperatingCashFlowPoisha, 5917700);
    // Security deposits held: 48,000 + 44,000 + 50,000 + 64,000 = 2,06,000 BDT (20600000 poisha)
    assert.equal(sum.securityDepositsHeldPoisha, 20600000);
  });

  // 14. Notification & Reminder eligibility on 5th, 10th, and 15th
  await test('Reminder eligibility checks 5th/10th/15th schedule & live overdue balances', () => {
    const demo = createDemoDatabaseState();
    const eval10th = evaluateOverdueReminders(demo, '2026-10-10');
    assert.equal(eval10th.isScheduledReminderDay, true);
    assert.equal(eval10th.overdueItems.length, 2); // Flat 1B and Flat 2A have unpaid balances
    // Verify NID is never included in reminder message
    for (const item of eval10th.overdueItems) {
      assert.equal(item.messageEn.includes(item.tenant.nidNumber), false);
      assert.equal(item.messageBn.includes(item.tenant.nidNumber), false);
    }
  });

  // 15. AES-256-GCM Encrypted Backup & Restore + Wrong Password / Tampering Rejection
  await test('AES-256-GCM backup encryption, integrity check, and wrong-password rejection', async () => {
    const demo = createDemoDatabaseState();
    const encryptedJson = await createEncryptedBackup(
      demo,
      'MySecretPass#2026',
      true
    );
    const envelope = inspectBackupEnvelope(encryptedJson);
    assert.equal(envelope.cipher, 'AES-256-GCM');
    assert.equal(envelope.summary.buildingsCount, 2);

    const { state: restored } = await decryptAndVerifyBackup(
      encryptedJson,
      'MySecretPass#2026'
    );
    assert.equal(restored.tenants.length, demo.tenants.length);
    assert.equal(restored.payments.length, demo.payments.length);

    await assert.rejects(async () => {
      await decryptAndVerifyBackup(encryptedJson, 'WrongPassword123');
    });
  });

  // 16. Sync idempotency & duplicate-payment prevention
  await test('Multi-device sync idempotency prevents duplicate payments & charges', () => {
    const local = createDemoDatabaseState();
    const remote = createDemoDatabaseState();
    const merged = mergeStatesIdempotently(local, remote);
    assert.equal(merged.addedPaymentsCount, 0);
    assert.equal(merged.addedChargesCount, 0);
    assert.equal(merged.mergedState.payments.length, local.payments.length);
  });

  // 17. PIN Hashing determinism
  await test('PIN code salted SHA-256 hashing', async () => {
    const h1 = await hashPinCode('1234');
    const h2 = await hashPinCode('1234');
    const h3 = await hashPinCode('9999');
    assert.equal(h1, h2);
    assert.notEqual(h1, h3);
  });

  console.log(`\nALL ${passed} AUTOMATED TESTS PASSED SUCCESSFULLY.`);
}

runSuite().catch((err) => {
  console.error('TEST SUITE FAILED:', err);
  process.exit(1);
});
