const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// load the proto
const PROTO_PATH = path.join(
  __dirname,
  '..',
  '..',
  'protos',
  'incident_reporting.proto',
);

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});

const incidentProto =
  grpc.loadPackageDefinition(packageDefinition).incidentreporting;

// ReportIncident - stub for now
// bidirectional streaming - both sides send and receive messages
function reportIncident(call) {
  console.log('ReportIncident called - new chat session');

  call.on('data', (msg) => {
    console.log('Received:', msg);
  });

  call.on('end', () => {
    console.log('Client closed the stream');
    call.end();
  });
}

// sets up the server
const server = new grpc.Server();

server.addService(incidentProto.IncidentReportingService.service, {
  ReportIncident: reportIncident,
});

// starts the servcer
server.bindAsync(
  '0.0.0.0:50053',
  grpc.ServerCredentials.createInsecure(),
  () => {
    console.log('Incident Reporting service running on port 50053');
  },
);
