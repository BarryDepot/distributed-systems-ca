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
// this is called to find where a service is running
function lookup(call, callback) {
  const name = call.request.serviceName;
  const info = registry.get(name);

  if (!info) {
    return callback({
      code: grpc.status.NOT_FOUND,
      message: 'Service not registered: ' + name,
    });
  }

  console.log('Lookup found:', name);
  callback(null, info);
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
