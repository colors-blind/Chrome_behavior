const PREFIX = "[BehaviorLogger]";

const STATIC_EXTENSIONS = [
  '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
  '.woff', '.woff2', '.ttf', '.eot',
  '.mp3', '.mp4', '.webm', '.ogg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx'
];

function isStaticResource(url) {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname.toLowerCase();
  return STATIC_EXTENSIONS.some(ext => pathname.endsWith(ext));
}

function logEvent(type, payload = {}) {
  const log = {
    type,
    timestamp: new Date().toISOString(),
    ...payload
  };
  console.log(PREFIX, log);
}

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (isStaticResource(details.url)) {
      return;
    }
    
    logEvent("http_request", {
      method: details.method,
      url: details.url,
      requestId: details.requestId,
      type: details.type,
      initiator: details.initiator || 'unknown'
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
