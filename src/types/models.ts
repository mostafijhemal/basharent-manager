export type Language = 'bn' | 'en';

export type UserRole = 'OWNER' | 'MANAGER';

export interface UserPermission {
  viewBuildings: boolean;
  manageTenants: boolean;
  recordPayments: boolean;
  enterUtilities: boolean;
  recordExpenses: boolean;
  generateReceipts: boolean;
  viewReports: boolean;
  manageDocuments: boolean;
  editSettings: boolean;
  manageUsers: boolean;
}

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  phone: string;
  permissions: UserPermission;
  active: boolean;
}

export type BuildingStatus = 'ACTIVE' | 'INACTIVE';

export interface Building {
  id: string;
  name: string;
  address: string;
  notes: string;
  photoDataUrl?: string;
  status: BuildingStatus;
  defaultDueDay: number;
  createdAt: string;
}

export interface Floor {
  id: string;
  buildingId: string;
  nameOrNumber: string;
  floorOrder: number;
  notes: string;
}

export type UnitStatus = 'VACANT' | 'OCCUPIED' | 'MAINTENANCE' | 'UNAVAILABLE';

export interface RentalUnit {
  id: string;
  buildingId: string;
  floorId: string;
  unitNumber: string;
  unitType: string; // e.g. 'Family Flat', 'Bachelor / Studio', 'Commercial'
  bedrooms: number;
  defaultRentPoisha: number; // Integer minor units: 1 BDT = 100 Poisha
  serviceChargePoisha: number;
  status: UnitStatus;
  notes: string;
}

export type TenantStatus = 'ACTIVE' | 'ARCHIVED';

export interface Tenant {
  id: string;
  fullName: string;
  photoDataUrl?: string;
  primaryPhone: string;
  altPhone: string;
  nidNumber: string;
  nidPhotoDataUrl?: string;
  presentAddress: string;
  permanentAddress: string;
  occupation: string;
  emergencyContact: string;
  familyMembersInfo: string;
  moveInDate: string; // YYYY-MM-DD
  moveOutDate?: string; // YYYY-MM-DD
  leaseStartDate: string;
  leaseEndDate: string;
  monthlyRentPoisha: number;
  dueDay: number;
  securityDepositPoisha: number; // Initial agreed deposit
  advanceRentCreditPoisha: number; // Current unallocated advance/overpayment balance in Poisha
  status: TenantStatus;
  agreementDocDataUrl?: string;
  agreementDocName?: string;
  notes: string;
  currentBuildingId: string;
  currentUnitId: string;
  createdAt: string;
}

export interface Occupancy {
  id: string;
  tenantId: string;
  buildingId: string;
  unitId: string;
  startDate: string;
  endDate?: string;
  agreedRentPoisha: number;
  isActive: boolean;
}

export interface LeaseAgreement {
  id: string;
  tenantId: string;
  unitId: string;
  startDate: string;
  endDate: string;
  monthlyRentPoisha: number;
  securityDepositPoisha: number;
  documentName?: string;
  createdAt: string;
}

export type ChargeCategory = 'RENT' | 'SERVICE_CHARGE';

export interface RentCharge {
  id: string;
  buildingId: string;
  unitId: string;
  tenantId: string;
  billingPeriod: string; // YYYY-MM
  category: ChargeCategory;
  originalAmountPoisha: number;
  adjustedAmountPoisha: number; // Effective charge amount
  paidAmountPoisha: number;
  dueDate: string; // YYYY-MM-DD
  isProrated: boolean;
  notes: string;
  createdAt: string;
}

export type UtilityType = 'ELECTRICITY' | 'WATER' | 'GAS' | 'SERVICE' | 'SHARED';
export type UtilityBillingMode = 'MANUAL' | 'METER' | 'SHARED_ALLOCATION';

export interface MeterReading {
  id: string;
  unitId: string;
  utilityType: 'ELECTRICITY' | 'WATER';
  billingPeriod: string;
  prevReading: number;
  currReading: number;
  consumptionUnits: number;
  ratePerUnitPoisha: number;
  fixedChargePoisha: number;
  rolloverAuthorized: boolean;
  readingDate: string;
  notes: string;
}

export interface UtilityBill {
  id: string;
  buildingId: string;
  unitId: string;
  tenantId: string;
  billingPeriod: string; // YYYY-MM
  utilityType: UtilityType;
  billingMode: UtilityBillingMode;
  prevReading?: number;
  currReading?: number;
  consumptionUnits?: number;
  ratePerUnitPoisha?: number;
  fixedChargePoisha?: number;
  meterRolloverAuthorized?: boolean;
  totalAmountPoisha: number;
  paidAmountPoisha: number;
  readingDate: string;
  notes: string;
  sharedChargeId?: string;
  isAdditionalCharge?: boolean;
  createdAt: string;
}

export interface SharedChargeAllocationItem {
  unitId: string;
  tenantId: string;
  amountPoisha: number;
}

export interface SharedCharge {
  id: string;
  buildingId: string;
  billingPeriod: string; // YYYY-MM
  title: string;
  totalAmountPoisha: number;
  allocations: SharedChargeAllocationItem[];
  posted: boolean;
  notes: string;
  createdAt: string;
}

export type PaymentMethod =
  | 'CASH'
  | 'BKASH'
  | 'NAGAD'
  | 'ROCKET'
  | 'BANK'
  | 'ADVANCE_APPLIED'
  | 'OTHER';

export interface PaymentAllocation {
  id: string;
  paymentId: string;
  targetType: 'RENT_CHARGE' | 'UTILITY_BILL' | 'ADVANCE_CREDIT';
  targetId: string;
  billingPeriod: string;
  label: string;
  amountPoisha: number;
}

export interface Payment {
  id: string;
  receiptNumber: string;
  timestamp: string; // ISO
  paymentDate: string; // YYYY-MM-DD in Asia/Dhaka
  buildingId: string;
  unitId: string;
  tenantId: string;
  method: PaymentMethod;
  methodDetail?: string;
  amountReceivedPoisha: number;
  unallocatedCreditPoisha: number;
  transactionRef: string;
  notes: string;
  recordedByUserId: string;
  recordedByName: string;
  allocations: PaymentAllocation[];
  previousBalancePoisha: number;
  remainingBalancePoisha: number;
  isReversed?: boolean;
  reversalReason?: string;
}

export type DepositTxType =
  | 'DEPOSIT_COLLECTED'
  | 'DEPOSIT_DEDUCTION'
  | 'DEPOSIT_REFUND'
  | 'ADVANCE_COLLECTED'
  | 'ADVANCE_APPLIED';

export interface SecurityDepositTransaction {
  id: string;
  tenantId: string;
  buildingId: string;
  unitId: string;
  type: DepositTxType;
  amountPoisha: number;
  date: string;
  method: PaymentMethod;
  reason: string;
  recordedByName: string;
  createdAt: string;
}

export type ExpenseCategory =
  | 'REPAIRS'
  | 'PAINTING'
  | 'CLEANING'
  | 'SECURITY_CARETAKER'
  | 'LIFT'
  | 'COMMON_UTILITY'
  | 'PLUMBING'
  | 'TAX_FEES'
  | 'OTHER';

export interface Expense {
  id: string;
  buildingId: string;
  unitId?: string;
  category: ExpenseCategory;
  amountPoisha: number;
  date: string; // YYYY-MM-DD
  description: string;
  method: PaymentMethod;
  vendor: string;
  attachmentDataUrl?: string;
  recordedByName: string;
  isCorrection?: boolean;
  parentExpenseId?: string;
  createdAt: string;
}

export interface ReminderSettings {
  enabled: boolean;
  reminderDays: number[]; // Default [5, 10, 15]
  templateEn: string;
  templateBn: string;
  notifiedEventKeys: string[]; // e.g. '2026-10-15_tenantId'
}

export type AuditEventType =
  | 'RENT_GENERATED'
  | 'RENT_ADJUSTED'
  | 'PAYMENT_RECORDED'
  | 'PAYMENT_REVERSED'
  | 'BILL_POSTED'
  | 'SHARED_CHARGE_POSTED'
  | 'EXPENSE_RECORDED'
  | 'EXPENSE_CORRECTED'
  | 'DEPOSIT_TX'
  | 'TENANT_ARCHIVED'
  | 'TENANT_RESTORED'
  | 'TENANT_DELETED'
  | 'SETTINGS_CHANGED'
  | 'USER_PERMISSION_CHANGED'
  | 'BACKUP_EXPORTED'
  | 'BACKUP_RESTORED'
  | 'SYNC_EVENT';

export interface AuditLog {
  id: string;
  timestamp: string;
  eventType: AuditEventType;
  entityId: string;
  buildingId?: string;
  userId: string;
  userName: string;
  summaryEn: string;
  summaryBn: string;
}

export interface SyncMetadata {
  deviceId: string;
  syncEnabled: boolean;
  provider: 'NONE' | 'SUPABASE_REST' | 'CUSTOM_HTTPS';
  endpointUrl: string;
  accountWorkspaceId: string;
  lastSyncedAt?: string;
  pendingOutboxCount: number;
  conflictCount: number;
  lastError?: string;
}

export type ProrationPolicy = 'FULL_MONTH' | 'DAILY_30' | 'ACTUAL_DAYS';

export interface AppSettings {
  appName: string;
  ownerName: string;
  ownerPhone: string;
  ownerSignature: string;
  language: Language;
  pinEnabled: boolean;
  pinCodeHash: string; // SHA-256 hex or salted digest
  pinLength: 4 | 6;
  biometricEnabled: boolean;
  prorationPolicy: ProrationPolicy;
  isDemoData: boolean;
}

export interface DatabaseState {
  schemaVersion: number;
  settings: AppSettings;
  users: UserProfile[];
  activeUserId: string;
  buildings: Building[];
  floors: Floor[];
  units: RentalUnit[];
  tenants: Tenant[];
  occupancies: Occupancy[];
  leases: LeaseAgreement[];
  rentCharges: RentCharge[];
  utilityBills: UtilityBill[];
  meterReadings: MeterReading[];
  sharedCharges: SharedCharge[];
  payments: Payment[];
  depositTransactions: SecurityDepositTransaction[];
  expenses: Expense[];
  reminderSettings: ReminderSettings;
  auditLogs: AuditLog[];
  syncMetadata: SyncMetadata;
}
