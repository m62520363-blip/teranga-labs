export type PaymentsConfig = {
  waveApiKey: string;
  waveBaseUrl: string;
  waveWebhookSecret: string;
  waveWebhookTolerance: number;
};

export function getPaymentsConfig(): PaymentsConfig {
  return {
    waveApiKey: process.env.WAVE_API_KEY ?? "",
    waveBaseUrl: process.env.WAVE_BASE_URL ?? "https://api.wave.com",
    waveWebhookSecret: process.env.WAVE_WEBHOOK_SECRET ?? "",
    waveWebhookTolerance: Number(process.env.WAVE_WEBHOOK_TOLERANCE ?? 300),
  };
}

export function isWaveConfigured(): boolean {
  return Boolean(
    process.env.WAVE_API_KEY && process.env.WAVE_WEBHOOK_SECRET
  );
}