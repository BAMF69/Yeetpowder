// Run against npm run duel:server. Real WebSocket clients verify live matchmaking and seat replacement.
import assert from 'node:assert/strict';
import WebSocket from 'ws';

const clients = [];
async function waitFor(client, predicate) {
  const deadline = Date.now() + 10000;
  while (!predicate(client)) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for room state: ' + JSON.stringify(client.messages.slice(-1)));
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
async function connect(request) {
  const socket = new WebSocket('ws://127.0.0.1:7357');
  const client = { socket, messages: [], joined: null, snapshot: null };
  clients.push(client);
  socket.on('message', (raw) => {
    const message = JSON.parse(String(raw)); client.messages.push(message);
    if (message.t === 'joined') client.joined = message;
    if (message.t === 'snap') client.snapshot = message;
    if (client.messages.length > 50) client.messages.shift();
  });
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  socket.send(JSON.stringify(request));
  await waitFor(client, (c) => c.joined || c.messages.some((m) => m.t === 'error'));
  return client;
}
try {
  const first = await connect({ t: 'quick', profile: { name: "Ninja QA", operator: "ninja" } });
  first.socket.send('null'); first.socket.send('{invalid');
  first.socket.send(JSON.stringify({ t: 'ping', at: 123 }));
  await waitFor(first, (c) => c.messages.some((m) => m.t === 'pong' && m.at === 123));
  assert.equal(first.joined.options.capacity, 8);
  await waitFor(first, (c) => c.snapshot?.bots.filter(Boolean).length === 7);
  for (let i = 1; i < 8; i++) {
    const next = await connect({ t: 'quick', profile: { name: `Operator ${i}`, operator: 'alien-t-pose' } }); assert.equal(next.joined.code, first.joined.code);
  }
  await waitFor(first, (c) => c.snapshot?.present.every(Boolean));
  assert.equal(first.snapshot.state.players.length, 8);
  assert.equal(first.snapshot.bots.filter(Boolean).length, 0);
  const watcher = await connect({ t: 'join', code: first.joined.code, spectate: true });
  assert.equal(watcher.joined.slot, -1);
  await waitFor(watcher, (c) => c.snapshot?.present.every(Boolean));
  assert.equal(watcher.snapshot.present.filter(Boolean).length, 8);
  assert.equal(first.snapshot.profiles[0].operator, "ninja");
  assert.equal(first.snapshot.profiles[1].operator, "alien-t-pose");
  assert.equal(watcher.snapshot.profiles[0].operator, "ninja");
  assert.equal(watcher.snapshot.profiles[1].operator, "alien-t-pose");
  watcher.socket.send(JSON.stringify({ t: 'in', inputs: [{ seq: 1, moveX: 1, moveZ: 0, dYaw: 0, dPitch: 0, select: -1 }] }));
  watcher.socket.send(JSON.stringify({ t: 'rematch' }));
  watcher.socket.send(JSON.stringify({ t: 'ping', at: 456 }));
  await waitFor(watcher, (c) => c.messages.some((m) => m.t === 'pong' && m.at === 456));
  watcher.socket.close();
  await waitFor(first, (c) => c.snapshot?.present.every(Boolean));
  const overflow = await connect({ t: 'quick' }); assert.notEqual(overflow.joined.code, first.joined.code);
  const departed = clients[7]; departed.socket.close();
  await waitFor(first, (c) => c.snapshot?.bots.filter(Boolean).length === 1);
  assert.equal(first.snapshot.active.filter(Boolean).length, 8);
  const replacement = await connect({ t: 'join', code: first.joined.code });
  assert.equal(replacement.joined.slot, departed.joined.slot);
  const privateRoom = await connect({ t: 'create', options: { level: 'island-party', mode: 'ringout', visibility: 'private', capacity: 8, botFill: true } });
  assert.equal(privateRoom.joined.options.mode, 'ringout');
  const publicJoin = await connect({ t: 'quick' }); assert.notEqual(publicJoin.joined.code, privateRoom.joined.code);
  console.log('PARTY_NETWORK_OK: eight humans, read-only spectator in a full room, overflow, disconnect bot fill, replacement seat, private isolation, Ring Out metadata');
} finally {
  for (const client of clients) client.socket.close();
}
