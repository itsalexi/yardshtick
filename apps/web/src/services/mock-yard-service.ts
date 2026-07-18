import type { SaleView, Storefront, YardItem, YardService } from "@yard/contracts";
import { demoSale, demoStorefront } from "@yard/mock-data";

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
    return {
      slug: this.sale.slug,
      title: this.sale.title,
      items: this.sale.items.filter((item) => item.selected),
    };
  }

  async getStorefront(): Promise<Storefront> {
    return structuredClone(demoStorefront);
  }

  async reserveItem(_slug: string, itemId: string, buyerName: string): Promise<void> {
    this.sale.items = this.sale.items.map((item) =>
      item.id === itemId
        ? { ...item, status: "reserved" as const, reservedByName: buyerName }
        : item,
    );
  }
}
