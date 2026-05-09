const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// load the proto
const PROTO_PATH = path.join(
  __dirname,
  '..',
  '..',
  'protos',
  'safety_monitor.proto',
);

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const safetyProto = grpc.loadPackageDefinition(packageDefinition).safetymonitor;

// fake safety data for some zones
// in real circumstances then this would come from a database or sensor feed
const zoneData = {
  MAYO_CASTLEBAR_ZONE3: { level: 2, note: 'Quiet area, well-lit streets' },
  MAYO_NORTH: { level: 3, note: 'Some recent reports of suspicious activity' },
  DUBLIN_CITY_CENTRE: { level: 4, note: 'High incident rate tonight' },
  GALWAY_WESTSIDE: { level: 1, note: 'No issues reported' },
};

// sample text of alert
const alertTemplates = [
  'Suspicious activity reported',
  'Increased foot traffic',
  'Streetlight outage',
  'Loud noise complaint',
  'Group gathering reported',
  'Vehicle parked unusually',
];

// CheckLocationSafety
// looks up the safety level for a zone and returns the current status
function checkLocationSafety(call, callback) {
  const { locationId, userId } = call.request;

  // validate required fields
  if (!locationId || !userId) {
    return callback({
      code: grpc.status.INVALID_ARGUMENT,
      message: 'locationId and userId are both required',
    });
  }

  console.log('Safety check for', userId, 'in', locationId);

  const data = zoneData[locationId];

  // if we don't know the zone, return an unknown reading
  if (!data) {
    return callback(null, {
      safetyLevel: 3,
      alertMessage: 'No data for this zone yet',
      isSafe: false,
    });
  }

  callback(null, {
    safetyLevel: data.level,
    alertMessage: data.note,
    isSafe: data.level <= 2,
  });
}

// StreamSafetyAlerts
// keeps pushing alerts to the client at intervals
// only sends ones at or above the severity threshold
function streamSafetyAlerts(call) {
  const { regionId, severityThreshold } = call.request;
  console.log(
    'Streaming alerts for',
    regionId,
    '(min severity',
    severityThreshold + ')',
  );

  let counter = 1;

  // push a new alert every 2 seconds
  const interval = setInterval(() => {
    const severity = Math.floor(Math.random() * 5) + 1;

    // skip alerts below the threshold
    if (severity < severityThreshold) {
      return;
    }

    const alert = {
      alertId: 'ALT_' + (1000 + counter),
      timestamp: new Date().toISOString(),
      description:
        alertTemplates[Math.floor(Math.random() * alertTemplates.length)] +
        ' near ' +
        regionId,
      severity: severity,
    };

    call.write(alert);
    counter++;
  }, 2000);

  // stop the stream when the client disconnects or cancels
  call.on('cancelled', () => {
    console.log('Stream cancelled by client');
    clearInterval(interval);
  });
}

// registering this service with the naming service so clients can discover
function registerWithNamingService() {
  const namingPath = path.join(
    __dirname,
    '..',
    '..',
    'protos',
    'naming_service.proto',
  );
  const namingDef = protoLoader.loadSync(namingPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const namingProto = grpc.loadPackageDefinition(namingDef).namingservice;

  const namingClient = new namingProto.NamingService(
    'localhost:50050',
    grpc.credentials.createInsecure(),
  );

  const myInfo = {
    serviceName: 'SafetyMonitorService',
    host: 'localhost',
    port: 50051,
    registeredAt: new Date().toISOString(),
  };

  namingClient.Register(myInfo, (err, reply) => {
    if (err) {
      console.error('Could not register with naming service:', err.message);
      return;
    }
    console.log('Registered with naming service:', reply.message);
  });
}

// sets up the server
const server = new grpc.Server();

server.addService(safetyProto.SafetyMonitorService.service, {
  CheckLocationSafety: checkLocationSafety,
  StreamSafetyAlerts: streamSafetyAlerts,
});

// starts server
server.bindAsync(
  '0.0.0.0:50051',
  grpc.ServerCredentials.createInsecure(),
  () => {
    console.log('Safety Monitor service running on port 50051');
    registerWithNamingService();
  },
);
