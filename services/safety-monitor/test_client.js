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

// connect to the safety monitor
const client = new safetyProto.SafetyMonitorService(
  'localhost:50051',
  grpc.credentials.createInsecure(),
);

// 1. test the unary call
console.log('Checking safety of MAYO_CASTLEBAR_ZONE3...');
client.CheckLocationSafety(
  { locationId: 'MAYO_CASTLEBAR_ZONE3', userId: 'USER_00452' },
  (err, response) => {
    if (err) {
      console.error('Error:', err.message);
      return;
    }
    console.log('Response:', response);

    // 2. test the streaming call
    console.log('\nListening for safety alerts in MAYO_NORTH (severity 3+)...');
    const stream = client.StreamSafetyAlerts({
      regionId: 'MAYO_NORTH',
      severityThreshold: 3,
    });

    let received = 0;
    stream.on('data', (alert) => {
      received++;
      console.log('Alert', received + ':', alert);

      // stop after 3 alerts so the test doesn't run forever
      if (received >= 3) {
        console.log('\nGot enough alerts, cancelling stream');
        stream.cancel();
      }
    });

    stream.on('error', (err) => {
      // cancel comes back as an error code which uis expected
      if (err.code === grpc.status.CANCELLED) {
        console.log('Stream closed cleanly');
      } else {
        console.error('Stream error:', err.message);
      }
    });
  },
);
