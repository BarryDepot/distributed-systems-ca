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

// allowed resource categories
const validCategories = ['legal', 'health', 'education'];

// UploadResourceRequests
// user sends multiple help requests & server replies once at the end
function uploadResourceRequests(call, callback) {
  let total = 0;
  let processed = 0;
  const byCategory = { legal: 0, health: 0, education: 0 };

  call.on('data', (req) => {
    total++;
    console.log('Got request:', req.requestId, '-', req.resourceType);

    const type = (req.resourceType || '').toLowerCase();
    if (validCategories.includes(type)) {
      byCategory[type]++;
      processed++;
    } else {
      console.log('  skipped (unknown type)');
    }
  });

  call.on('end', () => {
    const summary =
      'Processed ' +
      processed +
      ' of ' +
      total +
      ' requests (legal: ' +
      byCategory.legal +
      ', health: ' +
      byCategory.health +
      ', education: ' +
      byCategory.education +
      ')';

    console.log('Batch finished:', summary);

    callback(null, {
      totalRequests: total,
      processedCount: processed,
      statusMessage: summary,
    });
  });

  call.on('error', (err) => {
    console.error('Stream error:', err.message);
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
