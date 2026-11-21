import { describe, expect, it } from "vitest";
import { compareCategories } from "./report";
import { payoffCountdown, payoffTimeline } from "./payoff";
import { formatMonthShort } from "./date";

describe("compareCategories", () => {
  it("menghitung siklus lalu, rata-rata 3 siklus, dan perubahan", () => {
    const cur = new Map([[1, 1_500_000], [2, 200_000]]);
    const hist = [new Map([[1, 1_000_000], [2, 400_000]]), new Map([[1, 1_000_000]]), new Map([[1, 1_000_000], [3, 300_000]])];
    const rows = compareCategories(cur, hist);
    expect(rows.map((r) => r.id)).toEqual([1, 2, 3]);
    expect(rows[0]).toMatchObject({ current: 1_500_000, previous: 1_000_000, average: 1_000_000, change: 0.5 });
    expect(rows[1].average).toBe(133_333);
    expect(rows[1].change).toBeCloseTo(0.5, 2);
    expect(rows[2]).toMatchObject({ current: 0, previous: 0, average: 100_000, change: -1 });
  });

  it("perubahan null bila belum ada riwayat", () => {
    const rows = compareCategories(new Map([[1, 50_000]]), [new Map(), new Map(), new Map()]);
    expect(rows).toEqual([{ id: 1, current: 50_000, previous: 0, average: 0, change: null }]);
  });
});

describe("payoffTimeline", () => {
  const debt = {
    trackFrom: "2026-09-10",
    base: 3_000_000,
    payments: [
      { date: "2026-09-15", principal: 500_000 },
      { date: "2026-10-15", principal: 500_000 },
    ],
    unpaid: [
      { due: "2026-11-15", principal: 500_000 },
      { due: "2026-12-15", principal: 500_000 },
      { due: "2027-01-15", principal: 1_000_000 },
    ],
  };

  it("riwayat nyata lalu proyeksi sampai lunas", () => {
    const pts = payoffTimeline([debt], "2026-11-21");
    expect(pts).toEqual([
      { month: "2026-09", actual: 2_500_000, projected: null },
      { month: "2026-10", actual: 2_000_000, projected: null },
      { month: "2026-11", actual: 2_000_000, projected: 2_000_000 },
      { month: "2026-12", actual: null, projected: 1_000_000 },
      { month: "2027-01", actual: null, projected: 0 },
    ]);
  });

  it("riwayat dibatasi monthsBack dan hutang yang dicatat belakangan tidak ikut di bulan sebelumnya", () => {
    const later = { trackFrom: "2026-11-01", base: 1_000_000, payments: [], unpaid: [{ due: "2026-11-25", principal: 1_000_000 }] };
    const pts = payoffTimeline([debt, later], "2026-11-21", 1);
    expect(pts[0]).toEqual({ month: "2026-10", actual: 2_000_000, projected: null });
    expect(pts[1]).toEqual({ month: "2026-11", actual: 3_000_000, projected: 3_000_000 });
    expect(pts[2]).toEqual({ month: "2026-12", actual: null, projected: 1_000_000 });
  });

  it("cicilan terlambat masuk proyeksi bulan depan; tanpa hutang = kosong", () => {
    const late = { trackFrom: "2026-11-01", base: 700_000, payments: [], unpaid: [{ due: "2026-10-05", principal: 700_000 }] };
    expect(payoffTimeline([late], "2026-11-21").at(-1)).toEqual({ month: "2026-12", actual: null, projected: 0 });
    expect(payoffTimeline([], "2026-11-21")).toEqual([]);
  });

  it("label bulan singkat", () => {
    expect(formatMonthShort("2027-01")).toBe("Jan 27");
    expect(formatMonthShort("2026-11-21")).toBe("Nov 26");
  });
});

describe("payoffCountdown", () => {
  it("terlambat / bulan ini / N bln lagi", () => {
    expect(payoffCountdown("2026-08-01", "2026-11-21")).toEqual({ label: "terlambat", late: true });
    expect(payoffCountdown("2026-11-28", "2026-11-21")).toEqual({ label: "bulan ini", late: false });
    expect(payoffCountdown("2027-02-07", "2026-11-21")).toEqual({ label: "3 bln lagi", late: false });
  });
});
