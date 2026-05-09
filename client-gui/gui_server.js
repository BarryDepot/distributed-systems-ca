const express = require('express');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// load safety monitor proto and connect to the service
const SAFETY_PROTO_PATH = path.join(
  __dirname,
  '..',
  'protos',
  'safety_monitor.proto',
);
const safetyDef = protoLoader.loadSync(SAFETY_PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const safetyProto = grpc.loadPackageDefinition(safetyDef).safetymonitor;

const safetyClient = new safetyProto.SafetyMonitorService(
  'localhost:50051',
  grpc.credentials.createInsecure(),
);

// check location safety (unary)
app.post('/api/safety/check', (req, res) => {
  const { locationId, userId } = req.body;

  safetyClient.CheckLocationSafety({ locationId, userId }, (err, response) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(response);
  });
});

// stream safety alerts via Server-Sent Events
app.get('/api/safety/alerts', (req, res) => {
  const regionId = req.query.regionId || 'MAYO_NORTH';
  const severityThreshold = parseInt(req.query.severityThreshold) || 1;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // open the gRPC stream
  const stream = safetyClient.StreamSafetyAlerts({
    regionId,
    severityThreshold,
  });

  stream.on('data', (alert) => {
    // forward each alert to the browser
    res.write('data: ' + JSON.stringify(alert) + '\n\n');
  });

  stream.on('error', (err) => {
    if (err.code !== grpc.status.CANCELLED) {
      console.error('Stream error:', err.message);
    }
    res.end();
  });

  stream.on('end', () => {
    res.end();
  });

  // if the browser disconnects, cancel the gRPC stream
  req.on('close', () => {
    stream.cancel();
  });
});

app.listen(PORT, () => {
  console.log('GUI server running on http://localhost:' + PORT);
});
