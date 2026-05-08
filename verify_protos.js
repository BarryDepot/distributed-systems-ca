// making sure all 3 proto files load without errors

const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const protos = [
  'safety_monitor.proto',
  'resource_access.proto',
  'incident_reporting.proto',
  'naming_service.proto',
];

console.log('Verifying proto files');

protos.forEach((file) => {
  const def = protoLoader.loadSync(path.join(__dirname, 'protos', file), {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  grpc.loadPackageDefinition(def);
  console.log(`  ${file} - OK`);
});

console.log('All protos loaded successfully');
