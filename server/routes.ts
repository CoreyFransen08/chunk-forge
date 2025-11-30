import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerUploadRoutes } from "./routes/upload";
import { registerUploadRoutes as registerUploadCrudRoutes } from "./routes/uploads";
import { registerSchemaRoutes } from "./routes/schemas";
import { registerChunkRoutes } from "./routes/chunk";
import { registerChunkCrudRoutes } from "./routes/chunks";
import { registerExportRoutes } from "./routes/export";
import { registerAgentRoutes } from "./routes/agents";
import { initStorage } from "./services/storage";

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize local file storage
  await initStorage();

  // Register all route modules
  registerUploadRoutes(app); // File upload handling (POST /api/upload)
  registerUploadCrudRoutes(app); // Upload CRUD routes (GET/PATCH/DELETE /api/uploads)
  registerSchemaRoutes(app);
  registerChunkRoutes(app);
  registerChunkCrudRoutes(app);
  registerExportRoutes(app);
  registerAgentRoutes(app);

  const httpServer = createServer(app);
  return httpServer;
}
