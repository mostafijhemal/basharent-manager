import { DatabaseState } from '../types/models';

export interface SyncMergeResult {
  mergedState: DatabaseState;
  addedPaymentsCount: number;
  addedChargesCount: number;
  conflictsDetected: string[];
}

/**
 * Idempotently merges a remote state snapshot with local state.
 * - Financial transactions (payments, rentCharges, utilityBills, expenses, depositTransactions, auditLogs)
 *   are treated as immutable events and deduplicated by primary ID and unique receiptNumber.
 * - Paid amounts on charges/bills are recalculated from authoritative payment allocations so no payment
 *   is ever lost or double-counted across devices.
 */
export function mergeStatesIdempotently(
  local: DatabaseState,
  remote: DatabaseState
): SyncMergeResult {
  const conflictsDetected: string[] = [];
  const merged: DatabaseState = JSON.parse(JSON.stringify(local));

  // Merge buildings, floors, units, tenants by ID
  const mergeById = <T extends { id: string }>(
    localArr: T[],
    remoteArr: T[],
    entityLabel: string
  ): T[] => {
    const map = new Map<string, T>();
    for (const item of localArr) map.set(item.id, item);
    for (const rItem of remoteArr) {
      const existing = map.get(rItem.id);
      if (!existing) {
        map.set(rItem.id, rItem);
      } else if (JSON.stringify(existing) !== JSON.stringify(rItem)) {
        conflictsDetected.push(`${entityLabel}:${rItem.id}`);
        // Preserve local modifications while logging conflict for review
      }
    }
    return Array.from(map.values());
  };

  merged.buildings = mergeById(local.buildings, remote.buildings, 'Building');
  merged.floors = mergeById(local.floors, remote.floors, 'Floor');
  merged.units = mergeById(local.units, remote.units, 'RentalUnit');
  merged.tenants = mergeById(local.tenants, remote.tenants, 'Tenant');

  // Deduplicate rentCharges by (unitId, tenantId, billingPeriod, category) or id
  const chargeKeys = new Set(
    merged.rentCharges.map(
      (c) => `${c.unitId}_${c.tenantId}_${c.billingPeriod}_${c.category}`
    )
  );
  let addedChargesCount = 0;
  for (const rc of remote.rentCharges) {
    const key = `${rc.unitId}_${rc.tenantId}_${rc.billingPeriod}_${rc.category}`;
    if (!chargeKeys.has(key) && !merged.rentCharges.some((x) => x.id === rc.id)) {
      merged.rentCharges.push(rc);
      chargeKeys.add(key);
      addedChargesCount++;
    }
  }

  // Deduplicate utilityBills by id
  for (const ub of remote.utilityBills) {
    if (!merged.utilityBills.some((x) => x.id === ub.id)) {
      merged.utilityBills.push(ub);
    }
  }

  // Deduplicate payments by id AND receiptNumber (preventing duplicate payments)
  const paymentIds = new Set(merged.payments.map((p) => p.id));
  const receiptNums = new Set(merged.payments.map((p) => p.receiptNumber));
  let addedPaymentsCount = 0;

  for (const rp of remote.payments) {
    if (!paymentIds.has(rp.id) && !receiptNums.has(rp.receiptNumber)) {
      merged.payments.push(rp);
      paymentIds.add(rp.id);
      receiptNums.add(rp.receiptNumber);
      addedPaymentsCount++;
    } else if (paymentIds.has(rp.id)) {
      const lp = merged.payments.find((p) => p.id === rp.id);
      if (lp && lp.isReversed !== rp.isReversed && rp.isReversed) {
        lp.isReversed = true;
        lp.reversalReason = rp.reversalReason;
      }
    }
  }

  // Reconcile paidAmountPoisha on all rentCharges & utilityBills from active payments
  const paidPerTarget = new Map<string, number>();
  for (const p of merged.payments) {
    if (p.isReversed) continue;
    for (const alloc of p.allocations) {
      if (
        alloc.targetType === 'RENT_CHARGE' ||
        alloc.targetType === 'UTILITY_BILL'
      ) {
        paidPerTarget.set(
          alloc.targetId,
          (paidPerTarget.get(alloc.targetId) || 0) + alloc.amountPoisha
        );
      }
    }
  }

  merged.rentCharges = merged.rentCharges.map((rc) => ({
    ...rc,
    paidAmountPoisha: Math.min(
      rc.adjustedAmountPoisha,
      paidPerTarget.get(rc.id) ?? rc.paidAmountPoisha
    ),
  }));

  merged.utilityBills = merged.utilityBills.map((ub) => ({
    ...ub,
    paidAmountPoisha: Math.min(
      ub.totalAmountPoisha,
      paidPerTarget.get(ub.id) ?? ub.paidAmountPoisha
    ),
  }));

  // Merge immutable expenses, depositTransactions, auditLogs
  for (const exp of remote.expenses) {
    if (!merged.expenses.some((x) => x.id === exp.id)) {
      merged.expenses.push(exp);
    }
  }
  for (const dtx of remote.depositTransactions) {
    if (!merged.depositTransactions.some((x) => x.id === dtx.id)) {
      merged.depositTransactions.push(dtx);
    }
  }
  for (const log of remote.auditLogs) {
    if (!merged.auditLogs.some((x) => x.id === log.id)) {
      merged.auditLogs.push(log);
    }
  }

  return {
    mergedState: merged,
    addedPaymentsCount,
    addedChargesCount,
    conflictsDetected,
  };
}
