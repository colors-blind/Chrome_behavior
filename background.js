const PREFIX = "[BehaviorLogger]";
const BACKEND_URL = "https://localhost:8443";

const STATIC_EXTENSIONS = [
  '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.eot',
  '.mp3', '.mp4', '.webm', '.ogg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx'
];

const eventQueue = [];
let isFlushing = false;
const MAX_QUEUE_SIZE = 50;
const FLUSH_INTERVAL = 1000;

function isStaticResource(url) {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname.toLowerCase();
  return STATIC_EXTENSIONS.some(ext => pathname.endsWith(ext));
}

async function sendToBackend(endpoint, data) {
  try {
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      console.log(`${PREFIX} Failed to send to backend: ${response.status}`);
    }
  } catch (error) {
    console.log(`${PREFIX} Backend connection error: ${error.message}`);
  }
}

function enqueueEvent(event) {
  eventQueue.push(event);
  
  if (eventQueue.length >= MAX_QUEUE_SIZE) {
    flushQueue();
  }
}

async function flushQueue() {
  if (isFlushing || eventQueue.length === 0) {
    return;
  }
  
  isFlushing = true;
  const eventsToSend = [...eventQueue];
  eventQueue.length = 0;
  
  try {
    await sendToBackend('/api/batch', eventsToSend);
  } catch (error) {
    console.log(`${PREFIX} Failed to flush queue: ${error.message}`);
    eventQueue.unshift(...eventsToSend);
  } finally {
    isFlushing = false;
  }
}

setInterval(flushQueue, FLUSH_INTERVAL);

function logEvent(type, payload = {}) {
  const log = {
    type,
    timestamp: new Date().toISOString(),
    ...payload
  };
  console.log(PREFIX, log);
  
  enqueueEvent(log);
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (isStaticResource(details.url)) {
      return;
    }
    
    let requestBody = null;
    if (details.requestBody) {
      if (details.requestBody.formData) {
        requestBody = details.requestBody.formData;
      } else if (details.requestBody.raw) {
        try {
          const decoder = new TextDecoder('utf-8');
          requestBody = decoder.decode(details.requestBody.raw[0].bytes);
          try {
            requestBody = JSON.parse(requestBody);
          } catch {
          }
        } catch {
          requestBody = '[Binary Data]';
        }
      }
    }
    
    logEvent("http_request", {
      method: details.method,
      url: details.url,
      requestId: details.requestId,
      type: details.type,
      initiator: details.initiator || 'unknown',
      requestBody: requestBody
    });
  },
  {
    urls: [
      "https://www.baidu.com/*",
      "https://baidu.com/*"
    ]
  },
  ["requestBody"]
);

chrome.webRequest.onBeforeSendHeaders.addListener(
  (details) => {
    if (isStaticResource(details.url)) {
      return;
    }
    
    const headers = {};
    details.requestHeaders.forEach(header => {
      headers[header.name] = header.value;
    });
    
    logEvent("http_request_headers", {
      requestId: details.requestId,
      headers: headers
    });
  },
  {
    urls: [
      "https://www.baidu.com/*",
      "https://baidu.com/*"
    ]
  },
  ["requestHeaders"]
);

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (isStaticResource(details.url)) {
      return;
    }
    
    const headers = {};
    details.responseHeaders.forEach(header => {
      headers[header.name] = header.value;
    });
    
    logEvent("http_response_headers", {
      requestId: details.requestId,
      statusCode: details.statusCode,
      statusLine: details.statusLine,
      headers: headers
    });
  },
  {
    urls: [
      "https://www.baidu.com/*",
      "https://baidu.com/*"
    ]
  },
  ["responseHeaders"]
);

chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (isStaticResource(details.url)) {
      return;
    }
    
    logEvent("http_request_completed", {
      requestId: details.requestId,
      url: details.url,
      method: details.method,
      statusCode: details.statusCode,
      fromCache: details.fromCache,
      ip: details.ip,
      responseSize: details.responseSize || 0
    });
  },
  {
    urls: [
      "https://www.baidu.com/*",
      "https://baidu.com/*"
    ]
  },
  []
);

chrome.webRequest.onErrorOccurred.addListener(
  (details) => {
    if (isStaticResource(details.url)) {
      return;
    }
    
    logEvent("http_request_error", {
      requestId: details.requestId,
      url: details.url,
      method: details.method,
      error: details.error
    });
  },
  {
    urls: [
      "https://www.baidu.com/*",
      "https://baidu.com/*"
    ]
  },
  []
);

console.log(PREFIX, "Background service worker started");
console.log(PREFIX, `Backend URL: ${BACKEND_URL}`);
