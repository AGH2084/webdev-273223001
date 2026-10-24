const readline = require('node:readline');
const { readFileSync } = require('node:fs');

const lectures = JSON.parse(readFileSync(`${__dirname}/lectures.json`, 'utf8'));

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

  if (message.method === 'tools/call' && message.params.name === 'find_lecture') {
    const lecture = lectures.find((item) => item.number === message.params.arguments.number);
    if (!lecture) {
      process.stdout.write(`${JSON.stringify({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [{
            type: 'text',
            text: `No lecture found with number ${message.params.arguments.number}. Choose a lecture number from 1 to 10.`,
          }],
          isError: true,
        },
      })}\n`);
      return;
    }

    process.stdout.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        content: [{
          type: 'text',
          text: `Lecture ${lecture.number}: ${lecture.title}. Topics: ${lecture.topics}`,
        }],
        isError: false,
      },
    })}\n`);
  }

  if (message.method === 'tools/call' && message.params.name === 'list_lectures') {
    const text = lectures
      .map((lecture) => `Lecture ${lecture.number}: ${lecture.title}. Topics: ${lecture.topics}`)
      .join('\n');
    process.stdout.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: message.id,
      result: {
        content: [{ type: 'text', text }],
        isError: false,
      },
    })}\n`);
    return;
  }

  if (message.method === 'tools/call') {
    process.stdout.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: message.id,
      error: {
        code: -32602,
        message: `Unknown tool: ${message.params.name}`,
      },
    })}\n`);
    return;
  }

  if (message.id !== undefined) {
    process.stdout.write(`${JSON.stringify({
      jsonrpc: '2.0',
      id: message.id,
      error: {
        code: -32601,
        message: `Unknown method: ${message.method}`,
      },
    })}\n`);
  }
});
