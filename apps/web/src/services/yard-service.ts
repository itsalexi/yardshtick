import type { YardService } from "@yard/contracts";

import { MockYardService } from "./mock-yard-service";

let service: YardService | undefined;

export function getYardService(): YardService {
  service ??= new MockYardService();
  return service;
}
