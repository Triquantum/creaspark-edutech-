/**
 * One-time import of real inventory data extracted from the two source
 * files supplied on the Desktop: "AMRITA KIT SUMMARY.docx" and
 * "Kits distribution.xlsx". Run once against production; safe to re-run
 * (all writes are upsert-by-name or additive allocations, never destructive).
 *
 * Every quantity below is transcribed verbatim from the source files -- see
 * the comment above each block for exactly which document/sheet/column it
 * came from. Rows that were ambiguous in the source (a literal "Repeat"
 * marker, or a non-numeric "1 Lot" quantity) are explicitly skipped and
 * logged, never guessed, per the "do not invent missing quantities" rule.
 *
 * Run with:
 *   pnpm --filter database exec tsx --env-file="<path to apps/api/.env>" packages/database/scripts/seed-amrita-kits.ts
 */
import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

// Registered schools (confirmed live via /academic/schools before writing this script).
const SCHOOL = {
  THALASSERY: "cmrv4uq5c0004rcw3nnefz329",
  KUTHUPARAMBA: "cms5v5e8f0002kh3ki256bi6o",
  KOYILANDI: "cms4boyfl0003g78e7yecccr7",
  KOZHIKODE: "cms4b2uqc00021cnekqnakt4g",
  ALLEY: "cms4f7qr000195aflii2cjfjs",
} as const;

const CREASPARK_TENANT_ID = "cmrv4bbg60000tcr3o1xbmdfr"; // CREASPARK LLP -- central org managing this stock

function generateItemCode(categoryPrefix: string, seen: Set<string>): string {
  const prefix = categoryPrefix.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase() || "AST";
  for (let i = 1; i < 1000; i++) {
    const code = `${prefix}-${String(i).padStart(3, "0")}`;
    if (!seen.has(code)) { seen.add(code); return code; }
  }
  throw new Error(`Could not generate a unique item code for prefix ${categoryPrefix}`);
}

async function ensureCategory(name: string, description?: string) {
  return prisma.assetCategory.upsert({ where: { name }, update: {}, create: { name, description } });
}

interface AllocationInput { schoolId: string; quantity: number }

async function createItemWithAllocations(opts: {
  itemName: string; assetCategoryId: string; totalQuantity: number;
  sourceFile: string; sourceItemName: string; importNotes?: string;
  allocations: AllocationInput[]; actorId: string; itemCode: string;
}) {
  const existing = await prisma.assetItem.findFirst({ where: { itemName: opts.itemName, assetCategoryId: opts.assetCategoryId } });
  if (existing) {
    console.log(`SKIP (already imported): ${opts.itemName}`);
    return existing;
  }
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.assetItem.create({
      data: {
        tenantId: CREASPARK_TENANT_ID, itemCode: opts.itemCode, itemName: opts.itemName, assetCategoryId: opts.assetCategoryId,
        totalQuantity: opts.totalQuantity, unit: "unit", sourceFile: opts.sourceFile, sourceItemName: opts.sourceItemName,
        importNotes: opts.importNotes, createdById: opts.actorId, updatedById: opts.actorId,
      },
    });
    if (opts.totalQuantity > 0) {
      await tx.assetTransaction.create({
        data: {
          assetItemId: created.id, type: "RECEIVED", quantity: opts.totalQuantity, userId: opts.actorId,
          previousValue: 0, newValue: opts.totalQuantity, remarks: `Imported from ${opts.sourceFile}`,
        },
      });
    }
    for (const a of opts.allocations) {
      if (a.quantity <= 0) continue;
      const allocation = await tx.assetAllocation.create({
        data: { assetItemId: created.id, schoolId: a.schoolId, allocatedQuantity: a.quantity, allocatedById: opts.actorId },
      });
      await tx.assetTransaction.create({
        data: {
          assetItemId: created.id, type: "ALLOCATION", quantity: a.quantity, schoolId: a.schoolId, userId: opts.actorId,
          previousValue: 0, newValue: allocation.allocatedQuantity, reference: opts.sourceFile,
        },
      });
    }
    return created;
  });
  console.log(`Created: ${opts.itemName} (${opts.itemCode}) total=${opts.totalQuantity} allocations=${opts.allocations.filter((a) => a.quantity > 0).length}`);
  return item;
}

async function main() {
  const actor = await prisma.user.findFirst({ where: { tenantId: CREASPARK_TENANT_ID, role: "SUPER_ADMIN" } });
  if (!actor) throw new Error("No SUPER_ADMIN user found under the CREASPARK LLP tenant -- aborting, nothing written.");

  const usedCodes = new Set<string>((await prisma.assetItem.findMany({ select: { itemCode: true } })).map((i) => i.itemCode));

  const catIoTKit = await prisma.assetCategory.findUnique({ where: { name: "IoT Kit" } });
  const catAvishkar = await prisma.assetCategory.findUnique({ where: { name: "Avishkar Bundle Kit" } });
  if (!catIoTKit || !catAvishkar) {
    throw new Error("Expected existing categories 'IoT Kit' / 'Avishkar Bundle Kit' not found -- run migration 20260809070000_add_asset_inventory first.");
  }
  const catRobotics = await ensureCategory("Robotics");
  const cat3DPrinting = await ensureCategory("3D Printing");
  const catDrones = await ensureCategory("Drones");
  const catElectronics = await ensureCategory(
    "Electronics",
    "Raw robotics/IoT components imported from Kits distribution.xlsx. Left as a single category -- administrator may split into finer categories (Sensors, Microcontrollers, Power & Battery, Tools & Accessories) if desired.",
  );

  // ── Source 1: AMRITA KIT SUMMARY.docx ──────────────────────────────────
  // 4 tables, one per school, each listing the same 8 kit-level items.
  // Column order in the source: Thalassery, Kuthuparamba, Koyilandi, Kozhikode.
  const AMRITA_SCHOOLS = [SCHOOL.THALASSERY, SCHOOL.KUTHUPARAMBA, SCHOOL.KOYILANDI, SCHOOL.KOZHIKODE];
  const amritaItems: { name: string; categoryId: string; codePrefix: string; qty: number[]; importNotes?: string }[] = [
    { name: "Robotics classroom bundle kit", categoryId: catRobotics.id, codePrefix: "ROB", qty: [2, 2, 2, 1] },
    { name: "Avishkaar Maker Board", categoryId: catAvishkar.id, codePrefix: "AVK", qty: [3, 3, 3, 2] },
    { name: "IoT Bridge pack", categoryId: catIoTKit.id, codePrefix: "IOT", qty: [3, 3, 3, 2] },
    {
      name: "IotT kit", categoryId: catIoTKit.id, codePrefix: "IOT", qty: [3, 3, 3, 2],
      importNotes: "Source spelling 'IotT kit' preserved verbatim from AMRITA KIT SUMMARY.docx -- likely a duplicate/typo of the 'IoT Kit' category or the 'IoT Bridge pack' item above. Flagged for administrator review (merge/rename/keep separate), not auto-merged.",
    },
    { name: "3D printer Bamboo Lab", categoryId: cat3DPrinting.id, codePrefix: "3DP", qty: [1, 1, 1, 0] },
    {
      name: "DM002 with camera", categoryId: catDrones.id, codePrefix: "DRN", qty: [2, 2, 2, 1],
      importNotes: "Categorized as Drones based on the item's model-number naming convention -- not explicitly labeled in the source document. Administrator should verify.",
    },
    { name: "J2 drones", categoryId: catDrones.id, codePrefix: "DRN", qty: [2, 2, 2, 1] },
    {
      name: "XYQ 6", categoryId: catDrones.id, codePrefix: "DRN", qty: [2, 2, 2, 1],
      importNotes: "Categorized as Drones based on its grouping alongside other drone models in the source document. Administrator should verify.",
    },
  ];

  for (const item of amritaItems) {
    const total = item.qty.reduce((a, b) => a + b, 0);
    await createItemWithAllocations({
      itemName: item.name, assetCategoryId: item.categoryId, totalQuantity: total,
      sourceFile: "AMRITA KIT SUMMARY.docx", sourceItemName: item.name, importNotes: item.importNotes,
      allocations: AMRITA_SCHOOLS.map((schoolId, i) => ({ schoolId, quantity: item.qty[i] })),
      actorId: actor.id, itemCode: generateItemCode(item.codePrefix, usedCodes),
    });
  }

  // ── Source 2: Kits distribution.xlsx (sheet "LIST") ────────────────────
  // Column order: AV TLY, AV KTPRB, AV KYLD, AV KZHD, ALLEY. "existing" is
  // the source's own stated total. null = blank cell. "LOT" = the source
  // literally said "1 Lot" (non-numeric, cannot be preserved as a quantity).
  const XLSX_SCHOOLS = [SCHOOL.THALASSERY, SCHOOL.KUTHUPARAMBA, SCHOOL.KOYILANDI, SCHOOL.KOZHIKODE, SCHOOL.ALLEY];
  type Qty = number | null | "LOT";
  const xlsxRows: { name: string; qty: Qty[]; existing: number | null }[] = [
    { name: "Arduino Uno", qty: [2, 2, 2, 1, 1], existing: 8 },
    { name: "IR Sensor Module", qty: [4, 4, 4, 3, 4], existing: 19 },
    { name: "HC-05 Bluetooth Module", qty: [1, 1, 1, 1, 1], existing: 5 },
    { name: "Smartphone with Bluetooth app & Blynk IoT App", qty: [null, null, null, null, null], existing: 0 },
    { name: "Bulb / Fan", qty: [null, null, null, null, null], existing: 35 },
    // Row 6 "HC-05 Bluetooth Module" with AV TLY="Repeat" -- source-marked duplicate of row 3, skipped entirely.
    { name: "LDR Sensor", qty: [3, 3, 3, 1, 3], existing: 13 },
    { name: "Relay Module 5v", qty: [7, 7, 7, 7, 7], existing: 35 },
    { name: "Bread board", qty: [4, 4, 4, 4, 4], existing: 20 },
    { name: "Jumper wires", qty: ["LOT", "LOT", "LOT", "LOT", "LOT"], existing: 0 },
    { name: "220V Bulb with holder", qty: [7, 7, 7, 7, 7], existing: 35 },
    { name: "Buzzer", qty: [3, null, null, null, 3], existing: 6 },
    { name: "LED", qty: ["LOT", null, null, null, "LOT"], existing: 0 },
    { name: "Resistor mixed", qty: ["LOT", "LOT", null, null, "LOT"], existing: 0 },
    { name: "Ultrasonic Sensor (HC-SR04)", qty: [2, 2, 2, 1, 2], existing: 9 },
    { name: "Battery (9V or power bank)", qty: [null, null, null, null, null], existing: 0 },
    { name: "Stick or pipe (to mount the circuit)", qty: [null, null, null, null, null], existing: 0 },
    { name: "MQ-2 Gas Sensor Module", qty: [5, 4, 4, 4, 5], existing: 22 },
    { name: "Sound Sensor Module", qty: [6, 6, 6, 4, 6], existing: 28 },
    { name: "Servo motor (sg 90)", qty: [5, 5, 5, 5, 5], existing: 25 },
    { name: "MQ-3 Alcohol sensor", qty: [7, 7, 7, 5, 7], existing: 33 },
    { name: "Soil Moisture Sensor Module", qty: [7, 7, 7, 6, 7], existing: 34 },
    { name: "Mini Water Pump", qty: [3, 3, 3, 3, 3], existing: 15 },
    { name: "Water container and pipe", qty: [null, null, null, null, null], existing: 0 },
    { name: "USB cable", qty: [null, null, null, null, null], existing: 0 },
    { name: "Laptop for radar visualization using Processing", qty: [null, null, null, null, null], existing: 0 },
    { name: "Processing Software for simulation", qty: [null, null, null, null, null], existing: 0 },
    { name: "2×10kΩ Resistors", qty: ["LOT", null, null, null, "LOT"], existing: 0 },
    { name: "Small solar panel (optional for model)", qty: [null, null, null, null, null], existing: 0 },
    { name: "DHT11 Temperature & Humidity Sensor", qty: [2, 2, 2, 1, 2], existing: 9 },
    { name: "Relay Module (2 channel)", qty: [null, null, null, null, null], existing: 0 },
    { name: "DC Fan", qty: [null, null, null, null, null], existing: 0 },
    { name: "LCD display (16×2) with I2C", qty: [1, 1, 1, null, null], existing: 3 },
    { name: "ESP32 Development Board", qty: [1, 1, 1, null, null], existing: 3 },
    { name: "2x 2Channel Relay Module", qty: [null, null, null, null, null], existing: 0 },
    { name: "maker board", qty: [null, null, null, null, null], existing: 0 },
    { name: "L298N Dual H-Bridge Motor Driver Module", qty: [2, 2, 2, 2, 2], existing: 10 },
    { name: "KY-026 Flame Sensor Module", qty: [5, 5, 5, 5, 5], existing: 25 },
    { name: "MG995 High Torque Servo Motor", qty: [1, 1, 1, 1, 1], existing: 5 },
    { name: "Rain sensor Module", qty: [3, 3, 3, 2, 3], existing: 14 },
    { name: "Battery pack of AA", qty: [3, 3, 3, 3, 3], existing: 15 },
    { name: "Multi directional flame sensor array module", qty: [2, 2, 2, 1, 1], existing: 8 },
    { name: "KY-038 microphone sound sensor module", qty: [1, 1, 1, 1, 1], existing: 5 },
    { name: "Soldering support", qty: [null, null, null, null, null], existing: 0 },
    { name: "Soldering tool with iron", qty: [1, null, null, null, 1], existing: 2 },
    { name: "Crocodile Clip wire", qty: [10, 10, 10, 10, 10], existing: 50 },
    { name: "Battery Power connector 9V", qty: [4, 4, 4, 4, 4], existing: 20 },
    { name: "Avishkaar MEX robotics explorer kit", qty: [1, 1, 1, null, 1], existing: null },
  ];

  let lotSkippedCount = 0;
  for (const row of xlsxRows) {
    const hasLot = row.qty.some((q) => q === "LOT");
    if (hasLot) {
      lotSkippedCount++;
      await createItemWithAllocations({
        itemName: row.name, assetCategoryId: catElectronics.id, totalQuantity: 0,
        sourceFile: "Kits distribution.xlsx", sourceItemName: row.name,
        importNotes: `Source quantity given as "1 Lot" (non-numeric) for one or more schools -- cannot be preserved as a unit count. Imported as a catalog entry with 0 stock; administrator must set the actual quantity and allocate manually.`,
        allocations: [], actorId: actor.id, itemCode: generateItemCode("ELE", usedCodes),
      });
      continue;
    }
    const numericQty = row.qty.map((q) => (typeof q === "number" ? q : 0));
    const sumQty = numericQty.reduce((a, b) => a + b, 0);
    const total = row.existing ?? sumQty;
    const importNotes = row.existing == null
      ? `Source "existing" total was blank -- totalQuantity computed as the sum of the stated per-school quantities (${sumQty}), not invented.`
      : row.name === "maker board"
        ? "Possible duplicate of 'Avishkaar Maker Board' (AMRITA KIT SUMMARY.docx) -- kept separate since the source names differ and this entry has 0 stock. Administrator should review."
        : undefined;
    await createItemWithAllocations({
      itemName: row.name, assetCategoryId: catElectronics.id, totalQuantity: total,
      sourceFile: "Kits distribution.xlsx", sourceItemName: row.name, importNotes,
      allocations: XLSX_SCHOOLS.map((schoolId, i) => ({ schoolId, quantity: numericQty[i] })),
      actorId: actor.id, itemCode: generateItemCode("ELE", usedCodes),
    });
  }

  console.log(`\nDone. Skipped 1 duplicate "Repeat" row (HC-05 Bluetooth Module, row 6) and flagged ${lotSkippedCount} "1 Lot" rows for manual quantity entry.`);
}

main().finally(() => prisma.$disconnect());
