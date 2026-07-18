export type SceneExpectation = {
  fixtureKey: string;
  fileName: string;
  width: 2048;
  height: 1536;
  expectedCandidateRange: readonly [number, number];
  required: ReadonlyArray<{
    label: string;
    aliases: readonly string[];
  }>;
  optional: ReadonlyArray<{
    label: string;
    aliases: readonly string[];
  }>;
  excluded: readonly string[];
  notes: readonly string[];
};

export const sceneManifest = [
  {
    fixtureKey: "phone-single",
    fileName: "phone-single.jpeg",
    width: 2048,
    height: 1536,
    expectedCandidateRange: [1, 2],
    required: [
      {
        label: "smartphone",
        aliases: ["phone", "iphone", "smartphone"],
      },
    ],
    optional: [
      {
        label: "partial laptop",
        aliases: ["laptop", "computer"],
      },
    ],
    excluded: ["table", "hand"],
    notes: ["A heavily clipped laptop may be omitted when it cannot support a listing."],
  },
  {
    fixtureKey: "laptop-table-multi",
    fileName: "laptop-table-multi.jpeg",
    width: 2048,
    height: 1536,
    expectedCandidateRange: [6, 12],
    required: [
      {
        label: "central laptop",
        aliases: ["laptop", "macbook", "notebook computer"],
      },
      {
        label: "smartphone",
        aliases: ["phone", "iphone", "smartphone"],
      },
      {
        label: "power adapter",
        aliases: ["charger", "power adapter", "laptop charger"],
      },
      {
        label: "wallet",
        aliases: ["wallet", "case", "black pouch"],
      },
    ],
    optional: [
      {
        label: "secondary laptop",
        aliases: ["laptop", "computer"],
      },
      {
        label: "bottle",
        aliases: ["bottle", "water bottle", "tumbler"],
      },
      {
        label: "cap",
        aliases: ["cap", "hat", "baseball cap"],
      },
      {
        label: "pouch or case",
        aliases: ["pouch", "case", "container"],
      },
    ],
    excluded: ["table", "person", "hand", "chair"],
    notes: ["Distinct visible tabletop products may be returned separately."],
  },
  {
    fixtureKey: "charger-cable",
    fileName: "charger-cable.jpeg",
    width: 2048,
    height: 1536,
    expectedCandidateRange: [1, 2],
    required: [
      {
        label: "charger bundle",
        aliases: ["charger", "power adapter and cable", "adapter cable"],
      },
    ],
    optional: [
      {
        label: "wallet",
        aliases: ["wallet", "pouch", "case"],
      },
    ],
    excluded: ["table", "arm", "laptop"],
    notes: ["Treat the attached adapter and cable as one product bundle."],
  },
  {
    fixtureKey: "overlapping-caps",
    fileName: "overlapping-caps.jpeg",
    width: 2048,
    height: 1536,
    expectedCandidateRange: [4, 7],
    required: [
      {
        label: "blue cap",
        aliases: ["blue cap", "oracle racing cap", "baseball cap"],
      },
      {
        label: "black cap",
        aliases: ["black cap", "alphatauri cap", "baseball cap"],
      },
    ],
    optional: [
      {
        label: "smartphone",
        aliases: ["phone", "iphone", "smartphone"],
      },
      {
        label: "laptop",
        aliases: ["laptop", "computer"],
      },
      {
        label: "bottle",
        aliases: ["bottle", "water bottle", "tumbler"],
      },
    ],
    excluded: ["table", "person", "hand"],
    notes: ["The caps overlap but remain separate; other identifiable products also count."],
  },
  {
    fixtureKey: "empty-table-room",
    fileName: "empty-table-room.jpeg",
    width: 2048,
    height: 1536,
    expectedCandidateRange: [6, 12],
    required: [
      {
        label: "table",
        aliases: ["table", "desk"],
      },
      {
        label: "chair",
        aliases: ["chair", "seat"],
      },
    ],
    optional: [],
    excluded: ["floor", "wall", "room"],
    notes: ["Furniture is valid garage-sale inventory even in a wider room scene."],
  },
  {
    fixtureKey: "pa-speaker-room",
    fileName: "pa-speaker-room.jpeg",
    width: 2048,
    height: 1536,
    expectedCandidateRange: [4, 12],
    required: [
      {
        label: "PA speaker bundle",
        aliases: ["pa speaker", "speaker and stand", "jbl speaker"],
      },
      {
        label: "whiteboard",
        aliases: ["whiteboard", "dry erase board", "marker board"],
      },
      {
        label: "chair",
        aliases: ["chair", "seat"],
      },
    ],
    optional: [
      {
        label: "table",
        aliases: ["table", "desk"],
      },
      {
        label: "cable bundle",
        aliases: ["cable", "cord", "wire bundle"],
      },
    ],
    excluded: ["window", "wall", "floor"],
    notes: ["Treat the speaker and tripod stand as one product; include other removable items."],
  },
] as const satisfies readonly SceneExpectation[];
