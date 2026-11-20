import { describe, expect, it } from "vitest";
import { addMonths, clampDay, diffDays, lastWorkdayOfMonth, todayJakarta } from "./date";
import { allocateByPercent, formatRp, formatRpShort, parseRp } from "./money";
import { nextPayday, periodFor, periodForSettings, shiftPeriod } from "./cycle";
import { adjustmentFor, computeBalance, computeBalances, creditCardStatus, type TxLike } from "./balance";
import { normalizeSplits, validateSplits } from "./splits";
import {
  annuityPayment,
  applyExtraPayment,
  buildSchedule,
  debtServiceRatio,
  recalcFromRemaining,
  scheduleForDebt,
  totalInterest,
} from "./amortization";
import { compareStrategies, simulateStrategy } from "./strategy";
import { budgetColor, crossedThresholds, nextRollover, perDay, sinkingMonthly, spendable, unallocated } from "./budget";
import { canAllocate, emergencyTarget, goalStatus, requiredMonthly } from "./goals";
import { billStatus, nextOccurrence, occurrencesBetween } from "./recurring";
import { ratioBreakdown, topWithOthers } from "./report";
import { resolveAmounts } from "./allocation";

const sumBy = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);

describe("money", () => {
  it("memformat rupiah", () => {
    expect(formatRp(1234567)).toBe("Rp 1.234.567");
    expect(formatRp(-2500)).toBe("−Rp 2.500");
    expect(formatRp(5000, { sign: true })).toBe("+Rp 5.000");
    expect(formatRpShort(1_250_000)).toBe("Rp 1,25 jt");
    expect(formatRpShort(350_000)).toBe("Rp 350 rb");
    expect(parseRp("Rp 1.250.000")).toBe(1250000);
  });
  it("membagi persen tanpa kehilangan rupiah", () => {
    const r = allocateByPercent(1_000_001, [50, 30, 20]);
    expect(r.reduce((a, b) => a + b, 0)).toBe(1_000_001);
    expect(r[0]).toBe(500_001);
  });
});

describe("date", () => {
  it("memotong hari ke akhir bulan", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(clampDay(2028, 2, 31)).toBe("2028-02-29");
    expect(diffDays("2026-11-20", "2026-12-01")).toBe(11);
    expect(lastWorkdayOfMonth(2026, 1)).toBe("2026-01-30"); // 31 Jan 2026 = Sabtu
  });
  it("hari ini dalam zona Asia/Jakarta", () => {
    // 2026-11-20 18:30 UTC = 2026-11-21 01:30 WIB
    expect(todayJakarta(new Date("2026-11-20T18:30:00Z"))).toBe("2026-11-21");
  });
});

describe("siklus bulan non-kalender", () => {
  it("25 s.d. 24", () => {
    expect(periodFor("2026-11-20", 25)).toEqual({ start: "2026-10-25", end: "2026-11-24" });
    expect(periodFor("2026-11-25", 25)).toEqual({ start: "2026-11-25", end: "2026-12-24" });
    expect(periodFor("2026-12-31", 25)).toEqual({ start: "2026-12-25", end: "2027-01-24" });
  });
  it("tanggal 1 = bulan kalender", () => {
    expect(periodFor("2026-02-14", 1)).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
  it("tanggal 31 dipotong di bulan pendek", () => {
    expect(periodFor("2026-02-15", 31)).toEqual({ start: "2026-01-31", end: "2026-02-27" });
    expect(periodFor("2026-02-28", 31)).toEqual({ start: "2026-02-28", end: "2026-03-30" });
  });
  it("aturan akhir pekan: maju ke hari kerja sebelumnya", () => {
    // 25 Okt 2026 = Minggu → 23 Okt (Jumat); 25 Nov 2026 = Rabu
    expect(periodFor("2026-10-24", 25, true)).toEqual({ start: "2026-10-23", end: "2026-11-24" });
  });
  it("mengikuti gajian istri", () => {
    const p = periodForSettings("2026-11-20", {
      cycleMode: "wife_payday",
      cycleStartDay: 1,
      husbandPayday: 25,
      wifePayday: 10,
      paydayWeekendRule: false,
    });
    expect(p).toEqual({ start: "2026-11-10", end: "2026-12-09" });
  });
  it("geser periode", () => {
    const p = periodFor("2026-11-20", 25);
    expect(shiftPeriod(p, -1, 25)).toEqual({ start: "2026-09-25", end: "2026-10-24" });
    expect(shiftPeriod(p, 2, 25)).toEqual({ start: "2026-12-25", end: "2027-01-24" });
  });
  it("gajian berikutnya", () => {
    expect(nextPayday("2026-11-20", 25)).toBe("2026-11-25");
    expect(nextPayday("2026-11-26", 25)).toBe("2026-12-25");
  });
});

describe("saldo", () => {
  const txs: TxLike[] = [
    { type: "income", accountId: 1, toAccountId: null, amount: 10_000_000 },
    { type: "expense", accountId: 1, toAccountId: null, amount: 250_000 },
    { type: "transfer", accountId: 1, toAccountId: 2, amount: 1_000_000 },
    { type: "saving_deposit", accountId: 1, toAccountId: 3, amount: 2_000_000 },
    { type: "debt_payment", accountId: 1, toAccountId: null, amount: 3_000_000 },
    { type: "adjustment", accountId: 2, toAccountId: null, amount: -5_000 },
    { type: "expense", accountId: 1, toAccountId: null, amount: 999, deletedAt: new Date() },
    { type: "expense", accountId: 1, toAccountId: null, amount: 777, status: "planned" },
  ];
  it("saldo awal + efek transaksi realized & tidak terhapus", () => {
    expect(computeBalance(500_000, 1, txs)).toBe(500_000 + 10_000_000 - 250_000 - 1_000_000 - 2_000_000 - 3_000_000);
    expect(computeBalance(0, 2, txs)).toBe(1_000_000 - 5_000);
    expect(computeBalance(0, 3, txs)).toBe(2_000_000);
  });
  it("banyak akun sekaligus sama dengan per akun", () => {
    const m = computeBalances(
      [
        { id: 1, openingBalance: 500_000 },
        { id: 2, openingBalance: 0 },
        { id: 3, openingBalance: 0 },
      ],
      txs,
    );
    expect(m.get(1)).toBe(computeBalance(500_000, 1, txs));
    expect(m.get(2)).toBe(computeBalance(0, 2, txs));
    expect(m.get(3)).toBe(2_000_000);
  });
  it("transfer tidak mengubah total saldo", () => {
    const t: TxLike[] = [{ type: "transfer", accountId: 1, toAccountId: 2, amount: 700 }];
    const m = computeBalances([{ id: 1, openingBalance: 1000 }, { id: 2, openingBalance: 0 }], t);
    expect(m.get(1)! + m.get(2)!).toBe(1000);
  });
  it("setor tabungan ke akun yang sama (alokasi virtual) tidak mengubah saldo", () => {
    const t: TxLike[] = [{ type: "saving_deposit", accountId: 1, toAccountId: 1, amount: 700 }];
    expect(computeBalances([{ id: 1, openingBalance: 1000 }], t).get(1)).toBe(1000);
    expect(computeBalance(1000, 1, t)).toBe(1000);
  });
  it("penyesuaian = selisih saldo nyata", () => {
    expect(adjustmentFor(1_000_000, 950_000)).toBe(-50_000);
    expect(adjustmentFor(1_000_000, 1_000_000)).toBe(0);
  });
  it("kartu kredit: tagihan berjalan & sisa limit", () => {
    expect(creditCardStatus(-2_500_000, 10_000_000)).toEqual({ outstanding: 2_500_000, available: 7_500_000 });
  });
});

describe("split", () => {
  it("jumlah split harus sama dengan total", () => {
    expect(validateSplits(300_000, [{ categoryId: 1, amount: 200_000 }, { categoryId: 2, amount: 100_000 }]).ok).toBe(true);
    const bad = validateSplits(300_000, [{ categoryId: 1, amount: 200_000 }]);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toContain("belum dibagi");
    expect(validateSplits(0, [{ categoryId: 1, amount: 0 }]).ok).toBe(false);
    expect(validateSplits(100, []).ok).toBe(false);
  });
  it("menggabungkan kategori ganda", () => {
    expect(normalizeSplits([{ categoryId: 1, amount: 5 }, { categoryId: 1, amount: 7 }, { categoryId: 2, amount: 1 }])).toEqual([
      { categoryId: 1, amount: 12 },
      { categoryId: 2, amount: 1 },
    ]);
  });
});

describe("amortisasi", () => {
  it("anuitas: PMT standar bank (100 jt, 12%, 12 bln)", () => {
    expect(annuityPayment(100_000_000, 1200, 12)).toBe(8_884_879);
    const rows = scheduleForDebt({ principal: 100_000_000, startDate: "2026-01-10", tenorMonths: 12, type: "annuity", rateBp: 1200, dueDay: 5 });
    expect(rows).toHaveLength(12);
    expect(rows[0].dueDate).toBe("2026-02-05");
    expect(rows[0].interest).toBe(1_000_000);
    expect(rows[0].principal).toBe(7_884_879);
    expect(sumBy(rows, (r) => r.principal)).toBe(100_000_000);
    expect(rows.at(-1)!.remaining).toBe(0);
    for (const r of rows.slice(0, -1)) expect(r.total).toBe(8_884_879);
    // pembulatan: cicilan terakhir selisih ≤ beberapa rupiah
    expect(Math.abs(rows.at(-1)!.total - 8_884_879)).toBeLessThanOrEqual(12);
  });
  it("KPR anuitas 500 jt, 7,5%, 20 thn", () => {
    const rows = scheduleForDebt({ principal: 500_000_000, startDate: "2026-01-01", tenorMonths: 240, type: "annuity", rateBp: 750, dueDay: 10 });
    expect(rows[0].total).toBe(4_027_966) // = 500e6·r/(1−(1+r)^−240), r = 7,5%/12;
    expect(rows).toHaveLength(240);
    expect(rows.at(-1)!.remaining).toBe(0);
  });
  it("flat: bunga tetap dari pokok awal", () => {
    const rows = scheduleForDebt({ principal: 12_000_000, startDate: "2026-01-01", tenorMonths: 12, type: "flat", rateBp: 1200, dueDay: 1 });
    expect(rows.every((r) => r.interest === 120_000)).toBe(true);
    expect(rows.every((r) => r.principal === 1_000_000)).toBe(true);
    expect(totalInterest(rows)).toBe(1_440_000);
  });
  it("0%: pokok dibagi rata, sisa di periode terakhir", () => {
    const rows = scheduleForDebt({ principal: 1_000_000, startDate: "2026-01-01", tenorMonths: 3, type: "zero", rateBp: 0, dueDay: 1 });
    expect(rows.map((r) => r.principal)).toEqual([333_333, 333_333, 333_334]);
    expect(totalInterest(rows)).toBe(0);
  });
  it("floating: jadwal dihitung ulang saat bunga berubah", () => {
    const base = { principal: 120_000_000, startDate: "2026-01-01", tenorMonths: 24, type: "floating" as const, rateBp: 600, dueDay: 1 };
    const fixed = scheduleForDebt(base);
    const floated = scheduleForDebt({ ...base, rateChanges: [{ effectiveDate: "2027-01-01", rateBp: 1000 }] });
    expect(floated.slice(0, 11)).toEqual(fixed.slice(0, 11));
    expect(floated[11].dueDate).toBe("2027-01-01");
    expect(floated[11].total).toBeGreaterThan(fixed[11].total);
    // cicilan setelah perubahan = PMT atas sisa pokok
    expect(floated[11].total).toBe(annuityPayment(floated[10].remaining, 1000, 13));
    expect(floated.at(-1)!.remaining).toBe(0);
    expect(sumBy(floated, (r) => r.principal)).toBe(120_000_000);
  });
  it("hitung ulang dari sisa pokok", () => {
    const rows = recalcFromRemaining({ remaining: 50_000_000, remainingPeriods: 10, nextPeriodNo: 15, nextDueDate: "2027-03-05", type: "annuity", rateBp: 900, dueDay: 5 });
    expect(rows[0].periodNo).toBe(15);
    expect(rows).toHaveLength(10);
    expect(rows.at(-1)!.remaining).toBe(0);
  });
  it("cicilan terlalu kecil ditolak", () => {
    expect(() => buildSchedule({ principal: 100_000_000, periods: 12, type: "annuity", rateBp: 1200, firstDueDate: "2026-01-01", dueDay: 1, fixedInstallment: 500_000 })).toThrow();
  });
  it("DSR", () => {
    expect(debtServiceRatio(4_500_000, 15_000_000)).toBeCloseTo(0.3);
  });
});

describe("pelunasan sebagian (extra payment)", () => {
  const rows = scheduleForDebt({ principal: 100_000_000, startDate: "2026-01-01", tenorMonths: 24, type: "annuity", rateBp: 1200, dueDay: 1 });
  const paid = rows.slice(0, 6);
  const unpaid = rows.slice(6);
  const remaining = paid.at(-1)!.remaining;

  it("kurangi tenor: cicilan sama, tenor lebih pendek, bunga hemat", () => {
    const r = applyExtraPayment({ remaining, currentUnpaid: unpaid, extra: 20_000_000, mode: "reduce_tenor", type: "annuity", rateBp: 1200, dueDay: 1 });
    expect(r.schedule.length).toBeLessThan(unpaid.length);
    expect(r.periodsSaved).toBeGreaterThan(0);
    expect(r.schedule[0].total).toBe(unpaid[0].total);
    expect(r.interestSaved).toBeGreaterThan(0);
    expect(sumBy(r.schedule, (x) => x.principal)).toBe(remaining - 20_000_000);
    expect(r.schedule[0].periodNo).toBe(7);
  });
  it("kurangi cicilan: tenor sama, cicilan lebih kecil", () => {
    const r = applyExtraPayment({ remaining, currentUnpaid: unpaid, extra: 20_000_000, mode: "reduce_installment", type: "annuity", rateBp: 1200, dueDay: 1 });
    expect(r.schedule).toHaveLength(unpaid.length);
    expect(r.newInstallment).toBeLessThan(unpaid[0].total);
    expect(r.interestSaved).toBeGreaterThan(0);
  });
  it("kurangi tenor menghemat bunga lebih banyak dari kurangi cicilan", () => {
    const a = applyExtraPayment({ remaining, currentUnpaid: unpaid, extra: 20_000_000, mode: "reduce_tenor", type: "annuity", rateBp: 1200, dueDay: 1 });
    const b = applyExtraPayment({ remaining, currentUnpaid: unpaid, extra: 20_000_000, mode: "reduce_installment", type: "annuity", rateBp: 1200, dueDay: 1 });
    expect(a.interestSaved).toBeGreaterThan(b.interestSaved);
  });
  it("extra ≥ sisa pokok = lunas", () => {
    const r = applyExtraPayment({ remaining, currentUnpaid: unpaid, extra: remaining + 1, mode: "reduce_tenor", type: "annuity", rateBp: 1200, dueDay: 1 });
    expect(r.schedule).toHaveLength(0);
    expect(r.interestSaved).toBe(totalInterest(unpaid));
  });
});

describe("snowball vs avalanche", () => {
  const debts = [
    { id: 1, name: "Kartu kredit", balance: 10_000_000, rateBp: 2400, minPayment: 500_000 },
    { id: 2, name: "Paylater", balance: 2_000_000, rateBp: 1200, minPayment: 200_000 },
    { id: 3, name: "KTA", balance: 30_000_000, rateBp: 1500, minPayment: 1_000_000 },
  ];
  it("urutan target sesuai strategi", () => {
    expect(simulateStrategy(debts, 1_000_000, "snowball").order).toEqual([2, 1, 3]);
    expect(simulateStrategy(debts, 1_000_000, "avalanche").order).toEqual([1, 3, 2]);
  });
  it("avalanche tidak lebih mahal dari snowball; dana ekstra mempercepat", () => {
    const { snowball, avalanche, baseline } = compareStrategies(debts, 1_000_000);
    expect(avalanche.totalInterest).toBeLessThanOrEqual(snowball.totalInterest);
    expect(avalanche.months).toBeLessThan(baseline.months);
    expect(snowball.feasible && avalanche.feasible).toBe(true);
    expect(snowball.payoffMonth[2]).toBeLessThan(avalanche.payoffMonth[2]);
  });
  it("total dibayar = pokok + bunga", () => {
    const r = simulateStrategy(debts, 500_000, "avalanche");
    expect(r.totalPaid).toBe(42_000_000 + r.totalInterest);
  });
});

describe("anggaran", () => {
  it("indikator warna", () => {
    expect(budgetColor({ budget: 1000, rollover: 0, spent: 799 })).toBe("green");
    expect(budgetColor({ budget: 1000, rollover: 0, spent: 800 })).toBe("yellow");
    expect(budgetColor({ budget: 1000, rollover: 0, spent: 1000 })).toBe("yellow");
    expect(budgetColor({ budget: 1000, rollover: 0, spent: 1001 })).toBe("red");
    expect(budgetColor({ budget: 0, rollover: 0, spent: 1 })).toBe("red");
  });
  it("rollover sisa & kelebihan", () => {
    expect(nextRollover({ budget: 1_000_000, rollover: 200_000, spent: 900_000 }, true)).toBe(300_000);
    expect(nextRollover({ budget: 1_000_000, rollover: 0, spent: 1_250_000 }, true)).toBe(-250_000);
    expect(nextRollover({ budget: 1_000_000, rollover: 0, spent: 100 }, false)).toBe(0);
  });
  it("zero-based: belum dialokasikan", () => {
    expect(unallocated(15_000_000, [5_000_000, 4_000_000, 6_000_000])).toBe(0);
    expect(unallocated(15_000_000, [5_000_000])).toBe(10_000_000);
  });
  it("ambang notifikasi 80% & 100%", () => {
    expect(crossedThresholds({ budget: 1000, rollover: 0, spent: 700 }, { budget: 1000, rollover: 0, spent: 850 })).toEqual([80]);
    expect(crossedThresholds({ budget: 1000, rollover: 0, spent: 700 }, { budget: 1000, rollover: 0, spent: 1100 })).toEqual([80, 100]);
    expect(crossedThresholds({ budget: 1000, rollover: 0, spent: 850 }, { budget: 1000, rollover: 0, spent: 900 })).toEqual([]);
  });
  it("sinking fund & sisa per hari", () => {
    expect(sinkingMonthly(1_200_000)).toBe(100_000);
    expect(sinkingMonthly(1_000_000)).toBe(83_334);
    expect(spendable({ budgets: [{ budget: 1000, rollover: 0, spent: 400 }, { budget: 500, rollover: 0, spent: 600 }], income: 0, outflow: 0 })).toBe(600);
    expect(spendable({ budgets: [], income: 10_000, outflow: 4_000 })).toBe(6_000);
    expect(perDay(350_000, 7)).toBe(50_000);
  });
});

describe("tujuan tabungan", () => {
  it("setoran per bulan yang dibutuhkan", () => {
    expect(requiredMonthly(12_000_000, 0, "2026-01-01", "2026-12-01")).toBe(1_000_000);
    expect(requiredMonthly(12_000_000, 12_000_000, "2026-01-01", "2026-12-01")).toBe(0);
  });
  it("status on track / tertinggal", () => {
    const s = goalStatus({ target: 12_000_000, savedBeforePeriod: 0, depositedThisPeriod: 400_000, periodStart: "2026-01-01", targetDate: "2026-12-01" });
    expect(s.onTrack).toBe(false);
    expect(s.shortfall).toBe(600_000);
    const ok = goalStatus({ target: 12_000_000, savedBeforePeriod: 0, depositedThisPeriod: 1_000_000, periodStart: "2026-01-01", targetDate: "2026-12-01" });
    expect(ok.onTrack).toBe(true);
  });
  it("dana darurat & alokasi virtual", () => {
    expect(emergencyTarget(7_500_000, 6)).toBe(45_000_000);
    expect(canAllocate(10_000_000, 8_000_000, 2_000_000)).toBe(true);
    expect(canAllocate(10_000_000, 8_000_000, 2_000_001)).toBe(false);
  });
});

describe("tagihan berulang", () => {
  it("bulanan tanggal 31 dipotong", () => {
    const rule = { frequency: "monthly" as const, interval: 1, dayOfMonth: 31, dayOfWeek: null, monthOfYear: null, startDate: "2026-01-01", endDate: null };
    expect(occurrencesBetween(rule, "2026-01-01", "2026-04-30")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });
  it("setiap 3 bulan, mingguan, tahunan, hari kerja terakhir", () => {
    expect(occurrencesBetween({ frequency: "every_n_months", interval: 3, dayOfMonth: 10, dayOfWeek: null, monthOfYear: null, startDate: "2026-01-05", endDate: null }, "2026-01-01", "2026-12-31")).toEqual(["2026-01-10", "2026-04-10", "2026-07-10", "2026-10-10"]);
    expect(occurrencesBetween({ frequency: "weekly", interval: 1, dayOfMonth: null, dayOfWeek: 1, monthOfYear: null, startDate: "2026-11-18", endDate: null }, "2026-11-01", "2026-12-07")).toEqual(["2026-11-23", "2026-11-30", "2026-12-07"]);
    expect(nextOccurrence({ frequency: "yearly", interval: 1, dayOfMonth: 15, dayOfWeek: null, monthOfYear: 3, startDate: "2026-05-01", endDate: null }, "2026-05-01")).toBe("2027-03-15");
    expect(occurrencesBetween({ frequency: "last_workday", interval: 1, dayOfMonth: null, dayOfWeek: null, monthOfYear: null, startDate: "2026-01-01", endDate: null }, "2026-01-01", "2026-02-28")).toEqual(["2026-01-30", "2026-02-27"]);
  });
  it("menghormati tanggal akhir", () => {
    expect(nextOccurrence({ frequency: "daily", interval: 1, dayOfMonth: null, dayOfWeek: null, monthOfYear: null, startDate: "2026-01-01", endDate: "2026-01-03" }, "2026-01-04")).toBeNull();
  });
  it("status tagihan", () => {
    expect(billStatus("2026-11-10", "2026-11-20", false)).toBe("late");
    expect(billStatus("2026-11-25", "2026-11-20", false)).toBe("unpaid");
    expect(billStatus("2026-11-10", "2026-11-20", true)).toBe("paid");
  });
});

describe("laporan", () => {
  it("rasio 50/30/20", () => {
    const r = ratioBreakdown({ needs: 5_000, wants: 3_000, savings_debt: 2_000 });
    expect(r.needs).toBeCloseTo(0.5);
    expect(r.wants).toBeCloseTo(0.3);
  });
  it("8 teratas + Lainnya", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({ name: `K${i}`, value: (i + 1) * 100 }));
    const r = topWithOthers(items);
    expect(r).toHaveLength(9);
    expect(r.at(-1)).toMatchObject({ name: "Lainnya", value: 300 });
  });
});

describe("alokasi gaji/bonus", () => {
  it("nominal tetap dulu, sisanya persen (50/30/20 bonus)", () => {
    expect(resolveAmounts(10_000_000, [{ percent: 50 }, { percent: 30 }, { percent: 20 }])).toEqual([5_000_000, 3_000_000, 2_000_000]);
    const r = resolveAmounts(15_000_001, [{ amount: 4_250_000 }, { amount: 1_000_000 }, { percent: 60 }, { percent: 40 }]);
    expect(r.slice(0, 2)).toEqual([4_250_000, 1_000_000]);
    expect(r[2] + r[3]).toBe(15_000_001 - 5_250_000);
  });
});
