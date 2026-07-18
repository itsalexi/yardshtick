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
    expectedCandidateRange: [1, 1],
    required: [
      {
        label: "smartphone",
        aliases: ["phone", "iphone", "smartphone"],
      },
    ],
    optional: [],
    excluded: ["table", "hand", "laptop"],
    notes: ["Ignore partial laptops at the frame edges."],
  },
  {
    fixtureKey: "laptop-table-multi",
    fileName: "laptop-table-multi.jpeg",
    width: 2048,
    height: 1536,
    expectedCandidateRange: [4, 8],
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
    ],
    excluded: ["table", "person", "hand", "chair"],
    notes: ["Distinct visible tabletop products may be returned separately."],
  },
  {
    fixtureKey: "charger-cable",
    fileName: "charger-cable.jpeg",
    width: 2048,
    height: 1536,
    expectedCandidateRange: [1, 1],
    required: [
      {
        label: "charger bundle",
        aliases: ["charger", "power adapter and cable", "adapter cable"],
      },
    ],
    optional: [],
    excluded: ["table", "arm", "wallet", "laptop"],
    notes: ["Treat the attached adapter and cable as one product bundle."],
  },
  {
    fixtureKey: "overlapping-caps",
    fileName: "overlapping-caps.jpeg",
    width: 2048,
    height: 1536,
    expectedCandidateRange: [2, 2],
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
    optional: [],
    excluded: ["table", "person", "phone", "laptop", "bottle"],
    notes: ["The caps overlap but must remain separate candidates."],
  },
  {
    fixtureKey: "empty-table-room",
    fileName: "empty-table-room.jpeg",
    width: 2048,
    height: 1536,
    expectedCandidateRange: [0, 0],
    required: [],
    optional: [],
    excluded: ["table", "chair", "floor", "room"],
    notes: ["Negative control: staging furniture is not merchandise."],
  },
  {
    fixtureKey: "pa-speaker-room",
    fileName: "pa-speaker-room.jpeg",
    width: 2048,
    height: 1536,
    expectedCandidateRange: [1, 1],
    required: [
      {
        label: "PA speaker bundle",
        aliases: ["pa speaker", "speaker and stand", "jbl speaker"],
      },
    ],
    optional: [],
    excluded: ["whiteboard", "table", "chair", "window", "cable"],
    notes: ["Treat the speaker and tripod stand as one product."],
  },
] as const satisfies readonly SceneExpectation[];
