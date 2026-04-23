(() => {
  const PREFIX = "[BehaviorLogger]";
  const BACKEND_URL = "http://localhost:8000";

  const STATIC_EXTENSIONS = [
    '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico',
    '.woff', '.woff2', '.ttf', '.eot',
    '.mp3', '.mp4', '.webm', '.ogg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx'
  ];

  const eventQueue = [];
  let isFlushing = false;
  const MAX_QUEUE_SIZE = 30;
  const FLUSH_INTERVAL = 1500;

  function isBaiduUrl(url) {
    try {
      const urlObj = new URL(url, window.location.href);
      return urlObj.hostname.includes('baidu.com');
    } catch {
      return false;
    }
  }

  function isStaticResource(url) {
    try {
      const urlObj = new URL(url, window.location.href);
      const pathname = urlObj.pathname.toLowerCase();
      return STATIC_EXTENSIONS.some(ext => pathname.endsWith(ext));
    } catch {
      return false;
    }
  }

  function shouldIntercept(url) {
    return isBaiduUrl(url) && !isStaticResource(url);
  }

  function safeParseJson(text) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
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
      pageUrl: window.location.href,
      ...payload
    };
    console.log(PREFIX, log);
    
    enqueueEvent(log);
  }

  // Hook XMLHttpRequest
  const originalXHR = window.XMLHttpRequest;
  
  function CustomXHR() {
    const xhr = new originalXHR();
    const xhrInfo = {
      method: '',
      url: '',
      headers: {},
      requestBody: null,
      startTime: null
    };

    const originalOpen = xhr.open;
    xhr.open = function(method, url, async, user, password) {
      xhrInfo.method = method;
      xhrInfo.url = url;
      xhrInfo.startTime = Date.now();
      return originalOpen.apply(this, arguments);
    };

    const originalSetRequestHeader = xhr.setRequestHeader;
    xhr.setRequestHeader = function(name, value) {
      xhrInfo.headers[name] = value;
      return originalSetRequestHeader.apply(this, arguments);
    };

    const originalSend = xhr.send;
    xhr.send = function(body) {
      xhrInfo.requestBody = body;
      
      if (shouldIntercept(xhrInfo.url)) {
        let parsedBody = body;
        if (typeof body === 'string') {
          parsedBody = safeParseJson(body);
        } else if (body instanceof FormData) {
          parsedBody = '[FormData]';
        } else if (body instanceof Blob) {
          parsedBody = '[Blob]';
        }
        
        logEvent("xhr_request", {
          method: xhrInfo.method,
          url: xhrInfo.url,
          headers: xhrInfo.headers,
          body: parsedBody
        });
      }
      
      return originalSend.apply(this, arguments);
    };

    xhr.addEventListener('readystatechange', function() {
      if (xhr.readyState === 4 && shouldIntercept(xhrInfo.url)) {
        const responseHeaders = {};
        const headersStr = xhr.getAllResponseHeaders();
        if (headersStr) {
          headersStr.split('\r\n').forEach(line => {
            if (line) {
              const [name, value] = line.split(': ');
              if (name) responseHeaders[name] = value;
            }
          });
        }

        let responseData = xhr.responseText;
        const contentType = responseHeaders['content-type'] || responseHeaders['Content-Type'] || '';
        if (contentType.includes('application/json')) {
          responseData = safeParseJson(xhr.responseText);
        }

        logEvent("xhr_response", {
          method: xhrInfo.method,
          url: xhrInfo.url,
          status: xhr.status,
          statusText: xhr.statusText,
          headers: responseHeaders,
          response: responseData,
          duration: Date.now() - xhrInfo.startTime
        });
      }
    });

    xhr.addEventListener('error', function() {
      if (shouldIntercept(xhrInfo.url)) {
        logEvent("xhr_error", {
          method: xhrInfo.method,
          url: xhrInfo.url,
          status: xhr.status,
          statusText: xhr.statusText
        });
      }
    });

    return xhr;
  }

  window.XMLHttpRequest = CustomXHR;

  // Hook Fetch
  const originalFetch = window.fetch;
  
  window.fetch = function(input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    const method = init.method || 'GET';
    const startTime = Date.now();
    
    let requestHeaders = {};
    if (init.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((value, name) => {
          requestHeaders[name] = value;
        });
      } else {
        requestHeaders = { ...init.headers };
      }
    }

    let requestBody = init.body;
    let parsedBody = requestBody;
    
    if (shouldIntercept(url)) {
      if (typeof requestBody === 'string') {
        parsedBody = safeParseJson(requestBody);
      } else if (requestBody instanceof FormData) {
        parsedBody = '[FormData]';
      } else if (requestBody instanceof Blob) {
        parsedBody = '[Blob]';
      } else if (requestBody instanceof URLSearchParams) {
        parsedBody = requestBody.toString();
      }
      
      logEvent("fetch_request", {
        method: method,
        url: url,
        headers: requestHeaders,
        body: parsedBody
      });
    }

    return originalFetch.apply(this, arguments).then(response => {
      if (!shouldIntercept(url)) {
        return response;
      }

      const clonedResponse = response.clone();
      
      return clonedResponse.text().then(text => {
        const responseHeaders = {};
        response.headers.forEach((value, name) => {
          responseHeaders[name] = value;
        });

        let responseData = text;
        const contentType = responseHeaders['content-type'] || '';
        if (contentType.includes('application/json')) {
          responseData = safeParseJson(text);
        }

        logEvent("fetch_response", {
          method: method,
          url: url,
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
          response: responseData,
          duration: Date.now() - startTime
        });

        return response;
      }).catch(err => {
        logEvent("fetch_response_parse_error", {
          method: method,
          url: url,
          error: err.message
        });
        return response;
      });
    }).catch(error => {
      if (shouldIntercept(url)) {
        logEvent("fetch_error", {
          method: method,
          url: url,
          error: error.message
        });
      }
      throw error;
    });
  };

  // 1) 输入文本内容
  document.addEventListener(
    "input",
    (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
        return;
      }

      logEvent("text_input", {
        tag: target.tagName.toLowerCase(),
        inputType: target.type || "text",
        id: target.id || null,
        name: target.name || null,
        value: target.value
      });
    },
    true
  );

  // 2) 光标移动 + 停留时间
  let lastMouse = null;
  let lastMoveAt = Date.now();
  let lastLoggedMoveAt = 0;
  const MOVE_THROTTLE_MS = 500;

  document.addEventListener(
    "mousemove",
    (event) => {
      const now = Date.now();

      if (now - lastLoggedMoveAt < MOVE_THROTTLE_MS) {
        return;
      }

      if (lastMouse) {
        const dwellMs = now - lastMoveAt;
        logEvent("cursor_dwell", {
          x: lastMouse.x,
          y: lastMouse.y,
          dwellMs
        });
      }

      const currentMouse = {
        x: event.clientX,
        y: event.clientY
      };

      logEvent("cursor_move", {
        from: lastMouse,
        to: currentMouse
      });

      lastMouse = currentMouse;
      lastMoveAt = now;
      lastLoggedMoveAt = now;
    },
    { passive: true, capture: true }
  );

  // 额外：鼠标进入/离开页面时记录停留
  window.addEventListener("blur", () => {
    logEvent("window_blur", {});
  });

  window.addEventListener("focus", () => {
    logEvent("window_focus", {});
  });

  // 3) 点击事件（辅助观察行为）
  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;
      let selector = null;

      if (target instanceof Element) {
        selector = target.tagName.toLowerCase();
        if (target.id) selector += `#${target.id}`;
        if (target.classList.length) selector += `.${Array.from(target.classList).slice(0, 3).join(".")}`;
      }

      logEvent("click", {
        x: event.clientX,
        y: event.clientY,
        target: selector
      });
    },
    true
  );

  logEvent("logger_ready", { message: "行为记录器已启动，XHR和Fetch钩子已激活" });
  console.log(PREFIX, `Backend URL: ${BACKEND_URL}`);
})();
