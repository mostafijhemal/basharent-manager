import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Building2,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Home,
  KeyRound,
  Lock,
  Menu,
  Phone,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  Smartphone,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { AndroidDeliveryView } from './components/AndroidDeliveryView';
import { PinLockOverlay } from './components/PinLockOverlay';
import { ReceiptModal } from './components/ReceiptModal';
import {
  createEncryptedBackup,
  decryptAndVerifyBackup,
  hashPinCode,
  inspectBackupEnvelope,
} from './services/cryptoBackupService';
import {
  createCleanDatabaseState,
  createDemoDatabaseState,
} from './services/defaultSeedData';
import {
  allocatePaymentCustom,
  allocatePaymentOldestFirst,
  calculateFinancialSummary,
  calculateMeterUtilityBill,
  calculateTenantDepositBalance,
  evaluateOverdueReminders,
  formatBDT,
  formatBillingPeriod,
  generateMonthlyChargesForPeriod,
  getDhakaBillingPeriod,
  getDhakaToday,
  getTenantUnpaidObligations,
  takaToPoisha,
  toBengaliDigits,
  validateSharedChargeAllocations,
} from './services/financialEngine';
import { ReceiptRenderContext } from './services/receiptGenerator';
import { loadDatabaseState, saveDatabaseState } from './services/storageEngine';
import { mergeStatesIdempotently } from './services/syncEngine';
import {
  AuditEventType,
  DatabaseState,
  DepositTxType,
  ExpenseCategory,
  Payment,
  PaymentMethod,
  ProrationPolicy,
  SharedChargeAllocationItem,
  UnitStatus,
  UserPermission,
  UtilityType,
} from './types/models';

type NavTab =
  | 'DASHBOARD'
  | 'BUILDINGS'
  | 'TENANTS'
  | 'COLLECTION'
  | 'BILLS'
  | 'EXPENSES'
  | 'REPORTS'
  | 'SETTINGS'
  | 'ANDROID_APK';

type ReportType =
  | 'MONTHLY'
  | 'YEARLY'
  | 'TENANT_LEDGER'
  | 'OUTSTANDING_DUES'
  | 'BUILDING_FINANCE'
  | 'RENT_COLLECTION'
  | 'UTILITY_BILLING'
  | 'EXPENSE_REPORT'
  | 'SECURITY_DEPOSIT'
  | 'OCCUPANCY'
  | 'AUDIT_HISTORY';

export function App() {
  const [db, setDb] = useState<DatabaseState | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('DASHBOARD');
  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    getDhakaBillingPeriod()
  );
  const [buildingFilter, setBuildingFilter] = useState<string>('ALL');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'info';
    text: string;
  } | null>(null);
  const [receiptModalCtx, setReceiptModalCtx] =
    useState<ReceiptRenderContext | null>(null);

  // User-friendly modal & drawer toggles (progressive disclosure instead of cluttered forms)
  const [activeBldModal, setActiveBldModal] = useState<
    'NONE' | 'BUILDING' | 'FLOOR' | 'UNIT'
  >('NONE');
  const [showDepositModal, setShowDepositModal] = useState<boolean>(false);
  const [billTabMode, setBillTabMode] = useState<'UTILITY' | 'SHARED'>(
    'UTILITY'
  );
  const [showExpenseModal, setShowExpenseModal] = useState<boolean>(false);
  const [showMobileMenu, setShowMobileMenu] = useState<boolean>(false);

  // Detect if running inside the installed Android APK or standalone app vs Web browser
  const isApkVersion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const isFileProtocol = window.location.protocol === 'file:';
    const hasApkQuery = window.location.search.includes('mode=apk');
    const hasApkUserAgent =
      typeof navigator !== 'undefined' &&
      navigator.userAgent.includes('BashaRentNativeAPK');
    const isStandalone =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches;
    return isFileProtocol || hasApkQuery || hasApkUserAgent || isStandalone;
  }, []);

  // Sub-state for Buildings tab
  const [newBldName, setNewBldName] = useState('');
  const [newBldAddress, setNewBldAddress] = useState('');
  const [newBldDueDay, setNewBldDueDay] = useState('5');
  const [newBldNotes, setNewBldNotes] = useState('');

  const [newFloorBldId, setNewFloorBldId] = useState('');
  const [newFloorName, setNewFloorName] = useState('');

  const [newUnitBldId, setNewUnitBldId] = useState('');
  const [newUnitFloorId, setNewUnitFloorId] = useState('');
  const [newUnitNum, setNewUnitNum] = useState('');
  const [newUnitType, setNewUnitType] = useState('Family Flat (3 Bed)');
  const [newUnitBeds, setNewUnitBeds] = useState('3');
  const [newUnitRentTaka, setNewUnitRentTaka] = useState('20000');
  const [newUnitScTaka, setNewUnitScTaka] = useState('2000');

  // Sub-state for Tenants tab
  const [tenantSearch, setTenantSearch] = useState('');
  const [tenantStatusFilter, setTenantStatusFilter] = useState<
    'ACTIVE' | 'ARCHIVED' | 'ALL'
  >('ACTIVE');
  const [showAddTenantForm, setShowAddTenantForm] = useState(false);
  const [tFullName, setTFullName] = useState('');
  const [tPhone, setTPhone] = useState('');
  const [tAltPhone, setTAltPhone] = useState('');
  const [tNid, setTNid] = useState('');
  const [tOccupation, setTOccupation] = useState('');
  const [tPermAddress, setTPermAddress] = useState('');
  const [tEmergency, setTEmergency] = useState('');
  const [tFamilyInfo, setTFamilyInfo] = useState('');
  const [tBuildingId, setTBuildingId] = useState('');
  const [tUnitId, setTUnitId] = useState('');
  const [tMoveInDate, setTMoveInDate] = useState(getDhakaToday());
  const [tLeaseEnd, setTLeaseEnd] = useState('2027-12-31');
  const [tRentTaka, setTRentTaka] = useState('22000');
  const [tDepositTaka, setTDepositTaka] = useState('44000');
  const [tDueDay, setTDueDay] = useState('5');
  const [tPhotoDataUrl, setTPhotoDataUrl] = useState<string | undefined>();
  const [tNidDocDataUrl, setTNidDocDataUrl] = useState<string | undefined>();
  const [tAgreementName, setTAgreementName] = useState('');

  // Deposit / Rent Adjustment modal state
  const [selectedTenantForDeposit, setSelectedTenantForDeposit] =
    useState<string>('');
  const [depTxType, setDepTxType] =
    useState<DepositTxType>('DEPOSIT_COLLECTED');
  const [depTxAmountTaka, setDepTxAmountTaka] = useState('');
  const [depTxReason, setDepTxReason] = useState('');
  const [newMonthlyRentTaka, setNewMonthlyRentTaka] = useState('');

  // Sub-state for Rent Collection tab
  const [colTenantId, setColTenantId] = useState<string>('');
  const [colAmountTaka, setColAmountTaka] = useState<string>('');
  const [colMethod, setColMethod] = useState<PaymentMethod>('BKASH');
  const [colRef, setColRef] = useState<string>('');
  const [colNotes, setColNotes] = useState<string>('');
  const [colMode, setColMode] = useState<'FIFO' | 'CUSTOM'>('FIFO');
  const [colCustomMapTaka, setColCustomMapTaka] = useState<
    Record<string, string>
  >({});

  // Sub-state for Utility Bills & Shared Charges tab
  const [billUnitId, setBillUnitId] = useState<string>('');
  const [billType, setBillType] = useState<UtilityType>('ELECTRICITY');
  const [billMode, setBillMode] = useState<'METER' | 'MANUAL'>('METER');
  const [billPeriod, setBillPeriod] = useState<string>(getDhakaBillingPeriod());
  const [billPrevReading, setBillPrevReading] = useState<string>('1000');
  const [billCurrReading, setBillCurrReading] = useState<string>('1180');
  const [billRateTaka, setBillRateTaka] = useState<string>('8.95');
  const [billFixedTaka, setBillFixedTaka] = useState<string>('150');
  const [billManualTaka, setBillManualTaka] = useState<string>('1080');
  const [billRollover, setBillRollover] = useState<boolean>(false);
  const [billAllowDuplicate, setBillAllowDuplicate] = useState<boolean>(false);
  const [billNotes, setBillNotes] = useState<string>('');

  // Shared Charge state
  const [scBuildingId, setScBuildingId] = useState<string>('');
  const [scTitle, setScTitle] = useState<string>(
    'Generator Diesel & Common Pump Maintenance'
  );
  const [scTotalTaka, setScTotalTaka] = useState<string>('4500');
  const [scCustomUnitTaka, setScCustomUnitTaka] = useState<
    Record<string, string>
  >({});

  // Sub-state for Expenses tab
  const [expBuildingId, setExpBuildingId] = useState<string>('');
  const [expUnitId, setExpUnitId] = useState<string>('');
  const [expCategory, setExpCategory] = useState<ExpenseCategory>('REPAIRS');
  const [expAmountTaka, setExpAmountTaka] = useState<string>('');
  const [expDate, setExpDate] = useState<string>(getDhakaToday());
  const [expVendor, setExpVendor] = useState<string>('');
  const [expMethod, setExpMethod] = useState<PaymentMethod>('CASH');
  const [expDesc, setExpDesc] = useState<string>('');

  // Sub-state for Reports tab
  const [reportType, setReportType] = useState<ReportType>('MONTHLY');
  const [reportTenantId, setReportTenantId] = useState<string>('ALL');
  const [auditTypeFilter, setAuditTypeFilter] = useState<string>('ALL');

  // Sub-state for Settings & Backup tab
  const [backupPassword, setBackupPassword] = useState<string>('');
  const [includeBackupDocs, setIncludeBackupDocs] = useState<boolean>(true);
  const [restorePassword, setRestorePassword] = useState<string>('');
  const [restoreFileContent, setRestoreFileContent] = useState<string>('');
  const [restorePreviewSummary, setRestorePreviewSummary] = useState<
    string | null
  >(null);
  const [newPinInput, setNewPinInput] = useState<string>('');
  const [newPinLen, setNewPinLen] = useState<4 | 6>(4);

  useEffect(() => {
    loadDatabaseState().then((loaded) => {
      // Automatically ensure current period charges exist on launch (idempotent)
      const currentPeriod = getDhakaBillingPeriod();
      const { newCharges } = generateMonthlyChargesForPeriod(
        loaded,
        currentPeriod
      );
      if (newCharges.length > 0) {
        loaded.rentCharges = [...loaded.rentCharges, ...newCharges];
        saveDatabaseState(loaded);
      }
      setDb(loaded);
      if (loaded.settings.pinEnabled && loaded.settings.pinCodeHash) {
        setIsLocked(true);
      }
      if (loaded.buildings.length > 0) {
        const b0 = loaded.buildings[0].id;
        setNewFloorBldId(b0);
        setNewUnitBldId(b0);
        setTBuildingId(b0);
        setScBuildingId(b0);
        setExpBuildingId(b0);
      }
      if (loaded.tenants.length > 0) {
        const activeT = loaded.tenants.find((t) => t.status === 'ACTIVE');
        if (activeT) {
          setColTenantId(activeT.id);
          setSelectedTenantForDeposit(activeT.id);
        }
      }
      if (loaded.units.length > 0) {
        const occU = loaded.units.find((u) => u.status === 'OCCUPIED');
        if (occU) setBillUnitId(occU.id);
      }
    });
  }, []);

  const notify = (
    text: string,
    type: 'success' | 'error' | 'info' = 'success'
  ) => {
    setToast({ text, type });
    setTimeout(() => {
      setToast((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const commitDb = async (
    updater: (draft: DatabaseState) => DatabaseState,
    auditEntry?: {
      eventType: AuditEventType;
      entityId: string;
      buildingId?: string;
      summaryEn: string;
      summaryBn: string;
    }
  ) => {
    if (!db) return;
    const clone: DatabaseState = JSON.parse(JSON.stringify(db));
    const updated = updater(clone);
    if (auditEntry) {
      const activeUser =
        updated.users.find((u) => u.id === updated.activeUserId) ||
        updated.users[0];
      updated.auditLogs = [
        {
          id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          eventType: auditEntry.eventType,
          entityId: auditEntry.entityId,
          buildingId: auditEntry.buildingId,
          userId: activeUser.id,
          userName: activeUser.name,
          summaryEn: auditEntry.summaryEn,
          summaryBn: auditEntry.summaryBn,
        },
        ...updated.auditLogs,
      ];
    }
    setDb(updated);
    await saveDatabaseState(updated);
  };

  const activeUser = useMemo(() => {
    if (!db) return null;
    return (
      db.users.find((u) => u.id === db.activeUserId) || db.users[0] || null
    );
  }, [db]);

  const hasPerm = (permKey: keyof UserPermission): boolean => {
    if (!activeUser) return false;
    if (activeUser.role === 'OWNER') return true;
    return !!activeUser.permissions[permKey];
  };

  const summary = useMemo(() => {
    if (!db) return null;
    return calculateFinancialSummary(db, selectedPeriod, buildingFilter);
  }, [db, selectedPeriod, buildingFilter]);

  const reminderEval = useMemo(() => {
    if (!db) return null;
    return evaluateOverdueReminders(db, getDhakaToday());
  }, [db]);

  const unpaidObligations = useMemo(() => {
    if (!db || !colTenantId) return [];
    return getTenantUnpaidObligations(
      colTenantId,
      db.rentCharges,
      db.utilityBills
    );
  }, [db, colTenantId]);

  const scBuildingUnits = useMemo(() => {
    if (!db) return [];
    return db.units
      .filter((u) => u.buildingId === scBuildingId && u.status === 'OCCUPIED')
      .map((u) => ({
        unit: u,
        tenant: db.tenants.find(
          (t) => t.currentUnitId === u.id && t.status === 'ACTIVE'
        ),
      }))
      .filter((x) => !!x.tenant);
  }, [db, scBuildingId]);

  const scValidation = useMemo(() => {
    let totalPoisha = 0;
    try {
      totalPoisha = takaToPoisha(scTotalTaka);
    } catch {
      totalPoisha = 0;
    }
    const items: SharedChargeAllocationItem[] = scBuildingUnits.map(
      ({ unit, tenant }) => {
        let amt = 0;
        try {
          amt = takaToPoisha(scCustomUnitTaka[unit.id] || '0');
        } catch {
          amt = 0;
        }
        return {
          unitId: unit.id,
          tenantId: tenant!.id,
          amountPoisha: amt,
        };
      }
    );
    return {
      totalPoisha,
      items,
      ...validateSharedChargeAllocations(totalPoisha, items),
    };
  }, [scTotalTaka, scBuildingUnits, scCustomUnitTaka]);

  if (!db || !activeUser || !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-600 text-sm">
        Loading BashaRent Manager Offline Database...
      </div>
    );
  }

  const lang = db.settings.language;
  const isBn = lang === 'bn';

  if (isLocked && db.settings.pinEnabled && db.settings.pinCodeHash) {
    return (
      <PinLockOverlay
        expectedPinHash={db.settings.pinCodeHash}
        pinLength={db.settings.pinLength}
        biometricEnabled={db.settings.biometricEnabled}
        lang={lang}
        appName={db.settings.appName}
        onUnlocked={() => setIsLocked(false)}
      />
    );
  }

  // Handlers
  const handleGenerateMonthlyRent = async () => {
    const { newCharges, skippedCount } = generateMonthlyChargesForPeriod(
      db,
      selectedPeriod
    );
    if (newCharges.length === 0) {
      notify(
        isBn
          ? `${selectedPeriod} মাসের সকল ভাড়া ইতিমধ্যে তৈরি করা হয়েছে (${skippedCount}টি ডুপ্লিকেট প্রতিরোধ করা হয়েছে)।`
          : `All monthly charges for ${selectedPeriod} already exist (${skippedCount} duplicates prevented).`,
        'info'
      );
      return;
    }
    await commitDb(
      (draft) => {
        draft.rentCharges.push(...newCharges);
        return draft;
      },
      {
        eventType: 'RENT_GENERATED',
        entityId: selectedPeriod,
        summaryEn: `Generated ${newCharges.length} monthly rent/service charge(s) for ${selectedPeriod}.`,
        summaryBn: `${selectedPeriod} মাসের জন্য ${newCharges.length}টি নতুন ভাড়া/সার্ভিস চার্জ তৈরি করা হয়েছে।`,
      }
    );
    notify(
      isBn
        ? `${newCharges.length}টি নতুন মাসিক চার্জ তৈরি হয়েছে।`
        : `Generated ${newCharges.length} monthly rent/service charges for ${selectedPeriod}.`
    );
  };

  const handleAddBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPerm('editSettings') && activeUser.role !== 'OWNER') {
      notify(
        isBn ? 'ভবন যোগ করার অনুমতি কেবল মালিকের।' : 'Only Owner can create buildings.',
        'error'
      );
      return;
    }
    if (!newBldName.trim() || !newBldAddress.trim()) {
      notify(
        isBn
          ? 'ভবনের নাম এবং ঠিকানা আবশ্যক।'
          : 'Building name and address are required.',
        'error'
      );
      return;
    }
    const id = `bld_${Date.now()}`;
    const dueDay = Math.max(1, Math.min(28, parseInt(newBldDueDay || '5', 10)));
    await commitDb(
      (draft) => {
        draft.buildings.push({
          id,
          name: newBldName.trim(),
          address: newBldAddress.trim(),
          defaultDueDay: dueDay,
          notes: newBldNotes.trim(),
          status: 'ACTIVE',
          createdAt: new Date().toISOString(),
        });
        draft.floors.push({
          id: `fl_${Date.now()}`,
          buildingId: id,
          nameOrNumber: '1st Floor (২য় তলা)',
          floorOrder: 1,
          notes: 'Default floor',
        });
        return draft;
      },
      {
        eventType: 'SETTINGS_CHANGED',
        entityId: id,
        buildingId: id,
        summaryEn: `Created building "${newBldName.trim()}" (${newBldAddress.trim()}).`,
        summaryBn: `নতুন ভবন "${newBldName.trim()}" যুক্ত করা হয়েছে।`,
      }
    );
    setNewBldName('');
    setNewBldAddress('');
    setNewBldNotes('');
    setActiveBldModal('NONE');
    notify(isBn ? 'নতুন ভবন সংরক্ষিত হয়েছে।' : 'Building added successfully.');
  };

  const handleAddFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFloorBldId || !newFloorName.trim()) {
      notify(
        isBn ? 'ভবন এবং তলার নাম নির্বাচন করুন।' : 'Select building and floor name.',
        'error'
      );
      return;
    }
    const id = `fl_${Date.now()}`;
    await commitDb((draft) => {
      const count = draft.floors.filter(
        (f) => f.buildingId === newFloorBldId
      ).length;
      draft.floors.push({
        id,
        buildingId: newFloorBldId,
        nameOrNumber: newFloorName.trim(),
        floorOrder: count + 1,
        notes: '',
      });
      return draft;
    });
    setNewFloorName('');
    setActiveBldModal('NONE');
    notify(isBn ? 'নতুন তলা যুক্ত হয়েছে।' : 'Floor added to building.');
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitBldId || !newUnitNum.trim()) {
      notify(
        isBn
          ? 'ভবন এবং ফ্ল্যাট নম্বর আবশ্যক।'
          : 'Building and Unit/Flat number are required.',
        'error'
      );
      return;
    }
    let rentPoisha = 0;
    let scPoisha = 0;
    try {
      rentPoisha = takaToPoisha(newUnitRentTaka);
      scPoisha = takaToPoisha(newUnitScTaka);
    } catch {
      notify(isBn ? 'ভাড়ার পরিমাণ সঠিক নয়।' : 'Invalid rent amount.', 'error');
      return;
    }
    if (rentPoisha <= 0) {
      notify(
        isBn ? 'মাসিক ভাড়া ০ এর বেশি হতে হবে।' : 'Default monthly rent must be positive.',
        'error'
      );
      return;
    }

    const floorId =
      newUnitFloorId ||
      db.floors.find((f) => f.buildingId === newUnitBldId)?.id ||
      '';
    const id = `unt_${Date.now()}`;
    await commitDb(
      (draft) => {
        draft.units.push({
          id,
          buildingId: newUnitBldId,
          floorId,
          unitNumber: newUnitNum.trim(),
          unitType: newUnitType.trim(),
          bedrooms: parseInt(newUnitBeds || '2', 10),
          defaultRentPoisha: rentPoisha,
          serviceChargePoisha: scPoisha,
          status: 'VACANT',
          notes: '',
        });
        return draft;
      },
      {
        eventType: 'SETTINGS_CHANGED',
        entityId: id,
        buildingId: newUnitBldId,
        summaryEn: `Added rental unit ${newUnitNum.trim()} with default rent ${formatBDT(rentPoisha, 'en')}.`,
        summaryBn: `ফ্ল্যাট ${newUnitNum.trim()} যুক্ত করা হয়েছে (নির্ধারিত ভাড়া ${formatBDT(rentPoisha, 'bn')})।`,
      }
    );
    setNewUnitNum('');
    setActiveBldModal('NONE');
    notify(isBn ? 'নতুন ফ্ল্যাট সংরক্ষিত হয়েছে।' : 'Rental unit created.');
  };

  const handleRegisterTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPerm('manageTenants')) {
      notify(
        isBn
          ? 'ভাড়াটিয়া নিবন্ধনের অনুমতি নেই।'
          : 'Permission denied: cannot register tenants.',
        'error'
      );
      return;
    }
    if (
      !tFullName.trim() ||
      !tPhone.trim() ||
      !tNid.trim() ||
      !tBuildingId ||
      !tUnitId
    ) {
      notify(
        isBn
          ? 'নাম, মোবাইল নম্বর, এনআইডি এবং ফ্ল্যাট নির্বাচন আবশ্যক।'
          : 'Full name, primary phone, NID number, and unit are required.',
        'error'
      );
      return;
    }
    const rentPoisha = takaToPoisha(tRentTaka);
    const depositPoisha = takaToPoisha(tDepositTaka);
    if (rentPoisha <= 0 || depositPoisha < 0) {
      notify(
        isBn
          ? 'ভাড়া এবং জামানতের পরিমাণ সঠিক হতে হবে।'
          : 'Monthly rent must be positive and deposit cannot be negative.',
        'error'
      );
      return;
    }

    const tenantId = `tnt_${Date.now()}`;
    await commitDb(
      (draft) => {
        draft.tenants.push({
          id: tenantId,
          fullName: tFullName.trim(),
          photoDataUrl: tPhotoDataUrl,
          primaryPhone: tPhone.trim(),
          altPhone: tAltPhone.trim(),
          nidNumber: tNid.trim(),
          nidPhotoDataUrl: tNidDocDataUrl,
          presentAddress: `Unit in ${draft.buildings.find((b) => b.id === tBuildingId)?.name || ''}`,
          permanentAddress: tPermAddress.trim(),
          occupation: tOccupation.trim(),
          emergencyContact: tEmergency.trim(),
          familyMembersInfo: tFamilyInfo.trim(),
          moveInDate: tMoveInDate,
          leaseStartDate: tMoveInDate,
          leaseEndDate: tLeaseEnd,
          monthlyRentPoisha: rentPoisha,
          dueDay: Math.max(1, Math.min(28, parseInt(tDueDay || '5', 10))),
          securityDepositPoisha: depositPoisha,
          advanceRentCreditPoisha: 0,
          status: 'ACTIVE',
          agreementDocName: tAgreementName || undefined,
          notes: '',
          currentBuildingId: tBuildingId,
          currentUnitId: tUnitId,
          createdAt: new Date().toISOString(),
        });

        const unit = draft.units.find((u) => u.id === tUnitId);
        if (unit) unit.status = 'OCCUPIED';

        if (depositPoisha > 0) {
          draft.depositTransactions.push({
            id: `dep_${Date.now()}`,
            tenantId,
            buildingId: tBuildingId,
            unitId: tUnitId,
            type: 'DEPOSIT_COLLECTED',
            amountPoisha: depositPoisha,
            date: tMoveInDate,
            method: 'CASH',
            reason: 'Initial refundable security deposit on registration',
            recordedByName: activeUser.name,
            createdAt: new Date().toISOString(),
          });
        }

        // Also generate current period rent if applicable
        const { newCharges } = generateMonthlyChargesForPeriod(
          draft,
          selectedPeriod
        );
        draft.rentCharges.push(...newCharges);
        return draft;
      },
      {
        eventType: 'RENT_GENERATED',
        entityId: tenantId,
        buildingId: tBuildingId,
        summaryEn: `Registered tenant ${tFullName.trim()} in unit ${db.units.find((u) => u.id === tUnitId)?.unitNumber || ''} with monthly rent ${formatBDT(rentPoisha, 'en')}.`,
        summaryBn: `নতুন ভাড়াটিয়া ${tFullName.trim()} নিবন্ধিত হয়েছেন (মাসিক ভাড়া ${formatBDT(rentPoisha, 'bn')})।`,
      }
    );

    setTFullName('');
    setTPhone('');
    setTNid('');
    setShowAddTenantForm(false);
    setColTenantId(tenantId);
    notify(
      isBn
        ? 'ভাড়াটিয়া নিবন্ধন ও জামানত লেজার সম্পন্ন হয়েছে।'
        : 'Tenant registered and unit marked Occupied.'
    );
  };

  const handleArchiveOrRestoreTenant = async (
    tenantId: string,
    archive: boolean
  ) => {
    if (activeUser.role !== 'OWNER' && !hasPerm('manageTenants')) {
      notify(
        isBn ? 'অনুমতি নেই।' : 'Permission denied.',
        'error'
      );
      return;
    }
    const target = db.tenants.find((t) => t.id === tenantId);
    if (!target) return;

    await commitDb(
      (draft) => {
        const t = draft.tenants.find((x) => x.id === tenantId);
        if (!t) return draft;
        t.status = archive ? 'ARCHIVED' : 'ACTIVE';
        if (archive) {
          t.moveOutDate = getDhakaToday();
          const u = draft.units.find((unit) => unit.id === t.currentUnitId);
          if (u) u.status = 'VACANT';
        } else {
          t.moveOutDate = undefined;
          const u = draft.units.find((unit) => unit.id === t.currentUnitId);
          if (u) u.status = 'OCCUPIED';
        }
        return draft;
      },
      {
        eventType: archive ? 'TENANT_ARCHIVED' : 'TENANT_RESTORED',
        entityId: tenantId,
        buildingId: target.currentBuildingId,
        summaryEn: `${archive ? 'Archived' : 'Restored'} tenant ${target.fullName}. Historical transactions preserved.`,
        summaryBn: `ভাড়াটিয়া ${target.fullName}-কে ${archive ? 'আর্কাইভ' : 'পুনরায় সক্রিয়'} করা হয়েছে।`,
      }
    );
    notify(
      archive
        ? isBn
          ? 'ভাড়াটিয়া আর্কাইভ করা হয়েছে এবং ফ্ল্যাট খালি দেখানো হয়েছে।'
          : 'Tenant archived and flat marked Vacant. All historical records preserved.'
        : isBn
        ? 'ভাড়াটিয়া পুনরায় সক্রিয় করা হয়েছে।'
        : 'Tenant restored to Active status.'
    );
  };

  const handleDeleteTenantPermanently = async (tenantId: string) => {
    if (activeUser.role !== 'OWNER') {
      notify(
        isBn
          ? 'স্থায়ীভাবে মুছে ফেলার অনুমতি কেবল মালিকের।'
          : 'Owner authorization required for permanent deletion.',
        'error'
      );
      return;
    }
    const hasFinancialHistory =
      db.payments.some((p) => p.tenantId === tenantId) ||
      db.rentCharges.some(
        (rc) => rc.tenantId === tenantId && rc.paidAmountPoisha > 0
      );

    if (hasFinancialHistory) {
      notify(
        isBn
          ? 'এই ভাড়াটিয়ার আর্থিক লেনদেন ও রসিদ রয়েছে। হিসাবের অখণ্ডতা রক্ষায় স্থায়ীভাবে মুছে ফেলা যাবে না—অনুগ্রহ করে আর্কাইভ ব্যবহার করুন।'
          : 'Retention Constraint: Tenant has posted payment receipts. Cannot permanently delete audited financial records — use Archive instead.',
        'error'
      );
      return;
    }

    const target = db.tenants.find((t) => t.id === tenantId);
    if (!target) return;

    await commitDb(
      (draft) => {
        draft.tenants = draft.tenants.filter((t) => t.id !== tenantId);
        draft.rentCharges = draft.rentCharges.filter(
          (rc) => rc.tenantId !== tenantId
        );
        const u = draft.units.find((unit) => unit.id === target.currentUnitId);
        if (u) u.status = 'VACANT';
        return draft;
      },
      {
        eventType: 'TENANT_DELETED',
        entityId: tenantId,
        buildingId: target.currentBuildingId,
        summaryEn: `Owner permanently deleted tenant ${target.fullName} (zero payment history).`,
        summaryBn: `মালিক কর্তৃক ভাড়াটিয়া ${target.fullName}-এর প্রোফাইল স্থায়ীভাবে মুছে ফেলা হয়েছে।`,
      }
    );
    notify(isBn ? 'ভাড়াটিয়া মুছে ফেলা হয়েছে।' : 'Tenant deleted.');
  };

  const handleDepositTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenantForDeposit || !depTxReason.trim()) {
      notify(
        isBn
          ? 'ভাড়াটিয়া এবং কারণ উল্লেখ করা আবশ্যক।'
          : 'Tenant and audit reason are required for deposit adjustments.',
        'error'
      );
      return;
    }
    const amountPoisha = takaToPoisha(depTxAmountTaka);
    if (amountPoisha <= 0) {
      notify(
        isBn ? 'টাকার পরিমাণ ০ এর বেশি হতে হবে।' : 'Amount must be greater than zero.',
        'error'
      );
      return;
    }
    const t = db.tenants.find((x) => x.id === selectedTenantForDeposit);
    if (!t) return;

    await commitDb(
      (draft) => {
        draft.depositTransactions.push({
          id: `dep_${Date.now()}`,
          tenantId: t.id,
          buildingId: t.currentBuildingId,
          unitId: t.currentUnitId,
          type: depTxType,
          amountPoisha,
          date: getDhakaToday(),
          method: 'CASH',
          reason: depTxReason.trim(),
          recordedByName: activeUser.name,
          createdAt: new Date().toISOString(),
        });
        if (depTxType === 'ADVANCE_COLLECTED') {
          const dt = draft.tenants.find((x) => x.id === t.id);
          if (dt) dt.advanceRentCreditPoisha += amountPoisha;
        }
        return draft;
      },
      {
        eventType: 'DEPOSIT_TX',
        entityId: t.id,
        buildingId: t.currentBuildingId,
        summaryEn: `${depTxType}: ${formatBDT(amountPoisha, 'en')} for ${t.fullName}. Reason: ${depTxReason.trim()}`,
        summaryBn: `${t.fullName}-এর জামানত/অগ্রিম হিসাব (${depTxType}): ${formatBDT(amountPoisha, 'bn')}। কারণ: ${depTxReason.trim()}`,
      }
    );
    setDepTxAmountTaka('');
    setDepTxReason('');
    setShowDepositModal(false);
    notify(
      isBn
        ? 'জামানত লেনদেন ও অডিট রেকর্ড সংরক্ষিত হয়েছে।'
        : 'Security deposit ledger updated with audit log.'
    );
  };

  const handleUpdateTenantFutureRent = async (tenantId: string) => {
    const newRentPoisha = takaToPoisha(newMonthlyRentTaka);
    if (newRentPoisha <= 0) {
      notify(isBn ? 'সঠিক ভাড়ার পরিমাণ দিন।' : 'Enter a valid positive rent amount.', 'error');
      return;
    }
    const t = db.tenants.find((x) => x.id === tenantId);
    if (!t) return;
    const oldRent = t.monthlyRentPoisha;

    await commitDb(
      (draft) => {
        const dt = draft.tenants.find((x) => x.id === tenantId);
        if (dt) dt.monthlyRentPoisha = newRentPoisha;
        // Update only unpaid current/future rent charge if desired, preserving paid history
        for (const rc of draft.rentCharges) {
          if (
            rc.tenantId === tenantId &&
            rc.billingPeriod >= selectedPeriod &&
            rc.category === 'RENT' &&
            rc.paidAmountPoisha === 0
          ) {
            rc.adjustedAmountPoisha = newRentPoisha;
          }
        }
        return draft;
      },
      {
        eventType: 'RENT_ADJUSTED',
        entityId: tenantId,
        buildingId: t.currentBuildingId,
        summaryEn: `Updated monthly rent for ${t.fullName} from ${formatBDT(oldRent, 'en')} to ${formatBDT(newRentPoisha, 'en')} (historical charges preserved).`,
        summaryBn: `${t.fullName}-এর মাসিক ভাড়া ${formatBDT(oldRent, 'bn')} থেকে পরিবর্তন করে ${formatBDT(newRentPoisha, 'bn')} করা হয়েছে।`,
      }
    );
    setNewMonthlyRentTaka('');
    setShowDepositModal(false);
    notify(
      isBn
        ? 'নতুন ভাড়া সংরক্ষিত হয়েছে (পূর্বের হিসাব অপরিবর্তিত)।'
        : 'Future monthly rent updated while preserving historical charges.'
    );
  };

  // Payment Collection Handler
  const selectedCollectionTenant = db.tenants.find(
    (t) => t.id === colTenantId
  );

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPerm('recordPayments')) {
      notify(
        isBn ? 'ভাড়া আদায় রেকর্ড করার অনুমতি নেই।' : 'Permission denied: cannot record payments.',
        'error'
      );
      return;
    }
    if (!selectedCollectionTenant) {
      notify(isBn ? 'ভাড়াটিয়া নির্বাচন করুন।' : 'Please select a tenant.', 'error');
      return;
    }

    let amountPoisha = 0;
    try {
      amountPoisha = takaToPoisha(colAmountTaka);
    } catch {
      notify(isBn ? 'টাকার পরিমাণ সঠিক নয়।' : 'Invalid payment amount.', 'error');
      return;
    }
    if (amountPoisha <= 0) {
      notify(
        isBn ? 'প্রাপ্ত টাকা ০ এর বেশি হতে হবে।' : 'Payment amount must be greater than 0.',
        'error'
      );
      return;
    }

    if (
      colMethod === 'ADVANCE_APPLIED' &&
      amountPoisha > selectedCollectionTenant.advanceRentCreditPoisha
    ) {
      notify(
        isBn
          ? 'ভাড়াটিয়ার পর্যাপ্ত অগ্রিম জমা (Advance Credit) নেই।'
          : 'Amount exceeds tenant available Advance Rent Credit.',
        'error'
      );
      return;
    }

    const paymentId = `pay_${Date.now()}`;
    const receiptNumber = `BR-${selectedPeriod.replace('-', '')}-${String(
      1001 + db.payments.length
    )}`;

    let allocResult;
    try {
      if (colMode === 'FIFO') {
        allocResult = allocatePaymentOldestFirst(
          paymentId,
          amountPoisha,
          unpaidObligations,
          selectedPeriod
        );
      } else {
        const customPoishaMap: Record<string, number> = {};
        for (const [k, v] of Object.entries(colCustomMapTaka)) {
          if (v && v.trim()) customPoishaMap[k] = takaToPoisha(v);
        }
        allocResult = allocatePaymentCustom(
          paymentId,
          amountPoisha,
          customPoishaMap,
          unpaidObligations,
          selectedPeriod
        );
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Allocation error', 'error');
      return;
    }

    const previousBalancePoisha = unpaidObligations.reduce(
      (s, o) => s + o.outstandingPoisha,
      0
    );
    const allocatedToObligations =
      amountPoisha - allocResult.unallocatedCreditPoisha;
    const remainingBalancePoisha = Math.max(
      0,
      previousBalancePoisha - allocatedToObligations
    );

    const newPayment: Payment = {
      id: paymentId,
      receiptNumber,
      timestamp: new Date().toISOString(),
      paymentDate: getDhakaToday(),
      buildingId: selectedCollectionTenant.currentBuildingId,
      unitId: selectedCollectionTenant.currentUnitId,
      tenantId: selectedCollectionTenant.id,
      method: colMethod,
      amountReceivedPoisha: amountPoisha,
      unallocatedCreditPoisha: allocResult.unallocatedCreditPoisha,
      transactionRef: colRef.trim(),
      notes: colNotes.trim(),
      recordedByUserId: activeUser.id,
      recordedByName: activeUser.name,
      allocations: allocResult.allocations,
      previousBalancePoisha,
      remainingBalancePoisha,
    };

    await commitDb(
      (draft) => {
        draft.payments.unshift(newPayment);
        for (const alloc of allocResult.allocations) {
          if (alloc.targetType === 'RENT_CHARGE') {
            const rc = draft.rentCharges.find((c) => c.id === alloc.targetId);
            if (rc) rc.paidAmountPoisha += alloc.amountPoisha;
          } else if (alloc.targetType === 'UTILITY_BILL') {
            const ub = draft.utilityBills.find((b) => b.id === alloc.targetId);
            if (ub) ub.paidAmountPoisha += alloc.amountPoisha;
          } else if (alloc.targetType === 'ADVANCE_CREDIT') {
            const dt = draft.tenants.find(
              (t) => t.id === selectedCollectionTenant.id
            );
            if (dt) dt.advanceRentCreditPoisha += alloc.amountPoisha;
          }
        }
        if (colMethod === 'ADVANCE_APPLIED') {
          const dt = draft.tenants.find(
            (t) => t.id === selectedCollectionTenant.id
          );
          if (dt) {
            dt.advanceRentCreditPoisha = Math.max(
              0,
              dt.advanceRentCreditPoisha - amountPoisha
            );
          }
        }
        return draft;
      },
      {
        eventType: 'PAYMENT_RECORDED',
        entityId: paymentId,
        buildingId: selectedCollectionTenant.currentBuildingId,
        summaryEn: `Receipt ${receiptNumber}: Collected ${formatBDT(amountPoisha, 'en')} via ${colMethod} from ${selectedCollectionTenant.fullName}.`,
        summaryBn: `রসিদ ${receiptNumber}: ${selectedCollectionTenant.fullName} হতে ${colMethod} মাধ্যমে ${formatBDT(amountPoisha, 'bn')} আদায় করা হয়েছে।`,
      }
    );

    setColAmountTaka('');
    setColRef('');
    setColNotes('');
    setColCustomMapTaka({});

    const building = db.buildings.find(
      (b) => b.id === selectedCollectionTenant.currentBuildingId
    );
    const unit = db.units.find(
      (u) => u.id === selectedCollectionTenant.currentUnitId
    );
    if (building && unit) {
      setReceiptModalCtx({
        payment: newPayment,
        tenant: selectedCollectionTenant,
        building,
        unit,
        settings: db.settings,
        lang,
      });
    }
    notify(
      isBn
        ? `পেমেন্ট সংরক্ষিত এবং রসিদ #${receiptNumber} প্রস্তুত হয়েছে!`
        : `Payment recorded and Receipt #${receiptNumber} generated!`
    );
  };

  const handleReversePayment = async (paymentId: string) => {
    if (activeUser.role !== 'OWNER') {
      notify(
        isBn
          ? 'পেমেন্ট বাতিল বা সংশোধনের এখতিয়ার কেবল মালিকের।'
          : 'Only the Property Owner can authorize a payment reversal.',
        'error'
      );
      return;
    }
    const target = db.payments.find((p) => p.id === paymentId);
    if (!target || target.isReversed) return;

    await commitDb(
      (draft) => {
        const p = draft.payments.find((x) => x.id === paymentId);
        if (!p) return draft;
        p.isReversed = true;
        p.reversalReason = 'Owner authorized audit reversal';
        for (const alloc of p.allocations) {
          if (alloc.targetType === 'RENT_CHARGE') {
            const rc = draft.rentCharges.find((c) => c.id === alloc.targetId);
            if (rc) {
              rc.paidAmountPoisha = Math.max(
                0,
                rc.paidAmountPoisha - alloc.amountPoisha
              );
            }
          } else if (alloc.targetType === 'UTILITY_BILL') {
            const ub = draft.utilityBills.find((b) => b.id === alloc.targetId);
            if (ub) {
              ub.paidAmountPoisha = Math.max(
                0,
                ub.paidAmountPoisha - alloc.amountPoisha
              );
            }
          } else if (alloc.targetType === 'ADVANCE_CREDIT') {
            const t = draft.tenants.find((x) => x.id === p.tenantId);
            if (t) {
              t.advanceRentCreditPoisha = Math.max(
                0,
                t.advanceRentCreditPoisha - alloc.amountPoisha
              );
            }
          }
        }
        return draft;
      },
      {
        eventType: 'PAYMENT_REVERSED',
        entityId: paymentId,
        buildingId: target.buildingId,
        summaryEn: `Reversed Receipt #${target.receiptNumber} (${formatBDT(target.amountReceivedPoisha, 'en')}) and restored unpaid balances.`,
        summaryBn: `রসিদ #${target.receiptNumber} (${formatBDT(target.amountReceivedPoisha, 'bn')}) মালিক কর্তৃক রিভার্স/সংশোধন করা হয়েছে।`,
      }
    );
    notify(
      isBn
        ? `রসিদ #${target.receiptNumber} রিভার্স করা হয়েছে এবং বকেয়া সমন্বয় হয়েছে।`
        : `Receipt #${target.receiptNumber} reversed with audit record.`
    );
  };

  // Utility Bill Handler
  const handlePostUtilityBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPerm('enterUtilities')) {
      notify(
        isBn ? 'বিল এন্ট্রি করার অনুমতি নেই।' : 'Permission denied: cannot enter utility bills.',
        'error'
      );
      return;
    }
    const unit = db.units.find((u) => u.id === billUnitId);
    const tenant = db.tenants.find(
      (t) => t.currentUnitId === billUnitId && t.status === 'ACTIVE'
    );
    if (!unit || !tenant) {
      notify(
        isBn
          ? 'সক্রিয় ভাড়াটিয়াসহ একটি ফ্ল্যাট নির্বাচন করুন।'
          : 'Select an occupied unit with an active tenant.',
        'error'
      );
      return;
    }

    // Check duplicate bill for same period and category
    const duplicate = db.utilityBills.find(
      (b) =>
        b.unitId === unit.id &&
        b.billingPeriod === billPeriod &&
        b.utilityType === billType
    );
    if (duplicate && !billAllowDuplicate) {
      notify(
        isBn
          ? `${billPeriod} মাসে এই ফ্ল্যাটে ${billType} বিল ইতিমধ্যে পোস্ট করা হয়েছে। অতিরিক্ত চার্জ দিতে চাইলে টিক দিন।`
          : `A ${billType} bill is already posted for ${unit.unitNumber} in ${billPeriod}. Check "Allow additional charge" to post another.`,
        'error'
      );
      return;
    }

    let totalPoisha = 0;
    let consumption = 0;
    let prevR: number | undefined;
    let currR: number | undefined;
    let ratePoisha: number | undefined;
    let fixedPoisha: number | undefined;

    try {
      if (billMode === 'METER') {
        prevR = parseFloat(billPrevReading);
        currR = parseFloat(billCurrReading);
        ratePoisha = takaToPoisha(billRateTaka);
        fixedPoisha = takaToPoisha(billFixedTaka);
        const calc = calculateMeterUtilityBill({
          prevReading: prevR,
          currReading: currR,
          ratePerUnitPoisha: ratePoisha,
          fixedChargePoisha: fixedPoisha,
          rolloverAuthorized: billRollover,
        });
        consumption = calc.consumptionUnits;
        totalPoisha = calc.totalAmountPoisha;
      } else {
        totalPoisha = takaToPoisha(billManualTaka);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Invalid meter reading', 'error');
      return;
    }

    if (totalPoisha <= 0) {
      notify(
        isBn ? 'বিলের পরিমাণ ০ এর বেশি হতে হবে।' : 'Bill amount must be greater than zero.',
        'error'
      );
      return;
    }

    const billId = `ub_${Date.now()}`;
    await commitDb(
      (draft) => {
        draft.utilityBills.unshift({
          id: billId,
          buildingId: unit.buildingId,
          unitId: unit.id,
          tenantId: tenant.id,
          billingPeriod: billPeriod,
          utilityType: billType,
          billingMode: billMode,
          prevReading: prevR,
          currReading: currR,
          consumptionUnits: consumption,
          ratePerUnitPoisha: ratePoisha,
          fixedChargePoisha: fixedPoisha,
          meterRolloverAuthorized: billRollover,
          totalAmountPoisha: totalPoisha,
          paidAmountPoisha: 0,
          readingDate: getDhakaToday(),
          notes: billNotes.trim(),
          isAdditionalCharge: billAllowDuplicate,
          createdAt: new Date().toISOString(),
        });
        return draft;
      },
      {
        eventType: 'BILL_POSTED',
        entityId: billId,
        buildingId: unit.buildingId,
        summaryEn: `Posted ${billType} (${billMode}) bill of ${formatBDT(totalPoisha, 'en')} for ${unit.unitNumber} (${tenant.fullName}) [${billPeriod}].`,
        summaryBn: `${unit.unitNumber} (${tenant.fullName})-এর জন্য ${formatBDT(totalPoisha, 'bn')} টাকার ${billType} বিল যোগ করা হয়েছে।`,
      }
    );

    setBillNotes('');
    notify(
      isBn
        ? `ইউটিলিটি বিল (${formatBDT(totalPoisha, 'bn')}) পোস্ট করা হয়েছে।`
        : `Utility bill (${formatBDT(totalPoisha, 'en')}) posted successfully.`
    );
  };

  // Custom Shared Charge Handler
  const handlePostSharedCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scValidation.isValid) {
      notify(
        isBn
          ? 'কাস্টম অ্যালোকেশনের যোগফল মোট খরচের সমান হতে হবে (পার্থক্য ৳ ০ হতে হবে)।'
          : 'Sum of custom unit allocations must exactly equal the total shared expense.',
        'error'
      );
      return;
    }
    const scId = `sc_${Date.now()}`;
    await commitDb(
      (draft) => {
        draft.sharedCharges.unshift({
          id: scId,
          buildingId: scBuildingId,
          billingPeriod: selectedPeriod,
          title: scTitle.trim(),
          totalAmountPoisha: scValidation.totalPoisha,
          allocations: scValidation.items,
          posted: true,
          notes: 'Custom owner allocation',
          createdAt: new Date().toISOString(),
        });
        for (const item of scValidation.items) {
          if (item.amountPoisha <= 0) continue;
          draft.utilityBills.unshift({
            id: `ub_${scId}_${item.unitId}`,
            buildingId: scBuildingId,
            unitId: item.unitId,
            tenantId: item.tenantId,
            billingPeriod: selectedPeriod,
            utilityType: 'SHARED',
            billingMode: 'SHARED_ALLOCATION',
            totalAmountPoisha: item.amountPoisha,
            paidAmountPoisha: 0,
            readingDate: getDhakaToday(),
            notes: `Shared Charge: ${scTitle.trim()}`,
            sharedChargeId: scId,
            createdAt: new Date().toISOString(),
          });
        }
        return draft;
      },
      {
        eventType: 'SHARED_CHARGE_POSTED',
        entityId: scId,
        buildingId: scBuildingId,
        summaryEn: `Posted shared building charge "${scTitle.trim()}" (${formatBDT(scValidation.totalPoisha, 'en')}) across ${scValidation.items.length} units.`,
        summaryBn: `যৌথ বিল "${scTitle.trim()}" (মোট ${formatBDT(scValidation.totalPoisha, 'bn')}) ফ্ল্যাটগুলোতে বণ্টন করা হয়েছে।`,
      }
    );
    setScCustomUnitTaka({});
    notify(
      isBn
        ? 'যৌথ চার্জ সফলভাবে ফ্ল্যাটগুলোর বিলে যুক্ত হয়েছে।'
        : 'Shared building charge allocated and posted to unit bills.'
    );
  };

  // Expense Handler
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPerm('recordExpenses')) {
      notify(
        isBn ? 'খরচ এন্ট্রি করার অনুমতি নেই।' : 'Permission denied: cannot record expenses.',
        'error'
      );
      return;
    }
    if (!expBuildingId || !expDesc.trim()) {
      notify(
        isBn ? 'ভবন এবং খরচের বিবরণ আবশ্যক।' : 'Building and description are required.',
        'error'
      );
      return;
    }
    const amtPoisha = takaToPoisha(expAmountTaka);
    if (amtPoisha <= 0) {
      notify(
        isBn ? 'খরচের পরিমাণ ০ এর বেশি হতে হবে।' : 'Expense amount must be positive.',
        'error'
      );
      return;
    }
    const expId = `exp_${Date.now()}`;
    await commitDb(
      (draft) => {
        draft.expenses.unshift({
          id: expId,
          buildingId: expBuildingId,
          unitId: expUnitId || undefined,
          category: expCategory,
          amountPoisha: amtPoisha,
          date: expDate,
          description: expDesc.trim(),
          method: expMethod,
          vendor: expVendor.trim(),
          recordedByName: activeUser.name,
          createdAt: new Date().toISOString(),
        });
        return draft;
      },
      {
        eventType: 'EXPENSE_RECORDED',
        entityId: expId,
        buildingId: expBuildingId,
        summaryEn: `Recorded ${expCategory} expense of ${formatBDT(amtPoisha, 'en')}: ${expDesc.trim()}.`,
        summaryBn: `${expCategory} বাবদ ${formatBDT(amtPoisha, 'bn')} খরচ এন্ট্রি করা হয়েছে: ${expDesc.trim()}।`,
      }
    );
    setExpAmountTaka('');
    setExpDesc('');
    setExpVendor('');
    setShowExpenseModal(false);
    notify(isBn ? 'খরচ সংরক্ষিত হয়েছে।' : 'Property expense recorded.');
  };

  // Share Overdue Reminder via WhatsApp / SMS / Android Share Sheet
  const handleSendReminder = async (
    eventKey: string,
    phone: string,
    message: string,
    channel: 'WHATSAPP' | 'SMS' | 'SHARE'
  ) => {
    await commitDb((draft) => {
      if (!draft.reminderSettings.notifiedEventKeys.includes(eventKey)) {
        draft.reminderSettings.notifiedEventKeys.push(eventKey);
      }
      return draft;
    });

    const cleanDigits = phone.replace(/[^0-9]/g, '');
    const bdPhone = cleanDigits.startsWith('88')
      ? cleanDigits
      : `88${cleanDigits}`;

    if (channel === 'SHARE' && navigator.share) {
      try {
        await navigator.share({
          title: 'Rent Payment Reminder',
          text: message,
        });
        return;
      } catch {
        // fallback below
      }
    }

    if (channel === 'WHATSAPP') {
      const a = document.createElement('a');
      a.href = `https://wa.me/${bdPhone}?text=${encodeURIComponent(message)}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    } else {
      const a = document.createElement('a');
      a.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
      a.click();
    }
    notify(
      isBn
        ? 'তাগাদা বার্তা শেয়ার করার জন্য প্রস্তুত করা হয়েছে।'
        : 'Reminder message prepared for dispatch.'
    );
  };

  // Backup Export & Restore Handlers
  const handleExportEncryptedBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const content = await createEncryptedBackup(
        db,
        backupPassword,
        includeBackupDocs
      );
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BashaRent_Encrypted_${getDhakaToday()}.brmbackup`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await commitDb((d) => d, {
        eventType: 'BACKUP_EXPORTED',
        entityId: 'backup',
        summaryEn: `Exported AES-256-GCM encrypted backup (${db.buildings.length} buildings, ${db.tenants.length} tenants, ${db.payments.length} payments).`,
        summaryBn: `AES-256-GCM এনক্রিপ্টেড ব্যাকআপ ফাইল ডাউনলোড করা হয়েছে।`,
      });
      setBackupPassword('');
      notify(
        isBn
          ? 'AES-256-GCM এনক্রিপ্টেড ব্যাকআপ ডাউনলোড সম্পন্ন হয়েছে।'
          : 'AES-256-GCM encrypted backup exported successfully.'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Backup failed', 'error');
    }
  };

  const handleSelectRestoreFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      try {
        const env = inspectBackupEnvelope(text);
        setRestoreFileContent(text);
        setRestorePreviewSummary(
          `Created: ${env.createdAt.slice(0, 19)} · Cipher: ${env.cipher} · Buildings: ${env.summary.buildingsCount} · Units: ${env.summary.unitsCount} · Tenants: ${env.summary.tenantsCount} · Payments: ${env.summary.paymentsCount}`
        );
      } catch (err) {
        setRestoreFileContent('');
        setRestorePreviewSummary(null);
        notify(
          err instanceof Error ? err.message : 'Invalid backup file',
          'error'
        );
      }
    };
    reader.readAsText(file);
  };

  const handleRestoreEncryptedBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreFileContent || !restorePassword) {
      notify(
        isBn
          ? 'ব্যাকআপ ফাইল এবং পাসওয়ার্ড দিন।'
          : 'Select a valid backup file and enter its decryption password.',
        'error'
      );
      return;
    }
    try {
      const { state: restored } = await decryptAndVerifyBackup(
        restoreFileContent,
        restorePassword
      );
      restored.auditLogs.unshift({
        id: `aud_restore_${Date.now()}`,
        timestamp: new Date().toISOString(),
        eventType: 'BACKUP_RESTORED',
        entityId: 'restore',
        userId: activeUser.id,
        userName: activeUser.name,
        summaryEn: 'Restored verified AES-256-GCM encrypted backup.',
        summaryBn: 'AES-256-GCM এনক্রিপ্টেড ব্যাকআপ হতে ডাটাবেস পুনরুদ্ধার করা হয়েছে।',
      });
      setDb(restored);
      await saveDatabaseState(restored);
      setRestorePassword('');
      setRestoreFileContent('');
      setRestorePreviewSummary(null);
      notify(
        isBn
          ? 'ব্যাকআপ সফলভাবে যাচাই ও পুনরুদ্ধার করা হয়েছে!'
          : 'Backup integrity verified and database restored!'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Restore failed', 'error');
    }
  };

  // Export CSV helper
  const handleExportCsvReport = () => {
    const rows: string[][] = [];
    if (reportType === 'RENT_COLLECTION') {
      rows.push([
        'Receipt Number',
        'Date',
        'Tenant',
        'Building',
        'Unit',
        'Method',
        'Amount (BDT)',
        'Status',
      ]);
      for (const p of db.payments) {
        const t = db.tenants.find((x) => x.id === p.tenantId);
        const b = db.buildings.find((x) => x.id === p.buildingId);
        const u = db.units.find((x) => x.id === p.unitId);
        rows.push([
          p.receiptNumber,
          p.paymentDate,
          t?.fullName || '',
          b?.name || '',
          u?.unitNumber || '',
          p.method,
          String(p.amountReceivedPoisha / 100),
          p.isReversed ? 'REVERSED' : 'PAID',
        ]);
      }
    } else if (reportType === 'OUTSTANDING_DUES') {
      rows.push([
        'Tenant',
        'Phone',
        'Building',
        'Unit',
        'Total Outstanding (BDT)',
        'Overdue Periods',
      ]);
      for (const item of reminderEval?.overdueItems || []) {
        rows.push([
          item.tenant.fullName,
          item.tenant.primaryPhone,
          item.building.name,
          item.unit.unitNumber,
          String(item.outstandingPoisha / 100),
          item.overduePeriods.join('; '),
        ]);
      }
    } else {
      rows.push([
        'Building',
        'Period Charged (BDT)',
        'Period Cash Collected (BDT)',
        'Total Outstanding (BDT)',
        'Period Expenses (BDT)',
      ]);
      for (const b of summary.buildingBreakdown) {
        rows.push([
          b.buildingName,
          String(b.chargedPoisha / 100),
          String(b.collectedPoisha / 100),
          String(b.outstandingPoisha / 100),
          String(b.expensesPoisha / 100),
        ]);
      }
    }

    const csvContent =
      '\uFEFF' +
      rows
        .map((r) =>
          r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        )
        .join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BashaRent_${reportType}_${selectedPeriod}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Navigation items — "APK ডাউনলোড" (ANDROID_APK) is shown ONLY in Web version, hidden inside APK
  const navItems = (
    [
      ['DASHBOARD', isBn ? 'হোম ও ড্যাশবোর্ড' : 'Home & Overview', Home],
      ['COLLECTION', isBn ? 'ভাড়া আদায় ও রসিদ' : 'Collect Rent', CreditCard],
      ['BUILDINGS', isBn ? 'ভবন ও ফ্ল্যাট' : 'Buildings & Flats', Building2],
      ['TENANTS', isBn ? 'ভাড়াটিয়া তালিকা' : 'Tenants & Deposits', Users],
      ['BILLS', isBn ? 'বিদ্যুৎ ও গ্যাস বিল' : 'Utility & Shared Bills', Zap],
      ['EXPENSES', isBn ? 'ভবনের খরচ' : 'Property Expenses', Wrench],
      ['REPORTS', isBn ? 'হিসাব ও রিপোর্ট' : 'Reports & Ledger', FileSpreadsheet],
      ['SETTINGS', isBn ? 'সেটিংস ও ব্যাকআপ' : 'Settings & Backup', Settings],
      ...(!isApkVersion
        ? ([
            [
              'ANDROID_APK',
              isBn ? 'APK ডাউনলোড' : 'Download APK',
              Smartphone,
            ],
          ] as const)
        : []),
    ] as const
  );

  return (
    <div className="min-h-screen flex bg-[#F4F7F6] text-slate-900">
      {/* Desktop Clean & Friendly Sidebar */}
      <aside className="hidden lg:flex lg:w-68 xl:w-72 lg:flex-col lg:fixed lg:inset-y-0 bg-white border-r border-slate-200/90 z-40 no-print select-none">
        {/* Brand Header */}
        <div className="h-20 px-6 flex items-center gap-3.5 border-b border-slate-100">
          <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold text-slate-900 tracking-tight truncate">
              {db.settings.appName}
            </div>
            <div className="text-xs text-slate-500 truncate mt-0.5">
              {isBn ? 'সহজ বাড়িভাড়া ও হিসাব খাতা' : 'Easy Rent & Property Book'}
            </div>
          </div>
        </div>

        {/* Quick Primary Action Button in Sidebar */}
        <div className="px-4 pt-5 pb-2">
          <button
            onClick={() => setActiveTab('COLLECTION')}
            className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <CreditCard className="w-4 h-4" />
            <span>{isBn ? '+ ভাড়া আদায় করুন' : '+ Collect Rent Now'}</span>
          </button>
        </div>

        {/* Single Clean Navigation List */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1.5">
          {navItems.map(([tabKey, label, Icon]) => {
            const active = activeTab === tabKey;
            return (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey as NavTab)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm transition-all cursor-pointer ${
                  active
                    ? 'bg-emerald-50 text-emerald-800 font-bold border border-emerald-200/80 shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 font-medium border border-transparent'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${
                    active ? 'text-emerald-600' : 'text-slate-400'
                  }`}
                />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </div>

        {/* Sidebar Footer: Role Switcher */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/70 space-y-2">
          <label className="block text-xs font-semibold text-slate-500">
            {isBn ? 'ব্যবহারকারী মোড (Role)' : 'Active User Role'}
          </label>
          <select
            aria-label="Active User Role"
            value={db.activeUserId}
            onChange={(e) =>
              commitDb((d) => {
                d.activeUserId = e.target.value;
                return d;
              })
            }
            className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-2 text-sm font-medium"
          >
            {db.users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.role === 'OWNER'
                  ? isBn
                    ? `বাড়িওয়ালা: ${u.name}`
                    : `Owner: ${u.name}`
                  : isBn
                  ? `ম্যানেজার: ${u.name}`
                  : `Manager: ${u.name}`}
              </option>
            ))}
          </select>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:pl-68 xl:pl-72 min-w-0">
        {/* Clean, Friendly Top Header (NO duplicate nav links, NO redundant top APK button) */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 h-16 flex items-center justify-between gap-3 no-print">
          {/* Mobile Brand / Desktop Current Section Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setActiveTab('DASHBOARD')}
              className="lg:hidden w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0"
            >
              <Building2 className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="text-base sm:text-lg font-bold text-slate-900 truncate">
                {activeTab === 'DASHBOARD' && (isBn ? 'হোম ও ড্যাশবোর্ড' : 'Dashboard')}
                {activeTab === 'BUILDINGS' && (isBn ? 'ভবন ও ফ্ল্যাট তালিকা' : 'Buildings & Flats')}
                {activeTab === 'TENANTS' && (isBn ? 'ভাড়াটিয়া ও জামানত' : 'Tenants & Deposits')}
                {activeTab === 'COLLECTION' && (isBn ? 'ভাড়া আদায় ও রসিদ' : 'Rent Collection')}
                {activeTab === 'BILLS' && (isBn ? 'বিদ্যুৎ, গ্যাস ও যৌথ বিল' : 'Utility Bills')}
                {activeTab === 'EXPENSES' && (isBn ? 'ভবনের রক্ষণাবেক্ষণ খরচ' : 'Property Expenses')}
                {activeTab === 'REPORTS' && (isBn ? 'হিসাব ও আর্থিক রিপোর্ট' : 'Financial Reports')}
                {activeTab === 'SETTINGS' && (isBn ? 'সেটিংস ও ব্যাকআপ' : 'Settings & Backup')}
                {activeTab === 'ANDROID_APK' && (isBn ? 'মোবাইল অ্যাপ (APK ডাউনলোড)' : 'Android APK Download')}
              </div>
            </div>
          </div>

          {/* Right Controls: Month Picker & Language Switcher Only */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-200/80 rounded-xl px-3 py-1.5">
              <span className="hidden sm:inline text-xs font-semibold text-slate-600">
                {isBn ? 'হিসাবের মাস:' : 'Month:'}
              </span>
              <input
                type="month"
                aria-label="Billing Period"
                value={selectedPeriod}
                onChange={(e) =>
                  setSelectedPeriod(e.target.value || getDhakaBillingPeriod())
                }
                className="bg-transparent text-slate-900 text-sm font-bold font-mono focus:outline-none"
              />
            </div>

            <button
              onClick={() =>
                commitDb((d) => {
                  d.settings.language =
                    d.settings.language === 'en' ? 'bn' : 'en';
                  return d;
                })
              }
              className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs sm:text-sm font-bold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isBn ? 'English' : 'বাংলা'}
            </button>
          </div>
        </header>

        {/* Friendly Toast Notification */}
        {toast && (
          <div className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 max-w-md rounded-2xl bg-slate-900 text-white px-5 py-3.5 shadow-2xl border border-slate-700 flex items-center gap-3 text-sm font-medium">
            <CheckCircle2
              className={`w-5 h-5 shrink-0 ${
                toast.type === 'error' ? 'text-rose-400' : 'text-emerald-400'
              }`}
            />
            <span>{toast.text}</span>
          </div>
        )}

        {/* Main Workspace Container */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 pb-28 lg:pb-12">
          {/* ==================== 1. USER-FRIENDLY DASHBOARD ==================== */}
          {activeTab === 'DASHBOARD' && (
            <div className="space-y-6">
              {/* Friendly Welcome & Quick Action Banner */}
              <div className="rounded-3xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 text-white p-6 sm:p-8 shadow-md">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 text-emerald-100 text-sm font-medium">
                      <span>{formatBillingPeriod(selectedPeriod, isBn ? 'bn' : 'en')}</span>
                      <span>·</span>
                      <span>
                        {isBn
                          ? `মোট ${toBengaliDigits(summary.occupiedUnitsCount)}টি ফ্ল্যাটে ভাড়াটিয়া আছেন`
                          : `${summary.occupiedUnitsCount} Flats Occupied`}
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                      {isBn
                        ? `স্বাগতম, ${activeUser.name}!`
                        : `Welcome back, ${activeUser.name}!`}
                    </h1>
                    <p className="text-sm text-emerald-100/90 max-w-xl leading-relaxed">
                      {isBn
                        ? 'এখান থেকে এক ক্লিকে ভাড়া আদায় করুন, রসিদ তৈরি করুন এবং কোন কোন ফ্ল্যাটে ভাড়া বকেয়া আছে তা সহজেই দেখুন।'
                        : 'Collect rent in one tap, share instant receipts, and track unpaid dues effortlessly.'}
                    </p>
                  </div>

                  {/* 3 Big, Unmistakable Action Buttons */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => setActiveTab('COLLECTION')}
                      className="px-5 py-3.5 rounded-2xl bg-white text-emerald-900 font-bold text-sm shadow-sm hover:bg-emerald-50 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <CreditCard className="w-4 h-4 text-emerald-600" />
                      <span>{isBn ? 'ভাড়া আদায় করুন' : 'Collect Rent'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setShowAddTenantForm(true);
                        setActiveTab('TENANTS');
                      }}
                      className="px-4 py-3.5 rounded-2xl bg-emerald-900/50 hover:bg-emerald-900/70 border border-emerald-400/30 text-white font-semibold text-sm transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>{isBn ? 'নতুন ভাড়াটিয়া' : 'Add Tenant'}</span>
                    </button>

                    <button
                      onClick={handleGenerateMonthlyRent}
                      className="px-4 py-3.5 rounded-2xl bg-emerald-900/50 hover:bg-emerald-900/70 border border-emerald-400/30 text-white font-semibold text-sm transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>
                        {isBn ? 'এই মাসের ভাড়া তৈরি' : 'Generate Month Rent'}
                      </span>
                    </button>
                  </div>
                </div>

                {/* Building Filter Bar inside Banner */}
                {db.buildings.length > 1 && (
                  <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-100 mr-1">
                      {isBn ? 'ভবন বেছে নিন:' : 'Filter Building:'}
                    </span>
                    <button
                      onClick={() => setBuildingFilter('ALL')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        buildingFilter === 'ALL'
                          ? 'bg-white text-emerald-900'
                          : 'bg-white/10 text-white hover:bg-white/20'
                      }`}
                    >
                      {isBn ? 'সব ভবন একসাথে' : 'All Buildings'}
                    </button>
                    {db.buildings.map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setBuildingFilter(b.id)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          buildingFilter === b.id
                            ? 'bg-white text-emerald-900'
                            : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                      >
                        {b.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 4 Big, Easy-to-Read Financial Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Total Collected */}
                <div className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">
                      {isBn ? 'এই মাসে আদায় হয়েছে' : 'Collected This Month'}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-emerald-600 font-mono tabular-nums mt-3">
                    {formatBDT(summary.totalCashCollectedPoisha, lang)}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>{isBn ? 'আদায়ের অগ্রগতি' : 'Collection Rate'}</span>
                    <span className="font-bold text-emerald-700 font-mono">
                      {isBn
                        ? toBengaliDigits(summary.collectionRatePercent)
                        : summary.collectionRatePercent}
                      %
                    </span>
                  </div>
                </div>

                {/* Card 2: Total Unpaid / Due */}
                <div className="rounded-2xl bg-white border border-rose-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">
                      {isBn ? 'মোট বকেয়া আছে' : 'Total Unpaid Dues'}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-rose-600 font-mono tabular-nums mt-3">
                    {formatBDT(summary.totalOutstandingAllPeriodsPoisha, lang)}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                    {isBn ? 'ভাড়া:' : 'Rent:'}{' '}
                    {formatBDT(summary.outstandingRentPoisha, lang)} ·{' '}
                    {isBn ? 'বিল:' : 'Bills:'}{' '}
                    {formatBDT(summary.outstandingUtilityPoisha, lang)}
                  </div>
                </div>

                {/* Card 3: Total Billed This Month */}
                <div className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">
                      {isBn ? 'এই মাসের মোট ধার্য ভাড়া' : 'Total Billed This Month'}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                      <Wallet className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums mt-3">
                    {formatBDT(
                      summary.totalRentChargedPoisha +
                        summary.totalUtilityChargedPoisha,
                      lang
                    )}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                    {isBn ? 'ভাড়া:' : 'Rent:'}{' '}
                    {formatBDT(summary.totalRentChargedPoisha, lang)} ·{' '}
                    {isBn ? 'বিল:' : 'Bills:'}{' '}
                    {formatBDT(summary.totalUtilityChargedPoisha, lang)}
                  </div>
                </div>

                {/* Card 4: Net Hand Cash after Expenses */}
                <div className="rounded-2xl bg-white border border-slate-200/90 p-5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600">
                      {isBn ? 'খরচ বাদে নিট জমা' : 'Net Cash After Expenses'}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                      <Shield className="w-5 h-5" />
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-slate-900 font-mono tabular-nums mt-3">
                    {formatBDT(summary.netOperatingCashFlowPoisha, lang)}
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                    {isBn ? 'ভবনের খরচ:' : 'Expenses:'}{' '}
                    {formatBDT(summary.totalExpensesPoisha, lang)} ·{' '}
                    {isBn ? 'জামানত:' : 'Held Deposit:'}{' '}
                    {formatBDT(summary.securityDepositsHeldPoisha, lang)}
                  </div>
                </div>
              </div>

              {/* Two-Column Friendly Overview: Who Needs to Pay vs Building Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left 6 Cols: Tenants with Unpaid Dues (1-Tap Collect or WhatsApp Reminder) */}
                <div className="lg:col-span-6 rounded-2xl bg-white border border-slate-200/90 p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        {isBn
                          ? 'যাদের ভাড়া বা বিল বকেয়া আছে'
                          : 'Tenants with Unpaid Rent'}
                      </h2>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {isBn
                          ? 'এক ক্লিকে ভাড়া জমা নিন অথবা WhatsApp-এ তাগাদা পাঠান'
                          : 'Collect payment in one tap or send a polite reminder'}
                      </p>
                    </div>
                    <span className="px-3 py-1 rounded-xl bg-rose-50 text-rose-700 font-bold text-xs">
                      {reminderEval?.overdueItems.length || 0}{' '}
                      {isBn ? 'জন বাকি' : 'Due'}
                    </span>
                  </div>

                  {reminderEval && reminderEval.overdueItems.length === 0 ? (
                    <div className="p-8 text-center rounded-2xl bg-emerald-50/60 border border-emerald-200/70 space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                      <div className="text-base font-bold text-emerald-900">
                        {isBn
                          ? 'আলহামদুলিল্লাহ! সকল ভাড়াটিয়ার ভাড়া পরিশোধিত আছে।'
                          : 'All tenants have paid their rent!'}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reminderEval?.overdueItems.map((item) => (
                        <div
                          key={item.eventKey}
                          className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 hover:border-slate-300 transition-all space-y-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-base font-bold text-slate-900">
                                {item.tenant.fullName}
                              </div>
                              <div className="text-sm text-slate-600 mt-0.5">
                                {item.building.name} ·{' '}
                                <span className="font-semibold text-slate-900">
                                  {item.unit.unitNumber}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-medium text-slate-500">
                                {isBn ? 'বকেয়া টাকা' : 'Unpaid Due'}
                              </div>
                              <div className="text-lg font-bold text-rose-600 font-mono tabular-nums">
                                {formatBDT(item.outstandingPoisha, lang)}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70">
                            <button
                              onClick={() => {
                                setColTenantId(item.tenant.id);
                                setColAmountTaka(
                                  String(item.outstandingPoisha / 100)
                                );
                                setActiveTab('COLLECTION');
                              }}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <CreditCard className="w-4 h-4" />
                              <span>{isBn ? 'ভাড়া জমা নিন' : 'Collect Rent'}</span>
                            </button>

                            <button
                              onClick={() =>
                                handleSendReminder(
                                  item.eventKey,
                                  item.tenant.primaryPhone,
                                  isBn ? item.messageBn : item.messageEn,
                                  'WHATSAPP'
                                )
                              }
                              className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5 text-emerald-600" />
                              <span>WhatsApp</span>
                            </button>

                            <button
                              onClick={() =>
                                handleSendReminder(
                                  item.eventKey,
                                  item.tenant.primaryPhone,
                                  isBn ? item.messageBn : item.messageEn,
                                  'SMS'
                                )
                              }
                              className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                            >
                              <Phone className="w-3.5 h-3.5 text-slate-600" />
                              <span>SMS</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right 6 Cols: Building-Wise Summary Cards */}
                <div className="lg:col-span-6 rounded-2xl bg-white border border-slate-200/90 p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        {isBn ? 'ভবনভিত্তিক হিসাব সংক্ষেপ' : 'Building Summary'}
                      </h2>
                      <p className="text-sm text-slate-500 mt-0.5">
                        {isBn
                          ? 'কোন ভবনে কত আদায় ও কত বকেয়া আছে'
                          : 'Collection and dues for each property'}
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveTab('BUILDINGS')}
                      className="text-sm font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isBn ? 'ফ্ল্যাট দেখুন' : 'View Flats'}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {summary.buildingBreakdown.map((b) => {
                      const bUnits = db.units.filter(
                        (u) => u.buildingId === b.buildingId
                      );
                      const occCount = bUnits.filter(
                        (u) => u.status === 'OCCUPIED'
                      ).length;
                      return (
                        <div
                          key={b.buildingId}
                          className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-base font-bold text-slate-900">
                                {b.buildingName}
                              </h3>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {isBn
                                  ? `মোট ${toBengaliDigits(bUnits.length)}টি ফ্ল্যাট · ${toBengaliDigits(occCount)}টিতে ভাড়াটিয়া আছেন`
                                  : `${occCount} of ${bUnits.length} flats occupied`}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setBuildingFilter(b.buildingId);
                                setActiveTab('BUILDINGS');
                              }}
                              className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                            >
                              {isBn ? 'বিস্তারিত' : 'Manage'}
                            </button>
                          </div>

                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200/70 text-sm">
                            <div>
                              <div className="text-xs text-slate-500">
                                {isBn ? 'আদায় হয়েছে' : 'Collected'}
                              </div>
                              <div className="font-bold font-mono text-emerald-700 mt-0.5">
                                {formatBDT(b.collectedPoisha, lang)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">
                                {isBn ? 'বকেয়া আছে' : 'Unpaid'}
                              </div>
                              <div className="font-bold font-mono text-rose-600 mt-0.5">
                                {formatBDT(b.outstandingPoisha, lang)}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">
                                {isBn ? 'ভবনের খরচ' : 'Expenses'}
                              </div>
                              <div className="font-bold font-mono text-slate-800 mt-0.5">
                                {formatBDT(b.expensesPoisha, lang)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Recent Payments & Instant Receipt Cards */}
              <div className="rounded-2xl bg-white border border-slate-200/90 p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {isBn
                        ? 'সাম্প্রতিক ভাড়া আদায় ও রসিদ'
                        : 'Recent Rent Payments & Receipts'}
                    </h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {isBn
                        ? 'যেকোনো পেমেন্টের রসিদ দেখতে বা ডাউনলোড করতে "রসিদ দেখুন" বাটনে চাপুন'
                        : 'Tap "View Receipt" to print, download PDF/Image, or share on WhatsApp'}
                    </p>
                  </div>
                </div>

                {db.payments.length === 0 ? (
                  <div className="text-sm text-slate-500 py-8 text-center bg-slate-50 rounded-2xl border border-slate-200/60">
                    {isBn
                      ? 'এখনো কোনো ভাড়া আদায় রেকর্ড করা হয়নি।'
                      : 'No payments recorded yet.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {db.payments.slice(0, 6).map((p) => {
                      const t = db.tenants.find((x) => x.id === p.tenantId);
                      const b = db.buildings.find((x) => x.id === p.buildingId);
                      const u = db.units.find((x) => x.id === p.unitId);
                      return (
                        <div
                          key={p.id}
                          className="p-4 rounded-2xl bg-slate-50/90 border border-slate-200/90 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-base font-bold text-slate-900 truncate">
                              {t?.fullName}{' '}
                              <span className="text-sm font-medium text-slate-500">
                                ({u?.unitNumber})
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-1 font-mono">
                              #{p.receiptNumber} · {p.paymentDate} · {p.method}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <div className="text-base font-bold font-mono text-emerald-700">
                                {formatBDT(p.amountReceivedPoisha, lang)}
                              </div>
                            </div>
                            {t && b && u && (
                              <button
                                onClick={() =>
                                  setReceiptModalCtx({
                                    payment: p,
                                    tenant: t,
                                    building: b,
                                    unit: u,
                                    settings: db.settings,
                                    lang,
                                  })
                                }
                                className="px-3.5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-100 text-slate-900 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                              >
                                <Receipt className="w-4 h-4 text-emerald-600" />
                                <span>{isBn ? 'রসিদ দেখুন' : 'Receipt'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

        {/* ==================== 2. BUILDINGS, FLOORS & UNITS (VISUAL CARDS + MODAL FORMS) ==================== */}
        {activeTab === 'BUILDINGS' && (
          <div className="space-y-6">
            {/* Clean Section Header with Action Buttons */}
            <div className="rounded-3xl bg-white border border-slate-200/90 p-6 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {isBn
                    ? 'ভবন ও ফ্ল্যাট ব্যবস্থাপনা'
                    : 'Buildings & Flats Overview'}
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  {isBn
                    ? 'কোন ফ্ল্যাটে কে আছেন এবং কোন ফ্ল্যাট খালি আছে তা এক নজরে দেখুন।'
                    : 'See occupied and vacant flats at a glance. Click any button to add a flat or building.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={() => setActiveBldModal('UNIT')}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isBn ? 'নতুন ফ্ল্যাট যোগ করুন' : 'Add Flat'}</span>
                </button>
                <button
                  onClick={() => setActiveBldModal('FLOOR')}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-slate-600" />
                  <span>{isBn ? 'নতুন তলা' : 'Add Floor'}</span>
                </button>
                <button
                  onClick={() => setActiveBldModal('BUILDING')}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Building2 className="w-4 h-4" />
                  <span>{isBn ? 'নতুন ভবন' : 'Add Building'}</span>
                </button>
              </div>
            </div>

            {/* Collapsible / Modal Form when User Clicks Add Flat / Floor / Building */}
            {activeBldModal !== 'NONE' && (
              <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-5">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="text-lg font-bold text-slate-900">
                      {activeBldModal === 'BUILDING' &&
                        (isBn ? 'নতুন ভবন যোগ করুন' : 'Add New Building')}
                      {activeBldModal === 'FLOOR' &&
                        (isBn ? 'ভবনে নতুন তলা যোগ করুন' : 'Add Floor to Building')}
                      {activeBldModal === 'UNIT' &&
                        (isBn ? 'নতুন ফ্ল্যাট / ইউনিট যোগ করুন' : 'Add New Rental Flat')}
                    </h2>
                    <button
                      onClick={() => setActiveBldModal('NONE')}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {activeBldModal === 'BUILDING' && (
                    <form onSubmit={handleAddBuilding} className="space-y-4 text-sm">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1.5">
                          {isBn ? 'ভবনের নাম *' : 'Building Name *'}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder={isBn ? 'যেমন: গ্রীন ভিউ ভিলা' : 'e.g. Green View Villa'}
                          value={newBldName}
                          onChange={(e) => setNewBldName(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1.5">
                          {isBn ? 'ভবনের ঠিকানা *' : 'Full Address *'}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="House 12, Road 5, Mirpur-10, Dhaka"
                          value={newBldAddress}
                          onChange={(e) => setNewBldAddress(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1.5">
                            {isBn ? 'ভাড়া পরিশোধের তারিখ' : 'Default Due Day'}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={28}
                            value={newBldDueDay}
                            onChange={(e) => setNewBldDueDay(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1.5">
                            {isBn ? 'মন্তব্য (ঐচ্ছিক)' : 'Notes'}
                          </label>
                          <input
                            type="text"
                            value={newBldNotes}
                            onChange={(e) => setNewBldNotes(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveBldModal('NONE')}
                          className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm cursor-pointer"
                        >
                          {isBn ? 'বাতিল' : 'Cancel'}
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm cursor-pointer"
                        >
                          {isBn ? 'ভবন সংরক্ষণ করুন' : 'Save Building'}
                        </button>
                      </div>
                    </form>
                  )}

                  {activeBldModal === 'FLOOR' && (
                    <form onSubmit={handleAddFloor} className="space-y-4 text-sm">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1.5">
                          {isBn ? 'ভবন নির্বাচন করুন *' : 'Select Building *'}
                        </label>
                        <select
                          value={newFloorBldId}
                          onChange={(e) => setNewFloorBldId(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                        >
                          {db.buildings.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1.5">
                          {isBn ? 'তলার নাম বা নম্বর *' : 'Floor Name or Number *'}
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 3rd Floor (৪র্থ তলা)"
                          value={newFloorName}
                          onChange={(e) => setNewFloorName(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveBldModal('NONE')}
                          className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm cursor-pointer"
                        >
                          {isBn ? 'বাতিল' : 'Cancel'}
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm cursor-pointer"
                        >
                          {isBn ? 'তলা যুক্ত করুন' : 'Save Floor'}
                        </button>
                      </div>
                    </form>
                  )}

                  {activeBldModal === 'UNIT' && (
                    <form onSubmit={handleAddUnit} className="space-y-4 text-sm">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1.5">
                            {isBn ? 'ভবন *' : 'Building *'}
                          </label>
                          <select
                            value={newUnitBldId}
                            onChange={(e) => setNewUnitBldId(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                          >
                            {db.buildings.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1.5">
                            {isBn ? 'তলা' : 'Floor'}
                          </label>
                          <select
                            value={newUnitFloorId}
                            onChange={(e) => setNewUnitFloorId(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
                          >
                            {db.floors
                              .filter((f) => f.buildingId === newUnitBldId)
                              .map((f) => (
                                <option key={f.id} value={f.id}>
                                  {f.nameOrNumber}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1.5">
                            {isBn ? 'ফ্ল্যাট নম্বর *' : 'Flat Number *'}
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Flat 3A"
                            value={newUnitNum}
                            onChange={(e) => setNewUnitNum(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1.5">
                            {isBn ? 'বেডরুম সংখ্যা' : 'Bedrooms'}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={newUnitBeds}
                            onChange={(e) => setNewUnitBeds(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1.5">
                            {isBn ? 'মাসিক ভাড়া (৳) *' : 'Monthly Rent (BDT) *'}
                          </label>
                          <input
                            type="number"
                            required
                            value={newUnitRentTaka}
                            onChange={(e) => setNewUnitRentTaka(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono font-bold"
                          />
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1.5">
                            {isBn ? 'সার্ভিস চার্জ (৳)' : 'Service Charge (BDT)'}
                          </label>
                          <input
                            type="number"
                            value={newUnitScTaka}
                            onChange={(e) => setNewUnitScTaka(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setActiveBldModal('NONE')}
                          className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-semibold text-sm cursor-pointer"
                        >
                          {isBn ? 'বাতিল' : 'Cancel'}
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm cursor-pointer"
                        >
                          {isBn ? 'ফ্ল্যাট সংরক্ষণ করুন' : 'Save Flat'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* Visual Building & Flat Cards (Easy to Read & Operate) */}
            {db.buildings.map((b) => {
              const bUnits = db.units.filter((u) => u.buildingId === b.id);
              const occCount = bUnits.filter(
                (u) => u.status === 'OCCUPIED'
              ).length;
              return (
                <div
                  key={b.id}
                  className="rounded-3xl bg-white border border-slate-200/90 p-6 shadow-2xs space-y-5"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-lg font-bold text-slate-900">
                          {b.name}
                        </h3>
                        <span className="px-3 py-1 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold">
                          {isBn
                            ? `${toBengaliDigits(occCount)}/${toBengaliDigits(bUnits.length)} ভাড়া দেওয়া`
                            : `${occCount}/${bUnits.length} Occupied`}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">
                        {b.address} ·{' '}
                        {isBn
                          ? `ভাড়া পরিশোধের তারিখ: প্রতি মাসের ${toBengaliDigits(b.defaultDueDay)} তারিখ`
                          : `Due Date: Day ${b.defaultDueDay} of month`}
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setNewUnitBldId(b.id);
                        setActiveBldModal('UNIT');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold self-start sm:self-auto flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4 text-emerald-600" />
                      <span>{isBn ? 'এই ভবনে ফ্ল্যাট যোগ' : 'Add Flat Here'}</span>
                    </button>
                  </div>

                  {/* Grid of Visual Flat Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {bUnits.map((u) => {
                      const occTenant = db.tenants.find(
                        (t) =>
                          t.currentUnitId === u.id && t.status === 'ACTIVE'
                      );
                      const isOccupied = u.status === 'OCCUPIED' && !!occTenant;

                      return (
                        <div
                          key={u.id}
                          className={`rounded-2xl p-5 border transition-all flex flex-col justify-between gap-4 ${
                            isOccupied
                              ? 'bg-white border-emerald-200/90 shadow-2xs'
                              : 'bg-amber-50/40 border-amber-200/90'
                          }`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-lg font-bold text-slate-900">
                                  {u.unitNumber}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {u.unitType} · {u.bedrooms}{' '}
                                  {isBn ? 'বেডরুম' : 'Bed'}
                                </div>
                              </div>

                              <select
                                aria-label="Unit Status"
                                value={u.status}
                                onChange={(e) =>
                                  commitDb((d) => {
                                    const du = d.units.find(
                                      (x) => x.id === u.id
                                    );
                                    if (du)
                                      du.status = e.target.value as UnitStatus;
                                    return d;
                                  })
                                }
                                className={`rounded-xl px-2.5 py-1 text-xs font-bold border ${
                                  u.status === 'OCCUPIED'
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : 'bg-amber-100/80 text-amber-900 border-amber-300'
                                }`}
                              >
                                <option value="OCCUPIED">
                                  {isBn ? 'ভাড়া দেওয়া' : 'Occupied'}
                                </option>
                                <option value="VACANT">
                                  {isBn ? 'খালি আছে' : 'Vacant'}
                                </option>
                                <option value="MAINTENANCE">
                                  {isBn ? 'মেরামত চলছে' : 'Maintenance'}
                                </option>
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-sm">
                              <div>
                                <div className="text-xs text-slate-500">
                                  {isBn ? 'নির্ধারিত ভাড়া' : 'Monthly Rent'}
                                </div>
                                <div className="font-bold font-mono text-slate-900">
                                  {formatBDT(u.defaultRentPoisha, lang)}
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500">
                                  {isBn ? 'সার্ভিস চার্জ' : 'Service Charge'}
                                </div>
                                <div className="font-bold font-mono text-slate-700">
                                  {formatBDT(u.serviceChargePoisha, lang)}
                                </div>
                              </div>
                            </div>

                            {occTenant ? (
                              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80">
                                <div className="text-xs text-slate-500">
                                  {isBn ? 'বর্তমান ভাড়াটিয়া' : 'Current Tenant'}
                                </div>
                                <div className="text-sm font-bold text-slate-900 mt-0.5">
                                  {occTenant.fullName}
                                </div>
                                <div className="text-xs font-mono text-slate-600">
                                  {occTenant.primaryPhone}
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 rounded-xl bg-white/80 border border-amber-200/70 text-xs text-amber-900 font-medium">
                                {isBn
                                  ? 'এই ফ্ল্যাটে বর্তমানে কোনো ভাড়াটিয়া নেই।'
                                  : 'No active tenant assigned to this flat.'}
                              </div>
                            )}
                          </div>

                          <div className="pt-1">
                            {occTenant ? (
                              <button
                                onClick={() => {
                                  setColTenantId(occTenant.id);
                                  setActiveTab('COLLECTION');
                                }}
                                className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <CreditCard className="w-4 h-4" />
                                <span>
                                  {isBn ? 'ভাড়া আদায় করুন' : 'Collect Rent'}
                                </span>
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  setTBuildingId(b.id);
                                  setTUnitId(u.id);
                                  setTRentTaka(
                                    String(u.defaultRentPoisha / 100)
                                  );
                                  setShowAddTenantForm(true);
                                  setActiveTab('TENANTS');
                                }}
                                className="w-full py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <UserPlus className="w-4 h-4" />
                                <span>
                                  {isBn
                                    ? '+ ভাড়াটিয়া যুক্ত করুন'
                                    : '+ Assign Tenant'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ==================== 3. TENANTS & SECURITY DEPOSITS (CLEAN CARDS + MODAL) ==================== */}
        {activeTab === 'TENANTS' && (
          <div className="space-y-6">
            {/* Header Banner */}
            <div className="rounded-3xl bg-white border border-slate-200/90 p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {isBn
                    ? 'ভাড়াটিয়া তালিকা ও জামানত হিসাব'
                    : 'Tenants & Security Deposits'}
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  {isBn
                    ? 'ভাড়াটিয়ার মোবাইল নম্বর, মাসিক ভাড়া, বকেয়া এবং জামানত এক নজরে দেখুন।'
                    : 'Manage tenant profiles, security deposits, and monthly rent easily.'}
                </p>
              </div>
              <button
                onClick={() => setShowAddTenantForm((s) => !s)}
                className="px-5 py-3 text-sm font-bold text-white bg-emerald-600 rounded-2xl hover:bg-emerald-700 flex items-center gap-2 whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>
                  {showAddTenantForm
                    ? isBn
                      ? 'ফর্ম বন্ধ করুন'
                      : 'Close Form'
                    : isBn
                    ? '+ নতুন ভাড়াটিয়া যোগ করুন'
                    : '+ Add New Tenant'}
                </span>
              </button>
            </div>

            {/* Add Tenant Modal / Form */}
            {showAddTenantForm && (
              <form
                onSubmit={handleRegisterTenant}
                className="rounded-3xl bg-white border-2 border-emerald-500/30 p-6 shadow-lg space-y-5"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-lg font-bold text-slate-900">
                    {isBn
                      ? 'নতুন ভাড়াটিয়া নিবন্ধন ফর্ম'
                      : 'Register New Tenant'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowAddTenantForm(false)}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      {isBn ? 'ভাড়াটিয়ার পূর্ণ নাম *' : 'Full Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isBn ? 'যেমন: মো: কামরুল হাসান' : 'Full Name'}
                      value={tFullName}
                      onChange={(e) => setTFullName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      {isBn ? 'মোবাইল নম্বর *' : 'Mobile Number *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="017XXXXXXXX"
                      value={tPhone}
                      onChange={(e) => setTPhone(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      {isBn ? 'জাতীয় পরিচয়পত্র (NID) নম্বর *' : 'NID Number *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="NID Number"
                      value={tNid}
                      onChange={(e) => setTNid(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      {isBn ? 'ভবন নির্বাচন *' : 'Select Building *'}
                    </label>
                    <select
                      value={tBuildingId}
                      onChange={(e) => {
                        setTBuildingId(e.target.value);
                        const firstU = db.units.find(
                          (u) => u.buildingId === e.target.value
                        );
                        if (firstU) setTUnitId(firstU.id);
                      }}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                    >
                      {db.buildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      {isBn ? 'ফ্ল্যাট নির্বাচন *' : 'Select Flat *'}
                    </label>
                    <select
                      value={tUnitId}
                      onChange={(e) => setTUnitId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                    >
                      <option value="">
                        {isBn ? '-- ফ্ল্যাট বেছে নিন --' : '-- Select Flat --'}
                      </option>
                      {db.units
                        .filter((u) => u.buildingId === tBuildingId)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.unitNumber} ({u.status})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      {isBn ? 'মাসিক ভাড়া (৳) *' : 'Monthly Rent (BDT) *'}
                    </label>
                    <input
                      type="number"
                      required
                      value={tRentTaka}
                      onChange={(e) => setTRentTaka(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      {isBn ? 'জামানত / অ্যাডভান্স (৳) *' : 'Security Deposit (BDT) *'}
                    </label>
                    <input
                      type="number"
                      required
                      value={tDepositTaka}
                      onChange={(e) => setTDepositTaka(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      {isBn ? 'বাসায় ওঠার তারিখ *' : 'Move-In Date *'}
                    </label>
                    <input
                      type="date"
                      required
                      value={tMoveInDate}
                      onChange={(e) => setTMoveInDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      {isBn ? 'পেশা ও কর্মস্থল' : 'Occupation'}
                    </label>
                    <input
                      type="text"
                      value={tOccupation}
                      onChange={(e) => setTOccupation(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      {isBn ? 'স্থায়ী ঠিকানা' : 'Permanent Address'}
                    </label>
                    <input
                      type="text"
                      value={tPermAddress}
                      onChange={(e) => setTPermAddress(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      {isBn ? 'জরুরি যোগাযোগ নম্বর' : 'Emergency Contact'}
                    </label>
                    <input
                      type="text"
                      value={tEmergency}
                      onChange={(e) => setTEmergency(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1.5">
                      {isBn ? 'ছবি বা চুক্তিপত্র ফাইল (ঐচ্ছিক)' : 'Photo / Agreement'}
                    </label>
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        setTAgreementName(f.name);
                        const r = new FileReader();
                        r.onload = () =>
                          setTPhotoDataUrl(String(r.result || ''));
                        r.readAsDataURL(f);
                      }}
                      className="w-full text-xs text-slate-600 pt-1.5"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddTenantForm(false)}
                    className="px-5 py-2.5 rounded-xl bg-slate-100 text-sm font-semibold text-slate-700 cursor-pointer"
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700 cursor-pointer"
                  >
                    {isBn ? 'ভাড়াটিয়া সংরক্ষণ করুন' : 'Save Tenant'}
                  </button>
                </div>
              </form>
            )}

            {/* Deposit & Rent Adjustment Modal (Opens only when requested on a Tenant Card) */}
            {showDepositModal && (
              <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="text-lg font-bold text-slate-900">
                      {isBn
                        ? 'জামানত ও মাসিক ভাড়া পরিবর্তন'
                        : 'Manage Deposit & Monthly Rent'}
                    </h2>
                    <button
                      onClick={() => setShowDepositModal(false)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Part 1: Modify Monthly Rent */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <h3 className="text-sm font-bold text-slate-900">
                      {isBn
                        ? '১. মাসিক ভাড়া পরিবর্তন করুন'
                        : '1. Change Monthly Rent'}
                    </h3>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        placeholder={isBn ? 'নতুন ভাড়া (৳)' : 'New Rent (BDT)'}
                        value={newMonthlyRentTaka}
                        onChange={(e) => setNewMonthlyRentTaka(e.target.value)}
                        className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-mono font-bold"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateTenantFutureRent(selectedTenantForDeposit)
                        }
                        className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 cursor-pointer"
                      >
                        {isBn ? 'ভাড়া আপডেট' : 'Update Rent'}
                      </button>
                    </div>
                  </div>

                  {/* Part 2: Security Deposit / Advance Ledger */}
                  <form
                    onSubmit={handleDepositTransaction}
                    className="space-y-4 text-sm pt-2 border-t border-slate-100"
                  >
                    <h3 className="text-sm font-bold text-slate-900">
                      {isBn
                        ? '২. জামানত গ্রহণ, কর্তন বা ফেরত'
                        : '2. Security Deposit Transaction'}
                    </h3>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        {isBn ? 'ভাড়াটিয়া' : 'Tenant'}
                      </label>
                      <select
                        value={selectedTenantForDeposit}
                        onChange={(e) =>
                          setSelectedTenantForDeposit(e.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                      >
                        {db.tenants.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.fullName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        {isBn ? 'লেনদেনের ধরন' : 'Transaction Type'}
                      </label>
                      <select
                        value={depTxType}
                        onChange={(e) =>
                          setDepTxType(e.target.value as DepositTxType)
                        }
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                      >
                        <option value="DEPOSIT_COLLECTED">
                          {isBn ? 'জামানত জমা নেওয়া' : 'Deposit Received'}
                        </option>
                        <option value="DEPOSIT_DEDUCTION">
                          {isBn ? 'জামানত হতে ক্ষতিপূরণ/বকেয়া কর্তন' : 'Deposit Deduction'}
                        </option>
                        <option value="DEPOSIT_REFUND">
                          {isBn ? 'জামানত ফেরত দেওয়া' : 'Deposit Refund'}
                        </option>
                        <option value="ADVANCE_COLLECTED">
                          {isBn ? 'অগ্রিম ভাড়া জমা' : 'Advance Rent Collected'}
                        </option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        {isBn ? 'টাকার পরিমাণ (৳) *' : 'Amount (BDT) *'}
                      </label>
                      <input
                        type="number"
                        required
                        value={depTxAmountTaka}
                        onChange={(e) => setDepTxAmountTaka(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        {isBn ? 'কারণ বা নোট *' : 'Reason / Note *'}
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={
                          isBn
                            ? 'যেমন: বাসা ছাড়ার সময় রং করার খরচ কর্তন'
                            : 'e.g. Wall repainting deduction'
                        }
                        value={depTxReason}
                        onChange={(e) => setDepTxReason(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full py-3 px-4 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 cursor-pointer"
                    >
                      {isBn ? 'জামানত হিসাব সংরক্ষণ করুন' : 'Save Deposit Record'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Search & Filter Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder={
                    isBn
                      ? 'ভাড়াটিয়ার নাম বা মোবাইল নম্বর দিয়ে খুঁজুন...'
                      : 'Search tenant by name or phone...'
                  }
                  value={tenantSearch}
                  onChange={(e) => setTenantSearch(e.target.value)}
                  className="w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 py-2.5 text-sm shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-1.5 p-1.5 bg-white border border-slate-200 rounded-2xl">
                {(['ACTIVE', 'ARCHIVED', 'ALL'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setTenantStatusFilter(st)}
                    className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-xl transition-colors cursor-pointer ${
                      tenantStatusFilter === st
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {st === 'ACTIVE'
                      ? isBn
                        ? 'বর্তমান ভাড়াটিয়া'
                        : 'Active'
                      : st === 'ARCHIVED'
                      ? isBn
                        ? 'পূর্বের ভাড়াটিয়া'
                        : 'Archived'
                      : isBn
                      ? 'সকল'
                      : 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* Spacious 2-Column Grid of Friendly Tenant Profile Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {db.tenants
                .filter((t) =>
                  tenantStatusFilter === 'ALL'
                    ? true
                    : t.status === tenantStatusFilter
                )
                .filter(
                  (t) =>
                    !tenantSearch.trim() ||
                    t.fullName
                      .toLowerCase()
                      .includes(tenantSearch.toLowerCase()) ||
                    t.primaryPhone.includes(tenantSearch)
                )
                .map((t) => {
                  const b = db.buildings.find(
                    (x) => x.id === t.currentBuildingId
                  );
                  const u = db.units.find((x) => x.id === t.currentUnitId);
                  const depSummary = calculateTenantDepositBalance(
                    t.id,
                    db.depositTransactions
                  );
                  const unpaid = getTenantUnpaidObligations(
                    t.id,
                    db.rentCharges,
                    db.utilityBills
                  ).reduce((s, o) => s + o.outstandingPoisha, 0);

                  return (
                    <div
                      key={t.id}
                      className="rounded-3xl bg-white border border-slate-200/90 p-6 shadow-2xs flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 font-bold text-lg flex items-center justify-center shrink-0">
                              {t.fullName.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-slate-900">
                                {t.fullName}
                              </h3>
                              <div className="text-sm text-slate-600 mt-0.5 flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg">
                                  {u?.unitNumber}
                                </span>
                                <span>·</span>
                                <span>{b?.name}</span>
                              </div>
                            </div>
                          </div>

                          <span
                            className={`px-3 py-1 rounded-xl text-xs font-bold ${
                              t.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {t.status === 'ACTIVE'
                              ? isBn
                                ? 'সক্রিয়'
                                : 'Active'
                              : isBn
                              ? 'আর্কাইভ'
                              : 'Archived'}
                          </span>
                        </div>

                        {/* Phone & Move-in Info */}
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600 bg-slate-50 px-4 py-2.5 rounded-2xl">
                          <span className="font-mono font-semibold text-slate-800">
                            📞 {t.primaryPhone}
                          </span>
                          <span className="text-xs text-slate-500">
                            {isBn ? 'ওঠার তারিখ:' : 'Move-In:'} {t.moveInDate}
                          </span>
                        </div>

                        {/* 3 Clear Financial Boxes */}
                        <div className="grid grid-cols-3 gap-2.5 text-center">
                          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                            <div className="text-xs text-slate-500">
                              {isBn ? 'মাসিক ভাড়া' : 'Monthly Rent'}
                            </div>
                            <div className="text-sm sm:text-base font-bold font-mono text-slate-900 mt-1">
                              {formatBDT(t.monthlyRentPoisha, lang)}
                            </div>
                          </div>

                          <div
                            className={`p-3 rounded-2xl border ${
                              unpaid > 0
                                ? 'bg-rose-50/70 border-rose-200'
                                : 'bg-emerald-50/70 border-emerald-200'
                            }`}
                          >
                            <div className="text-xs text-slate-600">
                              {isBn ? 'বর্তমান বকেয়া' : 'Unpaid Due'}
                            </div>
                            <div
                              className={`text-sm sm:text-base font-bold font-mono mt-1 ${
                                unpaid > 0
                                  ? 'text-rose-600'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {formatBDT(unpaid, lang)}
                            </div>
                          </div>

                          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                            <div className="text-xs text-slate-500">
                              {isBn ? 'গচ্ছিত জামানত' : 'Held Deposit'}
                            </div>
                            <div className="text-sm sm:text-base font-bold font-mono text-slate-900 mt-1">
                              {formatBDT(depSummary.heldBalancePoisha, lang)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Clear Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
                        <button
                          onClick={() => {
                            setColTenantId(t.id);
                            if (unpaid > 0) {
                              setColAmountTaka(String(unpaid / 100));
                            }
                            setActiveTab('COLLECTION');
                          }}
                          className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>{isBn ? 'ভাড়া আদায়' : 'Collect Rent'}</span>
                        </button>

                        <button
                          onClick={() => {
                            setSelectedTenantForDeposit(t.id);
                            setNewMonthlyRentTaka(
                              String(t.monthlyRentPoisha / 100)
                            );
                            setShowDepositModal(true);
                          }}
                          className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-bold cursor-pointer"
                        >
                          {isBn ? 'জামানত / ভাড়া পরিবর্তন' : 'Deposit & Rent'}
                        </button>

                        {t.status === 'ACTIVE' ? (
                          <button
                            onClick={() =>
                              handleArchiveOrRestoreTenant(t.id, true)
                            }
                            className="py-2.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>{isBn ? 'বাসা ছেড়েছেন' : 'Move Out'}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() =>
                                handleArchiveOrRestoreTenant(t.id, false)
                              }
                              className="py-2 px-3 rounded-xl bg-slate-100 text-slate-800 text-xs font-bold cursor-pointer"
                            >
                              {isBn ? 'সক্রিয় করুন' : 'Restore'}
                            </button>
                            <button
                              onClick={() =>
                                handleDeleteTenantPermanently(t.id)
                              }
                              className="py-2 px-2.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* ==================== 4. RENT COLLECTION & RECEIPTS (STEP-BY-STEP FRIENDLY FLOW) ==================== */}
        {activeTab === 'COLLECTION' && (
          <div className="space-y-6">
            <div className="rounded-3xl bg-white border border-slate-200/90 p-6 shadow-2xs">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {isBn
                  ? 'সহজ ভাড়া ও বিল আদায় এবং রসিদ তৈরি'
                  : 'Rent Collection & Instant Receipt'}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {isBn
                  ? 'ভাড়াটিয়া নির্বাচন করুন, টাকার পরিমাণ বসান এবং এক ক্লিকে রসিদ ডাউনলোড বা WhatsApp-এ পাঠান।'
                  : 'Select tenant, enter amount received, and generate an official bilingual receipt immediately.'}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 7 Cols: Step-by-Step Collection Form */}
              <form
                onSubmit={handleRecordPayment}
                className="lg:col-span-7 rounded-3xl bg-white border border-slate-200/90 p-6 sm:p-7 shadow-2xs space-y-6"
              >
                {/* Step 1: Select Tenant */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-800">
                    {isBn
                      ? '১. কোন ফ্ল্যাটের ভাড়াটিয়া হতে টাকা নিচ্ছেন? *'
                      : '1. Select Tenant & Flat *'}
                  </label>
                  <select
                    value={colTenantId}
                    onChange={(e) => setColTenantId(e.target.value)}
                    className="w-full rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-3.5 text-base font-bold text-slate-900"
                  >
                    {db.tenants.map((t) => {
                      const u = db.units.find((x) => x.id === t.currentUnitId);
                      return (
                        <option key={t.id} value={t.id}>
                          {u?.unitNumber} — {t.fullName} ({t.primaryPhone})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Unpaid Obligations Box with 1-Tap Fill */}
                <div className="rounded-2xl bg-slate-50 border border-slate-200/90 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-bold text-slate-800">
                      {isBn
                        ? 'এই ভাড়াটিয়ার অপরিশোধিত হিসাব:'
                        : 'Unpaid Rent & Bills:'}
                    </span>
                    {unpaidObligations.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const sumTaka =
                            unpaidObligations.reduce(
                              (s, o) => s + o.outstandingPoisha,
                              0
                            ) / 100;
                          setColAmountTaka(String(sumTaka));
                        }}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-bold hover:bg-emerald-700 cursor-pointer"
                      >
                        {isBn
                          ? 'সম্পূর্ণ বকেয়া টাকা বসান'
                          : 'Fill Full Due Amount'}
                      </button>
                    )}
                  </div>

                  {unpaidObligations.length === 0 ? (
                    <div className="text-sm text-emerald-800 bg-emerald-50/80 border border-emerald-200 rounded-xl p-3 font-medium">
                      {isBn
                        ? 'এই ভাড়াটিয়ার কোনো বকেয়া নেই। এখন টাকা জমা নিলে তা অগ্রিম (Advance Credit) হিসেবে জমা থাকবে।'
                        : 'No unpaid dues! Any payment recorded will be stored as Advance Credit.'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {unpaidObligations.map((ob) => (
                        <div
                          key={ob.targetId}
                          className="flex items-center justify-between gap-3 bg-white px-4 py-3 rounded-xl border border-slate-200 text-sm"
                        >
                          <div>
                            <div className="font-bold text-slate-900">
                              {ob.label}
                            </div>
                            <div className="text-xs text-slate-500 font-mono">
                              {isBn ? 'মোট:' : 'Total:'}{' '}
                              {formatBDT(ob.totalPoisha, lang)} ·{' '}
                              {isBn ? 'জমা:' : 'Paid:'}{' '}
                              {formatBDT(ob.paidPoisha, lang)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-base text-rose-600">
                              {formatBDT(ob.outstandingPoisha, lang)}
                            </span>
                            {colMode === 'CUSTOM' && (
                              <input
                                type="number"
                                placeholder="৳"
                                value={colCustomMapTaka[ob.targetId] || ''}
                                onChange={(e) =>
                                  setColCustomMapTaka((prev) => ({
                                    ...prev,
                                    [ob.targetId]: e.target.value,
                                  }))
                                }
                                className="w-28 rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-mono text-right"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Step 2: Enter Amount Received */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-800">
                    {isBn
                      ? '২. কত টাকা জমা নিচ্ছেন (৳)? *'
                      : '2. Amount Received (BDT) *'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder={isBn ? 'টাকার পরিমাণ লিখুন (যেমন: ২৪০০০)' : 'Enter amount e.g. 24000'}
                    value={colAmountTaka}
                    onChange={(e) => setColAmountTaka(e.target.value)}
                    className="w-full rounded-2xl border-2 border-emerald-500/60 bg-white px-4 py-3.5 text-xl font-mono font-bold text-slate-900 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {/* Step 3: Visual Payment Method Selector */}
                <div className="space-y-2">
                  <label className="block text-sm font-bold text-slate-800">
                    {isBn
                      ? '৩. কীভাবে টাকা পেয়েছেন? *'
                      : '3. Payment Method *'}
                  </label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {(
                      [
                        ['CASH', isBn ? 'নগদ ক্যাশ' : 'Cash'],
                        ['BKASH', 'bKash'],
                        ['NAGAD', 'Nagad'],
                        ['ROCKET', 'Rocket'],
                        ['BANK', isBn ? 'ব্যাংক' : 'Bank'],
                        ['ADVANCE_APPLIED', isBn ? 'অগ্রিম সমন্বয়' : 'Advance'],
                      ] as [PaymentMethod, string][]
                    ).map(([mKey, mLabel]) => (
                      <button
                        key={mKey}
                        type="button"
                        onClick={() => setColMethod(mKey)}
                        className={`py-2.5 px-2 rounded-xl text-xs sm:text-sm font-bold border transition-all cursor-pointer ${
                          colMethod === mKey
                            ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {mLabel}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Reference, Notes & Allocation Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm pt-2 border-t border-slate-100">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {isBn
                        ? 'বিকাশ / ব্যাংক ট্রানজেকশন নম্বর (ঐচ্ছিক)'
                        : 'TrxID / Check Ref (Optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BK981234X"
                      value={colRef}
                      onChange={(e) => setColRef(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {isBn ? 'রসিদে মন্তব্য (ঐচ্ছিক)' : 'Receipt Note (Optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder={isBn ? 'যেমন: মার্চ মাসের ভাড়া' : 'Optional note'}
                      value={colNotes}
                      onChange={(e) => setColNotes(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>{isBn ? 'বকেয়া সমন্বয়ের নিয়ম:' : 'Allocation Mode:'}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setColMode('FIFO')}
                      className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                        colMode === 'FIFO'
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isBn ? 'স্বয়ংক্রিয় (পুরাতন বকেয়া আগে)' : 'Auto (Oldest First)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setColMode('CUSTOM')}
                      className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                        colMode === 'CUSTOM'
                          ? 'bg-slate-800 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isBn ? 'নিজের মতো ভাগ' : 'Custom Split'}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-4 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Receipt className="w-5 h-5" />
                  <span>
                    {isBn
                      ? 'ভাড়া জমা নিন ও রসিদ দেখুন'
                      : 'Save Payment & View Receipt'}
                  </span>
                </button>
              </form>

              {/* Right 5 Cols: Recent Receipts History */}
              <div className="lg:col-span-5 rounded-3xl bg-white border border-slate-200/90 p-6 shadow-2xs space-y-4">
                <h2 className="text-lg font-bold text-slate-900">
                  {isBn
                    ? 'পূর্ববর্তী আদায় ও রসিদ তালিকা'
                    : 'Payment & Receipt History'}
                </h2>
                <div className="space-y-3 max-h-[680px] overflow-y-auto pr-1">
                  {db.payments.map((p) => {
                    const t = db.tenants.find((x) => x.id === p.tenantId);
                    const b = db.buildings.find((x) => x.id === p.buildingId);
                    const u = db.units.find((x) => x.id === p.unitId);
                    return (
                      <div
                        key={p.id}
                        className={`p-4 rounded-2xl border ${
                          p.isReversed
                            ? 'bg-rose-50/40 border-rose-200 opacity-75'
                            : 'bg-slate-50 border-slate-200/90'
                        } space-y-3 text-sm`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-slate-900 text-base">
                              {t?.fullName}{' '}
                              <span className="text-slate-500 font-medium text-sm">
                                ({u?.unitNumber})
                              </span>
                            </div>
                            <div className="font-mono text-xs text-slate-500 mt-0.5">
                              #{p.receiptNumber} · {p.paymentDate} · {p.method}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-base text-emerald-700">
                              {formatBDT(p.amountReceivedPoisha, lang)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                          <span className="text-xs text-slate-500">
                            {isBn ? 'আদায়কারী:' : 'By:'} {p.recordedByName}
                          </span>
                          <div className="flex items-center gap-2">
                            {t && b && u && (
                              <button
                                onClick={() =>
                                  setReceiptModalCtx({
                                    payment: p,
                                    tenant: t,
                                    building: b,
                                    unit: u,
                                    settings: db.settings,
                                    lang,
                                  })
                                }
                                className="px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                <span>
                                  {isBn ? 'রসিদ ডাউনলোড/শেয়ার' : 'Receipt'}
                                </span>
                              </button>
                            )}
                            {!p.isReversed && activeUser.role === 'OWNER' && (
                              <button
                                onClick={() => handleReversePayment(p.id)}
                                className="px-2.5 py-2 rounded-xl border border-rose-200 text-rose-700 text-xs hover:bg-rose-50 font-semibold cursor-pointer"
                              >
                                {isBn ? 'বাতিল' : 'Reverse'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 5. UTILITY BILLS & SHARED CHARGES ==================== */}
        {activeTab === 'BILLS' && (
          <div className="space-y-6">
            {/* Friendly Header + Mode Switcher */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-extrabold text-slate-900">
                  {isBn
                    ? 'বিদ্যুৎ, গ্যাস, পানি ও যৌথ বিল'
                    : 'Electricity, Gas, Water & Shared Bills'}
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  {isBn
                    ? 'নিচের ট্যাব থেকে একক ফ্ল্যাটের মিটার বিল অথবা পুরো ভবনের যৌথ বিল বণ্টন বেছে নিন।'
                    : 'Switch between individual unit utility bills and building-wide shared expense split.'}
                </p>
              </div>
              <div className="inline-flex rounded-2xl bg-slate-100 p-1.5 gap-1">
                <button
                  type="button"
                  onClick={() => setBillTabMode('UTILITY')}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    billTabMode === 'UTILITY'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isBn ? '⚡ একক ফ্ল্যাটের বিল' : '⚡ Single Unit Bill'}
                </button>
                <button
                  type="button"
                  onClick={() => setBillTabMode('SHARED')}
                  className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    billTabMode === 'SHARED'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {isBn ? '🏢 যৌথ বিল বণ্টন' : '🏢 Shared Building Split'}
                </button>
              </div>
            </div>

            {/* Active Bill Form (Only 1 shown at a time for zero clutter!) */}
            {billTabMode === 'UTILITY' ? (
              <form
                onSubmit={handlePostUtilityBill}
                className="rounded-3xl bg-white border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-5 max-w-3xl"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-emerald-600" />
                    <span>
                      {isBn
                        ? 'একক ফ্ল্যাটের ইউটিলিটি বিল যোগ করুন'
                        : 'Add Single Flat Utility Bill'}
                    </span>
                  </h2>
                  <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setBillMode('METER')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        billMode === 'METER'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      {isBn ? 'মিটার রিডিং হিসাব' : 'Meter Reading'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBillMode('MANUAL')}
                      className={`px-3 py-1.5 rounded-lg transition-all ${
                        billMode === 'MANUAL'
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600'
                      }`}
                    >
                      {isBn ? 'সরাসরি টাকা এন্ট্রি' : 'Fixed Amount'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      {isBn ? 'ফ্ল্যাট নির্বাচন করুন *' : 'Occupied Flat *'}
                    </label>
                    <select
                      value={billUnitId}
                      onChange={(e) => setBillUnitId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-semibold"
                    >
                      {db.units
                        .filter((u) => u.status === 'OCCUPIED')
                        .map((u) => {
                          const b = db.buildings.find(
                            (x) => x.id === u.buildingId
                          );
                          return (
                            <option key={u.id} value={u.id}>
                              {u.unitNumber} ({b?.name})
                            </option>
                          );
                        })}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      {isBn ? 'বিলের ধরন *' : 'Bill Type *'}
                    </label>
                    <select
                      value={billType}
                      onChange={(e) =>
                        setBillType(e.target.value as UtilityType)
                      }
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-semibold"
                    >
                      <option value="ELECTRICITY">⚡ বিদ্যুৎ বিল (Electricity)</option>
                      <option value="WATER">💧 পানির বিল (WASA / Water)</option>
                      <option value="GAS">🔥 গ্যাস বিল (Titas / Gas)</option>
                      <option value="SERVICE">🛠️ সার্ভিস চার্জ (Service)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      {isBn ? 'বিলিং মাস *' : 'Billing Month *'}
                    </label>
                    <input
                      type="month"
                      value={billPeriod}
                      onChange={(e) => setBillPeriod(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono font-bold"
                    />
                  </div>
                </div>

                {billMode === 'METER' ? (
                  <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-sm">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          {isBn ? 'পূর্বের রিডিং' : 'Prev Reading'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={billPrevReading}
                          onChange={(e) => setBillPrevReading(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          {isBn ? 'বর্তমান রিডিং' : 'Curr Reading'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={billCurrReading}
                          onChange={(e) => setBillCurrReading(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          {isBn ? 'ইউনিট দর (৳)' : 'Rate/Unit (৳)'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={billRateTaka}
                          onChange={(e) => setBillRateTaka(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono font-bold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          {isBn ? 'ফিক্সড চার্জ (৳)' : 'Fixed Charge (৳)'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={billFixedTaka}
                          onChange={(e) => setBillFixedTaka(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 font-mono font-bold"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={billRollover}
                        onChange={(e) => setBillRollover(e.target.checked)}
                        className="rounded"
                      />
                      <span>
                        {isBn
                          ? 'নতুন মিটার বা রিসেট হলে টিক দিন (বর্তমান রিডিং পূর্বের চেয়ে কম হলে)'
                          : 'Allow meter rollover/reset if current reading is lower'}
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-sm">
                    <label className="block font-bold text-slate-700 mb-1.5">
                      {isBn ? 'মোট বিলের পরিমাণ (৳) *' : 'Total Bill Amount (BDT) *'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={billManualTaka}
                      onChange={(e) => setBillManualTaka(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-mono text-lg font-extrabold"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={billAllowDuplicate}
                    onChange={(e) => setBillAllowDuplicate(e.target.checked)}
                    className="rounded"
                  />
                  <span>
                    {isBn
                      ? 'একই মাসে দ্বিতীয়বার অতিরিক্ত বিল যোগ করার অনুমতি দিন'
                      : 'Allow posting an additional bill in the same month'}
                  </span>
                </label>

                <button
                  type="submit"
                  className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold shadow-sm transition-all"
                >
                  {isBn ? 'বিল সংরক্ষণ করুন' : 'Save Utility Bill'}
                </button>
              </form>
            ) : (
              <form
                onSubmit={handlePostSharedCharge}
                className="rounded-3xl bg-white border border-slate-200/80 p-6 sm:p-8 shadow-sm space-y-5 max-w-3xl"
              >
                <div className="border-b border-slate-100 pb-4">
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {isBn
                      ? 'ভবনের যৌথ বিল সব ফ্ল্যাটে ভাগ করে দিন'
                      : 'Split Shared Building Charge Across Flats'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">
                    {isBn
                      ? 'দারোয়ান, লিফট বা কমন কারেন্ট বিল সব ফ্ল্যাটে সমান বা ইচ্ছামতো ভাগ করে দিন।'
                      : 'Split common charges equally or assign custom amounts per flat.'}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      {isBn ? 'ভবন' : 'Building'}
                    </label>
                    <select
                      value={scBuildingId}
                      onChange={(e) => setScBuildingId(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-semibold"
                    >
                      {db.buildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      {isBn ? 'খরচের নাম' : 'Charge Title'}
                    </label>
                    <input
                      type="text"
                      value={scTitle}
                      onChange={(e) => setScTitle(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1.5">
                      {isBn ? 'মোট টাকা (৳)' : 'Total Shared Amount (৳)'}
                    </label>
                    <input
                      type="number"
                      value={scTotalTaka}
                      onChange={(e) => setScTotalTaka(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono font-extrabold"
                    />
                  </div>
                </div>

                <div className="space-y-2.5 max-h-60 overflow-y-auto border border-slate-200 rounded-2xl p-4 bg-slate-50">
                  <div className="flex justify-between items-center text-sm pb-2 border-b border-slate-200">
                    <span className="font-bold text-slate-700">
                      {isBn ? 'ফ্ল্যাট ও ভাড়াটিয়া' : 'Occupied Flat & Tenant'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        if (scBuildingUnits.length === 0) return;
                        const totalP = scValidation.totalPoisha;
                        const count = scBuildingUnits.length;
                        const baseShare = Math.floor(totalP / count);
                        const rem = totalP - baseShare * count;
                        const nextMap: Record<string, string> = {};
                        scBuildingUnits.forEach(({ unit }, idx) => {
                          const shareP =
                            idx === 0 ? baseShare + rem : baseShare;
                          nextMap[unit.id] = String(shareP / 100);
                        });
                        setScCustomUnitTaka(nextMap);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-extrabold hover:bg-emerald-200 transition-colors"
                    >
                      {isBn ? '✨ সমান ভাগে বসান' : '✨ Auto Equal Split'}
                    </button>
                  </div>
                  {scBuildingUnits.map(({ unit, tenant }) => (
                    <div
                      key={unit.id}
                      className="flex items-center justify-between gap-3 text-sm py-1"
                    >
                      <span className="text-slate-800">
                        <strong className="font-extrabold">{unit.unitNumber}</strong> — {tenant?.fullName}
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={scCustomUnitTaka[unit.id] || ''}
                        onChange={(e) =>
                          setScCustomUnitTaka((prev) => ({
                            ...prev,
                            [unit.id]: e.target.value,
                          }))
                        }
                        className="w-32 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-right font-mono font-bold"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-sm font-mono px-4 py-3 rounded-2xl bg-slate-100">
                  <span>
                    {isBn ? 'মোট বণ্টিত:' : 'Allocated:'}{' '}
                    <strong>{formatBDT(scValidation.allocatedSumPoisha, lang)}</strong>
                  </span>
                  <span
                    className={
                      scValidation.differencePoisha === 0
                        ? 'text-emerald-700 font-extrabold'
                        : 'text-red-600 font-extrabold'
                    }
                  >
                    {isBn ? 'বাকি পার্থক্য:' : 'Difference:'}{' '}
                    {formatBDT(scValidation.differencePoisha, lang)}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={!scValidation.isValid}
                  className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 text-white text-sm font-extrabold hover:bg-emerald-700 disabled:opacity-40 shadow-sm"
                >
                  {isBn
                    ? 'যৌথ বিল সব ফ্ল্যাটে যোগ করুন'
                    : 'Post Shared Charge to Flats'}
                </button>
              </form>
            )}

            {/* Posted Utility Bills Cards */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-6 shadow-sm">
              <h3 className="text-base font-extrabold text-slate-900 mb-4">
                {isBn
                  ? 'পোস্টকৃত ইউটিলিটি ও যৌথ বিলের তালিকা'
                  : 'Posted Utility & Shared Bills'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {db.utilityBills.map((ub) => {
                  const u = db.units.find((x) => x.id === ub.unitId);
                  const t = db.tenants.find((x) => x.id === ub.tenantId);
                  const rem = Math.max(
                    0,
                    ub.totalAmountPoisha - ub.paidAmountPoisha
                  );
                  return (
                    <div
                      key={ub.id}
                      className="rounded-2xl border border-slate-200/90 p-4 hover:border-slate-300 transition-all flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="inline-block px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 font-extrabold text-xs">
                            {u?.unitNumber} · {ub.billingPeriod}
                          </span>
                          <div className="text-sm font-bold text-slate-900 mt-1">
                            {t?.fullName}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {ub.utilityType} ({ub.billingMode})
                            {ub.billingMode === 'METER'
                              ? ` · ${ub.prevReading} → ${ub.currReading}`
                              : ub.notes
                              ? ` · ${ub.notes}`
                              : ''}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-extrabold font-mono text-slate-900">
                            {formatBDT(ub.totalAmountPoisha, lang)}
                          </div>
                          {rem > 0 ? (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-red-50 text-red-700 text-[11px] font-bold">
                              {isBn ? 'বকেয়া:' : 'Due:'} {formatBDT(rem, lang)}
                            </span>
                          ) : (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold">
                              {isBn ? 'পরিশোধিত' : 'Paid'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 6. PROPERTY EXPENSES ==================== */}
        {activeTab === 'EXPENSES' && (
          <div className="space-y-6">
            {/* Friendly Header + Add Expense Button */}
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-extrabold text-slate-900">
                  {isBn
                    ? 'ভবনের রক্ষণাবেক্ষণ ও খরচ'
                    : 'Property Maintenance & Operating Expenses'}
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  {isBn
                    ? 'দারোয়ানের বেতন, লিফট সার্ভিসিং, মেরামত ও ট্যাক্স খরচ সংরক্ষণ করুন।'
                    : 'Record caretaker wages, repairs, lift servicing, and property taxes.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowExpenseModal(true)}
                className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold flex items-center gap-2 shadow-sm transition-all self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>{isBn ? 'নতুন খরচ যোগ করুন' : 'Add New Expense'}</span>
              </button>
            </div>

            {/* Modal for Adding New Expense */}
            {showExpenseModal && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
                <form
                  onSubmit={(e) => {
                    handleAddExpense(e);
                    setShowExpenseModal(false);
                  }}
                  className="bg-white rounded-3xl border border-slate-200 max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-4 text-sm animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                      <Wrench className="w-5 h-5 text-emerald-600" />
                      <span>{isBn ? 'নতুন খরচ যোগ করুন' : 'Record Property Expense'}</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowExpenseModal(false)}
                      className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {isBn ? 'ভবন *' : 'Building *'}
                      </label>
                      <select
                        value={expBuildingId}
                        onChange={(e) => setExpBuildingId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-semibold"
                      >
                        {db.buildings.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {isBn ? 'ফ্ল্যাট (ঐচ্ছিক)' : 'Flat (Optional)'}
                      </label>
                      <select
                        value={expUnitId}
                        onChange={(e) => setExpUnitId(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                      >
                        <option value="">{isBn ? 'পুরো ভবনের খরচ' : 'Entire Building'}</option>
                        {db.units
                          .filter((u) => u.buildingId === expBuildingId)
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.unitNumber}
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {isBn ? 'খরচের খাত *' : 'Category *'}
                      </label>
                      <select
                        value={expCategory}
                        onChange={(e) =>
                          setExpCategory(e.target.value as ExpenseCategory)
                        }
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-semibold"
                      >
                        <option value="REPAIRS">মেরামত (Repairs)</option>
                        <option value="SECURITY_CARETAKER">দারোয়ান/কেয়ারটেকার বেতন</option>
                        <option value="LIFT">লিফট সার্ভিসিং (Lift)</option>
                        <option value="COMMON_UTILITY">কমন বিদ্যুৎ ও পানি</option>
                        <option value="CLEANING">পরিষ্কার-পরিচ্ছন্নতা</option>
                        <option value="PAINTING">রং ও সংস্কার (Painting)</option>
                        <option value="PLUMBING">প্লাম্বিং/পানির লাইন</option>
                        <option value="TAX_FEES">সিটি কর্পোরেশন ট্যাক্স/ফি</option>
                        <option value="OTHER">অন্যান্য খরচ</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {isBn ? 'টাকার পরিমাণ (৳) *' : 'Amount (BDT) *'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={expAmountTaka}
                        onChange={(e) => setExpAmountTaka(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono font-extrabold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {isBn ? 'তারিখ *' : 'Date *'}
                      </label>
                      <input
                        type="date"
                        required
                        value={expDate}
                        onChange={(e) => setExpDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {isBn ? 'ভেন্ডর / প্রাপকের নাম' : 'Vendor / Payee'}
                      </label>
                      <input
                        type="text"
                        placeholder={isBn ? 'যেমন: করিম ইলেকট্রিক' : 'e.g. Dhaka Elevator Ltd.'}
                        value={expVendor}
                        onChange={(e) => setExpVendor(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {isBn ? 'খরচের বিবরণ *' : 'Description *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isBn ? 'খরচের সংক্ষিপ্ত বিবরণ লিখুন' : 'Reason for expense'}
                      value={expDesc}
                      onChange={(e) => setExpDesc(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowExpenseModal(false)}
                      className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold"
                    >
                      {isBn ? 'বাতিল' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-extrabold hover:bg-emerald-700"
                    >
                      {isBn ? 'খরচ সংরক্ষণ করুন' : 'Save Expense'}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Expenses Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {db.expenses.map((e) => {
                const b = db.buildings.find((x) => x.id === e.buildingId);
                return (
                  <div
                    key={e.id}
                    className="rounded-3xl bg-white border border-slate-200/80 p-5 shadow-sm flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-block px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-extrabold">
                          {e.category}
                        </span>
                        <h3 className="text-base font-extrabold text-slate-900 mt-2">
                          {e.description}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {b?.name} {e.vendor ? `· ${e.vendor}` : ''}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-extrabold font-mono text-slate-900">
                          {formatBDT(e.amountPoisha, lang)}
                        </div>
                        <div className="text-xs font-mono text-slate-400 mt-0.5">
                          {e.date}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== 7. REPORTS & AUDIT HISTORY ==================== */}
        {activeTab === 'REPORTS' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-extrabold text-slate-900">
                  {isBn
                    ? 'আর্থিক হিসাব ও রিপোর্ট সমূহ'
                    : 'Financial Statements & Property Reports'}
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                  {isBn
                    ? 'মাসিক আয়-ব্যয়, ভাড়াটিয়া লেজার এবং বকেয়া রিপোর্ট দেখুন ও প্রিন্ট বা Excel-এ ডাউনলোড করুন।'
                    : 'View and export monthly statements, tenant ledgers, and outstanding dues.'}
                </p>
              </div>
              <div className="flex items-center gap-2.5 no-print">
                <button
                  onClick={handleExportCsvReport}
                  className="px-4 py-2.5 rounded-2xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 flex items-center gap-2 shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{isBn ? 'Excel ডাউনলোড' : 'Export Excel'}</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2.5 rounded-2xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 flex items-center gap-2 shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isBn ? 'প্রিন্ট / PDF' : 'Print / PDF'}</span>
                </button>
              </div>
            </div>

            {/* Report Selector Pills */}
            <div className="flex flex-wrap gap-2 bg-white p-3 rounded-3xl border border-slate-200/80 shadow-sm no-print">
              {(
                [
                  ['MONTHLY', isBn ? '📊 মাসিক রিপোর্ট' : 'Monthly Summary'],
                  ['OUTSTANDING_DUES', isBn ? '⚠️ বকেয়া তালিকা' : 'Outstanding Dues'],
                  ['TENANT_LEDGER', isBn ? '👥 ভাড়াটিয়া লেজার' : 'Tenant Ledger'],
                  ['RENT_COLLECTION', isBn ? '🧾 ভাড়া আদায়' : 'Rent Collection'],
                  ['UTILITY_BILLING', isBn ? '⚡ ইউটিলিটি বিল' : 'Utility Billing'],
                  ['EXPENSE_REPORT', isBn ? '🛠️ খরচ রিপোর্ট' : 'Expense Report'],
                  ['SECURITY_DEPOSIT', isBn ? '🛡️ জামানত হিসাব' : 'Security Deposits'],
                  ['OCCUPANCY', isBn ? '🏢 ফ্ল্যাট দখল' : 'Occupancy'],
                  ['YEARLY', isBn ? '📅 বার্ষিক হিসাব' : 'Yearly Summary'],
                  ['AUDIT_HISTORY', isBn ? '📋 অডিট লগ' : 'Audit History'],
                ] as [ReportType, string][]
              ).map(([rk, label]) => (
                <button
                  key={rk}
                  onClick={() => setReportType(rk)}
                  className={`px-4 py-2 rounded-2xl text-sm font-bold transition-all ${
                    reportType === rk
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Report Content Box */}
            <div className="rounded-3xl bg-white border border-slate-200/80 p-6 shadow-sm space-y-4">
              {(reportType === 'MONTHLY' ||
                reportType === 'BUILDING_FINANCE' ||
                reportType === 'YEARLY') && (
                <div className="space-y-4">
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {reportType === 'YEARLY'
                      ? isBn
                        ? `বার্ষিক আয়-ব্যয় বিবরণী (${selectedPeriod.slice(0, 4)})`
                        : `Yearly Financial Statement (${selectedPeriod.slice(0, 4)})`
                      : isBn
                      ? `ভবনভিত্তিক মাসিক আয়-ব্যয় হিসাব (${selectedPeriod})`
                      : `Building-Wise Monthly Reconciliation (${selectedPeriod})`}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-3 pr-3">{isBn ? 'ভবন' : 'Building'}</th>
                          <th className="py-3 px-3 text-right">{isBn ? 'মোট ধার্য' : 'Billed'}</th>
                          <th className="py-3 px-3 text-right">{isBn ? 'আদায়কৃত' : 'Collected'}</th>
                          <th className="py-3 px-3 text-right">{isBn ? 'বকেয়া' : 'Outstanding'}</th>
                          <th className="py-3 px-3 text-right">{isBn ? 'খরচ' : 'Expenses'}</th>
                          <th className="py-3 pl-3 text-right">{isBn ? 'নিট আয়' : 'Net Cash Flow'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {summary.buildingBreakdown.map((b) => (
                          <tr key={b.buildingId} className="hover:bg-slate-50">
                            <td className="py-3.5 pr-3 font-extrabold text-slate-900">
                              {b.buildingName}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono">
                              {formatBDT(b.chargedPoisha, lang)}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono text-emerald-700 font-bold">
                              {formatBDT(b.collectedPoisha, lang)}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono text-red-600 font-bold">
                              {formatBDT(b.outstandingPoisha, lang)}
                            </td>
                            <td className="py-3.5 px-3 text-right font-mono">
                              {formatBDT(b.expensesPoisha, lang)}
                            </td>
                            <td className="py-3.5 pl-3 text-right font-mono font-extrabold text-slate-900">
                              {formatBDT(
                                b.collectedPoisha - b.expensesPoisha,
                                lang
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {reportType === 'TENANT_LEDGER' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 className="text-lg font-extrabold text-slate-900">
                      {isBn
                        ? 'ভাড়াটিয়া লেজার (সক্রিয় ও পুরাতন)'
                        : 'Complete Tenant Ledger'}
                    </h2>
                    <select
                      value={reportTenantId}
                      onChange={(e) => setReportTenantId(e.target.value)}
                      className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold"
                    >
                      <option value="ALL">{isBn ? 'সকল ভাড়াটিয়া' : 'All Tenants'}</option>
                      {db.tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName} ({t.status})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-3 pr-3">{isBn ? 'ভাড়াটিয়া' : 'Tenant'}</th>
                          <th className="py-3 px-3">{isBn ? 'অবস্থা' : 'Status'}</th>
                          <th className="py-3 px-3 text-right">{isBn ? 'মাসিক ভাড়া' : 'Monthly Rent'}</th>
                          <th className="py-3 px-3 text-right">{isBn ? 'জামানত' : 'Held Deposit'}</th>
                          <th className="py-3 px-3 text-right">{isBn ? 'অগ্রিম জমা' : 'Advance Credit'}</th>
                          <th className="py-3 pl-3 text-right">{isBn ? 'বর্তমান বকেয়া' : 'Current Due'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {db.tenants
                          .filter(
                            (t) =>
                              reportTenantId === 'ALL' || t.id === reportTenantId
                          )
                          .map((t) => {
                            const dep = calculateTenantDepositBalance(
                              t.id,
                              db.depositTransactions
                            );
                            const due = getTenantUnpaidObligations(
                              t.id,
                              db.rentCharges,
                              db.utilityBills
                            ).reduce((s, o) => s + o.outstandingPoisha, 0);
                            return (
                              <tr key={t.id} className="hover:bg-slate-50">
                                <td className="py-3.5 pr-3 font-bold text-slate-900">
                                  {t.fullName}
                                </td>
                                <td className="py-3.5 px-3">{t.status}</td>
                                <td className="py-3.5 px-3 text-right font-mono">
                                  {formatBDT(t.monthlyRentPoisha, lang)}
                                </td>
                                <td className="py-3.5 px-3 text-right font-mono">
                                  {formatBDT(dep.heldBalancePoisha, lang)}
                                </td>
                                <td className="py-3.5 px-3 text-right font-mono text-emerald-700 font-bold">
                                  {formatBDT(t.advanceRentCreditPoisha, lang)}
                                </td>
                                <td className="py-3.5 pl-3 text-right font-mono font-extrabold text-red-600">
                                  {formatBDT(due, lang)}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {reportType === 'OUTSTANDING_DUES' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {isBn ? 'বকেয়া ভাড়ার তালিকা' : 'Outstanding Dues List'}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-3 pr-3">{isBn ? 'ভাড়াটিয়া ও ফোন' : 'Tenant'}</th>
                          <th className="py-3 px-3">{isBn ? 'ভবন ও ফ্ল্যাট' : 'Building & Flat'}</th>
                          <th className="py-3 px-3">{isBn ? 'বকেয়া মাস' : 'Overdue Months'}</th>
                          <th className="py-3 pl-3 text-right">{isBn ? 'মোট বকেয়া' : 'Total Due'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reminderEval?.overdueItems.map((item) => (
                          <tr key={item.eventKey} className="hover:bg-slate-50">
                            <td className="py-3.5 pr-3 font-bold text-slate-900">
                              {item.tenant.fullName} ({item.tenant.primaryPhone})
                            </td>
                            <td className="py-3.5 px-3">
                              {item.building.name} · <strong>{item.unit.unitNumber}</strong>
                            </td>
                            <td className="py-3.5 px-3 font-mono">
                              {item.overduePeriods.join(', ')}
                            </td>
                            <td className="py-3.5 pl-3 text-right font-mono font-extrabold text-red-600">
                              {formatBDT(item.outstandingPoisha, lang)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {reportType === 'RENT_COLLECTION' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {isBn ? 'ভাড়া আদায় ও রসিদ তালিকা' : 'Rent Collection & Receipt Ledger'}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-3 pr-3">{isBn ? 'রসিদ নং' : 'Receipt #'}</th>
                          <th className="py-3 px-3">{isBn ? 'তারিখ' : 'Date'}</th>
                          <th className="py-3 px-3">{isBn ? 'ভাড়াটিয়া' : 'Tenant'}</th>
                          <th className="py-3 px-3">{isBn ? 'মাধ্যম' : 'Method'}</th>
                          <th className="py-3 pl-3 text-right">{isBn ? 'টাকার পরিমাণ' : 'Amount'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {db.payments.map((p) => {
                          const t = db.tenants.find((x) => x.id === p.tenantId);
                          return (
                            <tr key={p.id} className="hover:bg-slate-50">
                              <td className="py-3 pr-3 font-mono font-bold">
                                {p.receiptNumber}
                              </td>
                              <td className="py-3 px-3 font-mono">
                                {p.paymentDate}
                              </td>
                              <td className="py-3 px-3 font-semibold">{t?.fullName}</td>
                              <td className="py-3 px-3 font-mono">
                                {p.method} {p.transactionRef}
                              </td>
                              <td className="py-3 pl-3 text-right font-mono font-extrabold text-emerald-700">
                                {formatBDT(p.amountReceivedPoisha, lang)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {reportType === 'UTILITY_BILLING' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {isBn ? 'ইউটিলিটি ও যৌথ বিল রিপোর্ট' : 'Utility Billing Report'}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-3 pr-3">{isBn ? 'মাস' : 'Period'}</th>
                          <th className="py-3 px-3">{isBn ? 'ফ্ল্যাট' : 'Flat'}</th>
                          <th className="py-3 px-3">{isBn ? 'বিলের ধরন' : 'Utility Type'}</th>
                          <th className="py-3 px-3 text-right">{isBn ? 'মোট বিল' : 'Billed'}</th>
                          <th className="py-3 pl-3 text-right">{isBn ? 'পরিশোধিত' : 'Paid'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {db.utilityBills.map((ub) => {
                          const u = db.units.find((x) => x.id === ub.unitId);
                          return (
                            <tr key={ub.id} className="hover:bg-slate-50">
                              <td className="py-3 pr-3 font-mono">
                                {ub.billingPeriod}
                              </td>
                              <td className="py-3 px-3 font-bold">{u?.unitNumber}</td>
                              <td className="py-3 px-3">
                                {ub.utilityType} ({ub.billingMode})
                              </td>
                              <td className="py-3 px-3 text-right font-mono">
                                {formatBDT(ub.totalAmountPoisha, lang)}
                              </td>
                              <td className="py-3 pl-3 text-right font-mono text-emerald-700 font-bold">
                                {formatBDT(ub.paidAmountPoisha, lang)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {reportType === 'EXPENSE_REPORT' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {isBn ? 'ভবনের খরচ রিপোর্ট' : 'Property Expense Report'}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-3 pr-3">{isBn ? 'তারিখ' : 'Date'}</th>
                          <th className="py-3 px-3">{isBn ? 'খাত' : 'Category'}</th>
                          <th className="py-3 px-3">{isBn ? 'বিবরণ' : 'Description'}</th>
                          <th className="py-3 pl-3 text-right">{isBn ? 'পরিমাণ' : 'Amount'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {db.expenses.map((e) => (
                          <tr key={e.id} className="hover:bg-slate-50">
                            <td className="py-3 pr-3 font-mono">{e.date}</td>
                            <td className="py-3 px-3 font-bold">
                              {e.category}
                            </td>
                            <td className="py-3 px-3">
                              {e.description} {e.vendor ? `(${e.vendor})` : ''}
                            </td>
                            <td className="py-3 pl-3 text-right font-mono font-extrabold">
                              {formatBDT(e.amountPoisha, lang)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {reportType === 'SECURITY_DEPOSIT' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {isBn ? 'জামানত (Security Deposit) হিসাব' : 'Security Deposit Ledger'}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-3 pr-3">{isBn ? 'তারিখ' : 'Date'}</th>
                          <th className="py-3 px-3">{isBn ? 'ভাড়াটিয়া' : 'Tenant'}</th>
                          <th className="py-3 px-3">{isBn ? 'ধরন' : 'Type'}</th>
                          <th className="py-3 px-3">{isBn ? 'কারণ' : 'Reason'}</th>
                          <th className="py-3 pl-3 text-right">{isBn ? 'পরিমাণ' : 'Amount'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {db.depositTransactions.map((dtx) => {
                          const t = db.tenants.find((x) => x.id === dtx.tenantId);
                          return (
                            <tr key={dtx.id} className="hover:bg-slate-50">
                              <td className="py-3 pr-3 font-mono">
                                {dtx.date}
                              </td>
                              <td className="py-3 px-3 font-bold">
                                {t?.fullName}
                              </td>
                              <td className="py-3 px-3 font-mono">
                                {dtx.type}
                              </td>
                              <td className="py-3 px-3">{dtx.reason}</td>
                              <td className="py-3 pl-3 text-right font-mono font-extrabold">
                                {formatBDT(dtx.amountPoisha, lang)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {reportType === 'OCCUPANCY' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-extrabold text-slate-900">
                    {isBn ? 'ফ্ল্যাট দখল ও খালি তালিকা' : 'Unit Occupancy & Vacancy Report'}
                  </h2>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-3 pr-3">{isBn ? 'ভবন' : 'Building'}</th>
                          <th className="py-3 px-3">{isBn ? 'ফ্ল্যাট' : 'Flat'}</th>
                          <th className="py-3 px-3">{isBn ? 'অবস্থা' : 'Status'}</th>
                          <th className="py-3 px-3">{isBn ? 'ভাড়াটিয়া' : 'Occupant'}</th>
                          <th className="py-3 pl-3 text-right">{isBn ? 'নির্ধারিত ভাড়া' : 'Default Rent'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {db.units.map((u) => {
                          const b = db.buildings.find(
                            (x) => x.id === u.buildingId
                          );
                          const t = db.tenants.find(
                            (x) => x.currentUnitId === u.id && x.status === 'ACTIVE'
                          );
                          return (
                            <tr key={u.id} className="hover:bg-slate-50">
                              <td className="py-3 pr-3">{b?.name}</td>
                              <td className="py-3 px-3 font-extrabold">
                                {u.unitNumber}
                              </td>
                              <td className="py-3 px-3 font-mono">
                                {u.status}
                              </td>
                              <td className="py-3 px-3 font-semibold">
                                {t ? t.fullName : '—'}
                              </td>
                              <td className="py-3 pl-3 text-right font-mono font-bold">
                                {formatBDT(u.defaultRentPoisha, lang)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {reportType === 'AUDIT_HISTORY' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 className="text-lg font-extrabold text-slate-900">
                      {isBn ? 'সকল লেনদেনের অডিট ইতিহাস' : 'Immutable Transaction Audit History'}
                    </h2>
                    <select
                      value={auditTypeFilter}
                      onChange={(e) => setAuditTypeFilter(e.target.value)}
                      className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-semibold"
                    >
                      <option value="ALL">All Event Types</option>
                      <option value="PAYMENT_RECORDED">PAYMENT_RECORDED</option>
                      <option value="PAYMENT_REVERSED">PAYMENT_REVERSED</option>
                      <option value="RENT_GENERATED">RENT_GENERATED</option>
                      <option value="RENT_ADJUSTED">RENT_ADJUSTED</option>
                      <option value="BILL_POSTED">BILL_POSTED</option>
                      <option value="DEPOSIT_TX">DEPOSIT_TX</option>
                      <option value="BACKUP_EXPORTED">BACKUP_EXPORTED</option>
                    </select>
                  </div>
                  <div className="space-y-2.5">
                    {db.auditLogs
                      .filter(
                        (a) =>
                          auditTypeFilter === 'ALL' ||
                          a.eventType === auditTypeFilter
                      )
                      .map((log) => (
                        <div
                          key={log.id}
                          className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
                        >
                          <div>
                            <span className="font-mono font-extrabold text-slate-900">
                              {log.eventType}
                            </span>
                            <span aria-hidden="true"> · </span>
                            <span className="text-slate-700">
                              {isBn ? log.summaryBn : log.summaryEn}
                            </span>
                          </div>
                          <div className="text-xs text-slate-500 font-mono whitespace-nowrap">
                            {log.userName} · {log.timestamp.slice(0, 19)}
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== 8. SETTINGS, ROLES, SYNC & ENCRYPTED BACKUP ==================== */}
        {activeTab === 'SETTINGS' && (
          <div className="space-y-6">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm">
              <h1 className="text-xl font-extrabold text-slate-900">
                {isBn
                  ? 'সেটিংস, পিন লক ও ব্যাকআপ'
                  : 'Settings, PIN Security & Encrypted Backup'}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {isBn
                  ? 'আপনার অ্যাপের নাম, স্বাক্ষর, পিন লক এবং ডাটা ব্যাকআপ সহজে নিয়ন্ত্রণ করুন।'
                  : 'Manage app branding, PIN lock, manager permissions, and encrypted backups.'}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. Encrypted Backup & Restore (AES-256-GCM) */}
              <div className="rounded-3xl bg-white border border-slate-200/80 p-6 shadow-sm space-y-5">
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-emerald-600" />
                  <span>
                    {isBn
                      ? 'নিরাপদ ব্যাকআপ ও রিস্টোর (AES-256)'
                      : 'Encrypted Backup & Restore (AES-256)'}
                  </span>
                </h2>
                <p className="text-sm text-slate-500">
                  {isBn
                    ? 'ফোন পরিবর্তন বা হারানোর ঝুঁকি এড়াতে পাসওয়ার্ড দিয়ে ব্যাকআপ ফাইল ডাউনলোড করে রাখুন।'
                    : 'Protect your ledger with a password-encrypted backup file.'}
                </p>

                <form
                  onSubmit={handleExportEncryptedBackup}
                  className="space-y-3 pt-3 border-t border-slate-100 text-sm"
                >
                  <div className="font-bold text-slate-800">
                    {isBn
                      ? '১. ব্যাকআপ ফাইল ডাউনলোড করুন'
                      : '1. Download Encrypted Backup (.brmbackup)'}
                  </div>
                  <input
                    type="password"
                    required
                    minLength={4}
                    placeholder={
                      isBn
                        ? 'গোপন পাসওয়ার্ড দিন (কমপক্ষে ৪ অক্ষর)'
                        : 'Enter encryption password (min 4 chars)'
                    }
                    value={backupPassword}
                    onChange={(e) => setBackupPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                  />
                  <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeBackupDocs}
                      onChange={(e) => setIncludeBackupDocs(e.target.checked)}
                      className="rounded"
                    />
                    <span>
                      {isBn
                        ? 'ভাড়াটিয়ার ছবি ও চুক্তিপত্র ফাইলগুলো ব্যাকআপে যুক্ত করুন'
                        : 'Include attached tenant photos & agreement files'}
                    </span>
                  </label>
                  <button
                    type="submit"
                    className="w-full py-3 px-4 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 flex items-center justify-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {isBn
                        ? 'ব্যাকআপ ডাউনলোড করুন'
                        : 'Download Encrypted Backup'}
                    </span>
                  </button>
                </form>

                <form
                  onSubmit={handleRestoreEncryptedBackup}
                  className="space-y-3 pt-4 border-t border-slate-200 text-sm"
                >
                  <div className="font-bold text-slate-800">
                    {isBn
                      ? '২. পুরাতন ব্যাকআপ ফাইল রিস্টোর করুন'
                      : '2. Restore from Backup File'}
                  </div>
                  <input
                    type="file"
                    accept=".brmbackup,.json"
                    onChange={(e) => handleSelectRestoreFile(e.target.files?.[0])}
                    className="w-full text-sm text-slate-600"
                  />
                  {restorePreviewSummary && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-900">
                      {restorePreviewSummary}
                    </div>
                  )}
                  <input
                    type="password"
                    placeholder={
                      isBn ? 'ব্যাকআপের পাসওয়ার্ড দিন' : 'Enter backup password'
                    }
                    value={restorePassword}
                    onChange={(e) => setRestorePassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                  />
                  <button
                    type="submit"
                    className="w-full py-3 px-4 rounded-2xl bg-emerald-600 text-white font-bold hover:bg-emerald-700 flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    <span>
                      {isBn
                        ? 'যাচাই ও রিস্টোর করুন'
                        : 'Verify & Restore Backup'}
                    </span>
                  </button>
                </form>
              </div>

              {/* 2. Branding, PIN Lock & Permissions */}
              <div className="space-y-6">
                <div className="rounded-3xl bg-white border border-slate-200/80 p-6 shadow-sm space-y-4 text-sm">
                  <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-emerald-600" />
                    <span>
                      {isBn
                        ? 'অ্যাপের নাম, স্বাক্ষর ও ভাড়ার নিয়ম'
                        : 'App Name, Signature & Rent Rules'}
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {isBn ? 'অ্যাপ/বাড়ির নাম' : 'App / Property Name'}
                      </label>
                      <input
                        type="text"
                        value={db.settings.appName}
                        onChange={(e) =>
                          commitDb((d) => {
                            d.settings.appName = e.target.value;
                            return d;
                          })
                        }
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {isBn ? 'মালিকের নাম ও স্বাক্ষর' : 'Owner Signature'}
                      </label>
                      <input
                        type="text"
                        value={db.settings.ownerSignature}
                        onChange={(e) =>
                          commitDb((d) => {
                            d.settings.ownerSignature = e.target.value;
                            return d;
                          })
                        }
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {isBn
                        ? 'মাসের মাঝামাঝি উঠলে ভাড়ার নিয়ম'
                        : 'Partial-Month Occupancy Rule'}
                    </label>
                    <select
                      value={db.settings.prorationPolicy}
                      onChange={(e) =>
                        commitDb((d) => {
                          d.settings.prorationPolicy = e.target
                            .value as ProrationPolicy;
                          return d;
                        })
                      }
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-semibold"
                    >
                      <option value="DAILY_30">
                        ৩০ দিনের আনুপাতিক হিসাব (Pro-rata 30-Day)
                      </option>
                      <option value="ACTUAL_DAYS">
                        ক্যালেন্ডার মাসের প্রকৃত দিন অনুযায়ী
                      </option>
                      <option value="FULL_MONTH">
                        পূর্ণ মাসের ভাড়া (Full Month)
                      </option>
                    </select>
                  </div>
                </div>

                {/* App Security PIN Configuration */}
                <div className="rounded-3xl bg-white border border-slate-200/80 p-6 shadow-sm space-y-4 text-sm">
                  <div className="font-extrabold text-slate-900 text-lg flex items-center gap-2">
                    <Lock className="w-5 h-5 text-emerald-600" />
                    <span>
                      {isBn
                        ? 'অ্যাপ পিন লক নিরাপত্তা'
                        : 'App PIN Lock Protection'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <select
                      value={newPinLen}
                      onChange={(e) =>
                        setNewPinLen(Number(e.target.value) as 4 | 6)
                      }
                      className="rounded-xl border border-slate-300 px-3 py-2.5 font-semibold"
                    >
                      <option value={4}>৪ সংখ্যার পিন (4-Digit)</option>
                      <option value={6}>৬ সংখ্যার পিন (6-Digit)</option>
                    </select>
                    <input
                      type="password"
                      maxLength={newPinLen}
                      placeholder={`${newPinLen} সংখ্যার পিন`}
                      value={newPinInput}
                      onChange={(e) =>
                        setNewPinInput(e.target.value.replace(/[^0-9]/g, ''))
                      }
                      className="rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono w-36 font-bold"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        if (newPinInput.length !== newPinLen) {
                          notify(
                            `PIN must be exactly ${newPinLen} digits.`,
                            'error'
                          );
                          return;
                        }
                        const digest = await hashPinCode(newPinInput);
                        await commitDb((d) => {
                          d.settings.pinEnabled = true;
                          d.settings.pinLength = newPinLen;
                          d.settings.pinCodeHash = digest;
                          return d;
                        });
                        setNewPinInput('');
                        notify('PIN Lock enabled.');
                      }}
                      className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-bold"
                    >
                      {isBn ? 'পিন চালু করুন' : 'Enable PIN'}
                    </button>
                    {db.settings.pinEnabled && (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsLocked(true)}
                          className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white font-bold"
                        >
                          {isBn ? 'এখনই লক করুন' : 'Lock Now'}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            commitDb((d) => {
                              d.settings.pinEnabled = false;
                              d.settings.pinCodeHash = '';
                              return d;
                            })
                          }
                          className="px-4 py-2.5 rounded-xl bg-red-50 text-red-700 font-bold"
                        >
                          {isBn ? 'পিন বন্ধ করুন' : 'Disable PIN'}
                        </button>
                      </>
                    )}
                  </div>

                  {/* Clean / Demo DB Reset */}
                  <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={async () => {
                        const clean = createCleanDatabaseState();
                        setDb(clean);
                        await saveDatabaseState(clean);
                        notify(
                          isBn
                            ? 'খালি নতুন ডাটাবেস চালু করা হয়েছে।'
                            : 'Switched to a clean production database.'
                        );
                      }}
                      className="px-4 py-2.5 rounded-xl border border-red-300 text-red-700 text-xs font-bold hover:bg-red-50"
                    >
                      {isBn
                        ? 'ডেমো মুছে নতুন খালি হিসাব শুরু করুন'
                        : 'Clear Demo & Start Blank Database'}
                    </button>

                    <button
                      type="button"
                      onClick={async () => {
                        const demo = createDemoDatabaseState();
                        setDb(demo);
                        await saveDatabaseState(demo);
                        notify(
                          isBn
                            ? 'ডেমো ডাটা পুনরায় লোড হয়েছে।'
                            : 'Reloaded sample dataset.'
                        );
                      }}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100"
                    >
                      {isBn ? 'ডেমো ডাটা রিসেট করুন' : 'Reset Demo Data'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 9. ANDROID APK & NATIVE SOURCE CENTER (Web Version Only) ==================== */}
        {activeTab === 'ANDROID_APK' && !isApkVersion && (
          <AndroidDeliveryView lang={lang} testsPassedCount={26} />
        )}
        </main>
      </div>

      {/* Mobile Slide-Up Full Menu Sheet */}
      {showMobileMenu && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-end justify-center no-print"
          onClick={() => setShowMobileMenu(false)}
        >
          <div
            className="bg-white w-full rounded-t-3xl p-6 space-y-4 max-h-[82vh] overflow-y-auto animate-in slide-in-from-bottom duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  {isBn ? 'সকল মেনু ও অপশন' : 'All Menu Options'}
                </h3>
                <p className="text-xs text-slate-500">
                  {db.settings.appName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileMenu(false)}
                className="p-2 rounded-xl bg-slate-100 text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {navItems.map(([key, label, Icon]) => {
                const active = activeTab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setActiveTab(key);
                      setShowMobileMenu(false);
                    }}
                    className={`flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-sm'
                        : 'bg-slate-50 text-slate-800 border-slate-200/80 font-semibold hover:bg-slate-100'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-white' : 'text-emerald-600'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs truncate">{label}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Fixed Bottom Navigation Bar (Clean 5-Tab Bar with "আরও / মেনু" Drawer) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 grid grid-cols-5 items-center h-16 px-1 no-print shadow-lg">
        {(
          [
            ['DASHBOARD', isBn ? 'হোম' : 'Home', Wallet],
            ['COLLECTION', isBn ? 'ভাড়া আদায়' : 'Collect', CreditCard],
            ['BUILDINGS', isBn ? 'ফ্ল্যাট' : 'Flats', Building2],
            ['TENANTS', isBn ? 'ভাড়াটিয়া' : 'Tenants', Users],
          ] as const
        ).map(([tabKey, label, Icon]) => {
          const active = activeTab === tabKey && !showMobileMenu;
          return (
            <button
              key={tabKey}
              type="button"
              onClick={() => {
                setShowMobileMenu(false);
                setActiveTab(tabKey);
              }}
              className={`flex flex-col items-center justify-center h-full transition-colors ${
                active
                  ? 'text-emerald-600 font-extrabold'
                  : 'text-slate-500 hover:text-slate-900 font-medium'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] mt-1 whitespace-nowrap">{label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setShowMobileMenu((prev) => !prev)}
          className={`flex flex-col items-center justify-center h-full transition-colors ${
            showMobileMenu ||
            ['BILLS', 'EXPENSES', 'REPORTS', 'SETTINGS', 'ANDROID_APK'].includes(activeTab)
              ? 'text-emerald-600 font-extrabold'
              : 'text-slate-500 hover:text-slate-900 font-medium'
          }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[11px] mt-1 whitespace-nowrap">
            {isBn ? 'মেনু / আরও' : 'More Menu'}
          </span>
        </button>
      </nav>

      {/* Official Receipt Preview, PDF, PNG & Share Modal */}
      <ReceiptModal
        context={receiptModalCtx}
        onClose={() => setReceiptModalCtx(null)}
      />
    </div>
  );
}

export default App;
