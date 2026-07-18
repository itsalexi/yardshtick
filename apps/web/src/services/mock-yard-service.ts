import type { SaleView, Storefront, YardItem, YardService } from "@yard/contracts";
import { demoSale } from "@yard/mock-data";

export class MockYardService implements YardService {
  private sale: SaleView = structuredClone(demoSale);

  async createDraft(): Promise<SaleView> {
    return structuredClone(this.sale);
  }

  async startScan(): Promise<void> {}

  async getSale(): Promise<SaleView> {
    return structuredClone(this.sale);
  }

  async setItemSelected(itemId: string, selected: boolean): Promise<void> {
    this.sale.items = this.sale.items.map((item) =>
      item.id === itemId ? { ...item, selected } : item,
    );
  }

  async updateItem(
    itemId: string,
    patch: Partial<Pick<YardItem, "title" | "condition" | "finalPricePhp">>,
  ): Promise<void> {
    this.sale.items = this.sale.items.map((item) =>
      item.id === itemId ? { ...item, ...patch } : item,
    );
  }

  async publishSale(): Promise<Storefront> {
    this.sale.status = "published";
    return this.storefrontFromSale();
  }

  async getStorefront(): Promise<Storefront> {
    return this.storefrontFromSale();
  }

  async reserveItem(_slug: string, itemId: string, buyerName: string): Promise<void> {
    const item = this.sale.items.find((candidate) => candidate.id === itemId);
    if (!item) throw new Error("Item not found");
    if (item.status !== "available") {
      throw new Error("Someone reserved this just before you.");
    }
    this.sale.items = this.sale.items.map((candidate) =>
      candidate.id === itemId
        ? { ...candidate, status: "reserved" as const, reservedByName: buyerName }
        : candidate,
    );
  }

  private storefrontFromSale(): Storefront {
    return {
      slug: this.sale.slug,
      title: this.sale.title,
      items: structuredClone(this.sale.items.filter((item) => item.selected)),
    };
  }
}
