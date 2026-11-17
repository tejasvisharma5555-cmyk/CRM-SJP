import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPrice, formatMoney, parseAmount } from "../lib/format.ts";

test("lakh / crore formatting", () => {
  assert.equal(formatPrice(5600000), "₹56 Lakh");
  assert.equal(formatPrice(12500000), "₹1.25 Cr");
  assert.equal(formatPrice(5600000, "hi"), "₹56 लाख");
  assert.equal(formatPrice(15000), "₹15,000");
  assert.equal(formatMoney(125000), "₹1,25,000");
});

test("parses typed amounts", () => {
  assert.equal(parseAmount("56 lakh"), 5600000);
  assert.equal(parseAmount("56L"), 5600000);
  assert.equal(parseAmount("1.25 cr"), 12500000);
  assert.equal(parseAmount("56,00,000"), 5600000);
  assert.equal(parseAmount("25k"), 25000);
  assert.equal(parseAmount("₹ 15000"), 15000);
  assert.equal(parseAmount("2 करोड़"), 20000000);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount("0"), null);
});
