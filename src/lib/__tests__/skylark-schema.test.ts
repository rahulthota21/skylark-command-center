import { describe, expect, it } from "vitest";

import { inferBoardMapping } from "@/lib/data/semantic-mapping";
import { normalizeDeals, normalizeWorkOrders } from "@/lib/data/normalization";
import type { MondayBoard } from "@/lib/data/types";

const dealsBoard: MondayBoard = {
  id: "deals", name: "Sales Pipeline", columns: [
    { id: "owner", title: "Owner code", type: "text" },
    { id: "client", title: "Client Code", type: "text" },
    { id: "status", title: "Deal Status", type: "status" },
    { id: "probability", title: "Closure Probability", type: "status" },
    { id: "amount", title: "Masked Deal value", type: "numbers" },
    { id: "close", title: "Tentative Close Date", type: "date" },
    { id: "stage", title: "Deal Stage", type: "status" },
    { id: "sector", title: "Sector/service", type: "dropdown" },
    { id: "created", title: "Created Date", type: "date" },
  ], items: [{
    id: "d1", name: "Masked Deal A", columnValues: [
      { id: "owner", text: "OWNER_001", value: "OWNER_001" },
      { id: "client", text: "COMPANY001", value: "COMPANY001" },
      { id: "status", text: "Open", value: "Open" },
      { id: "probability", text: "High", value: "High" },
      { id: "amount", text: "500000", value: "500000" },
      { id: "close", text: "2026-02-26", value: '{"date":"2026-02-26"}' },
      { id: "stage", text: "E. Proposal/Commercials Sent", value: "E. Proposal/Commercials Sent" },
      { id: "sector", text: "Renewables", value: "Renewables" },
      { id: "created", text: "2025-12-26", value: '{"date":"2025-12-26"}' },
    ],
  }],
};

const workOrdersBoard: MondayBoard = {
  id: "work-orders", name: "Project Execution", columns: [
    { id: "deal", title: "Deal name masked", type: "text" },
    { id: "customer", title: "Customer Name Code", type: "text" },
    { id: "execution", title: "Execution Status", type: "status" },
    { id: "end", title: "Probable End Date", type: "date" },
    { id: "sector", title: "Sector", type: "dropdown" },
    { id: "amount", title: "Amount in Rupees (Incl of GST) (Masked)", type: "numbers" },
    { id: "billed", title: "Billed Value in Rupees (Incl of GST.) (Masked)", type: "numbers" },
    { id: "collected", title: "Collected Amount in Rupees (Incl of GST.) (Masked)", type: "numbers" },
    { id: "unbilled", title: "Amount to be billed in Rs. (Incl. of GST) (Masked)", type: "numbers" },
    { id: "ar", title: "Amount Receivable (Masked)", type: "numbers" },
    { id: "invoice", title: "Invoice Status", type: "status" },
  ], items: [{
    id: "wo1", name: "SDPLDEAL-001", columnValues: [
      { id: "deal", text: "Masked Deal A", value: "Masked Deal A" },
      { id: "customer", text: "WOCOMPANY001", value: "WOCOMPANY001" },
      { id: "execution", text: "Ongoing", value: "Ongoing" },
      { id: "end", text: "2026-03-31", value: '{"date":"2026-03-31"}' },
      { id: "sector", text: "Renewables", value: "Renewables" },
      { id: "amount", text: "590000", value: "590000" },
      { id: "billed", text: "200000", value: "200000" },
      { id: "collected", text: "150000", value: "150000" },
      { id: "unbilled", text: "390000", value: "390000" },
      { id: "ar", text: "50000", value: "50000" },
      { id: "invoice", text: "Partially Billed", value: "Partially Billed" },
    ],
  }],
};

describe("supplied Skylark tracker schema", () => {
  it("recognizes the actual business columns and documented assumptions", () => {
    const dealMapping = inferBoardMapping(dealsBoard, "deals");
    const workMapping = inferBoardMapping(workOrdersBoard, "workOrders");
    const field = (mapping: typeof dealMapping, name: string) => mapping.fields.find((entry) => entry.field === name)?.columnTitle;

    expect(field(dealMapping, "dealStatus")).toBe("Deal Status");
    expect(field(dealMapping, "closeDate")).toBe("Tentative Close Date");
    expect(field(workMapping, "linkedDealName")).toBe("Deal name masked");
    expect(field(workMapping, "status")).toBe("Execution Status");
    expect(field(workMapping, "dueDate")).toBe("Probable End Date");
    expect(field(workMapping, "receivableAmount")).toBe("Amount Receivable (Masked)");

    const [deal] = normalizeDeals(dealsBoard, dealMapping);
    const [workOrder] = normalizeWorkOrders(workOrdersBoard, workMapping);
    expect(deal).toMatchObject({ stageCategory: "active", probability: 0.75, probabilityKind: "qualitative", sector: "Energy / Renewables" });
    expect(deal.amount).toMatchObject({ amount: 500000, currency: "INR", currencyInferred: true });
    expect(workOrder.amount).toMatchObject({ amount: 590000, currency: "INR" });
    expect(workOrder.receivableAmount).toMatchObject({ amount: 50000, currency: "INR" });
  });
});
