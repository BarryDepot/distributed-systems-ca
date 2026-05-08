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

// CheckLocationSafety
// this looks up the safety level for a zone and returns the current status
function checkLocationSafety(call, callback) {
  const { locationId, userId } = call.request;
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

// StreamSafetyAlerts - stub for now
function streamSafetyAlerts(call) {
  console.log('StreamSafetyAlerts called with:', call.request);
  call.end();
}

// sets up the server
const server = new grpc.Server();

server.addService(safetyProto.SafetyMonitorService.service, {
  CheckLocationSafety: checkLocationSafety,
  StreamSafetyAlerts: streamSafetyAlerts,
});

// start server
server.bindAsync(
  '0.0.0.0:50051',
  grpc.ServerCredentials.createInsecure(),
  () => {
    console.log('Safety Monitor service running on port 50051');
  },
);
