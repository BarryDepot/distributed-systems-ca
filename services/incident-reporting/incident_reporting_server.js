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

// must match the token the gui sends
const AUTH_TOKEN = 'she-demo-token-2026';

function checkAuth(call) {
  const token = call.metadata.get('auth-token')[0];
  const userId = call.metadata.get('user-id')[0];
  console.log('Auth check - user:', userId, 'token ok:', token === AUTH_TOKEN);
  return token === AUTH_TOKEN;
}

// canned officer responses depending on what the user sent
function officerReply(userMessage) {
  const type = (userMessage.messageType || '').toLowerCase();

  if (type === 'report') {
    return {
      senderId: 'OFFICER_07',
      content: 'Got your report. Are you safe right now?',
      timestamp: new Date().toISOString(),
      messageType: 'response',
    };
  }

  if (type === 'update') {
    return {
      senderId: 'OFFICER_07',
      content:
        'Thanks for the update. I can send you a list of nearby support services.',
      timestamp: new Date().toISOString(),
      messageType: 'update',
    };
  }

  if (type === 'closure') {
    return {
      senderId: 'OFFICER_07',
      content: 'Stay safe. Closing this session now.',
      timestamp: new Date().toISOString(),
      messageType: 'closure',
    };
  }

  // default ack
  return {
    senderId: 'OFFICER_07',
    content: 'Acknowledged. Please continue.',
    timestamp: new Date().toISOString(),
    messageType: 'response',
  };
}

// ReportIncident
// each time the user sends a message, the officer replies
// the chat stays open until the user closes their side
function reportIncident(call) {
  if (!checkAuth(call)) {
    call.destroy({
      code: grpc.status.UNAUTHENTICATED,
      details: 'Invalid or missing auth token',
    });
    return;
  }

  console.log('ReportIncident - new chat session opened');

  call.on('data', (userMsg) => {
    if (!userMsg.senderId || !userMsg.content) {
      console.log('  invalid message - missing fields');
      call.write({
        senderId: 'OFFICER_07',
        content: 'Error: senderId and content are required',
        timestamp: new Date().toISOString(),
        messageType: 'error',
      });
      return;
    }

    console.log('User:', userMsg.content);
    const reply = officerReply(userMsg);
    console.log('Officer:', reply.content);
    call.write(reply);
  });

  call.on('end', () => {
    console.log('User closed the stream');
    call.end();
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
    serviceName: 'IncidentReportingService',
    host: 'localhost',
    port: 50053,
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
    registerWithNamingService();
  },
);
