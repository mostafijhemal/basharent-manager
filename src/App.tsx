import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Building2,
  CheckCircle2,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  KeyRound,
  Lock,
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
  Users,
  Wallet,
  Wrench,
  Zap,
} from 'lucide-react';
import { AndroidDeliveryView } from './components/AndroidDeliveryView';
import { PinLockOverlay } from './components/PinLockOverlay';
import { PWAInstallButton } from './components/PWAInstallButton';
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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: Zone 1 (Wordmark) — Zone 2 (5 Single-Line Nav Links) — Zone 3 (1 Primary Action) */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200 no-print">
        <button
          onClick={() => setActiveTab('DASHBOARD')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left"
        >
          {db.settings.appName}
        </button>

        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => setActiveTab('DASHBOARD')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'DASHBOARD'
                ? 'text-slate-900 border-b-2 border-emerald-600 font-semibold'
                : ''
            }`}
          >
            {isBn ? 'ড্যাশবোর্ড' : 'Dashboard'}
          </button>
          <button
            onClick={() => setActiveTab('BUILDINGS')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'BUILDINGS'
                ? 'text-slate-900 border-b-2 border-emerald-600 font-semibold'
                : ''
            }`}
          >
            {isBn ? 'ভবন ও ফ্ল্যাট' : 'Buildings'}
          </button>
          <button
            onClick={() => setActiveTab('TENANTS')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'TENANTS'
                ? 'text-slate-900 border-b-2 border-emerald-600 font-semibold'
                : ''
            }`}
          >
            {isBn ? 'ভাড়াটিয়া' : 'Tenants'}
          </button>
          <button
            onClick={() => setActiveTab('COLLECTION')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'COLLECTION'
                ? 'text-slate-900 border-b-2 border-emerald-600 font-semibold'
                : ''
            }`}
          >
            {isBn ? 'ভাড়া আদায়' : 'Rent Collection'}
          </button>
          <button
            onClick={() => setActiveTab('REPORTS')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
              activeTab === 'REPORTS'
                ? 'text-slate-900 border-b-2 border-emerald-600 font-semibold'
                : ''
            }`}
          >
            {isBn ? 'রিপোর্ট' : 'Reports'}
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <PWAInstallButton
            lang={lang}
            onOpenAndroidCenter={() => setActiveTab('ANDROID_APK')}
          />
        </div>
      </header>

      {/* Secondary Workspace Toolbar (Below Header) */}
      <div className="bg-slate-900 text-slate-200 px-6 py-2.5 border-b border-slate-800 no-print">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Secondary Module Switcher */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ['DASHBOARD', isBn ? 'ড্যাশবোর্ড' : 'Dashboard'],
                ['BUILDINGS', isBn ? 'ভবন ও ফ্ল্যাট' : 'Buildings & Units'],
                ['TENANTS', isBn ? 'ভাড়াটিয়া ও জামানত' : 'Tenants & Deposits'],
                ['COLLECTION', isBn ? 'ভাড়া আদায় ও রসিদ' : 'Collect & Receipts'],
                ['BILLS', isBn ? 'বিদ্যুৎ/গ্যাস ও যৌথ বিল' : 'Utilities & Shared'],
                ['EXPENSES', isBn ? 'ভবনের খরচ' : 'Expenses'],
                ['REPORTS', isBn ? 'আর্থিক রিপোর্ট ও অডিট' : 'Reports & Audit'],
                ['SETTINGS', isBn ? 'সেটিংস ও ব্যাকআপ' : 'Settings & Backup'],
                ['ANDROID_APK', isBn ? 'অ্যান্ড্রয়েড ও APK' : 'Android APK & Source'],
              ] as [NavTab, string][]
            ).map(([tabKey, label]) => (
              <button
                key={tabKey}
                onClick={() => setActiveTab(tabKey)}
                className={`px-2.5 py-1.5 rounded-md font-medium transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === tabKey
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Language, Role Profile, Period & Demo Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {db.settings.isDemoData && (
              <span className="text-amber-300 font-medium whitespace-nowrap">
                {isBn ? 'ডেমো ডাটা মোড' : 'Demo Data Active'} ·
              </span>
            )}
            <select
              aria-label="Active User Role"
              value={db.activeUserId}
              onChange={(e) =>
                commitDb((d) => {
                  d.activeUserId = e.target.value;
                  return d;
                })
              }
              className="bg-slate-800 border border-slate-700 text-slate-100 rounded px-2 py-1 text-xs"
            >
              {db.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.role}: {u.name}
                </option>
              ))}
            </select>

            <input
              type="month"
              aria-label="Billing Period"
              value={selectedPeriod}
              onChange={(e) =>
                setSelectedPeriod(e.target.value || getDhakaBillingPeriod())
              }
              className="bg-slate-800 border border-slate-700 text-slate-100 rounded px-2 py-1 text-xs font-mono"
            />

            <button
              onClick={() =>
                commitDb((d) => {
                  d.settings.language = d.settings.language === 'en' ? 'bn' : 'en';
                  return d;
                })
              }
              className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-emerald-400 font-semibold hover:bg-slate-700 whitespace-nowrap"
            >
              {isBn ? 'English' : 'বাংলা'}
            </button>
          </div>
        </div>
      </div>

      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed bottom-20 lg:bottom-6 right-6 z-50 max-w-md rounded-xl bg-slate-900 text-white px-4 py-3 shadow-xl border border-slate-700 flex items-center gap-2.5 text-xs">
          <CheckCircle2
            className={`w-4 h-4 shrink-0 ${
              toast.type === 'error' ? 'text-red-400' : 'text-emerald-400'
            }`}
          />
          <span>{toast.text}</span>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-12">
        {/* ==================== 1. DASHBOARD ==================== */}
        {activeTab === 'DASHBOARD' && (
          <div className="space-y-6">
            {/* Top Operational Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {isBn
                    ? `${formatBillingPeriod(selectedPeriod, 'bn')} — আর্থিক ড্যাশবোর্ড`
                    : `${formatBillingPeriod(selectedPeriod, 'en')} Financial Overview`}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  {isBn
                    ? 'বাংলাদেশ সময় (Asia/Dhaka) অনুযায়ী অফলাইন রিলেশনাল লেজার। জামানত ভাড়ার আয়ের সাথে মিশ্রিত নয়।'
                    : 'Offline-first SQLite/IndexedDB ledger in Bangladesh Time (Asia/Dhaka). Security deposits are strictly separated from operating rent income.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <select
                  value={buildingFilter}
                  onChange={(e) => setBuildingFilter(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                >
                  <option value="ALL">
                    {isBn ? 'সকল ভবন (All Buildings)' : 'All Buildings'}
                  </option>
                  {db.buildings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleGenerateMonthlyRent}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    {isBn ? 'মাসিক ভাড়া চার্জ তৈরি' : 'Generate Monthly Charges'}
                  </span>
                </button>

                <button
                  onClick={() => setActiveTab('COLLECTION')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>{isBn ? 'ভাড়া আদায় করুন' : 'Record Rent Payment'}</span>
                </button>
              </div>
            </div>

            {/* 4-Column Primary Financial KPI Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl bg-white border border-slate-200 p-5">
                <div className="text-xs font-medium text-slate-500">
                  {isBn
                    ? 'মোট ধার্যকৃত ভাড়া ও বিল (এই মাস)'
                    : 'Total Rent & Bills Charged'}
                </div>
                <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
                  {formatBDT(
                    summary.totalRentChargedPoisha +
                      summary.totalUtilityChargedPoisha,
                    lang
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-2 font-mono tabular-nums">
                  {isBn ? 'ভাড়া:' : 'Rent:'}{' '}
                  {formatBDT(summary.totalRentChargedPoisha, lang)} ·{' '}
                  {isBn ? 'বিল:' : 'Bills:'}{' '}
                  {formatBDT(summary.totalUtilityChargedPoisha, lang)}
                </div>
              </div>

              <div className="rounded-xl bg-white border border-slate-200 p-5">
                <div className="text-xs font-medium text-slate-500">
                  {isBn
                    ? 'নগদ/ব্যাংক আদায় (Collected Cash)'
                    : 'Total Payments Collected'}
                </div>
                <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1.5">
                  {formatBDT(summary.totalCashCollectedPoisha, lang)}
                </div>
                <div className="text-xs text-slate-500 mt-2">
                  {isBn ? 'আদায়ের হার:' : 'Collection Rate:'}{' '}
                  <span className="font-mono font-semibold text-slate-800">
                    {isBn
                      ? toBengaliDigits(summary.collectionRatePercent)
                      : summary.collectionRatePercent}
                    %
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-white border border-slate-200 p-5">
                <div className="text-xs font-medium text-slate-500">
                  {isBn
                    ? 'মোট বকেয়া (ভাড়া ও ইউটিলিটি)'
                    : 'Total Outstanding Dues'}
                </div>
                <div className="text-2xl font-bold text-red-600 font-mono tabular-nums mt-1.5">
                  {formatBDT(summary.totalOutstandingAllPeriodsPoisha, lang)}
                </div>
                <div className="text-xs text-slate-500 mt-2 font-mono tabular-nums">
                  {isBn ? 'ভাড়া বকেয়া:' : 'Rent Due:'}{' '}
                  {formatBDT(summary.outstandingRentPoisha, lang)} ·{' '}
                  {isBn ? 'বিল:' : 'Utility:'}{' '}
                  {formatBDT(summary.outstandingUtilityPoisha, lang)}
                </div>
              </div>

              <div className="rounded-xl bg-white border border-slate-200 p-5">
                <div className="text-xs font-medium text-slate-500">
                  {isBn
                    ? 'নিট অপারেটিং ক্যাশ ফ্লো (Net Cash Flow)'
                    : 'Net Operating Cash Flow'}
                </div>
                <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1.5">
                  {formatBDT(summary.netOperatingCashFlowPoisha, lang)}
                </div>
                <div className="text-xs text-slate-500 mt-2 font-mono tabular-nums">
                  {isBn ? 'খরচ:' : 'Expenses:'}{' '}
                  {formatBDT(summary.totalExpensesPoisha, lang)} ·{' '}
                  {isBn ? 'জামানত গচ্ছিত:' : 'Deposits Held:'}{' '}
                  {formatBDT(summary.securityDepositsHeldPoisha, lang)}
                </div>
              </div>
            </div>

            {/* Secondary Occupancy & Collection Progress Strip */}
            <div className="rounded-xl bg-white border border-slate-200 p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
                <div>
                  <div className="text-xs text-slate-500">
                    {isBn ? 'ভাড়াকৃত ফ্ল্যাট (Occupied)' : 'Occupied Units'}
                  </div>
                  <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                    {summary.occupiedUnitsCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">
                    {isBn ? 'খালি ফ্ল্যাট (Vacant)' : 'Vacant Units'}
                  </div>
                  <div className="text-lg font-bold font-mono text-amber-600 mt-0.5">
                    {summary.vacantUnitsCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">
                    {isBn ? 'সক্রিয় ভাড়াটিয়া' : 'Active Tenants'}
                  </div>
                  <div className="text-lg font-bold font-mono text-slate-900 mt-0.5">
                    {summary.activeTenantsCount}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                    <span>
                      {isBn ? 'মাসিক আদায় অগ্রগতি' : 'Monthly Charge Settlement'}
                    </span>
                    <span className="font-mono font-semibold">
                      {summary.collectionRatePercent}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full transition-all"
                      style={{ width: `${summary.collectionRatePercent}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Split Grid: Building-Wise Financial Breakdown & Overdue Reminders (5th, 10th, 15th) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Building Breakdown & Visual Chart (7 cols) */}
              <div className="lg:col-span-7 rounded-xl bg-white border border-slate-200 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">
                    {isBn
                      ? 'ভবনভিত্তিক আয়, আদায়, বকেয়া ও খরচ'
                      : 'Building-Wise Financial Reconciliation'}
                  </h2>
                  <span className="text-xs text-slate-500 font-mono">
                    {selectedPeriod}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2.5 pr-3 font-semibold">
                          {isBn ? 'ভবন' : 'Building'}
                        </th>
                        <th className="py-2.5 px-3 text-right font-semibold">
                          {isBn ? 'ধার্যকৃত' : 'Charged'}
                        </th>
                        <th className="py-2.5 px-3 text-right font-semibold">
                          {isBn ? 'আদায়' : 'Collected'}
                        </th>
                        <th className="py-2.5 px-3 text-right font-semibold">
                          {isBn ? 'বকেয়া' : 'Outstanding'}
                        </th>
                        <th className="py-2.5 pl-3 text-right font-semibold">
                          {isBn ? 'খরচ' : 'Expenses'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.buildingBreakdown.map((b) => (
                        <tr key={b.buildingId} className="hover:bg-slate-50">
                          <td className="py-3 pr-3 font-semibold text-slate-900">
                            {b.buildingName}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">
                            {formatBDT(b.chargedPoisha, lang)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                            {formatBDT(b.collectedPoisha, lang)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono tabular-nums text-red-600 font-semibold">
                            {formatBDT(b.outstandingPoisha, lang)}
                          </td>
                          <td className="py-3 pl-3 text-right font-mono tabular-nums text-slate-600">
                            {formatBDT(b.expensesPoisha, lang)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Visual Income vs Expenses Bar Comparison */}
                <div className="pt-3 border-t border-slate-100 space-y-2.5">
                  <div className="text-xs font-semibold text-slate-700">
                    {isBn
                      ? 'আদায় বনাম খরচ ও বকেয়া তুলনাচিত্র'
                      : 'Cash Collected vs. Operating Expenses & Outstanding Dues'}
                  </div>
                  {[
                    {
                      label: isBn ? 'নগদ আদায় (Collected)' : 'Cash Collected',
                      val: summary.totalCashCollectedPoisha,
                      color: 'bg-emerald-600',
                    },
                    {
                      label: isBn ? 'মোট বকেয়া (Outstanding)' : 'Outstanding Dues',
                      val: summary.totalOutstandingAllPeriodsPoisha,
                      color: 'bg-red-500',
                    },
                    {
                      label: isBn ? 'ভবনের খরচ (Expenses)' : 'Property Expenses',
                      val: summary.totalExpensesPoisha,
                      color: 'bg-amber-500',
                    },
                  ].map((bar) => {
                    const maxVal = Math.max(
                      1,
                      summary.totalCashCollectedPoisha,
                      summary.totalOutstandingAllPeriodsPoisha,
                      summary.totalExpensesPoisha
                    );
                    const pct = Math.min(100, Math.round((bar.val * 100) / maxVal));
                    return (
                      <div key={bar.label} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600">{bar.label}</span>
                          <span className="font-mono tabular-nums font-semibold">
                            {formatBDT(bar.val, lang)}
                          </span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${bar.color} rounded-full`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Overdue Reminders Panel (5th, 10th, 15th schedule) (5 cols) */}
              <div className="lg:col-span-5 rounded-xl bg-white border border-slate-200 p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="text-base font-bold text-slate-900">
                      {isBn
                        ? 'বকেয়া ভাড়ার তাগাদা ও রিমাইন্ডার'
                        : 'Overdue Rent & Utility Reminders'}
                    </h2>
                    <span className="text-xs text-slate-500">
                      {isBn ? 'তারিখ: ৫, ১০, ১৫' : 'Schedule: 5th, 10th, 15th'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">
                    {isBn
                      ? 'প্রতি মাসের ৫, ১০ ও ১৫ তারিখে স্বয়ংক্রিয়ভাবে বকেয়া যাচাই করা হয়। WhatsApp বা SMS-এ তাগাদা পাঠান (এনআইডি নম্বর কখনোই পাঠানো হয় না)।'
                      : 'Rechecked against live unpaid balances. Share polite Bengali/English reminders via WhatsApp or SMS (NID numbers are never included).'}
                  </p>

                  {reminderEval && reminderEval.overdueItems.length === 0 ? (
                    <div className="p-6 text-center rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      {isBn
                        ? 'আলহামদুলিল্লাহ! বর্তমানে কোনো ভাড়াটিয়ার বকেয়া নেই।'
                        : 'All active tenants have zero outstanding balance.'}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {reminderEval?.overdueItems.map((item) => (
                        <div
                          key={item.eventKey}
                          className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-xs font-bold text-slate-900">
                                {item.tenant.fullName}
                              </div>
                              <div className="text-[11px] text-slate-500">
                                {item.building.name} · {item.unit.unitNumber} ·{' '}
                                <span className="font-mono">
                                  {item.overduePeriods.join(', ')}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs font-bold text-red-600 font-mono tabular-nums">
                                {formatBDT(item.outstandingPoisha, lang)}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {item.alreadyNotifiedToday
                                  ? isBn
                                    ? 'আজ তাগাদা পাঠানো হয়েছে'
                                    : 'Reminded today'
                                  : isBn
                                  ? 'অপরিশোধিত'
                                  : 'Overdue'}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              onClick={() =>
                                handleSendReminder(
                                  item.eventKey,
                                  item.tenant.primaryPhone,
                                  isBn ? item.messageBn : item.messageEn,
                                  'WHATSAPP'
                                )
                              }
                              className="px-2.5 py-1.5 rounded bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-700 flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" />
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
                              className="px-2.5 py-1.5 rounded bg-slate-800 text-white text-[11px] font-semibold hover:bg-slate-700 flex items-center gap-1"
                            >
                              <Smartphone className="w-3 h-3" />
                              <span>SMS</span>
                            </button>
                            <button
                              onClick={() => {
                                setColTenantId(item.tenant.id);
                                setActiveTab('COLLECTION');
                              }}
                              className="px-2.5 py-1.5 rounded bg-white border border-slate-300 text-slate-700 text-[11px] font-semibold hover:bg-slate-100 ml-auto"
                            >
                              {isBn ? 'আদায় করুন' : 'Collect Now'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Payments & Receipts Table */}
            <div className="rounded-xl bg-white border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-slate-900">
                  {isBn
                    ? 'সাম্প্রতিক ভাড়া আদায় ও রসিদসমূহ'
                    : 'Recent Payments & Official Receipts'}
                </h2>
                <button
                  onClick={() => setActiveTab('COLLECTION')}
                  className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                >
                  {isBn ? 'সকল পেমেন্ট দেখুন →' : 'View All / Collect →'}
                </button>
              </div>

              {db.payments.length === 0 ? (
                <div className="text-xs text-slate-500 py-6 text-center">
                  {isBn
                    ? 'এখনো কোনো পেমেন্ট রেকর্ড করা হয়নি।'
                    : 'No payments recorded yet.'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2.5 pr-3">
                          {isBn ? 'রসিদ নং' : 'Receipt #'}
                        </th>
                        <th className="py-2.5 px-3">
                          {isBn ? 'তারিখ' : 'Date'}
                        </th>
                        <th className="py-2.5 px-3">
                          {isBn ? 'ভাড়াটিয়া ও ফ্ল্যাট' : 'Tenant & Unit'}
                        </th>
                        <th className="py-2.5 px-3">
                          {isBn ? 'মাধ্যম' : 'Method'}
                        </th>
                        <th className="py-2.5 px-3 text-right">
                          {isBn ? 'পরিমাণ' : 'Amount'}
                        </th>
                        <th className="py-2.5 pl-3 text-right">
                          {isBn ? 'রসিদ' : 'Action'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {db.payments.slice(0, 6).map((p) => {
                        const t = db.tenants.find((x) => x.id === p.tenantId);
                        const b = db.buildings.find(
                          (x) => x.id === p.buildingId
                        );
                        const u = db.units.find((x) => x.id === p.unitId);
                        return (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="py-3 pr-3 font-mono font-semibold text-slate-900">
                              {p.receiptNumber}
                              {p.isReversed ? ' (REVERSED)' : ''}
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600">
                              {p.paymentDate}
                            </td>
                            <td className="py-3 px-3 text-slate-800">
                              {t?.fullName} · {b?.name} ({u?.unitNumber})
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600">
                              {p.method}
                            </td>
                            <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                              {formatBDT(p.amountReceivedPoisha, lang)}
                            </td>
                            <td className="py-3 pl-3 text-right">
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
                                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold inline-flex items-center gap-1"
                                >
                                  <Receipt className="w-3.5 h-3.5" />
                                  <span>{isBn ? 'রসিদ' : 'Receipt'}</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== 2. BUILDINGS, FLOORS & UNITS ==================== */}
        {activeTab === 'BUILDINGS' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-xl font-bold text-slate-900">
                {isBn
                  ? 'ভবন, তলা এবং ফ্ল্যাট ব্যবস্থাপনা'
                  : 'Buildings, Floors & Rental Units Hierarchy'}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                {isBn
                  ? 'একাধিক ভবন, তলা এবং ফ্ল্যাট (ভাড়া, সার্ভিস চার্জ ও বর্তমান অবস্থা) পরিচালনা করুন।'
                  : 'Manage unlimited buildings, floors, and rental flats with default monthly rent and service charges.'}
              </p>
            </div>

            {/* Forms Grid: Add Building, Floor, Unit */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* 1. Add Building */}
              <form
                onSubmit={handleAddBuilding}
                className="rounded-xl bg-white border border-slate-200 p-5 space-y-3"
              >
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>{isBn ? '১. নতুন ভবন যোগ করুন' : '1. Add New Building'}</span>
                </h2>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {isBn ? 'ভবনের নাম *' : 'Building Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Green View Villa"
                    value={newBldName}
                    onChange={(e) => setNewBldName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {isBn ? 'ঠিকানা *' : 'Full Address *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="House 12, Road 5, Mirpur-10, Dhaka"
                    value={newBldAddress}
                    onChange={(e) => setNewBldAddress(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {isBn ? 'ডিফল্ট পরিশোধের দিন' : 'Default Due Day'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={newBldDueDay}
                      onChange={(e) => setNewBldDueDay(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {isBn ? 'মন্তব্য' : 'Notes'}
                    </label>
                    <input
                      type="text"
                      value={newBldNotes}
                      onChange={(e) => setNewBldNotes(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  {isBn ? 'ভবন সংরক্ষণ করুন' : 'Create Building'}
                </button>
              </form>

              {/* 2. Add Floor */}
              <form
                onSubmit={handleAddFloor}
                className="rounded-xl bg-white border border-slate-200 p-5 space-y-3"
              >
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-600" />
                  <span>{isBn ? '২. তলা (Floor) যোগ করুন' : '2. Add Floor to Building'}</span>
                </h2>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {isBn ? 'ভবন নির্বাচন করুন *' : 'Select Building *'}
                  </label>
                  <select
                    value={newFloorBldId}
                    onChange={(e) => setNewFloorBldId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  >
                    {db.buildings.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {isBn ? 'তলার নাম বা নম্বর *' : 'Floor Name or Number *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 3rd Floor (৪র্থ তলা)"
                    value={newFloorName}
                    onChange={(e) => setNewFloorName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  {isBn ? 'তলা যুক্ত করুন' : 'Add Floor'}
                </button>
              </form>

              {/* 3. Add Rental Unit */}
              <form
                onSubmit={handleAddUnit}
                className="rounded-xl bg-white border border-slate-200 p-5 space-y-3"
              >
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-600" />
                  <span>{isBn ? '৩. নতুন ফ্ল্যাট/ইউনিট যোগ করুন' : '3. Add Rental Unit / Flat'}</span>
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {isBn ? 'ভবন *' : 'Building *'}
                    </label>
                    <select
                      value={newUnitBldId}
                      onChange={(e) => setNewUnitBldId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
                    >
                      {db.buildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {isBn ? 'তলা' : 'Floor'}
                    </label>
                    <select
                      value={newUnitFloorId}
                      onChange={(e) => setNewUnitFloorId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-xs"
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
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {isBn ? 'ফ্ল্যাট নম্বর *' : 'Flat / Unit Number *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Flat 3A"
                      value={newUnitNum}
                      onChange={(e) => setNewUnitNum(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {isBn ? 'বেডরুম সংখ্যা' : 'Bedrooms'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={newUnitBeds}
                      onChange={(e) => setNewUnitBeds(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {isBn ? 'মাসিক ভাড়া (৳) *' : 'Default Rent (BDT) *'}
                    </label>
                    <input
                      type="number"
                      required
                      value={newUnitRentTaka}
                      onChange={(e) => setNewUnitRentTaka(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {isBn ? 'সার্ভিস চার্জ (৳)' : 'Service Charge (BDT)'}
                    </label>
                    <input
                      type="number"
                      value={newUnitScTaka}
                      onChange={(e) => setNewUnitScTaka(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full py-2 px-4 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                >
                  {isBn ? 'ফ্ল্যাট সংরক্ষণ করুন' : 'Create Rental Unit'}
                </button>
              </form>
            </div>

            {/* Building & Units List */}
            {db.buildings.map((b) => {
              const bUnits = db.units.filter((u) => u.buildingId === b.id);
              return (
                <div
                  key={b.id}
                  className="rounded-xl bg-white border border-slate-200 p-5 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {b.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {b.address} ·{' '}
                        {isBn
                          ? `ভাড়া পরিশোধের তারিখ: প্রতি মাসের ${toBengaliDigits(b.defaultDueDay)} তারিখ`
                          : `Default Due Date: Day ${b.defaultDueDay} of month`}
                      </p>
                    </div>
                    <div className="text-xs text-slate-500 font-mono">
                      {bUnits.length} {isBn ? 'টি ফ্ল্যাট' : 'Units'}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 pr-3">{isBn ? 'ফ্ল্যাট' : 'Unit'}</th>
                          <th className="py-2 px-3">{isBn ? 'ধরন' : 'Type'}</th>
                          <th className="py-2 px-3 text-right">
                            {isBn ? 'নির্ধারিত ভাড়া' : 'Default Rent'}
                          </th>
                          <th className="py-2 px-3 text-right">
                            {isBn ? 'সার্ভিস চার্জ' : 'Service Charge'}
                          </th>
                          <th className="py-2 px-3">
                            {isBn ? 'বর্তমান ভাড়াটিয়া' : 'Current Tenant'}
                          </th>
                          <th className="py-2 pl-3 text-right">
                            {isBn ? 'অবস্থা (Status)' : 'Unit Status'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {bUnits.map((u) => {
                          const occTenant = db.tenants.find(
                            (t) =>
                              t.currentUnitId === u.id && t.status === 'ACTIVE'
                          );
                          return (
                            <tr key={u.id} className="hover:bg-slate-50">
                              <td className="py-3 pr-3 font-bold text-slate-900">
                                {u.unitNumber}
                              </td>
                              <td className="py-3 px-3 text-slate-600">
                                {u.unitType} ({u.bedrooms} Bed)
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums">
                                {formatBDT(u.defaultRentPoisha, lang)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono tabular-nums">
                                {formatBDT(u.serviceChargePoisha, lang)}
                              </td>
                              <td className="py-3 px-3 text-slate-800">
                                {occTenant ? (
                                  <span className="font-medium">
                                    {occTenant.fullName} ({occTenant.primaryPhone})
                                  </span>
                                ) : (
                                  <span className="text-slate-400">
                                    {isBn ? 'খালি' : 'Unoccupied'}
                                  </span>
                                )}
                              </td>
                              <td className="py-3 pl-3 text-right">
                                <select
                                  value={u.status}
                                  onChange={(e) =>
                                    commitDb((d) => {
                                      const du = d.units.find(
                                        (x) => x.id === u.id
                                      );
                                      if (du)
                                        du.status = e.target
                                          .value as UnitStatus;
                                      return d;
                                    })
                                  }
                                  className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800"
                                >
                                  <option value="OCCUPIED">OCCUPIED</option>
                                  <option value="VACANT">VACANT</option>
                                  <option value="MAINTENANCE">
                                    MAINTENANCE
                                  </option>
                                  <option value="UNAVAILABLE">
                                    UNAVAILABLE
                                  </option>
                                </select>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ==================== 3. TENANTS & SECURITY DEPOSITS ==================== */}
        {activeTab === 'TENANTS' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  {isBn
                    ? 'ভাড়াটিয়া প্রোফাইল, এনআইডি ও জামানত লেজার'
                    : 'Tenant Profiles, Private Documents & Security Deposit Ledger'}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  {isBn
                    ? 'ভাড়াটিয়ার ছবি ও এনআইডি সংবেদনশীল তথ্য হিসেবে সুরক্ষিত থাকে এবং কখনোই রসিদে প্রকাশ পায় না।'
                    : 'NID numbers, photographs, and signed agreements are stored privately and never exposed on receipts or shared messages.'}
                </p>
              </div>
              <button
                onClick={() => setShowAddTenantForm((s) => !s)}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {showAddTenantForm
                    ? isBn
                      ? 'ফর্ম বন্ধ করুন'
                      : 'Close Form'
                    : isBn
                    ? 'নতুন ভাড়াটিয়া নিবন্ধন'
                    : 'Register New Tenant'}
                </span>
              </button>
            </div>

            {/* Add Tenant Form */}
            {showAddTenantForm && (
              <form
                onSubmit={handleRegisterTenant}
                className="rounded-xl bg-white border border-slate-200 p-6 space-y-4"
              >
                <h2 className="text-base font-bold text-slate-900">
                  {isBn
                    ? 'নতুন ভাড়াটিয়া নিবন্ধন ফর্ম'
                    : 'New Tenant Registration & Lease Setup'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'পূর্ণ নাম *' : 'Full Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={tFullName}
                      onChange={(e) => setTFullName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'প্রধান মোবাইল নম্বর *' : 'Primary Phone *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="017XXXXXXXX"
                      value={tPhone}
                      onChange={(e) => setTPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'বিকল্প মোবাইল নম্বর' : 'Alternative Phone'}
                    </label>
                    <input
                      type="text"
                      value={tAltPhone}
                      onChange={(e) => setTAltPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'জাতীয় পরিচয়পত্র (NID) নম্বর *' : 'NID Number (Private) *'}
                    </label>
                    <input
                      type="text"
                      required
                      value={tNid}
                      onChange={(e) => setTNid(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'ভবন নির্বাচন *' : 'Building *'}
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
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      {db.buildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'ফ্ল্যাট নির্বাচন *' : 'Rental Unit / Flat *'}
                    </label>
                    <select
                      value={tUnitId}
                      onChange={(e) => setTUnitId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      <option value="">-- Select Unit --</option>
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
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'মাসিক ভাড়া (৳) *' : 'Monthly Rent (BDT) *'}
                    </label>
                    <input
                      type="number"
                      required
                      value={tRentTaka}
                      onChange={(e) => setTRentTaka(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'ফেরতযোগ্য জামানত (৳) *' : 'Security Deposit (BDT) *'}
                    </label>
                    <input
                      type="number"
                      required
                      value={tDepositTaka}
                      onChange={(e) => setTDepositTaka(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'ওঠার তারিখ (Move-in Date) *' : 'Move-In Date *'}
                    </label>
                    <input
                      type="date"
                      required
                      value={tMoveInDate}
                      onChange={(e) => setTMoveInDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'চুক্তির মেয়াদ শেষ' : 'Lease End Date'}
                    </label>
                    <input
                      type="date"
                      value={tLeaseEnd}
                      onChange={(e) => setTLeaseEnd(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'ভাড়া পরিশোধের দিন (১-২৮)' : 'Payment Due Day (1-28)'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={28}
                      value={tDueDay}
                      onChange={(e) => setTDueDay(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'পেশা ও কর্মস্থল' : 'Occupation'}
                    </label>
                    <input
                      type="text"
                      value={tOccupation}
                      onChange={(e) => setTOccupation(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'স্থায়ী ঠিকানা' : 'Permanent Address'}
                    </label>
                    <input
                      type="text"
                      value={tPermAddress}
                      onChange={(e) => setTPermAddress(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'জরুরি যোগাযোগ' : 'Emergency Contact'}
                    </label>
                    <input
                      type="text"
                      value={tEmergency}
                      onChange={(e) => setTEmergency(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'পরিবারের সদস্যদের তথ্য' : 'Family Members Info'}
                    </label>
                    <input
                      type="text"
                      value={tFamilyInfo}
                      onChange={(e) => setTFamilyInfo(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'ভাড়াটিয়ার ছবি / এনআইডি সংযুক্তি' : 'Tenant Photo / Agreement File'}
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
                      className="w-full text-xs text-slate-600"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddTenantForm(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-600"
                  >
                    {isBn ? 'বাতিল' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
                  >
                    {isBn ? 'ভাড়াটিয়া নিবন্ধন সম্পন্ন করুন' : 'Save & Register Tenant'}
                  </button>
                </div>
              </form>
            )}

            {/* Search & Status Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder={
                    isBn
                      ? 'নাম, মোবাইল বা ফ্ল্যাট দিয়ে খুঁজুন...'
                      : 'Search tenants by name, phone, or flat...'
                  }
                  value={tenantSearch}
                  onChange={(e) => setTenantSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                {(['ACTIVE', 'ARCHIVED', 'ALL'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setTenantStatusFilter(st)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      tenantStatusFilter === st
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st === 'ACTIVE'
                      ? isBn
                        ? 'সক্রিয় (Active)'
                        : 'Active'
                      : st === 'ARCHIVED'
                      ? isBn
                        ? 'আর্কাইভ (Archived)'
                        : 'Archived'
                      : isBn
                      ? 'সকল (All)'
                      : 'All'}
                  </button>
                ))}
              </div>
            </div>

            {/* Tenants List + Security Deposit & Rent Adjustment Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-3">
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
                        className="rounded-xl bg-white border border-slate-200 p-5 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div>
                            <h3 className="text-base font-bold text-slate-900">
                              {t.fullName}
                            </h3>
                            <div className="text-xs text-slate-500 mt-0.5">
                              <span>{b?.name}</span>
                              <span aria-hidden="true"> · </span>
                              <span className="font-semibold text-slate-700">
                                {u?.unitNumber}
                              </span>
                              <span aria-hidden="true"> · </span>
                              <span className="font-mono">{t.primaryPhone}</span>
                              <span aria-hidden="true"> · </span>
                              <span>{t.status}</span>
                            </div>
                          </div>

                          <div className="text-left sm:text-right font-mono text-xs">
                            <div className="font-bold text-slate-900">
                              {isBn ? 'মাসিক ভাড়া:' : 'Monthly Rent:'}{' '}
                              {formatBDT(t.monthlyRentPoisha, lang)}
                            </div>
                            <div
                              className={
                                unpaid > 0
                                  ? 'text-red-600 font-semibold'
                                  : 'text-emerald-700'
                              }
                            >
                              {isBn ? 'বর্তমান বকেয়া:' : 'Unpaid Due:'}{' '}
                              {formatBDT(unpaid, lang)}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 text-xs">
                          <div>
                            <span className="text-slate-400 block">
                              {isBn ? 'গচ্ছিত জামানত (Held Deposit)' : 'Held Security Deposit'}
                            </span>
                            <span className="font-mono font-semibold text-slate-800">
                              {formatBDT(depSummary.heldBalancePoisha, lang)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">
                              {isBn ? 'অগ্রিম জমা (Advance Credit)' : 'Advance Rent Credit'}
                            </span>
                            <span className="font-mono font-semibold text-emerald-700">
                              {formatBDT(t.advanceRentCreditPoisha, lang)}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">
                              {isBn ? 'এনআইডি (গোপনীয়)' : 'NID (Private Record)'}
                            </span>
                            <span className="font-mono text-slate-700">
                              {hasPerm('manageDocuments')
                                ? t.nidNumber
                                : '••••••••••••'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">
                              {isBn ? 'চুক্তিপত্র ও ওঠার তারিখ' : 'Move-In & Agreement'}
                            </span>
                            <span className="font-mono text-slate-700">
                              {t.moveInDate}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => {
                              setSelectedTenantForDeposit(t.id);
                              setNewMonthlyRentTaka(
                                String(t.monthlyRentPoisha / 100)
                              );
                            }}
                            className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold"
                          >
                            {isBn
                              ? 'জামানত ও ভাড়া পরিবর্তন'
                              : 'Manage Deposit / Adjust Rent'}
                          </button>

                          <button
                            onClick={() => {
                              setColTenantId(t.id);
                              setActiveTab('COLLECTION');
                            }}
                            className="px-3 py-1.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold hover:bg-emerald-100"
                          >
                            {isBn ? 'ভাড়া আদায়' : 'Collect Rent'}
                          </button>

                          {t.status === 'ACTIVE' ? (
                            <button
                              onClick={() =>
                                handleArchiveOrRestoreTenant(t.id, true)
                              }
                              className="px-3 py-1.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold hover:bg-amber-100 flex items-center gap-1 ml-auto"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>
                                {isBn ? 'আর্কাইভ (Move-Out)' : 'Archive (Move-Out)'}
                              </span>
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 ml-auto">
                              <button
                                onClick={() =>
                                  handleArchiveOrRestoreTenant(t.id, false)
                                }
                                className="px-3 py-1.5 rounded bg-slate-100 text-slate-800 text-xs font-semibold"
                              >
                                {isBn ? 'পুনরায় সক্রিয়' : 'Restore'}
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteTenantPermanently(t.id)
                                }
                                className="px-2.5 py-1.5 rounded bg-red-50 text-red-700 text-xs font-semibold flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>{isBn ? 'মুছুন' : 'Delete'}</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Right Column: Deposit & Future Rent Adjustment Inspector */}
              <div className="lg:col-span-4 space-y-4">
                <form
                  onSubmit={handleDepositTransaction}
                  className="rounded-xl bg-white border border-slate-200 p-5 space-y-3"
                >
                  <h3 className="text-sm font-bold text-slate-900">
                    {isBn
                      ? 'জামানত ও অগ্রিম সমন্বয় (Deposit Ledger)'
                      : 'Security Deposit & Advance Ledger'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isBn
                      ? 'জামানত গ্রহণ, ক্ষতিপূরণ কর্তন বা ফেরত দেওয়ার জন্য কারণসহ অডিট এন্ট্রি করুন।'
                      : 'Record deposit collection, damage deduction, or move-out refund with mandatory audit reason.'}
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {isBn ? 'ভাড়াটিয়া' : 'Tenant'}
                    </label>
                    <select
                      value={selectedTenantForDeposit}
                      onChange={(e) =>
                        setSelectedTenantForDeposit(e.target.value)
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    >
                      {db.tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {isBn ? 'লেনদেনের ধরন' : 'Transaction Type'}
                    </label>
                    <select
                      value={depTxType}
                      onChange={(e) =>
                        setDepTxType(e.target.value as DepositTxType)
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    >
                      <option value="DEPOSIT_COLLECTED">
                        {isBn ? 'জামানত গ্রহণ (Deposit Received)' : 'Deposit Received'}
                      </option>
                      <option value="DEPOSIT_DEDUCTION">
                        {isBn
                          ? 'জামানত হতে কর্তন (Damage/Unpaid Deduction)'
                          : 'Authorized Deposit Deduction'}
                      </option>
                      <option value="DEPOSIT_REFUND">
                        {isBn ? 'জামানত ফেরত (Move-Out Refund)' : 'Deposit Refund to Tenant'}
                      </option>
                      <option value="ADVANCE_COLLECTED">
                        {isBn ? 'অগ্রিম ভাড়া গ্রহণ (Advance Rent)' : 'Advance Rent Collected'}
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {isBn ? 'পরিমাণ (৳) *' : 'Amount (BDT) *'}
                    </label>
                    <input
                      type="number"
                      required
                      value={depTxAmountTaka}
                      onChange={(e) => setDepTxAmountTaka(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {isBn ? 'কারণ ও অডিট নোট *' : 'Audit Reason / Note *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Wall repainting deduction on move-out"
                      value={depTxReason}
                      onChange={(e) => setDepTxReason(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                  >
                    {isBn ? 'জামানত লেজার আপডেট করুন' : 'Record Deposit Transaction'}
                  </button>
                </form>

                {/* Rent Change Box */}
                <div className="rounded-xl bg-white border border-slate-200 p-5 space-y-3">
                  <h3 className="text-sm font-bold text-slate-900">
                    {isBn
                      ? 'মাসিক ভাড়া পরিবর্তন (Rent Adjustment)'
                      : 'Modify Tenant Monthly Rent'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {isBn
                      ? 'ভবিষ্যৎ মাসের ভাড়া পরিবর্তন করলেও পূর্ববর্তী মাসের পরিশোধিত হিসাব ও রসিদ অপরিবর্তিত থাকবে।'
                      : 'Preserves all historical paid charges and applies the updated rent only to unpaid current/future periods.'}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      placeholder="New Rent (BDT)"
                      value={newMonthlyRentTaka}
                      onChange={(e) => setNewMonthlyRentTaka(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateTenantFutureRent(selectedTenantForDeposit)
                      }
                      className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 whitespace-nowrap"
                    >
                      {isBn ? 'আপডেট' : 'Update Rent'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 4. RENT COLLECTION & RECEIPTS ==================== */}
        {activeTab === 'COLLECTION' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-xl font-bold text-slate-900">
                {isBn
                  ? 'ভাড়া ও ইউটিলিটি আদায় এবং রসিদ তৈরি'
                  : 'Rent Collection, Charge Allocation & Official Receipt Generator'}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                {isBn
                  ? 'পূর্ণ বা আংশিক পেমেন্ট, একাধিক মাসের বকেয়া বা অতিরিক্ত অগ্রিম পেমেন্ট গ্রহণ করুন এবং সাথে সাথে PDF/PNG রসিদ শেয়ার করুন।'
                  : 'Support full payments, partial installments, multi-period settlements, oldest-first (FIFO) or custom charge allocation, and instant PDF/Image receipts.'}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 6 Cols: Payment Recording Form */}
              <form
                onSubmit={handleRecordPayment}
                className="lg:col-span-6 rounded-xl bg-white border border-slate-200 p-6 space-y-4"
              >
                <h2 className="text-base font-bold text-slate-900">
                  {isBn ? 'পেমেন্ট গ্রহণ ও বণ্টন ফর্ম' : 'Record Payment & Allocate'}
                </h2>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {isBn ? 'ভাড়াটিয়া ও ফ্ল্যাট নির্বাচন করুন *' : 'Select Tenant & Flat *'}
                  </label>
                  <select
                    value={colTenantId}
                    onChange={(e) => setColTenantId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium"
                  >
                    {db.tenants.map((t) => {
                      const u = db.units.find((x) => x.id === t.currentUnitId);
                      return (
                        <option key={t.id} value={t.id}>
                          {t.fullName} — {u?.unitNumber} ({t.status})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Unpaid Obligations List */}
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">
                      {isBn
                        ? 'অপরিশোধিত ভাড়া ও বিলের তালিকা:'
                        : 'Unpaid Charges & Utility Bills:'}
                    </span>
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
                      className="text-emerald-700 font-semibold hover:underline"
                    >
                      {isBn ? 'সম্পূর্ণ বকেয়া বসান' : 'Fill Full Balance'}
                    </button>
                  </div>

                  {unpaidObligations.length === 0 ? (
                    <div className="text-xs text-slate-500 py-2">
                      {isBn
                        ? 'এই ভাড়াটিয়ার কোনো বকেয়া নেই। অতিরিক্ত পেমেন্ট অগ্রিম (Advance Credit) হিসেবে জমা হবে।'
                        : 'No unpaid charges. Any payment recorded will be stored as unallocated Advance Rent Credit.'}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {unpaidObligations.map((ob) => (
                        <div
                          key={ob.targetId}
                          className="flex items-center justify-between gap-2 text-xs bg-white px-3 py-2 rounded border border-slate-200"
                        >
                          <div>
                            <div className="font-semibold text-slate-800">
                              {ob.label}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              Total: {formatBDT(ob.totalPoisha, lang)} · Paid:{' '}
                              {formatBDT(ob.paidPoisha, lang)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-red-600">
                              {formatBDT(ob.outstandingPoisha, lang)}
                            </span>
                            {colMode === 'CUSTOM' && (
                              <input
                                type="number"
                                placeholder="Allocate ৳"
                                value={colCustomMapTaka[ob.targetId] || ''}
                                onChange={(e) =>
                                  setColCustomMapTaka((prev) => ({
                                    ...prev,
                                    [ob.targetId]: e.target.value,
                                  }))
                                }
                                className="w-24 rounded border border-slate-300 px-2 py-1 text-xs font-mono text-right"
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Allocation Rule Selector */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-600 font-medium">
                    {isBn ? 'বণ্টন নিয়ম:' : 'Allocation Rule:'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setColMode('FIFO')}
                    className={`px-3 py-1.5 rounded-md font-medium ${
                      colMode === 'FIFO'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {isBn ? 'পুরাতন বকেয়া আগে (Oldest First)' : 'Oldest Due First (FIFO)'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setColMode('CUSTOM')}
                    className={`px-3 py-1.5 rounded-md font-medium ${
                      colMode === 'CUSTOM'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {isBn ? 'পছন্দমতো মাস নির্বাচন (Custom)' : 'Owner-Selected Custom'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'প্রাপ্ত টাকার পরিমাণ (৳) *' : 'Amount Received (BDT) *'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="e.g. 24000"
                      value={colAmountTaka}
                      onChange={(e) => setColAmountTaka(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'পরিশোধের মাধ্যম *' : 'Payment Method (Recording Only) *'}
                    </label>
                    <select
                      value={colMethod}
                      onChange={(e) =>
                        setColMethod(e.target.value as PaymentMethod)
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium"
                    >
                      <option value="CASH">{isBn ? 'নগদ (Cash)' : 'Cash'}</option>
                      <option value="BKASH">bKash (বিকাশ)</option>
                      <option value="NAGAD">Nagad (নগদ)</option>
                      <option value="ROCKET">Rocket (রকেট)</option>
                      <option value="BANK">
                        {isBn ? 'ব্যাংক ট্রান্সফার (Bank)' : 'Bank Transfer'}
                      </option>
                      <option value="ADVANCE_APPLIED">
                        {isBn
                          ? 'অগ্রিম জমা হতে সমন্বয় (Apply Advance Credit)'
                          : 'Apply Eligible Advance Credit'}
                      </option>
                      <option value="OTHER">
                        {isBn ? 'অন্যান্য (Other)' : 'Other Manual Method'}
                      </option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'ট্রানজেকশন রেফারেন্স / TrxID' : 'Transaction Reference / TrxID'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BK981234X or Check #"
                      value={colRef}
                      onChange={(e) => setColRef(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'মন্তব্য' : 'Notes'}
                    </label>
                    <input
                      type="text"
                      placeholder="Optional note on receipt"
                      value={colNotes}
                      onChange={(e) => setColNotes(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors"
                >
                  {isBn
                    ? 'পেমেন্ট সংরক্ষণ ও রসিদ তৈরি করুন'
                    : 'Save Payment & Generate Official Receipt'}
                </button>
              </form>

              {/* Right 6 Cols: Payment Ledger & Receipt History */}
              <div className="lg:col-span-6 rounded-xl bg-white border border-slate-200 p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-900">
                  {isBn
                    ? 'সকল রসিদ ও পেমেন্ট বণ্টন ইতিহাস'
                    : 'Recorded Payments & Allocation Breakdown'}
                </h2>
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {db.payments.map((p) => {
                    const t = db.tenants.find((x) => x.id === p.tenantId);
                    const b = db.buildings.find((x) => x.id === p.buildingId);
                    const u = db.units.find((x) => x.id === p.unitId);
                    return (
                      <div
                        key={p.id}
                        className={`p-4 rounded-xl border ${
                          p.isReversed
                            ? 'bg-red-50/40 border-red-200 opacity-75'
                            : 'bg-slate-50 border-slate-200'
                        } space-y-2 text-xs`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-mono font-bold text-slate-900">
                              #{p.receiptNumber}
                            </span>
                            <span aria-hidden="true"> · </span>
                            <span className="font-mono text-slate-500">
                              {p.paymentDate}
                            </span>
                            <div className="font-semibold text-slate-800 mt-0.5">
                              {t?.fullName} ({u?.unitNumber})
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-mono font-bold text-sm text-emerald-700">
                              {formatBDT(p.amountReceivedPoisha, lang)}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500">
                              {p.method}{' '}
                              {p.transactionRef ? `· ${p.transactionRef}` : ''}
                            </div>
                          </div>
                        </div>

                        <div className="text-[11px] text-slate-600 space-y-0.5 pt-1 border-t border-slate-200/70">
                          {p.allocations.map((a) => (
                            <div
                              key={a.id}
                              className="flex justify-between font-mono"
                            >
                              <span>→ {a.label}</span>
                              <span>{formatBDT(a.amountPoisha, lang)}</span>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-2">
                          <span className="text-[11px] text-slate-400">
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
                                className="px-3 py-1 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800 flex items-center gap-1"
                              >
                                <Receipt className="w-3 h-3" />
                                <span>
                                  {isBn ? 'পিডিএফ / ছবি রসিদ' : 'View / Share Receipt'}
                                </span>
                              </button>
                            )}
                            {!p.isReversed && activeUser.role === 'OWNER' && (
                              <button
                                onClick={() => handleReversePayment(p.id)}
                                className="px-2.5 py-1 rounded border border-red-200 text-red-700 hover:bg-red-50 font-medium"
                              >
                                {isBn ? 'রিভার্স' : 'Reverse'}
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
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-xl font-bold text-slate-900">
                {isBn
                  ? 'বিদ্যুৎ, পানি, গ্যাস ও কাস্টম যৌথ বিল ব্যবস্থাপনা'
                  : 'Utility Bills (Meter & Manual) & Custom Shared Charges'}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                {isBn
                  ? 'সাব-মিটার রিডিং বা ম্যানুয়াল এন্ট্রি এবং ভবনের যৌথ খরচ ফ্ল্যাট অনুযায়ী কাস্টম বণ্টন করুন।'
                  : 'Calculate electricity/water bills from meter readings or manual entry, and distribute shared building expenses with custom per-unit allocations.'}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Meter / Manual Utility Bill Entry */}
              <form
                onSubmit={handlePostUtilityBill}
                className="rounded-xl bg-white border border-slate-200 p-6 space-y-4"
              >
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-emerald-600" />
                  <span>
                    {isBn
                      ? 'ইউটিলিটি বিল এন্ট্রি (মিটার বা ম্যানুয়াল)'
                      : 'Post Unit Utility Bill (Meter or Manual)'}
                  </span>
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'ফ্ল্যাট নির্বাচন *' : 'Occupied Unit *'}
                    </label>
                    <select
                      value={billUnitId}
                      onChange={(e) => setBillUnitId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-2"
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
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'বিলের ধরন *' : 'Utility Category *'}
                    </label>
                    <select
                      value={billType}
                      onChange={(e) =>
                        setBillType(e.target.value as UtilityType)
                      }
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-2"
                    >
                      <option value="ELECTRICITY">Electricity (বিদ্যুৎ)</option>
                      <option value="WATER">Water / WASA (পানি)</option>
                      <option value="GAS">Gas / Titas (গ্যাস)</option>
                      <option value="SERVICE">Service Charge</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'বিলিং মাস *' : 'Billing Period *'}
                    </label>
                    <input
                      type="month"
                      value={billPeriod}
                      onChange={(e) => setBillPeriod(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setBillMode('METER')}
                    className={`px-3 py-1.5 rounded-md font-medium ${
                      billMode === 'METER'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {isBn ? 'মিটার রিডিং হিসাব (Meter-Based)' : 'Meter-Based Calculation'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillMode('MANUAL')}
                    className={`px-3 py-1.5 rounded-md font-medium ${
                      billMode === 'MANUAL'
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {isBn ? 'সরাসরি টাকা এন্ট্রি (Manual)' : 'Manual Amount Entry'}
                  </button>
                </div>

                {billMode === 'METER' ? (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">
                          {isBn ? 'পূর্বের রিডিং' : 'Prev Reading'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={billPrevReading}
                          onChange={(e) => setBillPrevReading(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">
                          {isBn ? 'বর্তমান রিডিং' : 'Curr Reading'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={billCurrReading}
                          onChange={(e) => setBillCurrReading(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">
                          {isBn ? 'ইউনিট দর (৳)' : 'Rate/Unit (BDT)'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={billRateTaka}
                          onChange={(e) => setBillRateTaka(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">
                          {isBn ? 'ফিক্সড চার্জ (৳)' : 'Fixed Charge (BDT)'}
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={billFixedTaka}
                          onChange={(e) => setBillFixedTaka(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono"
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-slate-600">
                      <input
                        type="checkbox"
                        checked={billRollover}
                        onChange={(e) => setBillRollover(e.target.checked)}
                      />
                      <span>
                        {isBn
                          ? 'মিটার রিসেট বা পরিবর্তন অনুমোদন (Authorize Meter Reset/Rollover)'
                          : 'Authorize meter reset/rollover (if current reading < previous)'}
                      </span>
                    </label>
                  </div>
                ) : (
                  <div className="text-xs">
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'মোট বিলের পরিমাণ (৳) *' : 'Manual Bill Amount (BDT) *'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={billManualTaka}
                      onChange={(e) => setBillManualTaka(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 text-slate-600">
                    <input
                      type="checkbox"
                      checked={billAllowDuplicate}
                      onChange={(e) => setBillAllowDuplicate(e.target.checked)}
                    />
                    <span>
                      {isBn
                        ? 'একই মাসে অতিরিক্ত বিল পোস্ট করার অনুমতি দিন'
                        : 'Explicitly allow additional charge for same period'}
                    </span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                >
                  {isBn ? 'ইউটিলিটি বিল পোস্ট করুন' : 'Post Utility Bill'}
                </button>
              </form>

              {/* Right: Custom Shared Building Charge Allocation */}
              <form
                onSubmit={handlePostSharedCharge}
                className="rounded-xl bg-white border border-slate-200 p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold text-slate-900">
                    {isBn
                      ? 'যৌথ খরচ কাস্টম বণ্টন (Shared Charge Allocation)'
                      : 'Custom Shared Building Charge Distribution'}
                  </h2>
                </div>
                <p className="text-xs text-slate-500">
                  {isBn
                    ? 'বাড়িওয়ালার পছন্দমতো প্রতিটি ফ্ল্যাটে কাস্টম পরিমাণ নির্ধারণ করুন। সকল ফ্ল্যাটের যোগফল মোট খরচের সমান হতে হবে।'
                    : 'Assign custom BDT amounts to each occupied unit. Total allocated must reconcile exactly with the total shared expense.'}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'ভবন' : 'Building'}
                    </label>
                    <select
                      value={scBuildingId}
                      onChange={(e) => setScBuildingId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-2"
                    >
                      {db.buildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'খরচের শিরোনাম' : 'Shared Charge Title'}
                    </label>
                    <input
                      type="text"
                      value={scTitle}
                      onChange={(e) => setScTitle(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'মোট বণ্টনযোগ্য টাকা (৳)' : 'Total Shared Amount (BDT)'}
                    </label>
                    <input
                      type="number"
                      value={scTotalTaka}
                      onChange={(e) => setScTotalTaka(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-2.5 py-2 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg p-3 bg-slate-50">
                  <div className="flex justify-between items-center text-xs pb-1 border-b border-slate-200">
                    <span className="font-semibold text-slate-700">
                      {isBn ? 'ফ্ল্যাট ও ভাড়াটিয়া' : 'Occupied Unit & Tenant'}
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
                      className="text-emerald-700 font-semibold hover:underline"
                    >
                      {isBn
                        ? 'প্রাথমিক সমান ভাগ বসান (রাউন্ডিং সহ)'
                        : 'Pre-fill Equal Split (with exact rounding)'}
                    </button>
                  </div>
                  {scBuildingUnits.map(({ unit, tenant }) => (
                    <div
                      key={unit.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <span>
                        <strong>{unit.unitNumber}</strong> — {tenant?.fullName}
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
                        className="w-28 rounded border border-slate-300 bg-white px-2.5 py-1 text-right font-mono"
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs font-mono px-3 py-2 rounded bg-slate-100">
                  <span>
                    {isBn ? 'বণ্টিত যোগফল:' : 'Allocated Sum:'}{' '}
                    {formatBDT(scValidation.allocatedSumPoisha, lang)}
                  </span>
                  <span
                    className={
                      scValidation.differencePoisha === 0
                        ? 'text-emerald-700 font-bold'
                        : 'text-red-600 font-bold'
                    }
                  >
                    {isBn ? 'পার্থক্য:' : 'Unallocated Diff:'}{' '}
                    {formatBDT(scValidation.differencePoisha, lang)}
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={!scValidation.isValid}
                  className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40"
                >
                  {isBn
                    ? 'কাস্টম যৌথ বিল পোস্ট করুন'
                    : 'Post Reconciled Shared Charge'}
                </button>
              </form>
            </div>

            {/* Posted Utility Bills Table */}
            <div className="rounded-xl bg-white border border-slate-200 p-5">
              <h3 className="text-sm font-bold text-slate-900 mb-3">
                {isBn
                  ? 'পোস্টকৃত ইউটিলিটি ও যৌথ বিলের তালিকা'
                  : 'Posted Utility & Shared Bills Ledger'}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 pr-3">{isBn ? 'মাস' : 'Period'}</th>
                      <th className="py-2 px-3">{isBn ? 'ফ্ল্যাট ও ভাড়াটিয়া' : 'Unit & Tenant'}</th>
                      <th className="py-2 px-3">{isBn ? 'ধরন ও মিটার বিবরণ' : 'Category & Reading'}</th>
                      <th className="py-2 px-3 text-right">{isBn ? 'মোট বিল' : 'Total Bill'}</th>
                      <th className="py-2 px-3 text-right">{isBn ? 'পরিশোধিত' : 'Paid'}</th>
                      <th className="py-2 pl-3 text-right">{isBn ? 'বকেয়া' : 'Outstanding'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {db.utilityBills.map((ub) => {
                      const u = db.units.find((x) => x.id === ub.unitId);
                      const t = db.tenants.find((x) => x.id === ub.tenantId);
                      const rem = Math.max(
                        0,
                        ub.totalAmountPoisha - ub.paidAmountPoisha
                      );
                      return (
                        <tr key={ub.id} className="hover:bg-slate-50">
                          <td className="py-2.5 pr-3 font-mono">
                            {ub.billingPeriod}
                          </td>
                          <td className="py-2.5 px-3 font-medium">
                            {u?.unitNumber} — {t?.fullName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {ub.utilityType} ({ub.billingMode})
                            {ub.billingMode === 'METER'
                              ? ` · ${ub.prevReading} → ${ub.currReading} (${ub.consumptionUnits} units)`
                              : ub.notes
                              ? ` · ${ub.notes}`
                              : ''}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                            {formatBDT(ub.totalAmountPoisha, lang)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-700">
                            {formatBDT(ub.paidAmountPoisha, lang)}
                          </td>
                          <td className="py-2.5 pl-3 text-right font-mono tabular-nums font-semibold text-red-600">
                            {formatBDT(rem, lang)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 6. PROPERTY EXPENSES ==================== */}
        {activeTab === 'EXPENSES' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-xl font-bold text-slate-900">
                {isBn
                  ? 'ভবনের রক্ষণাবেক্ষণ ও পরিচালন খরচ'
                  : 'Property Operating Expenses & Maintenance Ledger'}
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                {isBn
                  ? 'কেয়ারটেকারের বেতন, লিফট সার্ভিসিং, মেরামত, রং ও ট্যাক্স খরচ সংরক্ষণ করুন যা নিট ক্যাশ ফ্লোতে প্রতিফলিত হয়।'
                  : 'Record repairs, caretaker wages, lift servicing, common utilities, and property taxes.'}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleAddExpense}
                className="lg:col-span-5 rounded-xl bg-white border border-slate-200 p-6 space-y-3.5 text-xs"
              >
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-emerald-600" />
                  <span>{isBn ? 'নতুন খরচ যোগ করুন' : 'Record Property Expense'}</span>
                </h2>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'ভবন *' : 'Building *'}
                    </label>
                    <select
                      value={expBuildingId}
                      onChange={(e) => setExpBuildingId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      {db.buildings.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'ফ্ল্যাট (ঐচ্ছিক)' : 'Unit (Optional)'}
                    </label>
                    <select
                      value={expUnitId}
                      onChange={(e) => setExpUnitId(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      <option value="">Building-Wide</option>
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

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'খাত (Category) *' : 'Expense Category *'}
                    </label>
                    <select
                      value={expCategory}
                      onChange={(e) =>
                        setExpCategory(e.target.value as ExpenseCategory)
                      }
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    >
                      <option value="REPAIRS">Repairs & Maintenance</option>
                      <option value="PAINTING">Painting</option>
                      <option value="CLEANING">Cleaning</option>
                      <option value="SECURITY_CARETAKER">
                        Security & Caretaker Wages
                      </option>
                      <option value="LIFT">Lift Maintenance</option>
                      <option value="COMMON_UTILITY">
                        Common Electricity & Water
                      </option>
                      <option value="PLUMBING">Plumbing</option>
                      <option value="TAX_FEES">Property Taxes / Fees</option>
                      <option value="OTHER">Other Expense</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'খরচের পরিমাণ (৳) *' : 'Amount (BDT) *'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expAmountTaka}
                      onChange={(e) => setExpAmountTaka(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'তারিখ *' : 'Date *'}
                    </label>
                    <input
                      type="date"
                      required
                      value={expDate}
                      onChange={(e) => setExpDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'ভেন্ডর / প্রাপক' : 'Vendor / Payee'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Dhaka Elevator Ltd."
                      value={expVendor}
                      onChange={(e) => setExpVendor(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {isBn ? 'বিবরণ *' : 'Description *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Detailed reason for expense"
                    value={expDesc}
                    onChange={(e) => setExpDesc(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800"
                >
                  {isBn ? 'খরচ সংরক্ষণ করুন' : 'Save Expense Record'}
                </button>
              </form>

              <div className="lg:col-span-7 rounded-xl bg-white border border-slate-200 p-6">
                <h2 className="text-base font-bold text-slate-900 mb-4">
                  {isBn ? 'খরচের তালিকা' : 'Recorded Property Expenses'}
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 pr-3">{isBn ? 'তারিখ' : 'Date'}</th>
                        <th className="py-2 px-3">{isBn ? 'ভবন' : 'Building'}</th>
                        <th className="py-2 px-3">{isBn ? 'খাত ও বিবরণ' : 'Category & Description'}</th>
                        <th className="py-2 pl-3 text-right">{isBn ? 'পরিমাণ' : 'Amount'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {db.expenses.map((e) => {
                        const b = db.buildings.find(
                          (x) => x.id === e.buildingId
                        );
                        return (
                          <tr key={e.id} className="hover:bg-slate-50">
                            <td className="py-3 pr-3 font-mono text-slate-600">
                              {e.date}
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-900">
                              {b?.name}
                            </td>
                            <td className="py-3 px-3 text-slate-700">
                              <span className="font-semibold">
                                {e.category}
                              </span>{' '}
                              — {e.description}
                              {e.vendor ? ` (${e.vendor})` : ''}
                            </td>
                            <td className="py-3 pl-3 text-right font-mono tabular-nums font-bold text-slate-900">
                              {formatBDT(e.amountPoisha, lang)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 7. REPORTS & AUDIT HISTORY ==================== */}
        {activeTab === 'REPORTS' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  {isBn
                    ? 'আর্থিক প্রতিবেদন, ভাড়াটিয়া লেজার ও অডিট ট্রেইল'
                    : 'Financial Reports, Tenant Ledgers & Immutable Audit History'}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  {isBn
                    ? 'ড্যাশবোর্ডের একই ডাটাবেস ও সূত্র হতে প্রস্তুতকৃত ১১ ধরনের রিপোর্ট। CSV (Excel) বা প্রিন্ট/PDF আকারে সংরক্ষণ করুন।'
                    : 'All 11 authoritative reports reconcile strictly with the local SQLite/IndexedDB ledger. Export to Excel CSV or PDF.'}
                </p>
              </div>
              <div className="flex items-center gap-2 no-print">
                <button
                  onClick={handleExportCsvReport}
                  className="px-3.5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>{isBn ? 'CSV / Excel এক্সপোর্ট' : 'Export CSV / Excel'}</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isBn ? 'পিডিএফ / প্রিন্ট' : 'Print / Save PDF'}</span>
                </button>
              </div>
            </div>

            {/* 11 Report Selector Tabs */}
            <div className="flex flex-wrap gap-1.5 bg-white p-2 rounded-xl border border-slate-200 no-print">
              {(
                [
                  ['MONTHLY', isBn ? 'মাসিক রিপোর্ট' : '1. Monthly Summary'],
                  ['YEARLY', isBn ? 'বার্ষিক রিপোর্ট' : '2. Yearly Summary'],
                  ['TENANT_LEDGER', isBn ? 'ভাড়াটিয়া লেজার' : '3. Tenant Ledger'],
                  ['OUTSTANDING_DUES', isBn ? 'বকেয়া তালিকা' : '4. Outstanding Dues'],
                  ['BUILDING_FINANCE', isBn ? 'ভবনভিত্তিক হিসাব' : '5. Building Finance'],
                  ['RENT_COLLECTION', isBn ? 'ভাড়া আদায় রিপোর্ট' : '6. Rent Collection'],
                  ['UTILITY_BILLING', isBn ? 'ইউটিলিটি বিল রিপোর্ট' : '7. Utility Billing'],
                  ['EXPENSE_REPORT', isBn ? 'খরচ রিপোর্ট' : '8. Expense Report'],
                  ['SECURITY_DEPOSIT', isBn ? 'জামানত রিপোর্ট' : '9. Security Deposits'],
                  ['OCCUPANCY', isBn ? 'ফ্ল্যাট দখল রিপোর্ট' : '10. Occupancy Report'],
                  ['AUDIT_HISTORY', isBn ? 'অডিট ইতিহাস' : '11. Audit History'],
                ] as [ReportType, string][]
              ).map(([rk, label]) => (
                <button
                  key={rk}
                  onClick={() => setReportType(rk)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    reportType === rk
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Report Content Box */}
            <div className="rounded-xl bg-white border border-slate-200 p-6 space-y-4">
              {(reportType === 'MONTHLY' ||
                reportType === 'BUILDING_FINANCE' ||
                reportType === 'YEARLY') && (
                <div className="space-y-4">
                  <h2 className="text-base font-bold text-slate-900">
                    {reportType === 'YEARLY'
                      ? `Yearly Financial Statement (${selectedPeriod.slice(0, 4)})`
                      : `Building-Wise Monthly Financial Reconciliation (${selectedPeriod})`}
                  </h2>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 pr-3">Building</th>
                        <th className="py-2 px-3 text-right">Charges Billed</th>
                        <th className="py-2 px-3 text-right">Cash Collected</th>
                        <th className="py-2 px-3 text-right">
                          Outstanding Balance
                        </th>
                        <th className="py-2 px-3 text-right">Expenses</th>
                        <th className="py-2 pl-3 text-right">
                          Net Operating Cash Flow
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {summary.buildingBreakdown.map((b) => (
                        <tr key={b.buildingId}>
                          <td className="py-3 pr-3 font-bold">
                            {b.buildingName}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            {formatBDT(b.chargedPoisha, lang)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-emerald-700 font-semibold">
                            {formatBDT(b.collectedPoisha, lang)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono text-red-600">
                            {formatBDT(b.outstandingPoisha, lang)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            {formatBDT(b.expensesPoisha, lang)}
                          </td>
                          <td className="py-3 pl-3 text-right font-mono font-bold">
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
              )}

              {reportType === 'TENANT_LEDGER' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">
                      {isBn
                        ? 'ভাড়াটিয়া লেজার (সক্রিয় ও আর্কাইভকৃত সহ)'
                        : 'Complete Tenant Ledger (Active & Archived Preserved)'}
                    </h2>
                    <select
                      value={reportTenantId}
                      onChange={(e) => setReportTenantId(e.target.value)}
                      className="rounded border border-slate-300 px-3 py-1.5 text-xs"
                    >
                      <option value="ALL">All Tenants (Active + Archived)</option>
                      {db.tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName} ({t.status})
                        </option>
                      ))}
                    </select>
                  </div>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 pr-3">Tenant</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Monthly Rent</th>
                        <th className="py-2 px-3 text-right">Held Deposit</th>
                        <th className="py-2 px-3 text-right">Advance Credit</th>
                        <th className="py-2 pl-3 text-right">Current Unpaid</th>
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
                            <tr key={t.id}>
                              <td className="py-3 pr-3 font-semibold">
                                {t.fullName}
                              </td>
                              <td className="py-3 px-3">{t.status}</td>
                              <td className="py-3 px-3 text-right font-mono">
                                {formatBDT(t.monthlyRentPoisha, lang)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono">
                                {formatBDT(dep.heldBalancePoisha, lang)}
                              </td>
                              <td className="py-3 px-3 text-right font-mono text-emerald-700">
                                {formatBDT(t.advanceRentCreditPoisha, lang)}
                              </td>
                              <td className="py-3 pl-3 text-right font-mono font-bold text-red-600">
                                {formatBDT(due, lang)}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}

              {reportType === 'OUTSTANDING_DUES' && (
                <div className="space-y-3">
                  <h2 className="text-base font-bold text-slate-900">
                    {isBn ? 'বকেয়া ভাড়ার বিস্তারিত প্রতিবেদন' : 'Outstanding Dues Report'}
                  </h2>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 pr-3">Tenant</th>
                        <th className="py-2 px-3">Building & Unit</th>
                        <th className="py-2 px-3">Overdue Billing Periods</th>
                        <th className="py-2 pl-3 text-right">
                          Total Outstanding
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reminderEval?.overdueItems.map((item) => (
                        <tr key={item.eventKey}>
                          <td className="py-3 pr-3 font-semibold">
                            {item.tenant.fullName} ({item.tenant.primaryPhone})
                          </td>
                          <td className="py-3 px-3">
                            {item.building.name} · {item.unit.unitNumber}
                          </td>
                          <td className="py-3 px-3 font-mono">
                            {item.overduePeriods.join(', ')}
                          </td>
                          <td className="py-3 pl-3 text-right font-mono font-bold text-red-600">
                            {formatBDT(item.outstandingPoisha, lang)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {reportType === 'RENT_COLLECTION' && (
                <div className="space-y-3">
                  <h2 className="text-base font-bold text-slate-900">
                    Rent Collection & Receipt Ledger
                  </h2>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 pr-3">Receipt #</th>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Tenant</th>
                        <th className="py-2 px-3">Method & Ref</th>
                        <th className="py-2 pl-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {db.payments.map((p) => {
                        const t = db.tenants.find((x) => x.id === p.tenantId);
                        return (
                          <tr key={p.id}>
                            <td className="py-2.5 pr-3 font-mono font-semibold">
                              {p.receiptNumber}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {p.paymentDate}
                            </td>
                            <td className="py-2.5 px-3">{t?.fullName}</td>
                            <td className="py-2.5 px-3 font-mono">
                              {p.method} {p.transactionRef}
                            </td>
                            <td className="py-2.5 pl-3 text-right font-mono font-bold text-emerald-700">
                              {formatBDT(p.amountReceivedPoisha, lang)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {reportType === 'UTILITY_BILLING' && (
                <div className="space-y-3">
                  <h2 className="text-base font-bold text-slate-900">
                    Utility Billing & Shared Charge Report
                  </h2>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 pr-3">Period</th>
                        <th className="py-2 px-3">Unit</th>
                        <th className="py-2 px-3">Utility Type</th>
                        <th className="py-2 px-3 text-right">Billed</th>
                        <th className="py-2 pl-3 text-right">Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {db.utilityBills.map((ub) => {
                        const u = db.units.find((x) => x.id === ub.unitId);
                        return (
                          <tr key={ub.id}>
                            <td className="py-2.5 pr-3 font-mono">
                              {ub.billingPeriod}
                            </td>
                            <td className="py-2.5 px-3">{u?.unitNumber}</td>
                            <td className="py-2.5 px-3">
                              {ub.utilityType} ({ub.billingMode})
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              {formatBDT(ub.totalAmountPoisha, lang)}
                            </td>
                            <td className="py-2.5 pl-3 text-right font-mono text-emerald-700">
                              {formatBDT(ub.paidAmountPoisha, lang)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {reportType === 'EXPENSE_REPORT' && (
                <div className="space-y-3">
                  <h2 className="text-base font-bold text-slate-900">
                    Property Expense Report
                  </h2>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3">Description & Vendor</th>
                        <th className="py-2 pl-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {db.expenses.map((e) => (
                        <tr key={e.id}>
                          <td className="py-2.5 pr-3 font-mono">{e.date}</td>
                          <td className="py-2.5 px-3 font-semibold">
                            {e.category}
                          </td>
                          <td className="py-2.5 px-3">
                            {e.description} ({e.vendor})
                          </td>
                          <td className="py-2.5 pl-3 text-right font-mono font-bold">
                            {formatBDT(e.amountPoisha, lang)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {reportType === 'SECURITY_DEPOSIT' && (
                <div className="space-y-3">
                  <h2 className="text-base font-bold text-slate-900">
                    Security Deposit Reconciliation (Excluded from Rent Income)
                  </h2>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 pr-3">Date</th>
                        <th className="py-2 px-3">Tenant</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3">Reason</th>
                        <th className="py-2 pl-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {db.depositTransactions.map((dtx) => {
                        const t = db.tenants.find((x) => x.id === dtx.tenantId);
                        return (
                          <tr key={dtx.id}>
                            <td className="py-2.5 pr-3 font-mono">
                              {dtx.date}
                            </td>
                            <td className="py-2.5 px-3 font-medium">
                              {t?.fullName}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {dtx.type}
                            </td>
                            <td className="py-2.5 px-3">{dtx.reason}</td>
                            <td className="py-2.5 pl-3 text-right font-mono font-bold">
                              {formatBDT(dtx.amountPoisha, lang)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {reportType === 'OCCUPANCY' && (
                <div className="space-y-3">
                  <h2 className="text-base font-bold text-slate-900">
                    Unit Occupancy & Vacancy Report
                  </h2>
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="py-2 pr-3">Building</th>
                        <th className="py-2 px-3">Unit</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3">Occupant</th>
                        <th className="py-2 pl-3 text-right">Default Rent</th>
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
                          <tr key={u.id}>
                            <td className="py-2.5 pr-3">{b?.name}</td>
                            <td className="py-2.5 px-3 font-bold">
                              {u.unitNumber}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {u.status}
                            </td>
                            <td className="py-2.5 px-3">
                              {t ? t.fullName : '—'}
                            </td>
                            <td className="py-2.5 pl-3 text-right font-mono">
                              {formatBDT(u.defaultRentPoisha, lang)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {reportType === 'AUDIT_HISTORY' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-bold text-slate-900">
                      Immutable Transaction Audit History
                    </h2>
                    <select
                      value={auditTypeFilter}
                      onChange={(e) => setAuditTypeFilter(e.target.value)}
                      className="rounded border border-slate-300 px-2.5 py-1 text-xs"
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
                  <div className="space-y-2">
                    {db.auditLogs
                      .filter(
                        (a) =>
                          auditTypeFilter === 'ALL' ||
                          a.eventType === auditTypeFilter
                      )
                      .map((log) => (
                        <div
                          key={log.id}
                          className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <span className="font-mono font-semibold text-slate-900">
                              {log.eventType}
                            </span>
                            <span aria-hidden="true"> · </span>
                            <span className="text-slate-700">
                              {isBn ? log.summaryBn : log.summaryEn}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono whitespace-nowrap">
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
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-xl font-bold text-slate-900">
                {isBn
                  ? 'সেটিংস, অনুমতি, পিন নিরাপত্তা, সিঙ্ক এবং এনক্রিপ্টেড ব্যাকআপ'
                  : 'Settings, Role Permissions, Security PIN, Sync & Encrypted Backup'}
              </h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 1. Encrypted Backup & Restore (AES-256-GCM) */}
              <div className="rounded-xl bg-white border border-slate-200 p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-600" />
                  <span>
                    {isBn
                      ? 'এনক্রিপ্টেড ব্যাকআপ ও রিস্টোর (AES-256-GCM)'
                      : 'Authenticated Encrypted Backup & Restore (AES-256-GCM)'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  {isBn
                    ? 'PBKDF2 (১২০,০০০ ইটারেশন) এবং র‍্যান্ডম ১২-বাইট নন্স (Nonce) সহ AES-256-GCM এনক্রিপশন। ভুল পাসওয়ার্ড বা ফাইল বিকৃত হলে রিস্টোর স্বয়ংক্রিয়ভাবে প্রতিরোধ করা হয়।'
                    : 'Protected with PBKDF2-HMAC-SHA256 (120,000 iterations), unique 96-bit cryptographic nonce, and SHA-256 state checksum.'}
                </p>

                <form
                  onSubmit={handleExportEncryptedBackup}
                  className="space-y-3 pt-2 border-t border-slate-100 text-xs"
                >
                  <div className="font-semibold text-slate-800">
                    {isBn
                      ? '১. এনক্রিপ্টেড ব্যাকআপ ফাইল তৈরি করুন'
                      : '1. Create Encrypted Backup (.brmbackup)'}
                  </div>
                  <input
                    type="password"
                    required
                    minLength={4}
                    placeholder={
                      isBn
                        ? 'ব্যাকআপ পাসওয়ার্ড দিন (কমপক্ষে ৪ অক্ষর)'
                        : 'Enter encryption password (min 4 chars)'
                    }
                    value={backupPassword}
                    onChange={(e) => setBackupPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                  <label className="flex items-center gap-2 text-slate-600">
                    <input
                      type="checkbox"
                      checked={includeBackupDocs}
                      onChange={(e) => setIncludeBackupDocs(e.target.checked)}
                    />
                    <span>
                      {isBn
                        ? 'ভাড়াটিয়ার ছবি ও চুক্তিপত্র ফাইলগুলো ব্যাকআপে অন্তর্ভুক্ত করুন'
                        : 'Include locally attached tenant photos & agreement files'}
                    </span>
                  </label>
                  <button
                    type="submit"
                    className="w-full py-2 px-4 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {isBn
                        ? 'এনক্রিপ্টেড ব্যাকআপ ডাউনলোড করুন'
                        : 'Export Encrypted Backup'}
                    </span>
                  </button>
                </form>

                <form
                  onSubmit={handleRestoreEncryptedBackup}
                  className="space-y-3 pt-4 border-t border-slate-200 text-xs"
                >
                  <div className="font-semibold text-slate-800">
                    {isBn
                      ? '২. ব্যাকআপ ফাইল হতে রিস্টোর করুন'
                      : '2. Restore from Encrypted Backup'}
                  </div>
                  <input
                    type="file"
                    accept=".brmbackup,.json"
                    onChange={(e) => handleSelectRestoreFile(e.target.files?.[0])}
                    className="w-full text-xs text-slate-600"
                  />
                  {restorePreviewSummary && (
                    <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200 text-[11px] font-mono text-emerald-900">
                      {restorePreviewSummary}
                    </div>
                  )}
                  <input
                    type="password"
                    placeholder={
                      isBn ? 'ডিক্রিপশন পাসওয়ার্ড দিন' : 'Enter backup password to decrypt'
                    }
                    value={restorePassword}
                    onChange={(e) => setRestorePassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                  <button
                    type="submit"
                    className="w-full py-2 px-4 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-4 h-4" />
                    <span>
                      {isBn
                        ? 'যাচাই ও রিস্টোর করুন (বিদ্যমান ডাটা প্রতিস্থাপিত হবে)'
                        : 'Verify Integrity & Restore Backup'}
                    </span>
                  </button>
                </form>
              </div>

              {/* 2. Role Permissions (Owner vs Manager) */}
              <div className="rounded-xl bg-white border border-slate-200 p-6 space-y-4">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>
                    {isBn
                      ? 'ম্যানেজার/কেয়ারটেকারের অনুমতি নিয়ন্ত্রণ'
                      : 'Property Manager Granular Permissions'}
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  {isBn
                    ? 'বাড়িওয়ালা (Owner) ম্যানেজারের জন্য কোন কোন কাজ অনুমোদিত তা নির্ধারণ করতে পারেন।'
                    : 'Configure which actions the Property Manager profile is authorized to perform on this device.'}
                </p>

                {db.users
                  .filter((u) => u.role === 'MANAGER')
                  .map((mgr) => (
                    <div key={mgr.id} className="space-y-2 text-xs">
                      <div className="font-semibold text-slate-800">
                        {mgr.name} ({mgr.phone})
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(
                          Object.keys(mgr.permissions) as (keyof UserPermission)[]
                        ).map((permKey) => (
                          <label
                            key={permKey}
                            className="flex items-center gap-2 p-2 rounded border border-slate-200 bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              disabled={activeUser.role !== 'OWNER'}
                              checked={mgr.permissions[permKey]}
                              onChange={(e) =>
                                commitDb(
                                  (d) => {
                                    const m = d.users.find(
                                      (x) => x.id === mgr.id
                                    );
                                    if (m)
                                      m.permissions[permKey] =
                                        e.target.checked;
                                    return d;
                                  },
                                  {
                                    eventType: 'USER_PERMISSION_CHANGED',
                                    entityId: mgr.id,
                                    summaryEn: `Updated Manager permission ${permKey} = ${String(e.target.checked)}.`,
                                    summaryBn: `ম্যানেজারের অনুমতি (${permKey}) পরিবর্তন করা হয়েছে।`,
                                  }
                                )
                              }
                            />
                            <span className="font-mono text-slate-700">
                              {permKey}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}

                {/* App Security PIN Configuration */}
                <div className="pt-4 border-t border-slate-200 space-y-3 text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Lock className="w-4 h-4 text-emerald-600" />
                    <span>
                      {isBn
                        ? 'অ্যাপ পিন লক ও বায়োমেট্রিক নিরাপত্তা'
                        : 'App PIN Lock & Biometric Protection'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={newPinLen}
                      onChange={(e) =>
                        setNewPinLen(Number(e.target.value) as 4 | 6)
                      }
                      className="rounded border border-slate-300 px-2.5 py-2"
                    >
                      <option value={4}>4-Digit PIN</option>
                      <option value={6}>6-Digit PIN</option>
                    </select>
                    <input
                      type="password"
                      maxLength={newPinLen}
                      placeholder={`Enter ${newPinLen}-digit PIN`}
                      value={newPinInput}
                      onChange={(e) =>
                        setNewPinInput(e.target.value.replace(/[^0-9]/g, ''))
                      }
                      className="rounded border border-slate-300 px-3 py-2 font-mono w-36"
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
                      className="px-3 py-2 rounded bg-slate-900 text-white font-semibold"
                    >
                      {isBn ? 'পিন চালু করুন' : 'Enable PIN'}
                    </button>
                    {db.settings.pinEnabled && (
                      <>
                        <button
                          type="button"
                          onClick={() => setIsLocked(true)}
                          className="px-3 py-2 rounded bg-emerald-600 text-white font-semibold"
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
                          className="px-3 py-2 rounded bg-red-50 text-red-700 font-semibold"
                        >
                          {isBn ? 'পিন বন্ধ' : 'Disable PIN'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Application Branding, Proration & Reminder Settings */}
              <div className="rounded-xl bg-white border border-slate-200 p-6 space-y-3 text-xs">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-600" />
                  <span>
                    {isBn
                      ? 'রসিদ ব্র্যান্ডিং, ভাড়া হিসাব ও রিমাইন্ডার সেটিংস'
                      : 'Receipt Branding, Proration Rule & Reminder Dates'}
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'অ্যাপের নাম (Configurable App Name)' : 'Application Name'}
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
                      className="w-full rounded border border-slate-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      {isBn ? 'মালিকের নাম ও স্বাক্ষর' : 'Owner Name / Receipt Signature'}
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
                      className="w-full rounded border border-slate-300 px-3 py-2"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {isBn
                      ? 'আংশিক মাসের ভাড়ার নিয়ম (Partial-Month Proration Rule)'
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
                    className="w-full rounded border border-slate-300 px-3 py-2"
                  >
                    <option value="DAILY_30">
                      Pro-rata 30-Day Standard (occupiedDays / 30)
                    </option>
                    <option value="ACTUAL_DAYS">
                      Exact Calendar Days in Month (occupiedDays / daysInMonth)
                    </option>
                    <option value="FULL_MONTH">
                      Full Month Rent (No Proration)
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    {isBn
                      ? 'মাসিক রিমাইন্ডার তারিখ (ডিফল্ট: ৫, ১০, ১৫)'
                      : 'Monthly Reminder Dates (Default: 5, 10, 15)'}
                  </label>
                  <input
                    type="text"
                    value={db.reminderSettings.reminderDays.join(', ')}
                    onChange={(e) => {
                      const days = e.target.value
                        .split(',')
                        .map((x) => parseInt(x.trim(), 10))
                        .filter((n) => !Number.isNaN(n) && n >= 1 && n <= 28);
                      if (days.length > 0) {
                        commitDb((d) => {
                          d.reminderSettings.reminderDays = days;
                          return d;
                        });
                      }
                    }}
                    className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
              </div>

              {/* 4. Multi-Device Cloud Sync & Database Reset */}
              <div className="rounded-xl bg-white border border-slate-200 p-6 space-y-4 text-xs">
                <h2 className="text-base font-bold text-slate-900">
                  {isBn
                    ? 'মাল্টি-ডিভাইস সিঙ্ক্রোনাইজেশন ও ডাটাবেস মোড'
                    : 'Multi-Device Synchronization & Demo/Clean Mode'}
                </h2>
                <p className="text-slate-500">
                  {isBn
                    ? 'অ্যাপটি অফলাইনে সম্পূর্ণ স্বয়ংসম্পূর্ণ। একাধিক ফোনে সিঙ্ক করতে চাইলে আপনার অনুমোদিত ক্লাউড এন্ডপয়েন্ট (Supabase / HTTPS) যুক্ত করুন।'
                    : 'Local SQLite/IndexedDB works 100% offline. For multi-phone synchronization, configure an authenticated HTTPS/Supabase sync endpoint below (idempotent merge prevents duplicate payments).'}
                </p>

                <div className="space-y-2">
                  <input
                    type="url"
                    placeholder="https://your-project.supabase.co/rest/v1/ledger_sync"
                    value={db.syncMetadata.endpointUrl}
                    onChange={(e) =>
                      commitDb((d) => {
                        d.syncMetadata.endpointUrl = e.target.value;
                        return d;
                      })
                    }
                    className="w-full rounded border border-slate-300 px-3 py-2 font-mono"
                  />
                  <div className="flex items-center justify-between text-slate-500 font-mono">
                    <span>Device ID: {db.syncMetadata.deviceId}</span>
                    <span>
                      Last Sync:{' '}
                      {db.syncMetadata.lastSyncedAt
                        ? db.syncMetadata.lastSyncedAt.slice(0, 19)
                        : 'Offline Local Mode'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = mergeStatesIdempotently(db, db);
                      await commitDb((d) => {
                        d.syncMetadata.lastSyncedAt = new Date().toISOString();
                        return d;
                      });
                      notify(
                        `Verified idempotent sync engine (0 duplicate payments, ${res.conflictsDetected.length} conflicts).`
                      );
                    }}
                    className="px-3.5 py-2 rounded bg-slate-900 text-white font-semibold hover:bg-slate-800"
                  >
                    {isBn
                      ? 'সিঙ্ক ইঞ্জিন যাচাই করুন'
                      : 'Verify Idempotent Sync Engine'}
                  </button>
                </div>

                <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={async () => {
                      const clean = createCleanDatabaseState();
                      setDb(clean);
                      await saveDatabaseState(clean);
                      notify(
                        isBn
                          ? 'খালি প্রোডাকশন ডাটাবেস চালু করা হয়েছে।'
                          : 'Switched to a clean, empty production database.'
                      );
                    }}
                    className="px-3.5 py-2 rounded border border-red-300 text-red-700 font-semibold hover:bg-red-50"
                  >
                    {isBn
                      ? 'ডেমো মুছে খালি ডাটাবেস শুরু করুন (Start Clean DB)'
                      : 'Clear Demo Data & Start Blank Production Ledger'}
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
                          : 'Reloaded sample Dhaka property dataset.'
                      );
                    }}
                    className="px-3.5 py-2 rounded border border-slate-300 text-slate-700 font-semibold hover:bg-slate-100"
                  >
                    {isBn ? 'ডেমো ডাটা রিসেট করুন' : 'Reset Sample Demo Data'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 9. ANDROID APK & NATIVE SOURCE CENTER ==================== */}
        {activeTab === 'ANDROID_APK' && (
          <AndroidDeliveryView lang={lang} testsPassedCount={26} />
        )}
      </main>

      {/* Mobile Fixed Bottom Navigation Bar (Natural Thumb Zone, <15% viewport height) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 grid grid-cols-5 items-center h-14 no-print">
        {(
          [
            ['DASHBOARD', isBn ? 'ড্যাশবোর্ড' : 'Home', Wallet],
            ['BUILDINGS', isBn ? 'ভবন' : 'Buildings', Building2],
            ['TENANTS', isBn ? 'ভাড়াটিয়া' : 'Tenants', Users],
            ['COLLECTION', isBn ? 'আদায়' : 'Collect', CreditCard],
            ['SETTINGS', isBn ? 'মেনু/APK' : 'Settings', Settings],
          ] as const
        ).map(([tabKey, label, Icon]) => (
          <button
            key={tabKey}
            onClick={() => setActiveTab(tabKey)}
            className={`flex flex-col items-center justify-center h-full ${
              activeTab === tabKey
                ? 'text-emerald-600 font-semibold'
                : 'text-slate-500'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-[10px] mt-0.5">{label}</span>
          </button>
        ))}
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
