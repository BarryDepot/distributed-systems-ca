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

// CheckLocationSafety - stub for now
function checkLocationSafety(call, callback) {
  console.log('CheckLocationSafety called with:', call.request);
  callback(null, {
    safetyLevel: 0,
    alertMessage: 'not implemented yet',
    isSafe: false,
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
