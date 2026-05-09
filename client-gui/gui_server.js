const express = require('express');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const app = express();
const PORT = 3000;

// serve static files (HTML, CSS, JS) from the public folder
app.use(express.static(path.join(__dirname, 'public')));

// for parsing JSON bodies sent from the frontend
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

// API route: check location safety
app.post('/api/safety/check', (req, res) => {
  const { locationId, userId } = req.body;

  safetyClient.CheckLocationSafety({ locationId, userId }, (err, response) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(response);
  });
});

// start the server
app.listen(PORT, () => {
  console.log('GUI server running on http://localhost:' + PORT);
});
