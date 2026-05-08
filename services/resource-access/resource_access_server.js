const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// load the proto
const PROTO_PATH = path.join(
  __dirname,
  '..',
  '..',
  'protos',
  'resource_access.proto',
);

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const resourceProto =
  grpc.loadPackageDefinition(packageDefinition).resourceaccess;

// UploadResourceRequests - stub for now
function uploadResourceRequests(call, callback) {
  console.log('UploadResourceRequests called');

  call.on('data', (req) => {
    console.log('Got request:', req);
  });

  call.on('end', () => {
    callback(null, {
      totalRequests: 0,
      processedCount: 0,
      statusMessage: 'not implemented yet',
    });
  });
}

// set up the server
const server = new grpc.Server();

server.addService(resourceProto.ResourceAccessService.service, {
  UploadResourceRequests: uploadResourceRequests,
});

// start it
server.bindAsync(
  '0.0.0.0:50052',
  grpc.ServerCredentials.createInsecure(),
  () => {
    console.log('Resource Access service running on port 50052');
  },
);
