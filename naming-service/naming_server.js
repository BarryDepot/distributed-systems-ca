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

// keep track of services that have registered
// using a Map - key is the service name
const registry = new Map();

// Register
// services call this when they start up so we know where they are
function register(call, callback) {
  const info = call.request;

  // add the time if it wasn't sent
  if (!info.registeredAt) {
    info.registeredAt = new Date().toISOString();
  }

  registry.set(info.serviceName, info);

  console.log(
    'Registered:',
    info.serviceName,
    'at',
    info.host + ':' + info.port,
  );

  callback(null, {
    ok: true,
    message: 'Service registered: ' + info.serviceName,
  });
}

// Lookup
function lookup(call, callback) {
  console.log('Lookup called with:', call.request);
  callback(null, { serviceName: '', host: '', port: 0, registeredAt: '' });
}

// set up the server
const server = new grpc.Server();

server.addService(namingProto.NamingService.service, {
  Register: register,
  Lookup: lookup,
});

// starts server
server.bindAsync(
  '0.0.0.0:50050',
  grpc.ServerCredentials.createInsecure(),
  () => {
    console.log('Naming service running on port 50050');
  },
);
