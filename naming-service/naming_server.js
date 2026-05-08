const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Path to proto file
const PROTO_PATH = path.join(__dirname, '..', 'protos', 'naming_service.proto');

// Load proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const namingProto = grpc.loadPackageDefinition(packageDefinition).namingservice;

//rregister handler - stub for now
function register(call, callback) {
  console.log('Register called with:', call.request);
  callback(null, { ok: false, message: 'not implemented yet' });
}

// lookup handler - stub for now
function lookup(call, callback) {
  console.log('Lookup called with:', call.request);
  callback(null, { serviceName: '', host: '', port: 0, registeredAt: '' });
}

// creates the server
const server = new grpc.Server();

server.addService(namingProto.NamingService.service, {
  Register: register,
  Lookup: lookup,
});

// starts the server
server.bindAsync(
  '0.0.0.0:50050',
  grpc.ServerCredentials.createInsecure(),
  () => {
    console.log('Naming service running on port 50050');
  },
);
