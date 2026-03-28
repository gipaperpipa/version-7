import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    console.info("[startup] PrismaService connecting...");
    await this.$connect();
    console.info("[startup] PrismaService connected.");
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
