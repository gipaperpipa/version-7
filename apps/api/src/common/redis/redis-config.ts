export interface RedisConnectionConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
}

function isTruthy(value: string | undefined) {
  return ["1", "true", "yes", "on"].includes((value ?? "").toLowerCase());
}

export function getRedisConnectionConfig(): RedisConnectionConfig {
  if (process.env.REDIS_URL) {
    const url = new URL(process.env.REDIS_URL);
    const isTls = url.protocol === "rediss:";

    return {
      host: url.hostname,
      port: Number(url.port || (isTls ? 6380 : 6379)),
      ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
      ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
      ...(isTls ? { tls: {} } : {}),
    };
  }

  const isTls = isTruthy(process.env.REDIS_TLS);

  return {
    host: process.env.REDIS_HOST ?? "127.0.0.1",
    port: Number(process.env.REDIS_PORT ?? (isTls ? 6380 : 6379)),
    ...(process.env.REDIS_USERNAME ? { username: process.env.REDIS_USERNAME } : {}),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
    ...(isTls ? { tls: {} } : {}),
  };
}

export function getRedisDiagnosticsUrl(config = getRedisConnectionConfig()) {
  const protocol = config.tls ? "rediss" : "redis";
  return `${protocol}://${config.host}:${config.port}`;
}
