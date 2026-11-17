import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeIndianPhone, whatsappLink, displayPhone } from "../lib/phone.ts";

test("normalises common Indian formats to +91XXXXXXXXXX", () => {
  for (const v of ["98120 12345", "+91-98120-12345", "098120-12345", "919812012345", "0091 9812012345", "(981) 201-2345", "+91 98120.12345"]) {
    assert.equal(normalizeIndianPhone(v), "+919812012345", v);
  }
});

test("rejects invalid numbers", () => {
  for (const v of ["5812012345", "98120123", "981201234567", "abc9812012345", "", "  ", "01662-245678"]) {
    assert.equal(normalizeIndianPhone(v), null, v);
  }
});

test("10-digit number starting with 91 is not stripped", () => {
  assert.equal(normalizeIndianPhone("9112345678"), "+919112345678");
});

test("links and display", () => {
  assert.equal(whatsappLink("+919812012345"), "https://wa.me/919812012345");
  assert.equal(displayPhone("+919812012345"), "98120 12345");
});
