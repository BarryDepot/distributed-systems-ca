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

// connect to the resource access server
const client = new resourceProto.ResourceAccessService(
  'localhost:50052',
  grpc.credentials.createInsecure(),
);

console.log('Sending a batch of help requests...\n');

// open the streaming call - server will reply once when we end
const call = client.UploadResourceRequests((err, response) => {
  if (err) {
    console.error('Error:', err.message);
    return;
  }
  console.log('\nServer summary:');
  console.log(response);
});

// few sample requests - mix of valid and invalid types
const requests = [
  {
    requestId: 'REQ_001',
    userId: 'USER_00452',
    resourceType: 'legal',
    description: 'Need help with a protection order',
  },
  {
    requestId: 'REQ_002',
    userId: 'USER_00452',
    resourceType: 'health',
    description: 'Looking for nearest womens clinic',
  },
  {
    requestId: 'REQ_003',
    userId: 'USER_00452',
    resourceType: 'education',
    description: 'Information on adult learning courses',
  },
  {
    requestId: 'REQ_004',
    userId: 'USER_00452',
    resourceType: 'finance',
    description: 'Asking about benefits - this should be skipped',
  },
  {
    requestId: 'REQ_005',
    userId: 'USER_00452',
    resourceType: 'health',
    description: 'Mental health support',
  },
];

requests.forEach((req) => {
  console.log('Sending', req.requestId, '-', req.resourceType);
  call.write(req);
});

// end
call.end();
