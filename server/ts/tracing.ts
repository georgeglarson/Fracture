/**
 * OpenTelemetry Tracing Bootstrap
 *
 * MUST be imported first in main.ts before all other imports.
 * Initializes the OTel SDK with tracing and HTTP auto-instrumentation.
 *
 * - Dev: ConsoleSpanExporter (traces to terminal)
 * - Prod: OTLP HTTP exporter, only when OTEL_EXPORTER_OTLP_ENDPOINT is
 *   explicitly set (no collector runs by default); otherwise no trace export
 * - HTTP auto-instrumentation covers Socket.IO transport
 * - Timer instrumentation is NOT enabled (game loop is 50/sec)
 *
 * dotenv is loaded here (before the endpoint read) because main.ts imports
 * this module first — an endpoint set in .env would otherwise read as unset.
 */

import 'dotenv/config';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import {
  ConsoleSpanExporter,
  TraceIdRatioBasedSampler,
  AlwaysOnSampler,
} from '@opentelemetry/sdk-trace-node';

const isDev = process.env.NODE_ENV !== 'production';

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: 'fracture-server',
  [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
});

// Dev: console exporter for local visibility
// Prod: OTLP HTTP exporter, opt-in via OTEL_EXPORTER_OTLP_ENDPOINT.
// When the endpoint is unset there is no collector to talk to, so the SDK is
// not started at all — passing `traceExporter: undefined` would NOT disable
// export: sdk-node falls back to getSpanProcessorsFromEnv(), which defaults an
// empty OTEL_TRACES_EXPORTER to `otlp` → batched exports to localhost:4318.
// Note: OTLPTraceExporter's `url` option requires the full signal-specific path.
// OTEL_EXPORTER_OTLP_ENDPOINT is the base URL (e.g. http://localhost:4318),
// so we must append /v1/traces — same pattern as pino-opentelemetry-transport in logger.ts.
const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
const tracingEnabled = isDev || !!endpoint;

const traceExporter = isDev
  ? new ConsoleSpanExporter()
  : endpoint
    ? new OTLPTraceExporter({
        url: `${endpoint}/v1/traces`,
      })
    : undefined;

// OTEL_TRACES_SAMPLER_ARG controls prod sampling ratio (0.0–1.0, default 1.0)
// Set to 0.1 for high-traffic production, leave default for demos
const samplerRatio = parseFloat(process.env.OTEL_TRACES_SAMPLER_ARG || '1.0');
const sampler = isDev
  ? new AlwaysOnSampler()
  : new TraceIdRatioBasedSampler(samplerRatio);

const sdk = tracingEnabled
  ? new NodeSDK({
      resource,
      traceExporter,
      sampler,
      instrumentations: [
        new HttpInstrumentation(),
        // Do NOT add TimerInstrumentation — game loop is 50/sec and would flood traces
      ],
    })
  : null;

// With no SDK started, the global OTel API stays a no-op: instrumentation
// points elsewhere in the server cost nothing and export nothing.
sdk?.start();

// Graceful shutdown on process exit
const shutdown = () => {
  sdk?.shutdown().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('OTel SDK shutdown error:', err);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

