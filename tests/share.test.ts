import { test } from "node:test";
import assert from "node:assert/strict";
import { buildShareMessage } from "../lib/share.ts";
import type { PublicPropertyCard } from "../lib/types.ts";

const card: PublicPropertyCard = {
  id: "x", property_type: "plot", purpose: "sale", city: "Jind", locality: "Urban Estate Sector 8",
  plot_no: "112-A", size_value: 200, size_unit: "gaj", price: 5600000, price_negotiable: true,
  status: "available", photo_paths: [], business_name: "SJP Properties", public_phone: "+919812000000",
};

test("message contains public details and our number", () => {
  const m = buildShareMessage(card, { lang: "en", includePlotNo: false });
  assert.match(m, /Plot for Sale/);
  assert.match(m, /Urban Estate Sector 8, Jind/);
  assert.match(m, /200 Gaj/);
  assert.match(m, /₹56 Lakh \(negotiable\)/);
  assert.match(m, /98120 00000/);
});

test("plot number hidden unless toggled", () => {
  assert.doesNotMatch(buildShareMessage(card, { lang: "en", includePlotNo: false }), /112-A/);
  assert.match(buildShareMessage(card, { lang: "en", includePlotNo: true }), /Plot No\. 112-A/);
});

test("private fields can never leak, even if a full row is passed in", () => {
  const leaky = {
    ...card,
    notes: "SECRET-NOTE owner in hurry",
    owner_name: "Ramesh Kumar",
    owner_phone: "+919812012345",
    source_contact_id: "c-1",
    expected_amount: 56000,
    commission: "2%",
  } as unknown as PublicPropertyCard;
  for (const lang of ["en", "hi"] as const) {
    const m = buildShareMessage(leaky, { lang, includePlotNo: false });
    for (const bad of ["SECRET", "Ramesh", "9812012345", "98120 12345", "56000", "56,000", "2%", "c-1"]) {
      assert.ok(!m.includes(bad), `${lang} message leaked ${bad}:\n${m}`);
    }
  }
});

test("hindi message", () => {
  const m = buildShareMessage({ ...card, purpose: "rent", price: 15000 }, { lang: "hi", includePlotNo: false });
  assert.match(m, /प्लॉट किराये पर/);
  assert.match(m, /₹15,000 \/ महीना/);
});
