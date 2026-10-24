import {
  Building,
  DatabaseState,
  Language,
  PaymentAllocation,
  ProrationPolicy,
  RentCharge,
  RentalUnit,
  SecurityDepositTransaction,
  SharedChargeAllocationItem,
  Tenant,
  UtilityBill,
} from '../types/models';

const BENGALI_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];

export function toBengaliDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => BENGALI_DIGITS[Number(d)]);
}

/**
 * Converts a BDT Taka numeric string or number into exact integer Poisha (1 BDT = 100 Poisha).
 * Uses string decomposition to avoid IEEE-754 floating-point drift.
 */
export function takaToPoisha(takaInput: string | number): number {
  const clean = String(takaInput).trim().replace(/,/g, '');
  if (!clean || clean === '-') return 0;
  const isNegative = clean.startsWith('-');
  const unsigned = isNegative ? clean.slice(1) : clean;
  const parts = unsigned.split('.');
  const wholeTaka = parseInt(parts[0] || '0', 10);
  const fracRaw = (parts[1] || '').padEnd(2, '0').slice(0, 2);
  const poisha = parseInt(fracRaw || '0', 10);
  if (Number.isNaN(wholeTaka) || Number.isNaN(poisha)) {
    throw new Error('Invalid BDT monetary value');
  }
  const total = wholeTaka * 100 + poisha;
  return isNegative ? -total : total;
}

export function poishaToTakaNumber(poisha: number): number {
  return Math.round(poisha) / 100;
}

/**
 * Formats integer Poisha in Bangladeshi Taka (Lakh/Crore system: 1,25,000) in English or Bengali.
 */
export function formatBDT(
  poisha: number,
  lang: Language = 'en',
  showDecimalsIfZero = false
): string {
  const rounded = Math.round(poisha);
  const isNeg = rounded < 0;
  const absPoisha = Math.abs(rounded);
  const wholeTaka = Math.floor(absPoisha / 100);
  const remPoisha = absPoisha % 100;

  // South Asian grouping: last 3 digits, then pairs of 2 digits
  const str = String(wholeTaka);
  let formattedWhole = str;
  if (str.length > 3) {
    const lastThree = str.slice(-3);
    const otherNumbers = str.slice(0, -3);
    formattedWhole =
      otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree;
  }

  let numberPart = formattedWhole;
  if (remPoisha > 0 || showDecimalsIfZero) {
    numberPart += '.' + String(remPoisha).padStart(2, '0');
  }

  if (lang === 'bn') {
    numberPart = toBengaliDigits(numberPart);
  }

  return `${isNeg ? '-' : ''}৳ ${numberPart}`;
}

/**
 * Returns current date in Asia/Dhaka timezone as YYYY-MM-DD.
 */
export function getDhakaToday(referenceDate: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(referenceDate); // YYYY-MM-DD
}

export function getDhakaBillingPeriod(referenceDate: Date = new Date()): string {
  return getDhakaToday(referenceDate).slice(0, 7); // YYYY-MM
}

export function formatBillingPeriod(period: string, lang: Language): string {
  const [year, month] = period.split('-');
  const monthsEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthsBn = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর',
  ];
  const idx = Math.max(0, Math.min(11, parseInt(month || '1', 10) - 1));
  if (lang === 'bn') {
    return `${monthsBn[idx]} ${toBengaliDigits(year || '')}`;
  }
  return `${monthsEn[idx]} ${year || ''}`;
}

export function getDaysInMonth(billingPeriod: string): number {
  const [y, m] = billingPeriod.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * Calculates prorated rent in integer Poisha based on moveInDate / moveOutDate within billingPeriod.
 */
export function calculateProratedRentPoisha(
  monthlyRentPoisha: number,
  billingPeriod: string,
  moveInDate: string,
  moveOutDate: string | undefined,
  policy: ProrationPolicy
): { amountPoisha: number; isProrated: boolean } {
  const totalDays = getDaysInMonth(billingPeriod);
  const periodStart = `${billingPeriod}-01`;
  const periodEnd = `${billingPeriod}-${String(totalDays).padStart(2, '0')}`;

  const effectiveStart = moveInDate > periodStart ? moveInDate : periodStart;
  const effectiveEnd =
    moveOutDate && moveOutDate < periodEnd ? moveOutDate : periodEnd;

  if (effectiveStart > effectiveEnd) {
    return { amountPoisha: 0, isProrated: false };
  }

  const startDay = parseInt(effectiveStart.slice(8, 10), 10);
  const endDay = parseInt(effectiveEnd.slice(8, 10), 10);
  const occupiedDays = endDay - startDay + 1;

  if (occupiedDays >= totalDays || policy === 'FULL_MONTH') {
    return { amountPoisha: monthlyRentPoisha, isProrated: false };
  }

  const divisor = policy === 'DAILY_30' ? 30 : totalDays;
  const prorated = Math.round((monthlyRentPoisha * occupiedDays) / divisor);
  return { amountPoisha: prorated, isProrated: true };
}

/**
 * Generates monthly rent and fixed service charges for a target billing period (YYYY-MM).
 * Strictly idempotent: never creates duplicate charges for the same (unitId, tenantId, billingPeriod, category).
 */
export function generateMonthlyChargesForPeriod(
  state: Pick<
    DatabaseState,
    'buildings' | 'units' | 'tenants' | 'rentCharges' | 'settings'
  >,
  billingPeriod: string,
  nowIso: string = new Date().toISOString()
): { newCharges: RentCharge[]; skippedCount: number } {
  const newCharges: RentCharge[] = [];
  let skippedCount = 0;

  const totalDays = getDaysInMonth(billingPeriod);
  const periodStart = `${billingPeriod}-01`;
  const periodEnd = `${billingPeriod}-${String(totalDays).padStart(2, '0')}`;

  for (const tenant of state.tenants) {
    if (tenant.status !== 'ACTIVE') continue;
    if (!tenant.currentUnitId || !tenant.currentBuildingId) continue;

    // Check occupancy boundaries
    if (tenant.moveInDate > periodEnd) continue;
    if (tenant.moveOutDate && tenant.moveOutDate < periodStart) continue;

    const unit = state.units.find((u) => u.id === tenant.currentUnitId);
    const building = state.buildings.find((b) => b.id === tenant.currentBuildingId);
    if (!unit || !building) continue;

    const dueDay = Math.max(
      1,
      Math.min(28, tenant.dueDay || building.defaultDueDay || 1)
    );
    const dueDate = `${billingPeriod}-${String(dueDay).padStart(2, '0')}`;

    // 1. Monthly Rent Charge
    const existingRent = state.rentCharges.find(
      (rc) =>
        rc.unitId === unit.id &&
        rc.tenantId === tenant.id &&
        rc.billingPeriod === billingPeriod &&
        rc.category === 'RENT'
    );

    if (existingRent) {
      skippedCount++;
    } else if (tenant.monthlyRentPoisha > 0) {
      const { amountPoisha, isProrated } = calculateProratedRentPoisha(
        tenant.monthlyRentPoisha,
        billingPeriod,
        tenant.moveInDate,
        tenant.moveOutDate,
        state.settings.prorationPolicy
      );

      if (amountPoisha > 0) {
        newCharges.push({
          id: `rc_${billingPeriod}_${unit.id}_${tenant.id}_RENT`,
          buildingId: building.id,
          unitId: unit.id,
          tenantId: tenant.id,
          billingPeriod,
          category: 'RENT',
          originalAmountPoisha: tenant.monthlyRentPoisha,
          adjustedAmountPoisha: amountPoisha,
          paidAmountPoisha: 0,
          dueDate,
          isProrated,
          notes: isProrated ? 'Prorated partial month occupancy' : '',
          createdAt: nowIso,
        });
      }
    }

    // 2. Unit Fixed Monthly Service Charge (if configured on unit)
    if (unit.serviceChargePoisha > 0) {
      const existingSc = state.rentCharges.find(
        (rc) =>
          rc.unitId === unit.id &&
          rc.tenantId === tenant.id &&
          rc.billingPeriod === billingPeriod &&
          rc.category === 'SERVICE_CHARGE'
      );
      if (existingSc) {
        skippedCount++;
      } else {
        newCharges.push({
          id: `rc_${billingPeriod}_${unit.id}_${tenant.id}_SC`,
          buildingId: building.id,
          unitId: unit.id,
          tenantId: tenant.id,
          billingPeriod,
          category: 'SERVICE_CHARGE',
          originalAmountPoisha: unit.serviceChargePoisha,
          adjustedAmountPoisha: unit.serviceChargePoisha,
          paidAmountPoisha: 0,
          dueDate,
          isProrated: false,
          notes: 'Monthly fixed service charge',
          createdAt: nowIso,
        });
      }
    }
  }

  return { newCharges, skippedCount };
}

export interface PayableObligation {
  targetType: 'RENT_CHARGE' | 'UTILITY_BILL';
  targetId: string;
  billingPeriod: string;
  label: string;
  totalPoisha: number;
  paidPoisha: number;
  outstandingPoisha: number;
  createdAt: string;
}

export function getTenantUnpaidObligations(
  tenantId: string,
  rentCharges: RentCharge[],
  utilityBills: UtilityBill[]
): PayableObligation[] {
  const items: PayableObligation[] = [];

  for (const rc of rentCharges) {
    if (rc.tenantId !== tenantId) continue;
    const rem = rc.adjustedAmountPoisha - rc.paidAmountPoisha;
    if (rem > 0) {
      items.push({
        targetType: 'RENT_CHARGE',
        targetId: rc.id,
        billingPeriod: rc.billingPeriod,
        label:
          rc.category === 'RENT'
            ? `Rent (${rc.billingPeriod})`
            : `Service Charge (${rc.billingPeriod})`,
        totalPoisha: rc.adjustedAmountPoisha,
        paidPoisha: rc.paidAmountPoisha,
        outstandingPoisha: rem,
        createdAt: rc.createdAt,
      });
    }
  }

  for (const ub of utilityBills) {
    if (ub.tenantId !== tenantId) continue;
    const rem = ub.totalAmountPoisha - ub.paidAmountPoisha;
    if (rem > 0) {
      items.push({
        targetType: 'UTILITY_BILL',
        targetId: ub.id,
        billingPeriod: ub.billingPeriod,
        label: `${ub.utilityType} Bill (${ub.billingPeriod})`,
        totalPoisha: ub.totalAmountPoisha,
        paidPoisha: ub.paidAmountPoisha,
        outstandingPoisha: rem,
        createdAt: ub.createdAt,
      });
    }
  }

  // Sort oldest billing period first, then RENT_CHARGE before UTILITY_BILL
  return items.sort((a, b) => {
    if (a.billingPeriod !== b.billingPeriod) {
      return a.billingPeriod.localeCompare(b.billingPeriod);
    }
    if (a.targetType !== b.targetType) {
      return a.targetType === 'RENT_CHARGE' ? -1 : 1;
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/**
 * Allocates a payment amount using Oldest-First FIFO rule across unpaid charges/bills.
 * Any excess beyond total unpaid charges is preserved as an explicit Advance Rent Credit allocation.
 */
export function allocatePaymentOldestFirst(
  paymentId: string,
  amountReceivedPoisha: number,
  obligations: PayableObligation[],
  currentPeriod: string
): {
  allocations: PaymentAllocation[];
  unallocatedCreditPoisha: number;
} {
  if (amountReceivedPoisha <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  let remainingToAllocate = amountReceivedPoisha;
  const allocations: PaymentAllocation[] = [];

  for (const ob of obligations) {
    if (remainingToAllocate <= 0) break;
    if (ob.outstandingPoisha <= 0) continue;

    const applied = Math.min(remainingToAllocate, ob.outstandingPoisha);
    allocations.push({
      id: `alloc_${paymentId}_${ob.targetId}`,
      paymentId,
      targetType: ob.targetType,
      targetId: ob.targetId,
      billingPeriod: ob.billingPeriod,
      label: ob.label,
      amountPoisha: applied,
    });
    remainingToAllocate -= applied;
  }

  if (remainingToAllocate > 0) {
    allocations.push({
      id: `alloc_${paymentId}_advance`,
      paymentId,
      targetType: 'ADVANCE_CREDIT',
      targetId: 'ADVANCE_POOL',
      billingPeriod: currentPeriod,
      label: `Unallocated Advance Credit (${currentPeriod})`,
      amountPoisha: remainingToAllocate,
    });
  }

  return {
    allocations,
    unallocatedCreditPoisha: remainingToAllocate,
  };
}

/**
 * Validates and allocates a payment using user-selected custom amounts per obligation.
 */
export function allocatePaymentCustom(
  paymentId: string,
  amountReceivedPoisha: number,
  customMap: Record<string, number>, // targetId -> amountPoisha
  obligations: PayableObligation[],
  currentPeriod: string
): {
  allocations: PaymentAllocation[];
  unallocatedCreditPoisha: number;
} {
  if (amountReceivedPoisha <= 0) {
    throw new Error('Payment amount must be greater than zero');
  }

  let sumAllocated = 0;
  const allocations: PaymentAllocation[] = [];

  for (const ob of obligations) {
    const requested = customMap[ob.targetId] || 0;
    if (requested < 0) {
      throw new Error('Allocation cannot be negative');
    }
    if (requested > ob.outstandingPoisha) {
      throw new Error(
        `Allocation for ${ob.label} exceeds its outstanding balance`
      );
    }
    if (requested > 0) {
      allocations.push({
        id: `alloc_${paymentId}_${ob.targetId}`,
        paymentId,
        targetType: ob.targetType,
        targetId: ob.targetId,
        billingPeriod: ob.billingPeriod,
        label: ob.label,
        amountPoisha: requested,
      });
      sumAllocated += requested;
    }
  }

  if (sumAllocated > amountReceivedPoisha) {
    throw new Error(
      'Total allocated amount cannot exceed total payment received'
    );
  }

  const unallocated = amountReceivedPoisha - sumAllocated;
  if (unallocated > 0) {
    allocations.push({
      id: `alloc_${paymentId}_advance`,
      paymentId,
      targetType: 'ADVANCE_CREDIT',
      targetId: 'ADVANCE_POOL',
      billingPeriod: currentPeriod,
      label: `Unallocated Advance Credit (${currentPeriod})`,
      amountPoisha: unallocated,
    });
  }

  return {
    allocations,
    unallocatedCreditPoisha: unallocated,
  };
}

/**
 * Calculates meter-based utility bill in integer Poisha.
 * Enforces currReading >= prevReading unless rolloverAuthorized is true.
 */
export function calculateMeterUtilityBill(params: {
  prevReading: number;
  currReading: number;
  ratePerUnitPoisha: number;
  fixedChargePoisha: number;
  rolloverAuthorized?: boolean;
  meterMaxRolloverValue?: number;
}): {
  consumptionUnits: number;
  totalAmountPoisha: number;
} {
  const {
    prevReading,
    currReading,
    ratePerUnitPoisha,
    fixedChargePoisha,
    rolloverAuthorized = false,
    meterMaxRolloverValue = 100000,
  } = params;

  if (prevReading < 0 || currReading < 0) {
    throw new Error('Meter readings cannot be negative');
  }
  if (ratePerUnitPoisha < 0 || fixedChargePoisha < 0) {
    throw new Error('Rates and fixed charges cannot be negative');
  }

  let consumptionUnits = 0;
  if (currReading < prevReading) {
    if (!rolloverAuthorized) {
      throw new Error(
        'Current meter reading cannot be lower than previous reading unless meter rollover/reset is authorized'
      );
    }
    consumptionUnits =
      currReading >= 0 && prevReading <= meterMaxRolloverValue
        ? currReading
        : 0;
  } else {
    consumptionUnits = Number((currReading - prevReading).toFixed(4));
  }

  const variablePoisha = Math.round(consumptionUnits * ratePerUnitPoisha);
  const totalAmountPoisha = variablePoisha + Math.round(fixedChargePoisha);

  return {
    consumptionUnits,
    totalAmountPoisha,
  };
}

/**
 * Validates custom shared charge allocations across units/tenants.
 * Requires exact reconciliation with totalAmountPoisha.
 */
export function validateSharedChargeAllocations(
  totalAmountPoisha: number,
  allocations: SharedChargeAllocationItem[]
): {
  isValid: boolean;
  allocatedSumPoisha: number;
  differencePoisha: number;
} {
  const allocatedSumPoisha = allocations.reduce(
    (sum, item) => sum + Math.round(item.amountPoisha),
    0
  );
  const differencePoisha = totalAmountPoisha - allocatedSumPoisha;
  return {
    isValid:
      totalAmountPoisha > 0 &&
      allocations.length > 0 &&
      differencePoisha === 0 &&
      allocations.every((a) => a.amountPoisha >= 0),
    allocatedSumPoisha,
    differencePoisha,
  };
}

/**
 * Computes a tenant's refundable security deposit balance separately from rental income.
 */
export function calculateTenantDepositBalance(
  tenantId: string,
  transactions: SecurityDepositTransaction[]
): {
  collectedPoisha: number;
  deductedPoisha: number;
  refundedPoisha: number;
  heldBalancePoisha: number;
} {
  let collectedPoisha = 0;
  let deductedPoisha = 0;
  let refundedPoisha = 0;

  for (const tx of transactions) {
    if (tx.tenantId !== tenantId) continue;
    if (tx.type === 'DEPOSIT_COLLECTED') collectedPoisha += tx.amountPoisha;
    else if (tx.type === 'DEPOSIT_DEDUCTION') deductedPoisha += tx.amountPoisha;
    else if (tx.type === 'DEPOSIT_REFUND') refundedPoisha += tx.amountPoisha;
  }

  const heldBalancePoisha = Math.max(
    0,
    collectedPoisha - deductedPoisha - refundedPoisha
  );
  return {
    collectedPoisha,
    deductedPoisha,
    refundedPoisha,
    heldBalancePoisha,
  };
}

export interface FinancialDashboardSummary {
  billingPeriod: string;
  totalRentChargedPoisha: number;
  totalUtilityChargedPoisha: number;
  totalCashCollectedPoisha: number;
  outstandingRentPoisha: number;
  outstandingUtilityPoisha: number;
  totalOutstandingAllPeriodsPoisha: number;
  totalExpensesPoisha: number;
  netOperatingCashFlowPoisha: number;
  securityDepositsHeldPoisha: number;
  vacantUnitsCount: number;
  occupiedUnitsCount: number;
  maintenanceUnitsCount: number;
  activeTenantsCount: number;
  collectionRatePercent: number;
  buildingBreakdown: {
    buildingId: string;
    buildingName: string;
    chargedPoisha: number;
    collectedPoisha: number;
    outstandingPoisha: number;
    expensesPoisha: number;
  }[];
}

/**
 * Authoritative financial aggregation used by both Dashboard and Reports.
 * Strictly separates cash collected from charges billed, and keeps security deposits out of rental income.
 */
export function calculateFinancialSummary(
  state: DatabaseState,
  billingPeriod: string,
  buildingFilterId?: string
): FinancialDashboardSummary {
  const filterBld = (bId: string) =>
    !buildingFilterId || buildingFilterId === 'ALL' || bId === buildingFilterId;

  // Charges for selected billingPeriod
  const periodRentCharges = state.rentCharges.filter(
    (rc) => rc.billingPeriod === billingPeriod && filterBld(rc.buildingId)
  );
  const periodUtilityBills = state.utilityBills.filter(
    (ub) => ub.billingPeriod === billingPeriod && filterBld(ub.buildingId)
  );

  const totalRentChargedPoisha = periodRentCharges.reduce(
    (s, c) => s + c.adjustedAmountPoisha,
    0
  );
  const totalUtilityChargedPoisha = periodUtilityBills.reduce(
    (s, b) => s + b.totalAmountPoisha,
    0
  );

  // Outstanding across ALL periods (or current period)
  const allRentCharges = state.rentCharges.filter((rc) =>
    filterBld(rc.buildingId)
  );
  const allUtilityBills = state.utilityBills.filter((ub) =>
    filterBld(ub.buildingId)
  );

  const outstandingRentPoisha = allRentCharges.reduce(
    (s, c) => s + Math.max(0, c.adjustedAmountPoisha - c.paidAmountPoisha),
    0
  );
  const outstandingUtilityPoisha = allUtilityBills.reduce(
    (s, b) => s + Math.max(0, b.totalAmountPoisha - b.paidAmountPoisha),
    0
  );

  // Cash collected in selected billingPeriod (excluding ADVANCE_APPLIED internal transfers & reversed payments)
  const periodPayments = state.payments.filter(
    (p) =>
      !p.isReversed &&
      p.method !== 'ADVANCE_APPLIED' &&
      p.paymentDate.startsWith(billingPeriod) &&
      filterBld(p.buildingId)
  );
  const totalCashCollectedPoisha = periodPayments.reduce(
    (s, p) => s + p.amountReceivedPoisha,
    0
  );

  // Expenses in selected billingPeriod
  const periodExpenses = state.expenses.filter(
    (e) => e.date.startsWith(billingPeriod) && filterBld(e.buildingId)
  );
  const totalExpensesPoisha = periodExpenses.reduce(
    (s, e) => s + e.amountPoisha,
    0
  );

  // Net Operating Cash Flow = Cash Collected - Recorded Operating Expenses (Security deposits never included)
  const netOperatingCashFlowPoisha =
    totalCashCollectedPoisha - totalExpensesPoisha;

  // Security Deposits Held across active/all tenants in filtered buildings
  const relevantTenants = state.tenants.filter((t) =>
    filterBld(t.currentBuildingId)
  );
  const securityDepositsHeldPoisha = relevantTenants.reduce((sum, t) => {
    const dep = calculateTenantDepositBalance(t.id, state.depositTransactions);
    return sum + dep.heldBalancePoisha;
  }, 0);

  // Unit occupancy metrics
  const relevantUnits = state.units.filter((u) => filterBld(u.buildingId));
  const vacantUnitsCount = relevantUnits.filter(
    (u) => u.status === 'VACANT'
  ).length;
  const occupiedUnitsCount = relevantUnits.filter(
    (u) => u.status === 'OCCUPIED'
  ).length;
  const maintenanceUnitsCount = relevantUnits.filter(
    (u) => u.status === 'MAINTENANCE' || u.status === 'UNAVAILABLE'
  ).length;
  const activeTenantsCount = relevantTenants.filter(
    (t) => t.status === 'ACTIVE'
  ).length;

  // Period collection rate %
  const totalPeriodCharged = totalRentChargedPoisha + totalUtilityChargedPoisha;
  const periodChargesPaid =
    periodRentCharges.reduce((s, c) => s + c.paidAmountPoisha, 0) +
    periodUtilityBills.reduce((s, b) => s + b.paidAmountPoisha, 0);

  const collectionRatePercent =
    totalPeriodCharged > 0
      ? Math.min(100, Math.round((periodChargesPaid * 100) / totalPeriodCharged))
      : 100;

  const buildingBreakdown = state.buildings
    .filter((b) => filterBld(b.id))
    .map((b) => {
      const bRent = allRentCharges.filter((rc) => rc.buildingId === b.id);
      const bUtil = allUtilityBills.filter((ub) => ub.buildingId === b.id);
      const bCharged =
        bRent
          .filter((rc) => rc.billingPeriod === billingPeriod)
          .reduce((s, c) => s + c.adjustedAmountPoisha, 0) +
        bUtil
          .filter((ub) => ub.billingPeriod === billingPeriod)
          .reduce((s, u) => s + u.totalAmountPoisha, 0);
      const bCollected = periodPayments
        .filter((p) => p.buildingId === b.id)
        .reduce((s, p) => s + p.amountReceivedPoisha, 0);
      const bOut =
        bRent.reduce(
          (s, c) => s + Math.max(0, c.adjustedAmountPoisha - c.paidAmountPoisha),
          0
        ) +
        bUtil.reduce(
          (s, u) => s + Math.max(0, u.totalAmountPoisha - u.paidAmountPoisha),
          0
        );
      const bExp = periodExpenses
        .filter((e) => e.buildingId === b.id)
        .reduce((s, e) => s + e.amountPoisha, 0);

      return {
        buildingId: b.id,
        buildingName: b.name,
        chargedPoisha: bCharged,
        collectedPoisha: bCollected,
        outstandingPoisha: bOut,
        expensesPoisha: bExp,
      };
    });

  return {
    billingPeriod,
    totalRentChargedPoisha,
    totalUtilityChargedPoisha,
    totalCashCollectedPoisha,
    outstandingRentPoisha,
    outstandingUtilityPoisha,
    totalOutstandingAllPeriodsPoisha:
      outstandingRentPoisha + outstandingUtilityPoisha,
    totalExpensesPoisha,
    netOperatingCashFlowPoisha,
    securityDepositsHeldPoisha,
    vacantUnitsCount,
    occupiedUnitsCount,
    maintenanceUnitsCount,
    activeTenantsCount,
    collectionRatePercent,
    buildingBreakdown,
  };
}

export interface OverdueReminderItem {
  eventKey: string;
  tenant: Tenant;
  building: Building;
  unit: RentalUnit;
  outstandingPoisha: number;
  overduePeriods: string[];
  alreadyNotifiedToday: boolean;
  messageEn: string;
  messageBn: string;
}

/**
 * Evaluates reminder eligibility against live outstanding balances.
 * Default schedule: 5th, 10th, and 15th of the month.
 */
export function evaluateOverdueReminders(
  state: DatabaseState,
  dhakaDateStr: string = getDhakaToday()
): {
  isScheduledReminderDay: boolean;
  dayOfMonth: number;
  overdueItems: OverdueReminderItem[];
} {
  const dayOfMonth = parseInt(dhakaDateStr.slice(8, 10), 10);
  const isScheduledReminderDay =
    state.reminderSettings.enabled &&
    state.reminderSettings.reminderDays.includes(dayOfMonth);

  const overdueItems: OverdueReminderItem[] = [];

  for (const tenant of state.tenants) {
    if (tenant.status !== 'ACTIVE') continue;
    const obligations = getTenantUnpaidObligations(
      tenant.id,
      state.rentCharges,
      state.utilityBills
    );
    const totalOut = obligations.reduce(
      (s, o) => s + o.outstandingPoisha,
      0
    );
    if (totalOut <= 0) continue;

    const building = state.buildings.find(
      (b) => b.id === tenant.currentBuildingId
    );
    const unit = state.units.find((u) => u.id === tenant.currentUnitId);
    if (!building || !unit) continue;

    const overduePeriods = Array.from(
      new Set(obligations.map((o) => o.billingPeriod))
    ).sort();
    const eventKey = `${dhakaDateStr}_${tenant.id}`;
    const alreadyNotifiedToday =
      state.reminderSettings.notifiedEventKeys.includes(eventKey);

    const amountEn = formatBDT(totalOut, 'en');
    const amountBn = formatBDT(totalOut, 'bn');
    const periodsStr = overduePeriods.join(', ');

    const messageEn = state.reminderSettings.templateEn
      .replace('{tenant}', tenant.fullName)
      .replace('{building}', building.name)
      .replace('{unit}', unit.unitNumber)
      .replace('{amount}', amountEn)
      .replace('{periods}', periodsStr);

    const messageBn = state.reminderSettings.templateBn
      .replace('{tenant}', tenant.fullName)
      .replace('{building}', building.name)
      .replace('{unit}', unit.unitNumber)
      .replace('{amount}', amountBn)
      .replace('{periods}', periodsStr);

    overdueItems.push({
      eventKey,
      tenant,
      building,
      unit,
      outstandingPoisha: totalOut,
      overduePeriods,
      alreadyNotifiedToday,
      messageEn,
      messageBn,
    });
  }

  return {
    isScheduledReminderDay,
    dayOfMonth,
    overdueItems,
  };
}
