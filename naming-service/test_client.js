const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// load the proto
const PROTO_PATH = path.join(__dirname, '..', 'protos', 'naming_service.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const namingProto = grpc.loadPackageDefinition(packageDefinition).namingservice;

// connect to the naming service
const client = new namingProto.NamingService(
  'localhost:50050',
  grpc.credentials.createInsecure(),
);

// fake service info just to test it works
const fakeService = {
  serviceName: 'SafetyMonitorService',
  host: 'localhost',
  port: 50051,
};

console.log('Trying to register a fake service...');
client.Register(fakeService, (err, reply) => {
  if (err) {
    console.error('Register error:', err.message);
    return;
  }
  console.log('Register reply:', reply);

  // now looks it up
  console.log('\nLooking up SafetyMonitorService...');
  client.Lookup({ serviceName: 'SafetyMonitorService' }, (err, info) => {
    if (err) {
      console.error('Lookup error:', err.message);
      return;
    }
    console.log('Found:', info);

    // try one that doesn't exist
    console.log('\nLooking up something that does not exist...');
    client.Lookup({ serviceName: 'NotARealService' }, (err, info) => {
      if (err) {
        console.log('Got expected error:', err.code, '-', err.message);
        return;
      }
      console.log('Found:', info);
    });
  });
});
