import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AbstractHttpAdapter, NestFactory } from "@nestjs/core";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";

export async function createApp(adapter?: AbstractHttpAdapter): Promise<INestApplication> {
  const app = adapter ? await NestFactory.create(AppModule, adapter) : await NestFactory.create(AppModule);
  app.use(helmet());
  app.enableCors({ origin: process.env.WEB_URL ?? true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("api/v1");

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("CREASPARK EDUCORE API")
      .setDescription("Multi-tenant School ERP & LMS")
      .setVersion("1.0")
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup("docs", app, doc);

  return app;
}
