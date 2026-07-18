import type { YardService } from "@yard/contracts";

import { ConvexYardService } from "./convex-yard-service";
import { MockYardService } from "./mock-yard-service";

let service: YardService | undefined;

export function getYardService(): YardService {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  service ??= convexUrl ? new ConvexYardService(convexUrl) : new MockYardService();
  return service;
}
