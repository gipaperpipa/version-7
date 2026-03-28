const inputUrl = process.argv[2] ?? process.env.HEALTHCHECK_URL ?? "http://localhost:4000/api/health";

try {
  const response = await fetch(inputUrl, { method: "GET" });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  const payload = await response.text();
  console.log(`[healthcheck] OK ${inputUrl}`);
  console.log(payload);
} catch (error) {
  console.error(`[healthcheck] FAILED ${inputUrl}`);
  console.error(error);
  process.exit(1);
}
