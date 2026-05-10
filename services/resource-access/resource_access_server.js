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

// must match the token the gui sends
const AUTH_TOKEN = 'she-demo-token-2026';

function checkAuth(call) {
  const token = call.metadata.get('auth-token')[0];
  const userId = call.metadata.get('user-id')[0];
  console.log('Auth check - user:', userId, 'token ok:', token === AUTH_TOKEN);
  return token === AUTH_TOKEN;
}

// allowed resource categories
const validCategories = ['legal', 'health', 'education'];

// UploadResourceRequests
// user sends multiple help requests - server replies once at the end
function uploadResourceRequests(call, callback) {
  if (!checkAuth(call)) {
    return callback({
      code: grpc.status.UNAUTHENTICATED,
      message: 'Invalid or missing auth token',
    });
  }
  let total = 0;
  let processed = 0;
  let invalid = 0;
  const byCategory = { legal: 0, health: 0, education: 0 };

  call.on('data', (req) => {
    total++;
    console.log('Got request:', req.requestId, '-', req.resourceType);

    // validate required fields - skip but count
    if (!req.requestId || !req.userId || !req.resourceType) {
      console.log('  invalid - missing fields');
      invalid++;
      return;
    }

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
      (invalid > 0 ? ', invalid: ' + invalid : '') +
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

// register this service with the naming service so clients can discover us
function registerWithNamingService() {
  const namingPath = path.join(
    __dirname,
    '..',
    '..',
    'protos',
    'naming_service.proto',
  );
  const namingDef = protoLoader.loadSync(namingPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const namingProto = grpc.loadPackageDefinition(namingDef).namingservice;

  const namingClient = new namingProto.NamingService(
    'localhost:50050',
    grpc.credentials.createInsecure(),
  );

  const myInfo = {
    serviceName: 'ResourceAccessService',
    host: 'localhost',
    port: 50052,
    registeredAt: new Date().toISOString(),
  };

  namingClient.Register(myInfo, (err, reply) => {
    if (err) {
      console.error('Could not register with naming service:', err.message);
      return;
    }
    console.log('Registered with naming service:', reply.message);
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
    registerWithNamingService();
  },
);
