import "reflect-metadata";
import { createConnection } from "node:net";
import { connect as createTlsConnection } from "node:tls";
import { ValidationPipe, VersioningType } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { getRedisConnectionConfig, getRedisDiagnosticsUrl } from "./common/redis/redis-config";
import { AppModule } from "./app.module";

function isEnvFlagEnabled(name: string) {
  return (process.env[name] ?? "").toLowerCase() === "true";
}

function logStartupError(label: string, error: unknown) {
  console.error(label);
  console.error(error);
}

function registerProcessDiagnostics() {
  process.on("unhandledRejection", (reason) => {
    logStartupError("[process] unhandledRejection detected.", reason);
    process.exit(1);
  });

  process.on("uncaughtException", (error) => {
    logStartupError("[process] uncaughtException detected.", error);
    process.exit(1);
  });

  process.on("warning", (warning) => {
    console.warn("[process] warning detected.");
    console.warn(warning.stack ?? warning);
  });
}

async function verifyPrismaConnection() {
  const prisma = new PrismaClient();

  try {
    console.info("[startup] Connecting to Prisma...");
    await prisma.$connect();
    console.info("[startup] Prisma connected.");
  } finally {
    await prisma.$disconnect();
  }
}

function encodeRedisCommand(parts: string[]) {
  return `*${parts.length}\r\n${parts.map((part) => `$${Buffer.byteLength(part, "utf8")}\r\n${part}\r\n`).join("")}`;
}

function getPublicApiBaseUrl(port: number) {
  const baseUrl =
    process.env.API_PUBLIC_URL ??
    process.env.RENDER_EXTERNAL_URL ??
    `http://localhost:${port}`;

  return `${baseUrl.replace(/\/$/, "")}/api`;
}

async function verifyRedisConnection() {
  const redis = getRedisConnectionConfig();
  const diagnosticsUrl = getRedisDiagnosticsUrl(redis);
  console.info(`[startup] Connecting to Redis at ${diagnosticsUrl}...`);

  await new Promise<void>((resolve, reject) => {
    const socket = redis.tls
      ? createTlsConnection({
          host: redis.host,
          port: redis.port,
          servername: redis.host,
        })
      : createConnection({ host: redis.host, port: redis.port });
    let settled = false;
    let authenticated = !(redis.password || redis.username);

    const timer = setTimeout(() => {
      if (settled) {
        return;
      }

      settled = true;
      socket.destroy();
      reject(new Error(`Timed out while connecting to Redis at ${diagnosticsUrl}.`));
    }, 5000);

    const cleanup = () => {
      clearTimeout(timer);
      socket.removeAllListeners();
    };

    socket.on("connect", () => {
      if (redis.password || redis.username) {
        const authParts = redis.username
          ? ["AUTH", redis.username, redis.password ?? ""]
          : ["AUTH", redis.password ?? ""];
        socket.write(encodeRedisCommand(authParts));
        return;
      }

      socket.write(encodeRedisCommand(["PING"]));
    });

    socket.on("data", (chunk) => {
      if (settled) {
        return;
      }

      const payload = chunk.toString("utf8");

      if (!authenticated) {
        if (payload.includes("+OK")) {
          authenticated = true;
          socket.write(encodeRedisCommand(["PING"]));
          return;
        }

        if (payload.startsWith("-")) {
          settled = true;
          cleanup();
          socket.destroy();
          reject(new Error(`Redis AUTH failed at ${diagnosticsUrl}: ${payload.trim()}`));
        }

        return;
      }

      if (payload.includes("+PONG")) {
        settled = true;
        cleanup();
        socket.end();
        resolve();
      }
    });

    socket.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      socket.destroy();
      reject(error);
    });

    socket.on("close", () => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      reject(new Error(`Redis connection closed before PONG at ${diagnosticsUrl}.`));
    });
  });

  console.info("[startup] Redis connected.");
}

async function bootstrap() {
  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  const swaggerDisabled = isEnvFlagEnabled("DISABLE_SWAGGER");
  const bullDisabled = isEnvFlagEnabled("DISABLE_BULL");

  try {
    console.info("[startup] bootstrap: begin");
    console.info(
      `[startup] bootstrap: diagnostics DISABLE_SWAGGER=${String(swaggerDisabled)} DISABLE_BULL=${String(bullDisabled)}`,
    );

    console.info("[startup] bootstrap: before Prisma preflight");
    await verifyPrismaConnection();
    console.info("[startup] bootstrap: after Prisma preflight");

    console.info("[startup] bootstrap: before Redis preflight");
    await verifyRedisConnection();
    console.info("[startup] bootstrap: after Redis preflight");

    console.info("[startup] bootstrap: before NestFactory.create(AppModule)");
    const app = await NestFactory.create(AppModule);
    console.info("[startup] bootstrap: after NestFactory.create(AppModule)");

    console.info("[startup] bootstrap: before app.setGlobalPrefix");
    app.setGlobalPrefix("api");
    console.info("[startup] bootstrap: after app.setGlobalPrefix");

    console.info("[startup] bootstrap: before app.enableVersioning");
    app.enableVersioning({ type: VersioningType.URI });
    console.info("[startup] bootstrap: after app.enableVersioning");

    console.info("[startup] bootstrap: before app.useGlobalPipes");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidUnknownValues: false,
      }),
    );
    console.info("[startup] bootstrap: after app.useGlobalPipes");

    if (swaggerDisabled) {
      console.warn("[startup] bootstrap: Swagger setup skipped because DISABLE_SWAGGER=true");
    } else {
      console.info("[startup] bootstrap: before Swagger document creation");
      const config = new DocumentBuilder()
        .setTitle("Feasibility OS API")
        .setDescription("German residential feasibility Sprint 1 API")
        .setVersion("1.0.0")
        .addBearerAuth()
        .build();

      const document = SwaggerModule.createDocument(app, config);
      console.info("[startup] bootstrap: after Swagger document creation");

      console.info("[startup] bootstrap: before SwaggerModule.setup");
      SwaggerModule.setup("api/docs", app, document);
      console.info("[startup] bootstrap: after SwaggerModule.setup");
    }

    console.info(`[startup] bootstrap: before app.listen(${port})`);
    await app.listen(port, "0.0.0.0");
    console.info(`[startup] bootstrap: after app.listen(${port})`);

    const baseUrl = getPublicApiBaseUrl(port);
    console.info(`[startup] API listening on ${baseUrl}`);
    console.info(
      swaggerDisabled
        ? "[startup] API docs disabled via DISABLE_SWAGGER=true"
        : `[startup] API docs available at ${baseUrl}/docs`,
    );
    console.info(`[startup] API health available at ${baseUrl}/health`);
  } catch (error) {
    logStartupError("[startup] API failed to start.", error);
    process.exit(1);
  }
}

registerProcessDiagnostics();
void bootstrap();
