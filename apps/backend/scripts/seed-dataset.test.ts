import { describe, expect, it } from "vitest";

import { missingFixtureKeys } from "./seed-dataset";

describe("missingFixtureKeys", () => {
  it("returns only desired keys that are not already seeded", () => {
    expect(
      missingFixtureKeys(
        ["phone-single", "charger-cable"],
        ["phone-single", "empty-table-room"],
      ),
    ).toEqual(["charger-cable"]);
  });

  it("does not return duplicates when the desired list repeats a key", () => {
    expect(missingFixtureKeys(["phone-single", "phone-single"], [])).toEqual([
      "phone-single",
    ]);
  });
});
