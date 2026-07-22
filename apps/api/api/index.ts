import type { VercelRequest, VercelResponse } from "@vercel/node";
import express, { type Express } from "express";
import { ExpressAdapter } from "@nestjs/platform-express";
import { createApp } from "../src/bootstrap";

let cachedServer: Express | null = null;

async function getServer(): Promise<Express> {
  if (cachedServer) return cachedServer;
  const expressApp = express();
  const app = await createApp(new ExpressAdapter(expressApp));
  await app.init();
  cachedServer = expressApp;
  return cachedServer;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const server = await getServer();
  server(req, res);
}
