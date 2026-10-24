const readline = require('node:readline');

const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

input.on('line', (line) => {
  console.error(`got: ${line}`);

  const message = JSON.parse(line);

  if (message.method === 'initialize') {
    process.stdout.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: message.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: 'lectures', version: '0.1.0' },
      },
    })}\n`);
  }

  if (message.method === 'tools/list') {
    process.stdout.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        tools: [
          {
            name: 'find_lecture',
            description: 'Find one course lecture by its number and return its title and topics. Use this when you need details about a specific lecture.',
            inputSchema: {
              type: 'object',
              properties: {
                number: { type: 'integer', description: 'Lecture number from 1 to 10.' },
              },
              required: ['number'],
            },
          },
          {
            name: 'list_lectures',
            description: 'List all course lectures with their titles and topics. Use this to browse the course or find which lecture covers a subject.',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      },
    })}\n`);
  }
});
