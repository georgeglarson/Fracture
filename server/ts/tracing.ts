/**
 * OpenTelemetry Tracing Bootstrap
 *
 * MUST be imported first in main.ts before all other imports.
 * Initializes the OTel SDK with tracing and HTTP auto-instrumentation.
 *
 * - Dev: ConsoleSpanExporter (traces to terminal)
 * - Prod: OTLP HTTP exporter to SigNoz collector
 * - HTTP auto-instrumentation covers Socket.IO transport
 * - Timer instrumentation is NOT enabled (game loop is 50/sec)
 */

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
// Prod: OTLP HTTP to SigNoz collector
const traceExporter = isDev
  ? new ConsoleSpanExporter()
  : new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    });

// AlwaysOn in dev for full visibility, 10% sampling in prod to control volume
const sampler = isDev
  ? new AlwaysOnSampler()
  : new TraceIdRatioBasedSampler(0.1);

const sdk = new NodeSDK({
  resource,
  traceExporter,
  sampler,
  instrumentations: [
    new HttpInstrumentation(),
    // Do NOT add TimerInstrumentation — game loop is 50/sec and would flood traces
  ],
});

sdk.start();

// Graceful shutdown on process exit
const shutdown = () => {
  sdk.shutdown().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('OTel SDK shutdown error:', err);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { sdk };
