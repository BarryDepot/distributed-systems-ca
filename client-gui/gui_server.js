const express = require('express');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// helper to load a proto file with our usual options
function loadProto(filename) {
  const def = protoLoader.loadSync(
    path.join(__dirname, '..', 'protos', filename),
    {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    },
  );
  return grpc.loadPackageDefinition(def);
}

// helper - build a deadline N seconds from now
function deadlineIn(seconds) {
  const d = new Date();
  d.setSeconds(d.getSeconds() + seconds);
  return d;
}

// helper - map a gRPC error code to a sensible HTTP status
function grpcErrorToHttpStatus(err) {
  switch (err.code) {
    case grpc.status.INVALID_ARGUMENT:
      return 400;
    case grpc.status.NOT_FOUND:
      return 404;
    case grpc.status.DEADLINE_EXCEEDED:
      return 504;
    case grpc.status.UNAUTHENTICATED:
      return 401;
    case grpc.status.UNAVAILABLE:
      return 503;
    default:
      return 500;
  }
}

const namingPkg = loadProto('naming_service.proto');
const safetyPkg = loadProto('safety_monitor.proto');
const resourcePkg = loadProto('resource_access.proto');
const incidentPkg = loadProto('incident_reporting.proto');

// connect to the naming service
const namingClient = new namingPkg.namingservice.NamingService(
  'localhost:50050',
  grpc.credentials.createInsecure(),
);

function lookupService(serviceName) {
  return new Promise((resolve, reject) => {
    namingClient.Lookup(
      { serviceName },
      { deadline: deadlineIn(3) },
      (err, info) => {
        if (err) return reject(err);
        resolve(info.host + ':' + info.port);
      },
    );
  });
}

// these get filled in once the naming service tells us where each service lives
let safetyClient;
let resourceClient;
let incidentClient;

app.post('/api/safety/check', (req, res) => {
  const { locationId, userId } = req.body;
  safetyClient.CheckLocationSafety(
    { locationId, userId },
    { deadline: deadlineIn(5) },
    (err, response) => {
      if (err) {
        return res.status(grpcErrorToHttpStatus(err)).json({
          error: err.message,
          code: err.code,
        });
      }
      res.json(response);
    },
  );
});

// stream safety alerts via SSE
app.get('/api/safety/alerts', (req, res) => {
  const regionId = req.query.regionId || 'MAYO_NORTH';
  const severityThreshold = parseInt(req.query.severityThreshold) || 1;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const stream = safetyClient.StreamSafetyAlerts({
    regionId,
    severityThreshold,
  });

  stream.on('data', (alert) => {
    res.write('data: ' + JSON.stringify(alert) + '\n\n');
  });
  stream.on('error', (err) => {
    if (err.code !== grpc.status.CANCELLED)
      console.error('Stream error:', err.message);
    res.end();
  });
  stream.on('end', () => res.end());
  req.on('close', () => stream.cancel());
});

app.post('/api/resource/submit', (req, res) => {
  const requests = req.body.requests || [];
  const call = resourceClient.UploadResourceRequests(
    { deadline: deadlineIn(10) },
    (err, response) => {
      if (err) {
        return res.status(grpcErrorToHttpStatus(err)).json({
          error: err.message,
          code: err.code,
        });
      }
      res.json(response);
    },
  );
  requests.forEach((r) => call.write(r));
  call.end();
});

// HTTP server wrapper for WebSocket
const server = http.createServer(app);

// WebSocket for the bidi incident chat
const wss = new WebSocket.Server({ server, path: '/api/incident/chat' });

wss.on('connection', (ws) => {
  console.log('Chat client connected');

  const grpcCall = incidentClient.ReportIncident();

  grpcCall.on('data', (msg) => ws.send(JSON.stringify(msg)));
  grpcCall.on('end', () => ws.close());
  grpcCall.on('error', (err) => {
    if (err.code !== grpc.status.CANCELLED)
      console.error('Chat stream error:', err.message);
    ws.close();
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      grpcCall.write(msg);
    } catch (err) {
      console.error('Could not parse browser message:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('Chat client disconnected');
    grpcCall.end();
  });
});

// startup - lookup services and connect to them, then start listening
async function start() {
  try {
    console.log('Looking up services via the naming service...');

    const safetyAddr = await lookupService('SafetyMonitorService');
    const resourceAddr = await lookupService('ResourceAccessService');
    const incidentAddr = await lookupService('IncidentReportingService');

    console.log('  Safety Monitor:', safetyAddr);
    console.log('  Resource Access:', resourceAddr);
    console.log('  Incident Reporting:', incidentAddr);

    safetyClient = new safetyPkg.safetymonitor.SafetyMonitorService(
      safetyAddr,
      grpc.credentials.createInsecure(),
    );
    resourceClient = new resourcePkg.resourceaccess.ResourceAccessService(
      resourceAddr,
      grpc.credentials.createInsecure(),
    );
    incidentClient = new incidentPkg.incidentreporting.IncidentReportingService(
      incidentAddr,
      grpc.credentials.createInsecure(),
    );

    server.listen(PORT, () => {
      console.log('GUI server running on http://localhost:' + PORT);
    });
  } catch (err) {
    console.error(
      'Could not start GUI - is the naming service and all 3 services running?',
    );
    console.error(err.message);
    process.exit(1);
  }
}

start();
