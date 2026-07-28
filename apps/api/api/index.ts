import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import { ExpressAdapter } from "@nestjs/platform-express";
import { createApp } from "../src/bootstrap";

// express() returns a callable app; the exported `Express` interface itself
// doesn't declare that call signature, so alias to the real inferred type.
type ExpressServer = ReturnType<typeof express>;

let cachedServer: ExpressServer | null = null;

async function getServer(): Promise<ExpressServer> {
  if (cachedServer) return cachedServer;
  const expressApp = express();
  const app = await createApp(new ExpressAdapter(expressApp));
  await app.init();
  cachedServer = expressApp;
  return expressApp;
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const server = await getServer();
  server(req, res);
}
