/**
 * online.js — Snakombo Online Multiplayer (PeerJS)
 *
 * Architecture: Host-Client
 *   Host: creates room, runs game loop, broadcasts state to client
 *   Client: joins with room code, sends only input, renders received state
 *
 * All public API is on window / global scope (vanilla JS, no modules).
 */

// ---------------------------------------------------------------------------
// Public state
// ---------------------------------------------------------------------------
var onlineRole = null;       // 'host' | 'client' | null
var onlineConnected = false;
var onlineRoomCode = '';

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------
var _onlinePeer = null;          // PeerJS Peer instance
var _onlineConn = null;          // PeerJS DataConnection (single peer-to-peer link)
var _onlineCallbacks = {};       // role-specific callbacks
var _onlineHeartbeatTimer = null;
var _onlineHeartbeatTimeout = null;
var _onlineLastPong = 0;
var _onlineSendFrameCounter = 0; // throttle state sends to 30fps
var _onlineLatestState = null;   // client: last received state from host
var _onlineDestroyed = false;    // guard against double-cleanup
var _onlineConnecting = false;   // guard against double connection attempts
var _onlineJoinTimeout = null;   // client: connection timeout timer

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
var ONLINE_ROOM_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/I/1/L
var ONLINE_ROOM_CODE_LEN = 6;
var ONLINE_PEER_PREFIX = 'snakombo-';
var ONLINE_HEARTBEAT_INTERVAL = 2000;  // ms — host sends ping every 2s
var ONLINE_HEARTBEAT_TIMEOUT = 6000;   // ms — 6s without pong = disconnect
var ONLINE_STATE_SEND_INTERVAL = 1;    // send every frame (60fps)
var ONLINE_JOIN_TIMEOUT_MS = 10000;    // 10s to connect or fail

// ---------------------------------------------------------------------------
// Room code helpers
// ---------------------------------------------------------------------------
function _onlineGenerateRoomCode() {
  var code = '';
  for (var i = 0; i < ONLINE_ROOM_CODE_LEN; i++) {
    code += ONLINE_ROOM_CHARS.charAt(Math.floor(Math.random() * ONLINE_ROOM_CHARS.length));
  }
  return code;
}

function _onlineIsValidRoomCode(code) {
  if (typeof code !== 'string') return false;
  if (code.length !== ONLINE_ROOM_CODE_LEN) return false;
  for (var i = 0; i < code.length; i++) {
    if (ONLINE_ROOM_CHARS.indexOf(code.charAt(i)) === -1) return false;
  }
  return true;
}

function _onlinePeerIdFromCode(code) {
  return ONLINE_PEER_PREFIX + code;
}

// ---------------------------------------------------------------------------
// Catmull-Rom interpolation (client-side reconstruction)
// ---------------------------------------------------------------------------
/**
 * Given a sparse array of points (every 4th from the original 100),
 * reconstruct the full 100-point array using Catmull-Rom spline.
 */
function onlineCatmullRomReconstruct(sparse, totalCount) {
  if (!sparse || sparse.length === 0) return [];
  if (sparse.length === 1) {
    var out = [];
    for (var i = 0; i < totalCount; i++) out.push({ x: sparse[0].x, y: sparse[0].y });
    return out;
  }

  var result = [];
  var n = sparse.length;

  for (var seg = 0; seg < n - 1; seg++) {
    var p0 = sparse[Math.max(0, seg - 1)];
    var p1 = sparse[seg];
    var p2 = sparse[Math.min(n - 1, seg + 1)];
    var p3 = sparse[Math.min(n - 1, seg + 2)];

    // Number of points to generate for this segment
    var stepsInSegment = 4; // we sampled every 4th point
    if (seg === n - 2) {
      // Last segment: fill remaining points
      stepsInSegment = totalCount - result.length;
    }

    for (var s = 0; s < stepsInSegment; s++) {
      var t = s / stepsInSegment;
      var t2 = t * t;
      var t3 = t2 * t;

      var x = 0.5 * (
        (2 * p1.x) +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
      );
      var y = 0.5 * (
        (2 * p1.y) +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
      );

      result.push({ x: x, y: y });
    }
  }

  // Ensure exactly totalCount points
  while (result.length < totalCount) {
    var last = sparse[sparse.length - 1];
    result.push({ x: last.x, y: last.y });
  }
  if (result.length > totalCount) {
    result.length = totalCount;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Point compression — send every 4th point from a 100-point array (=> 25 pts)
// ---------------------------------------------------------------------------
function onlineCompressPoints(pts) {
  if (!pts || pts.length === 0) return [];
  var compressed = [];
  for (var i = 0; i < pts.length; i += 4) {
    var p = pts[i];
    // Round to 1 decimal place to save bandwidth
    compressed.push({ x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
  }
  // Always include the last point for accurate tail position
  var lastIdx = pts.length - 1;
  if (lastIdx % 4 !== 0) {
    var lp = pts[lastIdx];
    compressed.push({ x: Math.round(lp.x * 10) / 10, y: Math.round(lp.y * 10) / 10 });
  }
  return compressed;
}

// ---------------------------------------------------------------------------
// Obstacle compression — send only renderable data, skip internal caches
// ---------------------------------------------------------------------------
function onlineCompressObstacles(obstacles) {
  if (!obstacles) return [];
  var result = [];
  for (var i = 0; i < obstacles.length; i++) {
    var obs = obstacles[i];
    if (obs.fadeOut > 0) continue; // fading out, skip
    var compressed = {
      x: Math.round(obs.x * 10) / 10,
      y: Math.round(obs.y * 10) / 10,
      c: [] // circles
    };
    if (obs.isGolden) compressed.g = 1;
    if (obs.fadeIn > 0) compressed.fi = obs.fadeIn;
    // Compress circles: {ox, oy, r}
    if (obs.circles) {
      for (var j = 0; j < obs.circles.length; j++) {
        var c = obs.circles[j];
        compressed.c.push({
          x: Math.round(c.ox * 10) / 10,
          y: Math.round(c.oy * 10) / 10,
          r: Math.round(c.r * 10) / 10
        });
      }
    }
    result.push(compressed);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Floating texts compression
// ---------------------------------------------------------------------------
function onlineCompressFloatingTexts(texts) {
  if (!texts) return [];
  var result = [];
  for (var i = 0; i < texts.length; i++) {
    var ft = texts[i];
    if (ft.life <= 0) continue;
    var item = {
      x: Math.round(ft.x),
      y: Math.round(ft.y),
      t: ft.text,
      l: ft.life
    };
    if (ft.color && ft.color.length === 3) {
      item.c = ft.color;
    }
    result.push(item);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
function _onlineClearTimers() {
  if (_onlineHeartbeatTimer) {
    clearInterval(_onlineHeartbeatTimer);
    _onlineHeartbeatTimer = null;
  }
  if (_onlineHeartbeatTimeout) {
    clearTimeout(_onlineHeartbeatTimeout);
    _onlineHeartbeatTimeout = null;
  }
  if (_onlineJoinTimeout) {
    clearTimeout(_onlineJoinTimeout);
    _onlineJoinTimeout = null;
  }
}

function onlineCloseAll() {
  _onlineDestroyed = true;
  _onlineConnecting = false;
  _onlineClearTimers();

  if (_onlineConn) {
    try { _onlineConn.close(); } catch (e) { /* ignore */ }
    _onlineConn = null;
  }
  if (_onlinePeer) {
    try { _onlinePeer.destroy(); } catch (e) { /* ignore */ }
    _onlinePeer = null;
  }

  onlineRole = null;
  onlineConnected = false;
  onlineRoomCode = '';
  _onlineCallbacks = {};
  _onlineSendFrameCounter = 0;
  _onlineLatestState = null;
}

// ---------------------------------------------------------------------------
// Disconnect handler (shared by host and client)
// ---------------------------------------------------------------------------
function _onlineHandleDisconnect(reason) {
  if (_onlineDestroyed) return;
  var wasConnected = onlineConnected;
  onlineConnected = false;
  _onlineClearTimers();

  var cb = _onlineCallbacks;
  if (wasConnected && cb && typeof cb.onDisconnected === 'function') {
    try { cb.onDisconnected(reason || '연결 끊김'); } catch (e) { console.error('[online] disconnect callback error:', e); }
  }
}

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------
function _onlineHandleError(msg) {
  var cb = _onlineCallbacks;
  if (cb && typeof cb.onError === 'function') {
    try { cb.onError(msg); } catch (e) { console.error('[online] error callback error:', e); }
  }
}

// ---------------------------------------------------------------------------
// Heartbeat (host-driven: host sends ping, client responds with pong)
// ---------------------------------------------------------------------------
function _onlineStartHeartbeatHost() {
  _onlineClearTimers();
  _onlineLastPong = Date.now();

  _onlineHeartbeatTimer = setInterval(function () {
    if (!_onlineConn || !_onlineConn.open) return;
    try {
      _onlineConn.send({ _t: 'ping', ts: Date.now() });
    } catch (e) { /* ignore */ }

    // Check timeout
    var elapsed = Date.now() - _onlineLastPong;
    if (elapsed > ONLINE_HEARTBEAT_TIMEOUT) {
      console.warn('[online] heartbeat timeout — disconnecting client');
      _onlineHandleDisconnect('heartbeat timeout');
      if (_onlineConn) {
        try { _onlineConn.close(); } catch (e) { /* ignore */ }
      }
    }
  }, ONLINE_HEARTBEAT_INTERVAL);
}

function _onlineStartHeartbeatClient() {
  _onlineClearTimers();
  _onlineLastPong = Date.now(); // treat connection start as last "pong"

  // Client checks for incoming pings; if no ping for 6s, consider disconnected
  _onlineHeartbeatTimer = setInterval(function () {
    var elapsed = Date.now() - _onlineLastPong;
    if (elapsed > ONLINE_HEARTBEAT_TIMEOUT) {
      console.warn('[online] no heartbeat from host — disconnecting');
      _onlineHandleDisconnect('heartbeat timeout');
      if (_onlineConn) {
        try { _onlineConn.close(); } catch (e) { /* ignore */ }
      }
    }
  }, ONLINE_HEARTBEAT_INTERVAL);
}

// ---------------------------------------------------------------------------
// HOST: create room
// ---------------------------------------------------------------------------
function onlineCreateRoom(callbacks) {
  return new Promise(function (resolve, reject) {
    if (_onlineConnecting || onlineConnected) {
      var msg = '이미 연결 중이거나 연결된 상태입니다';
      _onlineHandleError(msg);
      reject(new Error(msg));
      return;
    }

    onlineCloseAll(); // clean slate
    _onlineDestroyed = false;
    _onlineConnecting = true;
    _onlineCallbacks = callbacks || {};
    onlineRole = 'host';

    var roomCode = _onlineGenerateRoomCode();
    var peerId = _onlinePeerIdFromCode(roomCode);

    var peer;
    try {
      peer = new Peer(peerId, { serialization: 'json' });
    } catch (e) {
      _onlineConnecting = false;
      onlineRole = null;
      var errMsg = 'PeerJS 초기화 실패: ' + (e.message || e);
      _onlineHandleError(errMsg);
      reject(new Error(errMsg));
      return;
    }

    _onlinePeer = peer;

    peer.on('open', function (id) {
      if (_onlineDestroyed) return;
      _onlineConnecting = false;
      onlineRoomCode = roomCode;
      console.log('[online] host room created:', roomCode, 'peerId:', id);
      resolve(roomCode);
    });

    peer.on('error', function (err) {
      console.error('[online] host peer error:', err);
      if (_onlineDestroyed) return;

      var errType = err.type || '';
      var errMsg = '서버 연결 오류';

      if (errType === 'unavailable-id') {
        errMsg = '방 코드 충돌 — 다시 시도해 주세요';
      } else if (errType === 'network' || errType === 'server-error') {
        errMsg = 'PeerJS 서버에 연결할 수 없습니다';
      } else if (errType === 'disconnected') {
        errMsg = '서버 연결이 끊어졌습니다';
      } else if (err.message) {
        errMsg = err.message;
      }

      _onlineHandleError(errMsg);

      // If we haven't opened yet, reject the promise
      if (_onlineConnecting) {
        _onlineConnecting = false;
        reject(new Error(errMsg));
      }
    });

    peer.on('close', function () {
      if (_onlineDestroyed) return;
      _onlineHandleDisconnect('peer closed');
    });

    // Host waits for a client connection
    peer.on('connection', function (conn) {
      if (_onlineDestroyed) return;

      // Only allow one client
      if (_onlineConn && _onlineConn.open) {
        console.warn('[online] rejecting second connection attempt');
        try { conn.close(); } catch (e) { /* ignore */ }
        return;
      }

      _onlineConn = conn;
      conn.serialization = 'json';

      conn.on('open', function () {
        if (_onlineDestroyed) return;
        onlineConnected = true;
        _onlineLastPong = Date.now();
        console.log('[online] client connected to host');

        _onlineStartHeartbeatHost();

        var cb = _onlineCallbacks;
        if (cb && typeof cb.onPeerConnected === 'function') {
          try { cb.onPeerConnected(); } catch (e) { console.error('[online] onPeerConnected error:', e); }
        }
      });

      conn.on('data', function (data) {
        if (_onlineDestroyed) return;
        if (!data || typeof data !== 'object') return;

        // Pong from client
        if (data._t === 'pong') {
          _onlineLastPong = Date.now();
          return;
        }

        // Input from client: { _t: 'input', l: bool, r: bool }
        if (data._t === 'input') {
          // Apply to gray snake's controls in main.js
          if (typeof keys !== 'undefined') {
            keys.left = !!data.l;
            keys.right = !!data.r;
          }
          return;
        }

        // Restart ready from client
        if (data._t === 'restart_ready') {
          var cb = _onlineCallbacks;
          if (cb && typeof cb.onRestartReady === 'function') {
            try { cb.onRestartReady(); } catch (e) { /* ignore */ }
          }
          return;
        }
      });

      conn.on('close', function () {
        if (_onlineDestroyed) return;
        console.log('[online] client disconnected');
        _onlineHandleDisconnect('client disconnected');
      });

      conn.on('error', function (err) {
        console.error('[online] host connection error:', err);
        if (_onlineDestroyed) return;
        _onlineHandleError('연결 오류: ' + (err.message || err));
      });
    });
  });
}

// ---------------------------------------------------------------------------
// CLIENT: join room
// ---------------------------------------------------------------------------
function onlineJoinRoom(roomCode, callbacks) {
  return new Promise(function (resolve, reject) {
    if (_onlineConnecting || onlineConnected) {
      var msg = '이미 연결 중이거나 연결된 상태입니다';
      _onlineHandleError(msg);
      reject(new Error(msg));
      return;
    }

    // Validate room code
    var code = (typeof roomCode === 'string') ? roomCode.toUpperCase().trim() : '';
    if (!_onlineIsValidRoomCode(code)) {
      var errMsg = '유효하지 않은 방 코드입니다';
      if (callbacks && typeof callbacks.onError === 'function') {
        try { callbacks.onError(errMsg); } catch (e) { /* ignore */ }
      }
      reject(new Error(errMsg));
      return;
    }

    onlineCloseAll(); // clean slate
    _onlineDestroyed = false;
    _onlineConnecting = true;
    _onlineCallbacks = callbacks || {};
    onlineRole = 'client';
    onlineRoomCode = code;

    var peer;
    try {
      // Client gets a random peer ID
      peer = new Peer(undefined, { serialization: 'json' });
    } catch (e) {
      _onlineConnecting = false;
      onlineRole = null;
      onlineRoomCode = '';
      var initErr = 'PeerJS 초기화 실패: ' + (e.message || e);
      _onlineHandleError(initErr);
      reject(new Error(initErr));
      return;
    }

    _onlinePeer = peer;

    // Connection timeout
    _onlineJoinTimeout = setTimeout(function () {
      if (_onlineDestroyed || onlineConnected) return;
      console.warn('[online] join timeout');
      _onlineConnecting = false;
      var timeoutMsg = '연결 시간 초과 — 방 코드를 확인해 주세요';
      _onlineHandleError(timeoutMsg);
      onlineCloseAll();
      reject(new Error(timeoutMsg));
    }, ONLINE_JOIN_TIMEOUT_MS);

    peer.on('open', function (id) {
      if (_onlineDestroyed) return;
      console.log('[online] client peer opened:', id, '— connecting to room:', code);

      var hostPeerId = _onlinePeerIdFromCode(code);
      var conn;
      try {
        conn = peer.connect(hostPeerId, {
          serialization: 'json',
          reliable: true
        });
      } catch (e) {
        _onlineConnecting = false;
        var connErr = '연결 시도 실패: ' + (e.message || e);
        _onlineHandleError(connErr);
        onlineCloseAll();
        reject(new Error(connErr));
        return;
      }

      _onlineConn = conn;

      conn.on('open', function () {
        if (_onlineDestroyed) return;
        _onlineConnecting = false;
        onlineConnected = true;
        _onlineLastPong = Date.now();

        if (_onlineJoinTimeout) {
          clearTimeout(_onlineJoinTimeout);
          _onlineJoinTimeout = null;
        }

        console.log('[online] connected to host room:', code);
        _onlineStartHeartbeatClient();

        var cb = _onlineCallbacks;
        if (cb && typeof cb.onConnected === 'function') {
          try { cb.onConnected(); } catch (e) { console.error('[online] onConnected error:', e); }
        }

        resolve();
      });

      conn.on('data', function (data) {
        if (_onlineDestroyed) return;
        if (!data || typeof data !== 'object') return;

        // Ping from host — respond with pong
        if (data._t === 'ping') {
          _onlineLastPong = Date.now();
          try {
            conn.send({ _t: 'pong', ts: data.ts });
          } catch (e) { /* ignore */ }
          return;
        }

        // Start signal from host
        if (data._t === 'start') {
          var cb = _onlineCallbacks;
          if (cb && typeof cb.onStartSignal === 'function') {
            try { cb.onStartSignal(); } catch (e) { console.error('[online] onStartSignal error:', e); }
          }
          return;
        }

        // Host notifies client that host is ready to restart
        if (data._t === 'restart_ready') {
          var cb = _onlineCallbacks;
          if (cb && typeof cb.onRestartReady === 'function') {
            try { cb.onRestartReady(); } catch (e) { /* ignore */ }
          }
          return;
        }

        // Host triggers actual restart
        if (data._t === 'restart') {
          var cb = _onlineCallbacks;
          if (cb && typeof cb.onRestart === 'function') {
            try { cb.onRestart(); } catch (e) { /* ignore */ }
          }
          return;
        }

        // Game state from host
        if (data._t === 'state') {
          _onlineLatestState = data;

          var cb = _onlineCallbacks;
          if (cb && typeof cb.onStateReceived === 'function') {
            try { cb.onStateReceived(data); } catch (e) { console.error('[online] onStateReceived error:', e); }
          }
          return;
        }
      });

      conn.on('close', function () {
        if (_onlineDestroyed) return;
        console.log('[online] disconnected from host');
        _onlineHandleDisconnect('host disconnected');
      });

      conn.on('error', function (err) {
        console.error('[online] client connection error:', err);
        if (_onlineDestroyed) return;

        var errType = err.type || '';
        var errMsg = '연결 오류';

        if (errType === 'peer-unavailable') {
          errMsg = '방을 찾을 수 없습니다 — 코드를 확인해 주세요';
        } else if (err.message) {
          errMsg = err.message;
        }

        _onlineHandleError(errMsg);

        if (_onlineConnecting) {
          _onlineConnecting = false;
          onlineCloseAll();
          reject(new Error(errMsg));
        }
      });
    });

    peer.on('error', function (err) {
      console.error('[online] client peer error:', err);
      if (_onlineDestroyed) return;

      var errType = err.type || '';
      var errMsg = '서버 연결 오류';

      if (errType === 'peer-unavailable') {
        errMsg = '방을 찾을 수 없습니다 — 코드를 확인해 주세요';
      } else if (errType === 'network' || errType === 'server-error') {
        errMsg = 'PeerJS 서버에 연결할 수 없습니다';
      } else if (err.message) {
        errMsg = err.message;
      }

      _onlineHandleError(errMsg);

      if (_onlineConnecting) {
        _onlineConnecting = false;
        onlineCloseAll();
        reject(new Error(errMsg));
      }
    });

    peer.on('close', function () {
      if (_onlineDestroyed) return;
      _onlineHandleDisconnect('peer closed');
    });
  });
}

// ---------------------------------------------------------------------------
// HOST: send game state (called from animate loop — throttled to 30fps)
// ---------------------------------------------------------------------------
function onlineSendState(stateObj) {
  if (onlineRole !== 'host' || !onlineConnected || !_onlineConn || !_onlineConn.open) return;

  _onlineSendFrameCounter++;
  if (_onlineSendFrameCounter % ONLINE_STATE_SEND_INTERVAL !== 0) return;

  try {
    stateObj._t = 'state';
    _onlineConn.send(stateObj);
  } catch (e) {
    console.error('[online] send state error:', e);
  }
}

// ---------------------------------------------------------------------------
// CLIENT: send input (called on key events)
// ---------------------------------------------------------------------------
function onlineSendInput(inputObj) {
  if (onlineRole !== 'client' || !onlineConnected || !_onlineConn || !_onlineConn.open) return;

  try {
    inputObj._t = 'input';
    _onlineConn.send(inputObj);
  } catch (e) {
    console.error('[online] send input error:', e);
  }
}

// ---------------------------------------------------------------------------
// Send arbitrary signal to the other peer (works for both host and client)
// ---------------------------------------------------------------------------
function onlineSendSignal(type) {
  if (!_onlineConn || !_onlineConn.open) return;
  try {
    _onlineConn.send({ _t: type });
  } catch (e) {
    console.error('[online] send signal error:', e);
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
function isOnlineMode() {
  return onlineRole === 'host' || onlineRole === 'client';
}

function onlineGetLatestState() {
  return _onlineLatestState;
}

// ---------------------------------------------------------------------------
// Client-side state interpolation helper
// ---------------------------------------------------------------------------
var _onlinePrevState = null;
var _onlineCurrState = null;
var _onlineStateReceivedAt = 0;
var _onlineStatePrevReceivedAt = 0;

/**
 * Called by the client when a new state arrives, to set up interpolation.
 */
function onlineClientPushState(state) {
  _onlinePrevState = _onlineCurrState;
  _onlineStatePrevReceivedAt = _onlineStateReceivedAt;
  _onlineCurrState = state;
  _onlineStateReceivedAt = performance.now();
}

/**
 * Returns an interpolation factor (0..1) between prev and curr state,
 * based on time elapsed since the last state was received.
 * Returns 1 if no interpolation data is available.
 */
function onlineClientGetInterpolation() {
  if (!_onlinePrevState || !_onlineCurrState) return 1;
  var interval = _onlineStateReceivedAt - _onlineStatePrevReceivedAt;
  if (interval <= 0) return 1;
  var elapsed = performance.now() - _onlineStateReceivedAt;
  var t = elapsed / interval;
  return Math.min(1, Math.max(0, t));
}

/**
 * Linearly interpolate two point arrays (same length).
 * Returns a new array with interpolated {x, y} points.
 */
function onlineLerpPoints(a, b, t) {
  if (!a || !b) return b || a || [];
  var len = Math.min(a.length, b.length);
  var result = [];
  for (var i = 0; i < len; i++) {
    result.push({
      x: a[i].x + (b[i].x - a[i].x) * t,
      y: a[i].y + (b[i].y - a[i].y) * t
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Expose everything on window (global scope)
// ---------------------------------------------------------------------------
window.onlineRole = onlineRole;
window.onlineConnected = onlineConnected;
window.onlineRoomCode = onlineRoomCode;

window.onlineCreateRoom = onlineCreateRoom;
window.onlineJoinRoom = onlineJoinRoom;
window.onlineSendState = onlineSendState;
window.onlineSendInput = onlineSendInput;
window.onlineCloseAll = onlineCloseAll;
window.onlineSendSignal = onlineSendSignal;
window.isOnlineMode = isOnlineMode;
window.onlineGetLatestState = onlineGetLatestState;

window.onlineCatmullRomReconstruct = onlineCatmullRomReconstruct;
window.onlineCompressPoints = onlineCompressPoints;
window.onlineCompressObstacles = onlineCompressObstacles;
window.onlineCompressFloatingTexts = onlineCompressFloatingTexts;

window.onlineClientPushState = onlineClientPushState;
window.onlineClientGetPrevState = function () { return _onlinePrevState; };
window.onlineClientGetInterpolation = onlineClientGetInterpolation;
window.onlineLerpPoints = onlineLerpPoints;

// Re-export state as getters so window reads always reflect current values
Object.defineProperty(window, 'onlineRole', {
  get: function () { return onlineRole; },
  set: function (v) { onlineRole = v; },
  configurable: true
});
Object.defineProperty(window, 'onlineConnected', {
  get: function () { return onlineConnected; },
  set: function (v) { onlineConnected = v; },
  configurable: true
});
Object.defineProperty(window, 'onlineRoomCode', {
  get: function () { return onlineRoomCode; },
  set: function (v) { onlineRoomCode = v; },
  configurable: true
});
