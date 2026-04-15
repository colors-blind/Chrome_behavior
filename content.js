(() => {
  const PREFIX = "[BehaviorLogger]";

  function logEvent(type, payload = {}) {
    const log = {
      type,
      timestamp: new Date().toISOString(),
      url: location.href,
      ...payload
    };
    console.log(PREFIX, log);
  }

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

  document.addEventListener(
    "mousemove",
    (event) => {
      const now = Date.now();

      if (lastMouse) {
        // 两次移动间隔可视为在上一位置附近的停留时长
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

  logEvent("logger_ready", { message: "行为记录器已启动" });
})();
