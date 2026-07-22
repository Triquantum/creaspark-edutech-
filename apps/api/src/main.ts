import { createApp } from "./bootstrap";

async function bootstrap() {
  const app = await createApp();
  await app.listen(process.env.PORT ?? process.env.API_PORT ?? 4000);
}
bootstrap();
