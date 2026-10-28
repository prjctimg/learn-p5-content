// ES5 compatibility shim prepended to the p5 runtime before it is parsed.
//
// p5 2.4 ships an ES2022 bundle and uses several newer browser APIs. Expo still
// supports older Android WebViews, so the content pack carries a transpiled p5
// build and this shim. The shim must stay ES5 and must be idempotent: newer
// WebViews already provide every method below.

export const P5_RUNTIME_COMPAT_MARKER = "learn-p5-runtime-compat:start";

export const P5_RUNTIME_COMPAT = `/* ${P5_RUNTIME_COMPAT_MARKER} */
(function () {
  var root = typeof window !== "undefined" ? window : this;
  var hasAbortController = typeof root.AbortController !== "undefined";
  var supportsAbortSignal = false;

  if (
    hasAbortController &&
    typeof root.EventTarget !== "undefined" &&
    typeof root.Event === "function"
  ) {
    try {
      var probeController = new root.AbortController();
      var probeTarget = new root.EventTarget();
      var probeCalled = false;
      probeTarget.addEventListener(
        "learn-p5-probe",
        function () {
          probeCalled = true;
        },
        { signal: probeController.signal }
      );
      probeController.abort();
      probeTarget.dispatchEvent(new root.Event("learn-p5-probe"));
      supportsAbortSignal = !probeCalled;
    } catch (error) {}
  }

  var needsAbortSignalShim = !supportsAbortSignal;

  if (typeof root.globalThis === "undefined") {
    root.globalThis = root;
  }

  if (root.Intl && typeof root.Intl.getCanonicalLocales !== "function") {
    root.Intl.getCanonicalLocales = function (locales) {
      var list = locales === undefined ? [] : Array.isArray(locales) ? locales : [locales];
      var result = [];
      for (var i = 0; i < list.length; i++) {
        if (typeof list[i] !== "string") {
          throw new TypeError("Language ID should be string or object.");
        }
        var tag = list[i];
        try {
          tag = new root.Intl.DateTimeFormat(tag).resolvedOptions().locale;
        } catch (error) {}
        result.push(tag);
      }
      return result;
    };
  }

  function define(target, name, value) {
    if (typeof target[name] === "function") return;
    if (Object.defineProperty) {
      Object.defineProperty(target, name, {
        configurable: true,
        writable: true,
        value: value
      });
    } else {
      target[name] = value;
    }
  }

  if (typeof Object.fromEntries !== "function") {
    Object.fromEntries = function (entries) {
      var result = {};
      if (entries == null) {
        throw new TypeError("Object.fromEntries requires an iterable");
      }
      var iteratorSymbol = typeof Symbol === "function" && Symbol.iterator;
      if (iteratorSymbol && typeof entries[iteratorSymbol] === "function") {
        var iterator = entries[iteratorSymbol]();
        var step;
        while (!(step = iterator.next()).done) {
          var entry = step.value;
          if (entry == null || typeof entry.length !== "number" || entry.length < 2) {
            throw new TypeError("Object.fromEntries requires entry objects");
          }
          result[entry[0]] = entry[1];
        }
        return result;
      }
      if (typeof entries.length === "number") {
        for (var i = 0; i < entries.length; i++) {
          var pair = entries[i];
          if (pair == null || typeof pair.length !== "number" || pair.length < 2) {
            throw new TypeError("Object.fromEntries requires entry objects");
          }
          result[pair[0]] = pair[1];
        }
        return result;
      }
      throw new TypeError("Object.fromEntries requires an iterable");
    };
  }

  if (typeof Object.entries !== "function") {
    Object.entries = function (object) {
      if (object == null) {
        throw new TypeError("Cannot convert undefined or null to object");
      }
      var keys = Object.keys(Object(object));
      var result = [];
      for (var i = 0; i < keys.length; i++) {
        result.push([keys[i], object[keys[i]]]);
      }
      return result;
    };
  }

  if (typeof Object.values !== "function") {
    Object.values = function (object) {
      var entries = Object.entries(Object(object));
      var result = [];
      for (var i = 0; i < entries.length; i++) {
        result.push(entries[i][1]);
      }
      return result;
    };
  }

  if (typeof Object.hasOwn !== "function") {
    Object.hasOwn = function (object, key) {
      return Object.prototype.hasOwnProperty.call(object, key);
    };
  }

  if (typeof String.prototype.replaceAll !== "function") {
    define(String.prototype, "replaceAll", function (search, replacement) {
      var value = String(this);
      if (search instanceof RegExp) {
        if (!search.global) {
          throw new TypeError("replaceAll must be called with a global RegExp");
        }
        return value.replace(search, replacement);
      }
      return value.split(String(search)).join(String(replacement));
    });
  }

  function pad(value, targetLength, padString, atStart) {
    var length = targetLength === undefined ? 0 : Number(targetLength);
    if (length !== length) length = 0;
    length = Math.floor(length);
    if (length <= value.length) return value;
    var padding = padString === undefined ? " " : String(padString);
    if (padding.length === 0) return value;
    var needed = length - value.length;
    var fill = "";
    while (fill.length < needed) fill += padding;
    fill = fill.slice(0, needed);
    return atStart ? fill + value : value + fill;
  }

  define(String.prototype, "padStart", function (targetLength, padString) {
    return pad(String(this), targetLength, padString, true);
  });

  define(String.prototype, "padEnd", function (targetLength, padString) {
    return pad(String(this), targetLength, padString, false);
  });

  define(Array.prototype, "at", function (index) {
    var length = this.length;
    var position = Number(index);
    if (position !== position) position = 0;
    position = position < 0 ? Math.ceil(position) : Math.floor(position);
    if (position < 0) position += length;
    return position >= 0 && position < length ? this[position] : undefined;
  });

  define(String.prototype, "at", function (index) {
    var value = String(this);
    var length = value.length;
    var position = Number(index);
    if (position !== position) position = 0;
    position = position < 0 ? Math.ceil(position) : Math.floor(position);
    if (position < 0) position += length;
    return position >= 0 && position < length ? value.charAt(position) : undefined;
  });

  function flattenInto(input, depth, output) {
    for (var i = 0; i < input.length; i++) {
      var value = input[i];
      if (depth > 0 && Array.isArray(value)) {
        flattenInto(value, depth - 1, output);
      } else {
        output.push(value);
      }
    }
    return output;
  }

  define(Array.prototype, "flat", function (depth) {
    var level = depth === undefined ? 1 : Number(depth);
    if (level !== level || level < 0) level = 0;
    return flattenInto(this, level === Infinity ? Infinity : Math.floor(level), []);
  });

  define(Array.prototype, "flatMap", function (callback, thisArg) {
    return flattenInto(this.map(callback, thisArg), 1, []);
  });

  if (typeof root.structuredClone !== "function") {
    root.structuredClone = function (value) {
      if (value === undefined) return undefined;
      return JSON.parse(JSON.stringify(value));
    };
  }

  if (typeof root.queueMicrotask !== "function") {
    root.queueMicrotask = function (callback) {
      Promise.resolve().then(callback).catch(function (error) {
        setTimeout(function () {
          throw error;
        }, 0);
      });
    };
  }

  if (typeof root.setImmediate !== "function") {
    root.setImmediate = function (callback) {
      var args = Array.prototype.slice.call(arguments, 1);
      return setTimeout(function () {
        callback.apply(null, args);
      }, 0);
    };
    root.clearImmediate = function (id) {
      clearTimeout(id);
    };
  }

  if (!hasAbortController) {
    root.AbortController = function () {
      var listeners = [];
      var signal = {
        aborted: false,
        onabort: null,
        addEventListener: function (type, listener) {
          if (type === "abort" && listeners.indexOf(listener) === -1) {
            listeners.push(listener);
          }
        },
        removeEventListener: function (type, listener) {
          if (type !== "abort") return;
          var index = listeners.indexOf(listener);
          if (index !== -1) listeners.splice(index, 1);
        }
      };
      this.signal = signal;
      this.abort = function () {
        if (signal.aborted) return;
        signal.aborted = true;
        var event;
        try {
          event = new Event("abort");
        } catch (error) {
          event = { type: "abort", target: signal };
        }
        if (typeof signal.onabort === "function") {
          try {
            signal.onabort.call(signal, event);
          } catch (error) {}
        }
        for (var i = 0; i < listeners.length; i++) {
          try {
            listeners[i].call(signal, event);
          } catch (error) {}
        }
        listeners.length = 0;
      };
    };
  }

  // Older WebViews ignore the signal option on addEventListener.
  // p5 uses it to tear down window/document listeners in remove().
  if (needsAbortSignalShim && typeof root.EventTarget !== "undefined") {
    var nativeAddEventListener = root.EventTarget.prototype.addEventListener;
    var nativeRemoveEventListener = root.EventTarget.prototype.removeEventListener;

    root.EventTarget.prototype.addEventListener = function (type, listener, options) {
      nativeAddEventListener.call(this, type, listener, options);
      if (!options || typeof options !== "object" || !options.signal) return;

      var signal = options.signal;
      var target = this;
      var remove = function () {
        nativeRemoveEventListener.call(target, type, listener, options);
      };

      if (signal.aborted) {
        remove();
      } else if (typeof signal.addEventListener === "function") {
        signal.addEventListener("abort", remove);
      }
    };
  }
})();
/* learn-p5-runtime-compat:end */`;
