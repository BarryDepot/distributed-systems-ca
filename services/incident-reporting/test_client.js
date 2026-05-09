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

// connect to the server
const client = new incidentProto.IncidentReportingService(
  'localhost:50053',
  grpc.credentials.createInsecure(),
);

console.log('Opening chat with the support officer...\n');

// open the bidi stream
const call = client.ReportIncident();

// listen for officer messages
call.on('data', (msg) => {
  console.log('Officer:', msg.content);
});

call.on('end', () => {
  console.log('\nChat session closed by server');
});

call.on('error', (err) => {
  console.error('Stream error:', err.message);
});

// helper to send a message after a delay
function sendAfter(ms, msg) {
  setTimeout(() => {
    console.log('User:', msg.content);
    call.write(msg);
  }, ms);
}

// the conversation - send each message a couple seconds apart
sendAfter(500, {
  senderId: 'USER_00452',
  content: 'I was followed walking home.',
  timestamp: new Date().toISOString(),
  messageType: 'report',
});

sendAfter(2500, {
  senderId: 'USER_00452',
  content: 'Yes I am safe now, just shaken.',
  timestamp: new Date().toISOString(),
  messageType: 'update',
});

sendAfter(4500, {
  senderId: 'USER_00452',
  content: 'Thanks, I am at home now. Closing this.',
  timestamp: new Date().toISOString(),
  messageType: 'closure',
});

// close the stream after the last message has had time to send
setTimeout(() => {
  call.end();
}, 5500);
