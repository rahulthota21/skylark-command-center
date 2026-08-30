import { describe, expect, it } from "vitest";

import {
  parseDate,
  parseMoney,
  parseProbability,
  stageCategory,
  workOrderStatusCategory,
} from "@/lib/data/normalization";

describe("money normalization", () => {
  it("parses Indian lakh/crore and common compact formats", () => {
    expect(parseMoney("₹5,00,000").value).toMatchObject({ amount: 500000, currency: "INR" });
    expect(parseMoney("1.5 Cr").value?.amount).toBe(15000000);
    expect(parseMoney("2 L").value?.amount).toBe(200000);
    expect(parseMoney("$20K").value).toMatchObject({ amount: 20000, currency: "USD" });
  });

  it("keeps unlabeled currency visible and rejects unparseable values", () => {
    expect(parseMoney("450000").warning?.code).toBe("MISSING_CURRENCY");
    expect(parseMoney("TBD").warning?.code).toBe("INVALID_MONEY");
  });
});

describe("probability normalization", () => {
  it("normalizes decimal, whole-number, and percentage inputs", () => {
    expect(parseProbability("0.7").value).toBe(0.7);
    expect(parseProbability("70").value).toBe(0.7);
    expect(parseProbability("70%").value).toBe(0.7);
  });

  it("does not turn invalid probability into a forecast value", () => {
    expect(parseProbability("125%").warning?.code).toBe("INVALID_PROBABILITY");
    expect(parseProbability(undefined).value).toBeUndefined();
  });
});

describe("date resilience", () => {
  it("uses structured monday dates and safe ISO values", () => {
    expect(parseDate("2026-04-12").value).toBe("2026-04-12");
    expect(parseDate("display", '{"date":"2026-04-12"}').value).toBe("2026-04-12");
    expect(parseDate("31/03/2026").value).toBe("2026-03-31");
  });

  it("does not guess ambiguous day/month strings", () => {
    expect(parseDate("03/04/2026").warning?.code).toBe("AMBIGUOUS_DATE");
    expect(parseDate("not a date").warning?.code).toBe("INVALID_DATE");
  });
});

describe("business status normalization", () => {
  it("maps standard sales stages and delivery statuses defensibly", () => {
    expect(stageCategory("Closed Won").value).toBe("won");
    expect(stageCategory("Negotiation").value).toBe("active");
    expect(stageCategory("Mystery stage").value).toBe("unknown");
    expect(workOrderStatusCategory("Delayed").value).toBe("at_risk");
    expect(workOrderStatusCategory("Delivered").value).toBe("complete");
  });
});
