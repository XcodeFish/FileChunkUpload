/******/ (() => {
  // webpackBootstrap
  /******/ 'use strict';
  /******/ var __webpack_modules__ = {
    /***/ '../core/src/developer-mode/logger.ts':
      /*!********************************************!*\
  !*** ../core/src/developer-mode/logger.ts ***!
  \********************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ Logger: () => /* binding */ Logger,
          /* harmony export */
        });
        /* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(
          /*! ./types */ '../core/src/developer-mode/types.ts',
        );
        /**
         * Logger类实现
         * 支持多级别日志和分类的可配置日志系统
         */

        /**
         * 默认日志格式化器
         */
        const defaultFormatter = (level, category, message, data, timestamp = Date.now()) => {
          const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'SILENT'];
          const time = new Date(timestamp).toISOString();
          const dataStr = data !== undefined ? `\nData: ${JSON.stringify(data, null, 2)}` : '';
          return `[${time}] [${levelNames[level]}] [${category}]: ${message}${dataStr}`;
        };
        /**
         * 控制台输出目标
         */
        const consoleOutput = (formattedLog, rawLogData) => {
          const { level } = rawLogData;
          switch (level) {
            case _types__WEBPACK_IMPORTED_MODULE_0__.LogLevel.DEBUG:
              console.debug(formattedLog);
              break;
            case _types__WEBPACK_IMPORTED_MODULE_0__.LogLevel.INFO:
              console.info(formattedLog);
              break;
            case _types__WEBPACK_IMPORTED_MODULE_0__.LogLevel.WARN:
              console.warn(formattedLog);
              break;
            case _types__WEBPACK_IMPORTED_MODULE_0__.LogLevel.ERROR:
              console.error(formattedLog);
              break;
            default:
              break;
          }
        };
        /**
         * 彩色化控制台输出
         */
        const colorizedConsoleOutput = (formattedLog, rawLogData) => {
          const { level } = rawLogData;
          const styles = [
            'color: #9E9E9E', // DEBUG - 灰色
            'color: #2196F3', // INFO - 蓝色
            'color: #FFC107', // WARN - 黄色
            'color: #F44336', // ERROR - 红色
            '', // SILENT
          ];
          switch (level) {
            case _types__WEBPACK_IMPORTED_MODULE_0__.LogLevel.DEBUG:
              console.debug(`%c${formattedLog}`, styles[level]);
              break;
            case _types__WEBPACK_IMPORTED_MODULE_0__.LogLevel.INFO:
              console.info(`%c${formattedLog}`, styles[level]);
              break;
            case _types__WEBPACK_IMPORTED_MODULE_0__.LogLevel.WARN:
              console.warn(`%c${formattedLog}`, styles[level]);
              break;
            case _types__WEBPACK_IMPORTED_MODULE_0__.LogLevel.ERROR:
              console.error(`%c${formattedLog}`, styles[level]);
              break;
            default:
              break;
          }
        };
        /**
         * Logger类 - 支持多级别日志和分类
         */
        class Logger {
          /**
           * 创建Logger实例
           */
          constructor(config) {
            this.logHistory = [];
            this.historyLimit = 1000; // 默认历史记录上限
            // 默认配置
            const defaultConfig = {
              level: _types__WEBPACK_IMPORTED_MODULE_0__.LogLevel.INFO,
              formatter: defaultFormatter,
              outputs: [consoleOutput],
              enabledCategories: true, // 所有类别
              colorize: true,
            };
            this.config = { ...defaultConfig, ...config };
            // 如果启用了彩色显示，替换输出方法
            if (this.config.colorize && typeof window !== 'undefined') {
              this.config.outputs = [colorizedConsoleOutput];
            }
          }
          /**
           * 配置日志记录器
           */
          configure(config) {
            this.config = { ...this.config, ...config };
            // 更新彩色化设置
            if (this.config.colorize !== undefined && typeof window !== 'undefined') {
              this.config.outputs = [this.config.colorize ? colorizedConsoleOutput : consoleOutput];
            }
          }
          /**
           * 判断分类是否启用
           */
          isCategoryEnabled(category) {
            if (this.config.enabledCategories === true) {
              return true;
            }
            return (
              Array.isArray(this.config.enabledCategories) &&
              this.config.enabledCategories.includes(category)
            );
          }
          /**
           * 记录日志
           */
          log(level, category, message, data) {
            // 检查日志级别和分类是否启用
            if (level < this.config.level || !this.isCategoryEnabled(category)) {
              return;
            }
            const timestamp = Date.now();
            const logData = {
              level,
              category,
              message,
              data,
              timestamp,
            };
            // 保存到历史记录
            this.logHistory.push(logData);
            if (this.logHistory.length > this.historyLimit) {
              this.logHistory.shift();
            }
            // 使用格式化器
            const formatter = this.config.formatter || defaultFormatter;
            const formattedLog = formatter(level, category, message, data, timestamp);
            // 发送到所有输出目标
            if (this.config.outputs && this.config.outputs.length > 0) {
              this.config.outputs.forEach(output => {
                output(formattedLog, logData);
              });
            }
          }
          /**
           * 日志级别方法
           */
          debug(category, message, data) {
            this.log(_types__WEBPACK_IMPORTED_MODULE_0__.LogLevel.DEBUG, category, message, data);
          }
          info(category, message, data) {
            this.log(_types__WEBPACK_IMPORTED_MODULE_0__.LogLevel.INFO, category, message, data);
          }
          warn(category, message, data) {
            this.log(_types__WEBPACK_IMPORTED_MODULE_0__.LogLevel.WARN, category, message, data);
          }
          error(category, message, data) {
            this.log(_types__WEBPACK_IMPORTED_MODULE_0__.LogLevel.ERROR, category, message, data);
          }
          /**
           * 获取日志历史
           */
          getHistory() {
            return [...this.logHistory];
          }
          /**
           * 按条件筛选日志
           */
          filterLogs(options) {
            return this.logHistory.filter(log => {
              if (options.level !== undefined && log.level < options.level) {
                return false;
              }
              if (options.category !== undefined && log.category !== options.category) {
                return false;
              }
              if (options.fromTime !== undefined && log.timestamp < options.fromTime) {
                return false;
              }
              if (options.toTime !== undefined && log.timestamp > options.toTime) {
                return false;
              }
              if (
                options.search !== undefined &&
                !log.message.includes(options.search) &&
                !(log.data && JSON.stringify(log.data).includes(options.search))
              ) {
                return false;
              }
              return true;
            });
          }
          /**
           * 清除日志历史
           */
          clearHistory() {
            this.logHistory = [];
          }
          /**
           * 设置历史记录上限
           */
          setHistoryLimit(limit) {
            this.historyLimit = limit;
            // 如果当前历史记录超出新上限，则截断
            if (this.logHistory.length > limit) {
              this.logHistory = this.logHistory.slice(-limit);
            }
          }
          /**
           * 添加自定义输出目标
           */
          addOutputTarget(target) {
            if (!this.config.outputs) {
              this.config.outputs = [];
            }
            this.config.outputs.push(target);
          }
          /**
           * 移除输出目标
           */
          removeOutputTarget(target) {
            if (this.config.outputs) {
              this.config.outputs = this.config.outputs.filter(t => t !== target);
            }
          }
        }

        /***/
      },

    /***/ '../core/src/developer-mode/types.ts':
      /*!*******************************************!*\
  !*** ../core/src/developer-mode/types.ts ***!
  \*******************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ LogLevel: () => /* binding */ LogLevel,
          /* harmony export */
        });
        /**
         * 开发者模式类型定义
         */
        /**
         * 日志级别枚举
         */
        var LogLevel;
        (function (LogLevel) {
          LogLevel[(LogLevel['DEBUG'] = 0)] = 'DEBUG';
          LogLevel[(LogLevel['INFO'] = 1)] = 'INFO';
          LogLevel[(LogLevel['WARN'] = 2)] = 'WARN';
          LogLevel[(LogLevel['ERROR'] = 3)] = 'ERROR';
          LogLevel[(LogLevel['SILENT'] = 4)] = 'SILENT';
        })(LogLevel || (LogLevel = {}));

        /***/
      },

    /***/ '../core/src/events/event-emitter.ts':
      /*!*******************************************!*\
  !*** ../core/src/events/event-emitter.ts ***!
  \*******************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ EventEmitter: () => /* binding */ EventEmitter,
          /* harmony export */
        });
        /* harmony import */ var _file_chunk_uploader_types__WEBPACK_IMPORTED_MODULE_0__ =
          __webpack_require__(/*! @file-chunk-uploader/types */ '../types/dist/index.esm.js');
        /* harmony import */ var _developer_mode_logger__WEBPACK_IMPORTED_MODULE_1__ =
          __webpack_require__(
            /*! ../developer-mode/logger */ '../core/src/developer-mode/logger.ts',
          );
        /* harmony import */ var _developer_mode_types__WEBPACK_IMPORTED_MODULE_2__ =
          __webpack_require__(/*! ../developer-mode/types */ '../core/src/developer-mode/types.ts');

        /**
         * 默认事件选项
         */
        const DEFAULT_EVENT_OPTIONS = {
          once: false,
          priority: 10,
          filter: () => true,
          timeout: 30000, // 默认30秒超时
          catchError: true,
        };
        /**
         * 创建上下文对象
         */
        function createEventContext(eventName, options, namespace) {
          // 用于控制事件传播
          let propagationStopped = false;
          return {
            eventName,
            timestamp: Date.now(),
            source: options?.source,
            meta: options?.meta || {},
            namespace,
            stopPropagation: () => {
              propagationStopped = true;
            },
            isPropagationStopped: () => propagationStopped,
          };
        }
        /**
         * 命名空间事件发射器
         * 提供命名空间隔离的事件机制
         */
        class NamespacedEventEmitter {
          /**
           * 创建命名空间事件发射器
           * @param parent 父事件发射器
           * @param namespace 命名空间
           */
          constructor(parent, namespace) {
            this.parentEmitter = parent;
            this.namespace = namespace;
          }
          /**
           * 创建带命名空间的事件名称
           * @param event 原始事件名
           * @returns 带命名空间的事件名
           */
          namespacedEvent(event) {
            return `${this.namespace}:${event}`;
          }
          on(event, handler, options) {
            this.parentEmitter.on(this.namespacedEvent(event), handler, options);
            return this;
          }
          once(event, handler, options) {
            this.parentEmitter.once(this.namespacedEvent(event), handler, options);
            return this;
          }
          off(event, handler) {
            this.parentEmitter.off(this.namespacedEvent(event), handler);
            return this;
          }
          async emit(event, data, options) {
            const namespacedEvent = this.namespacedEvent(event);
            // 创建命名空间相关的发布选项
            const namespacedOptions = {
              ...options,
              // 添加命名空间标识
              meta: {
                ...(options?.meta || {}),
                namespace: this.namespace,
              },
            };
            await this.parentEmitter.emit(namespacedEvent, data, namespacedOptions);
            // 如果没有设置仅命名空间触发，则同时触发全局事件
            if (!options?.namespaceOnly) {
              // 标记是来自命名空间的事件
              const globalOptions = {
                ...options,
                meta: {
                  ...(options?.meta || {}),
                  namespace: this.namespace,
                  fromNamespace: true,
                },
              };
              await this.parentEmitter.emit(event, data, globalOptions);
            }
          }
          emitSync(event, data, options) {
            const namespacedEvent = this.namespacedEvent(event);
            // 创建命名空间相关的发布选项
            const namespacedOptions = {
              ...options,
              // 添加命名空间标识
              meta: {
                ...(options?.meta || {}),
                namespace: this.namespace,
              },
            };
            this.parentEmitter.emitSync(namespacedEvent, data, namespacedOptions);
            // 如果没有设置仅命名空间触发，则同时触发全局事件
            if (!options?.namespaceOnly) {
              // 标记是来自命名空间的事件
              const globalOptions = {
                ...options,
                meta: {
                  ...(options?.meta || {}),
                  namespace: this.namespace,
                  fromNamespace: true,
                },
              };
              this.parentEmitter.emitSync(event, data, globalOptions);
            }
          }
          onBatch(events, handler, options) {
            return events.map(event => {
              this.on(event, handler, options);
              // 返回取消订阅函数
              return () => {
                this.off(event, handler);
              };
            });
          }
          hasListeners(event) {
            return this.parentEmitter.hasListeners(this.namespacedEvent(event));
          }
          getEventNames() {
            const prefix = `${this.namespace}:`;
            return this.parentEmitter
              .getEventNames()
              .filter(name => name.startsWith(prefix))
              .map(name => name.substring(prefix.length));
          }
          removeAllListeners(eventName) {
            if (eventName) {
              this.parentEmitter.off(this.namespacedEvent(eventName));
            } else {
              const prefix = `${this.namespace}:`;
              const namespacedEvents = this.parentEmitter
                .getEventNames()
                .filter(name => name.startsWith(prefix));
              namespacedEvents.forEach(event => {
                this.parentEmitter.off(event);
              });
            }
            return this;
          }
          createNamespacedEmitter(namespace) {
            // 嵌套命名空间，使用冒号连接
            return new NamespacedEventEmitter(this.parentEmitter, `${this.namespace}:${namespace}`);
          }
          /**
           * 获取事件监听器
           * @param eventName 事件名称
           * @returns 该事件的所有监听器
           */
          listeners(eventName) {
            const namespacedEvent = this.namespacedEvent(eventName);
            // 将IEventHandlerWithPriority转换为IEventListener
            return this.parentEmitter.listeners(namespacedEvent);
          }
        }
        /**
         * 事件发射器实现
         */
        class EventEmitter {
          /**
           * 创建事件发射器
           * @param enableLogging 是否启用日志记录
           * @param namespace 指定命名空间
           */
          constructor(enableLogging = false, namespace) {
            this.events = new Map();
            // 使用WeakMap存储超时定时器，当处理器被垃圾回收时，不会阻止回收
            this.timeoutTimers = new WeakMap();
            // 缓存排序后的处理器列表，提高性能
            this.sortedHandlersCache = new Map();
            this.sortVersions = new Map();
            if (enableLogging) {
              this.logger = new _developer_mode_logger__WEBPACK_IMPORTED_MODULE_1__.Logger({
                level: _developer_mode_types__WEBPACK_IMPORTED_MODULE_2__.LogLevel.DEBUG,
                colorize: true,
              });
            }
            this.namespace = namespace;
          }
          /**
           * 创建命名空间事件发射器
           * @param namespace 命名空间
           * @returns 命名空间事件发射器
           */
          createNamespacedEmitter(namespace) {
            return new NamespacedEventEmitter(this, namespace);
          }
          /**
           * 注册事件监听器
           * @param event 事件名
           * @param handler 事件处理函数
           * @param options 选项
           * @returns this 实例，用于链式调用
           */
          on(event, handler, options) {
            const finalOptions = { ...DEFAULT_EVENT_OPTIONS, ...options };
            // 生成唯一ID（如果没有提供）
            if (!finalOptions.id) {
              finalOptions.id = `handler_${Math.random().toString(36).substring(2, 9)}`;
            }
            // 确保事件处理器数组存在
            if (!this.events.has(event)) {
              this.events.set(event, []);
              this.sortVersions.set(event, 0);
            } else {
              // 增加排序版本，使缓存失效
              const version = (this.sortVersions.get(event) || 0) + 1;
              this.sortVersions.set(event, version);
              this.sortedHandlersCache.delete(event);
            }
            const handlers = this.events.get(event);
            // 创建处理器包装对象
            const handlerWithPriority = {
              handler: handler,
              priority: finalOptions.priority,
              once: finalOptions.once,
              filter: finalOptions.filter,
              timeout: finalOptions.timeout,
              context: finalOptions.context,
              id: finalOptions.id,
            };
            handlers.push(handlerWithPriority);
            this.logDebug(`注册事件处理函数: ${event}`, {
              priority: finalOptions.priority,
              once: finalOptions.once,
              handlerId: finalOptions.id,
            });
            return this;
          }
          /**
           * 批量注册事件监听器
           * @param events 事件名称数组
           * @param handler 事件处理函数
           * @param options 选项
           * @returns 取消订阅函数数组
           */
          onBatch(events, handler, options) {
            return events.map(event => {
              this.on(event, handler, options);
              // 返回取消订阅函数
              return () => {
                this.off(event, handler);
              };
            });
          }
          /**
           * 注册只执行一次的事件监听器
           * @param event 事件名
           * @param handler 事件处理函数
           * @param options 选项
           * @returns this 实例，用于链式调用
           */
          once(event, handler, options) {
            this.on(event, handler, { ...options, once: true });
            return this;
          }
          /**
           * 移除事件监听器
           * @param event 事件名
           * @param handler 可选的特定处理函数
           * @returns this 实例，用于链式调用
           */
          off(event, handler) {
            if (!this.events.has(event)) return this;
            if (!handler) {
              // 如果没有指定处理函数，则移除此事件的所有监听器
              const handlers = this.events.get(event);
              // 清除所有相关的超时定时器
              handlers.forEach(h => {
                const handler = h.handler;
                this.clearHandlerTimeout(handler);
              });
              this.events.delete(event);
              this.sortedHandlersCache.delete(event);
              this.logDebug(`移除所有事件处理函数: ${event}`);
            } else {
              this.removeHandler(event, handler);
            }
            return this;
          }
          /**
           * 移除特定处理函数
           * @param event 事件名
           * @param handler 处理函数
           */
          removeHandler(event, handler) {
            if (!this.events.has(event)) return;
            const handlers = this.events.get(event);
            const index = handlers.findIndex(h => h.handler === handler);
            if (index !== -1) {
              // 清除相关的超时定时器
              this.clearHandlerTimeout(handler);
              handlers.splice(index, 1);
              // 增加排序版本，使缓存失效
              const version = (this.sortVersions.get(event) || 0) + 1;
              this.sortVersions.set(event, version);
              this.sortedHandlersCache.delete(event);
              this.logDebug(`移除事件处理函数: ${event}`);
              // 如果没有处理函数了，删除整个事件条目
              if (handlers.length === 0) {
                this.events.delete(event);
              }
            }
          }
          /**
           * 异步触发事件
           * @param event 事件名
           * @param data 事件数据
           * @param options 发布选项
           */
          async emit(event, data, options) {
            if (!this.events.has(event)) {
              this.logDebug(`触发事件（没有监听器）: ${event}`);
              return;
            }
            this.logDebug(`异步触发事件: ${event}`);
            // 创建事件上下文
            const context = createEventContext(event, options, this.namespace);
            // 判断是否需要使用全局超时
            if (options?.timeout && options.timeout > 0) {
              try {
                // 使用Promise.race实现整体超时控制
                await Promise.race([
                  this.executeHandlers(event, data, context),
                  new Promise((_, reject) => {
                    setTimeout(() => {
                      reject(
                        new _file_chunk_uploader_types__WEBPACK_IMPORTED_MODULE_0__.HandlerTimeoutError(
                          event,
                          options.timeout,
                        ),
                      );
                    }, options.timeout);
                  }),
                ]);
              } catch (error) {
                if (
                  error instanceof
                  _file_chunk_uploader_types__WEBPACK_IMPORTED_MODULE_0__.HandlerTimeoutError
                ) {
                  this.logWarn(`事件整体执行超时: ${event}`, { timeout: options.timeout });
                } else {
                  this.logError(`事件处理过程中发生错误: ${event}`, { error });
                }
              }
            } else {
              // 普通执行，无整体超时控制
              await this.executeHandlers(event, data, context);
            }
          }
          /**
           * 执行事件处理器
           * @param event 事件名
           * @param data 事件数据
           * @param context 事件上下文
           */
          async executeHandlers(event, data, context) {
            const sortedHandlers = this.getSortedHandlers(event);
            const onceHandlers = [];
            // 收集所有错误
            const errors = [];
            for (const handlerInfo of sortedHandlers) {
              // 检查事件传播是否已停止
              if (context && context.isPropagationStopped?.()) {
                this.logDebug(`事件传播已停止: ${event}`);
                break;
              }
              // 检查过滤条件
              if (handlerInfo.filter && !handlerInfo.filter(data)) {
                continue;
              }
              // 收集一次性处理函数
              if (handlerInfo.once) {
                onceHandlers.push(handlerInfo.handler);
              }
              try {
                this.logDebug(`执行事件处理函数: ${event}`, {
                  priority: handlerInfo.priority,
                  handlerId: handlerInfo.id,
                });
                const startTime = performance.now();
                // 设置超时处理
                const timeoutPromise = this.createTimeoutPromise(
                  handlerInfo.handler,
                  event,
                  handlerInfo.timeout,
                  handlerInfo.id,
                );
                // 执行处理函数并等待结果或超时
                await Promise.race([
                  // 绑定上下文
                  Promise.resolve(handlerInfo.handler.call(handlerInfo.context, data, context)),
                  timeoutPromise,
                ]);
                // 清理超时定时器
                this.clearHandlerTimeout(handlerInfo.handler);
                const duration = performance.now() - startTime;
                this.logDebug(`事件处理函数完成: ${event}`, {
                  duration,
                  priority: handlerInfo.priority,
                  handlerId: handlerInfo.id,
                });
              } catch (error) {
                // 清理超时定时器
                this.clearHandlerTimeout(handlerInfo.handler);
                // 处理错误，根据选项决定是否继续执行后续处理器
                const catchError =
                  handlerInfo.catchError !== undefined ? handlerInfo.catchError : true;
                if (
                  error instanceof
                  _file_chunk_uploader_types__WEBPACK_IMPORTED_MODULE_0__.HandlerTimeoutError
                ) {
                  this.logError(`事件处理函数超时: ${event}`, {
                    error,
                    timeout: handlerInfo.timeout,
                    handlerId: handlerInfo.id,
                  });
                  // 收集错误
                  errors.push({
                    error,
                    handlerId: handlerInfo.id,
                  });
                } else {
                  // 创建事件处理器错误
                  const handlerError =
                    new _file_chunk_uploader_types__WEBPACK_IMPORTED_MODULE_0__.EventHandlerError(
                      event,
                      error,
                      handlerInfo.id,
                    );
                  this.logError(`事件处理函数异常: ${event}`, {
                    error: handlerError,
                    handlerId: handlerInfo.id,
                  });
                  // 收集错误
                  errors.push({
                    error: handlerError,
                    handlerId: handlerInfo.id,
                  });
                  // 如果设置不捕获错误，则向上抛出
                  if (!catchError) {
                    throw handlerError;
                  }
                }
              }
            }
            // 移除一次性处理函数
            for (const handler of onceHandlers) {
              this.removeHandler(event, handler);
            }
            // 如果有错误且上下文中有错误处理回调，则调用回调
            if (errors.length > 0 && context?.meta?.errorCallback) {
              try {
                const errorCallback = context.meta.errorCallback;
                errorCallback(errors);
              } catch (callbackError) {
                this.logError(`错误回调执行失败: ${event}`, { error: callbackError });
              }
            }
          }
          /**
           * 同步触发事件
           * @param event 事件名
           * @param data 事件数据
           * @param options 发布选项
           */
          emitSync(event, data, options) {
            if (!this.events.has(event)) {
              this.logDebug(`同步触发事件（没有监听器）: ${event}`);
              return;
            }
            this.logDebug(`同步触发事件: ${event}`);
            // 创建事件上下文
            const context = createEventContext(event, options, this.namespace);
            const sortedHandlers = this.getSortedHandlers(event);
            const onceHandlers = [];
            // 收集所有错误
            const errors = [];
            for (const handlerInfo of sortedHandlers) {
              // 检查事件传播是否已停止
              if (context && context.isPropagationStopped?.()) {
                this.logDebug(`事件传播已停止: ${event}`);
                break;
              }
              // 检查过滤条件
              if (handlerInfo.filter && !handlerInfo.filter(data)) {
                continue;
              }
              // 收集一次性处理函数
              if (handlerInfo.once) {
                onceHandlers.push(handlerInfo.handler);
              }
              try {
                this.logDebug(`同步执行事件处理函数: ${event}`, {
                  priority: handlerInfo.priority,
                  handlerId: handlerInfo.id,
                });
                const startTime = performance.now();
                // 同步执行处理函数
                handlerInfo.handler.call(handlerInfo.context, data, context);
                const duration = performance.now() - startTime;
                this.logDebug(`同步事件处理函数完成: ${event}`, {
                  duration,
                  priority: handlerInfo.priority,
                  handlerId: handlerInfo.id,
                });
              } catch (error) {
                // 处理错误，根据选项决定是否继续执行后续处理器
                const catchError =
                  handlerInfo.catchError !== undefined ? handlerInfo.catchError : true;
                const handlerError =
                  new _file_chunk_uploader_types__WEBPACK_IMPORTED_MODULE_0__.EventHandlerError(
                    event,
                    error,
                    handlerInfo.id,
                  );
                this.logError(`同步事件处理函数异常: ${event}`, {
                  error: handlerError,
                  handlerId: handlerInfo.id,
                });
                // 收集错误
                errors.push({
                  error: handlerError,
                  handlerId: handlerInfo.id,
                });
                // 如果设置不捕获错误，则向上抛出
                if (!catchError) {
                  throw handlerError;
                }
              }
            }
            // 移除一次性处理函数
            for (const handler of onceHandlers) {
              this.removeHandler(event, handler);
            }
            // 如果有错误且上下文中有错误处理回调，则调用回调
            if (errors.length > 0 && context?.meta?.errorCallback) {
              try {
                const errorCallback = context.meta.errorCallback;
                errorCallback(errors);
              } catch (callbackError) {
                this.logError(`错误回调执行失败: ${event}`, { error: callbackError });
              }
            }
          }
          /**
           * 检查是否存在特定事件的监听器
           * @param event 事件名
           * @returns 是否有监听器
           */
          hasListeners(event) {
            return this.events.has(event) && this.events.get(event).length > 0;
          }
          /**
           * 获取事件监听器
           * @param eventName 事件名称
           * @returns 该事件的所有监听器
           */
          listeners(eventName) {
            if (!this.events.has(eventName)) return [];
            // 将IEventHandlerWithPriority转换为IEventListener
            return this.events.get(eventName).map(handler => {
              return {
                handler: handler.handler,
                options: {
                  once: handler.once,
                  priority: handler.priority,
                  filter: handler.filter,
                  timeout: handler.timeout,
                  context: handler.context,
                  id: handler.id,
                  catchError: handler.catchError,
                },
              };
            });
          }
          /**
           * 获取所有已注册的事件名称
           * @returns 事件名称数组
           */
          getEventNames() {
            return Array.from(this.events.keys());
          }
          /**
           * 获取已排序的事件处理器
           * @param event 事件名称
           * @returns 已排序的处理器数组
           */
          getSortedHandlers(event) {
            if (!this.events.has(event)) {
              return [];
            }
            const currentVersion = this.sortVersions.get(event) || 0;
            const cachedResult = this.sortedHandlersCache.get(event);
            // 如果缓存有效，直接返回
            if (cachedResult && cachedResult.version === currentVersion) {
              return cachedResult.handlers;
            }
            // 重新排序
            const handlers = this.events.get(event);
            const sorted = [...handlers].sort((a, b) => a.priority - b.priority);
            // 更新缓存
            this.sortedHandlersCache.set(event, {
              version: currentVersion,
              handlers: sorted,
            });
            return sorted;
          }
          /**
           * 移除所有事件监听器
           * @param eventName 可选的事件名称，如不提供则移除所有事件监听器
           * @returns this 实例，用于链式调用
           */
          removeAllListeners(eventName) {
            if (eventName) {
              this.off(eventName);
            } else {
              // 清除所有超时定时器
              this.events.forEach((handlers, event) => {
                handlers.forEach(h => {
                  this.clearHandlerTimeout(h.handler);
                });
                this.logDebug(`移除所有事件处理函数: ${event}`);
              });
              // 清空事件映射
              this.events.clear();
              this.sortedHandlersCache.clear();
              this.sortVersions.clear();
              this.logDebug('移除所有事件监听器');
            }
            return this;
          }
          /**
           * 创建超时Promise
           * @param handler 处理函数
           * @param event 事件名
           * @param timeout 超时时间（毫秒）
           * @param _handlerId 处理器ID
           */
          createTimeoutPromise(handler, event, timeout, _handlerId) {
            if (!timeout || timeout <= 0) return new Promise(() => {});
            return new Promise((_, reject) => {
              const timer = setTimeout(() => {
                reject(
                  new _file_chunk_uploader_types__WEBPACK_IMPORTED_MODULE_0__.HandlerTimeoutError(
                    event,
                    timeout,
                  ),
                );
              }, timeout);
              this.timeoutTimers.set(handler, timer);
            });
          }
          /**
           * 清除处理器超时定时器
           * @param handler 处理函数
           */
          clearHandlerTimeout(handler) {
            const timer = this.timeoutTimers.get(handler);
            if (timer) {
              clearTimeout(timer);
              this.timeoutTimers.delete(handler);
            }
          }
          /**
           * 记录调试日志
           * @param message 消息
           * @param data 数据
           */
          logDebug(message, data) {
            this.logger?.debug('event', message, data);
          }
          /**
           * 记录警告日志
           * @param message 消息
           * @param data 数据
           */
          logWarn(message, data) {
            this.logger?.warn('event', message, data);
          }
          /**
           * 记录错误日志
           * @param message 消息
           * @param data 数据
           */
          logError(message, data) {
            this.logger?.error('event', message, data);
          }
        }

        /***/
      },

    /***/ '../types/dist/index.esm.js':
      /*!**********************************!*\
  !*** ../types/dist/index.esm.js ***!
  \**********************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ ErrorCode: () => /* binding */ ErrorCode,
          /* harmony export */ EventHandlerError: () => /* binding */ EventHandlerError,
          /* harmony export */ EventName: () => /* binding */ EventName,
          /* harmony export */ HandlerTimeoutError: () => /* binding */ HandlerTimeoutError,
          /* harmony export */ HookType: () => /* binding */ HookType,
          /* harmony export */ LogFormat: () => /* binding */ LogFormat,
          /* harmony export */ LogLevel: () => /* binding */ LogLevel,
          /* harmony export */ PluginState: () => /* binding */ PluginState,
          /* harmony export */ StorageType: () => /* binding */ StorageType,
          /* harmony export */ UploadStatus: () => /* binding */ UploadStatus,
          /* harmony export */ WorkerTaskType: () => /* binding */ WorkerTaskType,
          /* harmony export */
        });
        /**
         * 基础类型定义
         * 包含文件上传相关的基本类型定义
         * @packageDocumentation
         */
        /**
         * 上传状态枚举
         * 表示文件上传的不同状态
         */
        var UploadStatus;
        (function (UploadStatus) {
          /** 待上传 */
          UploadStatus['PENDING'] = 'pending';
          /** 上传中 */
          UploadStatus['UPLOADING'] = 'uploading';
          /** 已暂停 */
          UploadStatus['PAUSED'] = 'paused';
          /** 已取消 */
          UploadStatus['CANCELED'] = 'canceled';
          /** 已完成 */
          UploadStatus['COMPLETED'] = 'completed';
          /** 上传失败 */
          UploadStatus['FAILED'] = 'failed';
        })(UploadStatus || (UploadStatus = {}));

        /**
         * 配置选项类型定义
         * 包含上传器各种配置选项
         * @packageDocumentation
         */
        /**
         * 日志级别枚举
         * 表示日志输出的不同级别
         */
        var LogLevel;
        (function (LogLevel) {
          /** 调试 */
          LogLevel['DEBUG'] = 'debug';
          /** 信息 */
          LogLevel['INFO'] = 'info';
          /** 警告 */
          LogLevel['WARN'] = 'warn';
          /** 错误 */
          LogLevel['ERROR'] = 'error';
          /** 静默（不输出日志） */
          LogLevel['SILENT'] = 'silent';
        })(LogLevel || (LogLevel = {}));
        /**
         * 日志格式枚举
         * 表示日志输出的格式
         */
        var LogFormat;
        (function (LogFormat) {
          /** 格式化输出 */
          LogFormat['PRETTY'] = 'pretty';
          /** JSON格式 */
          LogFormat['JSON'] = 'json';
        })(LogFormat || (LogFormat = {}));

        /**
         * 插件状态
         */
        var PluginState;
        (function (PluginState) {
          PluginState['ENABLED'] = 'enabled';
          PluginState['DISABLED'] = 'disabled';
          PluginState['PENDING'] = 'pending';
          PluginState['FAILED'] = 'failed';
        })(PluginState || (PluginState = {}));

        /**
         * 事件名称枚举
         * 定义系统中所有可能的事件类型
         */
        var EventName;
        (function (EventName) {
          // 上传生命周期事件
          EventName['UPLOAD_START'] = 'upload:start';
          EventName['UPLOAD_PROGRESS'] = 'upload:progress';
          EventName['UPLOAD_SUCCESS'] = 'upload:success';
          EventName['UPLOAD_ERROR'] = 'upload:error';
          EventName['UPLOAD_COMPLETE'] = 'upload:complete';
          EventName['UPLOAD_PAUSE'] = 'upload:pause';
          EventName['UPLOAD_RESUME'] = 'upload:resume';
          EventName['UPLOAD_CANCEL'] = 'upload:cancel';
          // 分片上传事件
          EventName['CHUNK_START'] = 'chunk:start';
          EventName['CHUNK_PROGRESS'] = 'chunk:progress';
          EventName['CHUNK_SUCCESS'] = 'chunk:success';
          EventName['CHUNK_ERROR'] = 'chunk:error';
          EventName['CHUNK_COMPLETE'] = 'chunk:complete';
          // 重试事件
          EventName['RETRY_START'] = 'retry:start';
          EventName['RETRY_SUCCESS'] = 'retry:success';
          EventName['RETRY_FAILED'] = 'retry:failed';
          EventName['RETRY_WAITING'] = 'retry:waiting';
          EventName['RETRY_ADJUSTING'] = 'retry:adjusting';
          // 网络事件
          EventName['NETWORK_ONLINE'] = 'network:online';
          EventName['NETWORK_OFFLINE'] = 'network:offline';
          EventName['NETWORK_SPEED_CHANGE'] = 'network:speed-change';
          EventName['NETWORK_REQUEST'] = 'network:request';
          EventName['NETWORK_RESPONSE'] = 'network:response';
          EventName['NETWORK_ERROR'] = 'network:error';
          // Worker事件
          EventName['WORKER_TASK'] = 'worker:task';
          EventName['WORKER_RESULT'] = 'worker:result';
          EventName['WORKER_ERROR'] = 'worker:error';
          // 插件事件
          EventName['PLUGIN_BEFORE'] = 'plugin:before';
          EventName['PLUGIN_AFTER'] = 'plugin:after';
          EventName['PLUGIN_ERROR'] = 'plugin:error';
          // 存储事件
          EventName['STORAGE_SAVE'] = 'storage:save';
          EventName['STORAGE_LOAD'] = 'storage:load';
          EventName['STORAGE_REMOVE'] = 'storage:remove';
          EventName['STORAGE_ERROR'] = 'storage:error';
          // 其他事件
          EventName['FILE_FILTER'] = 'file:filter';
          EventName['FILE_HASH'] = 'file:hash';
          EventName['FILE_TRANSFORM'] = 'file:transform';
          // 生命周期事件
          EventName['UPLOADER_INITIALIZED'] = 'uploader:initialized';
          EventName['UPLOADER_DESTROYED'] = 'uploader:destroyed';
          // 文件操作事件
          EventName['FILE_ADDED'] = 'file:added';
          EventName['FILE_REMOVED'] = 'file:removed';
          EventName['FILES_ADDED'] = 'files:added';
        })(EventName || (EventName = {}));
        /**
         * 预定义的钩子类型
         */
        var HookType;
        (function (HookType) {
          // 文件处理钩子
          HookType['BEFORE_FILE_ADD'] = 'hook:before_file_add';
          HookType['AFTER_FILE_ADD'] = 'hook:after_file_add';
          HookType['BEFORE_FILE_REMOVE'] = 'hook:before_file_remove';
          // 上传钩子
          HookType['BEFORE_UPLOAD'] = 'hook:before_upload';
          HookType['AFTER_UPLOAD'] = 'hook:after_upload';
          HookType['BEFORE_PAUSE'] = 'hook:before_pause';
          HookType['BEFORE_RESUME'] = 'hook:before_resume';
          HookType['BEFORE_CANCEL'] = 'hook:before_cancel';
          // 分片钩子
          HookType['BEFORE_CHUNK_UPLOAD'] = 'hook:before_chunk_upload';
          HookType['AFTER_CHUNK_UPLOAD'] = 'hook:after_chunk_upload';
          // 错误处理钩子
          HookType['ON_ERROR'] = 'hook:on_error';
          HookType['BEFORE_RETRY'] = 'hook:before_retry';
        })(HookType || (HookType = {}));
        /**
         * 事件处理器超时错误
         */
        class HandlerTimeoutError extends Error {
          /**
           * 创建处理器超时错误
           *
           * @param event 事件名称
           * @param timeout 超时时间
           */
          constructor(event, timeout) {
            super(`事件处理器超时: ${event} (${timeout}ms)`);
            this.name = 'HandlerTimeoutError';
            this.eventName = event;
            this.timeout = timeout;
          }
        }
        /**
         * 事件处理器错误
         */
        class EventHandlerError extends Error {
          /**
           * 创建事件处理器错误
           *
           * @param event 事件名称
           * @param originalError 原始错误
           * @param handlerId 处理器ID
           */
          constructor(event, originalError, handlerId) {
            const idInfo = handlerId ? ` (处理器ID: ${handlerId})` : '';
            super(`事件处理器执行失败: ${event}${idInfo}`);
            this.name = 'EventHandlerError';
            this.originalError = originalError;
            this.eventName = event;
            this.handlerId = handlerId;
          }
        }

        /**
         * 错误类型定义
         * 包含上传错误和错误处理相关接口
         * @packageDocumentation
         */
        /**
         * 错误代码枚举
         * 定义所有可能的错误类型代码
         */
        var ErrorCode;
        (function (ErrorCode) {
          // 通用错误
          ErrorCode['UNKNOWN_ERROR'] = 'unknown_error';
          ErrorCode['NOT_IMPLEMENTED'] = 'not_implemented';
          ErrorCode['OPERATION_CANCELED'] = 'operation_canceled';
          ErrorCode['TIMEOUT'] = 'timeout';
          ErrorCode['INVALID_PARAMETER'] = 'invalid_parameter';
          // 文件错误
          ErrorCode['FILE_NOT_FOUND'] = 'file_not_found';
          ErrorCode['FILE_TOO_LARGE'] = 'file_too_large';
          ErrorCode['FILE_TYPE_NOT_ALLOWED'] = 'file_type_not_allowed';
          ErrorCode['FILE_EMPTY'] = 'file_empty';
          ErrorCode['FILE_CORRUPTED'] = 'file_corrupted';
          ErrorCode['FILE_READ_ERROR'] = 'file_read_error';
          // 网络错误
          ErrorCode['NETWORK_ERROR'] = 'network_error';
          ErrorCode['NETWORK_DISCONNECT'] = 'network_disconnect';
          ErrorCode['SERVER_ERROR'] = 'server_error';
          ErrorCode['SERVER_TIMEOUT'] = 'server_timeout';
          ErrorCode['SERVER_OVERLOAD'] = 'server_overload';
          ErrorCode['REQUEST_FAILED'] = 'request_failed';
          ErrorCode['RESPONSE_PARSE_ERROR'] = 'response_parse_error';
          // 分片错误
          ErrorCode['CHUNK_UPLOAD_FAILED'] = 'chunk_upload_failed';
          ErrorCode['CHUNK_SIZE_INVALID'] = 'chunk_size_invalid';
          ErrorCode['CHUNK_OUT_OF_RANGE'] = 'chunk_out_of_range';
          ErrorCode['INVALID_CHUNK_SIZE'] = 'invalid_chunk_size';
          // 存储错误
          ErrorCode['STORAGE_ERROR'] = 'storage_error';
          ErrorCode['STORAGE_FULL'] = 'storage_full';
          ErrorCode['QUOTA_EXCEEDED'] = 'quota_exceeded';
          ErrorCode['STORAGE_READ_ERROR'] = 'storage_read_error';
          ErrorCode['STORAGE_WRITE_ERROR'] = 'storage_write_error';
          // 插件错误
          ErrorCode['PLUGIN_ERROR'] = 'plugin_error';
          ErrorCode['PLUGIN_NOT_FOUND'] = 'plugin_not_found';
          ErrorCode['PLUGIN_INITIALIZATION_FAILED'] = 'plugin_initialization_failed';
          ErrorCode['PLUGIN_CONFLICT'] = 'plugin_conflict';
          // Worker错误
          ErrorCode['WORKER_ERROR'] = 'worker_error';
          ErrorCode['WORKER_NOT_SUPPORTED'] = 'worker_not_supported';
          ErrorCode['WORKER_TERMINATED'] = 'worker_terminated';
          ErrorCode['WORKER_TIMEOUT'] = 'worker_timeout';
          // 安全错误
          ErrorCode['SECURITY_ERROR'] = 'security_error';
          ErrorCode['AUTHENTICATION_FAILED'] = 'authentication_failed';
          ErrorCode['AUTHORIZATION_FAILED'] = 'authorization_failed';
          ErrorCode['TOKEN_EXPIRED'] = 'token_expired';
          ErrorCode['SIGNATURE_INVALID'] = 'signature_invalid';
        })(ErrorCode || (ErrorCode = {}));

        /**
         * 存储类型枚举
         */
        var StorageType;
        (function (StorageType) {
          /** 本地存储 */
          StorageType['LOCAL_STORAGE'] = 'localStorage';
          /** IndexedDB */
          StorageType['INDEXED_DB'] = 'indexedDB';
          /** 内存存储 */
          StorageType['MEMORY'] = 'memory';
          /** 会话存储 */
          StorageType['SESSION_STORAGE'] = 'sessionStorage';
          /** 自定义存储 */
          StorageType['CUSTOM'] = 'custom';
        })(StorageType || (StorageType = {}));

        /**
         * Worker相关类型定义
         * 包含Worker池和任务类型
         */
        /**
         * Worker任务类型枚举
         */
        var WorkerTaskType;
        (function (WorkerTaskType) {
          /** 哈希计算 */
          WorkerTaskType['HASH'] = 'hash';
          /** 分片创建 */
          WorkerTaskType['CHUNK'] = 'chunk';
          /** 内容扫描 */
          WorkerTaskType['SCAN'] = 'scan';
          /** 加密 */
          WorkerTaskType['ENCRYPT'] = 'encrypt';
          /** 解密 */
          WorkerTaskType['DECRYPT'] = 'decrypt';
          /** 压缩 */
          WorkerTaskType['COMPRESS'] = 'compress';
          /** 解压 */
          WorkerTaskType['DECOMPRESS'] = 'decompress';
          /** 图像处理 */
          WorkerTaskType['IMAGE'] = 'image';
        })(WorkerTaskType || (WorkerTaskType = {}));

        //# sourceMappingURL=index.esm.js.map

        /***/
      },

    /***/ './src/index.ts':
      /*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ ChunkStateManager: () =>
            /* reexport safe */ _resume_strategy__WEBPACK_IMPORTED_MODULE_1__.ChunkStateManager,
          /* harmony export */ ChunkStatus: () =>
            /* reexport safe */ _resume_strategy__WEBPACK_IMPORTED_MODULE_1__.ChunkStatus,
          /* harmony export */ IndexedDBAdapter: () =>
            /* reexport safe */ _storage__WEBPACK_IMPORTED_MODULE_0__.IndexedDBAdapter,
          /* harmony export */ MigrationHelper: () =>
            /* reexport safe */ _storage__WEBPACK_IMPORTED_MODULE_0__.MigrationHelper,
          /* harmony export */ MigrationStatus: () =>
            /* reexport safe */ _storage__WEBPACK_IMPORTED_MODULE_0__.MigrationStatus,
          /* harmony export */ PriorityManager: () =>
            /* reexport safe */ _storage__WEBPACK_IMPORTED_MODULE_0__.PriorityManager,
          /* harmony export */ ProgressCalculator: () =>
            /* reexport safe */ _resume_strategy__WEBPACK_IMPORTED_MODULE_1__.ProgressCalculator,
          /* harmony export */ ResumeUploadStrategy: () =>
            /* reexport safe */ _resume_strategy__WEBPACK_IMPORTED_MODULE_1__.ResumeUploadStrategy,
          /* harmony export */ SpaceCleanupEvent: () =>
            /* reexport safe */ _storage__WEBPACK_IMPORTED_MODULE_0__.SpaceCleanupEvent,
          /* harmony export */ SpaceManager: () =>
            /* reexport safe */ _storage__WEBPACK_IMPORTED_MODULE_0__.SpaceManager,
          /* harmony export */ StorageLogger: () =>
            /* reexport safe */ _storage__WEBPACK_IMPORTED_MODULE_0__.StorageLogger,
          /* harmony export */ StorageManager: () =>
            /* reexport safe */ _storage__WEBPACK_IMPORTED_MODULE_0__.StorageManager,
          /* harmony export */ StorageOperation: () =>
            /* reexport safe */ _storage__WEBPACK_IMPORTED_MODULE_0__.StorageOperation,
          /* harmony export */ UploadStateValidator: () =>
            /* reexport safe */ _resume_strategy__WEBPACK_IMPORTED_MODULE_1__.UploadStateValidator,
          /* harmony export */ compressData: () =>
            /* reexport safe */ _storage__WEBPACK_IMPORTED_MODULE_0__.compressData,
          /* harmony export */ decompressData: () =>
            /* reexport safe */ _storage__WEBPACK_IMPORTED_MODULE_0__.decompressData,
          /* harmony export */ isCompressionSupported: () =>
            /* reexport safe */ _storage__WEBPACK_IMPORTED_MODULE_0__.isCompressionSupported,
          /* harmony export */ resumable: () =>
            /* reexport safe */ _resume_strategy__WEBPACK_IMPORTED_MODULE_1__.resumable,
          /* harmony export */
        });
        /* harmony import */ var _storage__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(
          /*! ./storage */ './src/storage/index.ts',
        );
        /* harmony import */ var _resume_strategy__WEBPACK_IMPORTED_MODULE_1__ =
          __webpack_require__(/*! ./resume-strategy */ './src/resume-strategy/index.ts');
        /**
         * 断点续传功能包入口文件
         * 提供断点续传相关的存储管理和续传策略功能
         */
        // 导出所有存储相关组件

        // 导出续传策略相关组件

        /***/
      },

    /***/ './src/resume-strategy/chunk-state-manager.ts':
      /*!****************************************************!*\
  !*** ./src/resume-strategy/chunk-state-manager.ts ***!
  \****************************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ ChunkStateManager: () => /* binding */ ChunkStateManager,
          /* harmony export */
        });
        /* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(
          /*! ./types */ './src/resume-strategy/types.ts',
        );

        /**
         * 分片状态管理器类
         * 处理分片状态的变更、记录和追踪
         */
        class ChunkStateManager {
          /**
           * 创建分片状态管理器
           * @param maxConcurrentChunks 最大并发分片数
           * @param logger 日志记录器
           */
          constructor(maxConcurrentChunks = 3, logger) {
            /** 当前活跃的上传分片映射 fileId -> Set<chunkIndex> */
            this.activeChunksMap = new Map();
            this.maxConcurrentChunks = maxConcurrentChunks;
            this.logger = logger;
          }
          /**
           * 获取指定文件的当前活跃上传分片数
           * @param fileId 文件ID
           * @returns 活跃上传分片数
           */
          getActiveChunksCount(fileId) {
            return this.activeChunksMap.get(fileId)?.size || 0;
          }
          /**
           * 检查是否可以上传新的分片（并发控制）
           * @param fileId 文件ID
           * @returns 是否可以上传新分片
           */
          canUploadMoreChunks(fileId) {
            const activeChunks = this.activeChunksMap.get(fileId);
            if (!activeChunks) {
              return true;
            }
            return activeChunks.size < this.maxConcurrentChunks;
          }
          /**
           * 标记分片开始上传
           * @param fileId 文件ID
           * @param chunkIndex 分片索引
           */
          markChunkAsUploading(fileId, chunkIndex) {
            // 确保文件ID在映射中存在
            if (!this.activeChunksMap.has(fileId)) {
              this.activeChunksMap.set(fileId, new Set());
            }
            // 添加分片到活跃集合
            this.activeChunksMap.get(fileId)?.add(chunkIndex);
            this.logDebug(`已标记分片为上传中 [文件:${fileId}, 分片:${chunkIndex}]`);
          }
          /**
           * 标记分片上传完成
           * @param fileId 文件ID
           * @param chunkIndex 分片索引
           */
          markChunkAsComplete(fileId, chunkIndex) {
            // 从活跃集合中移除分片
            this.activeChunksMap.get(fileId)?.delete(chunkIndex);
            this.logDebug(`已标记分片为完成 [文件:${fileId}, 分片:${chunkIndex}]`);
          }
          /**
           * 标记分片上传失败
           * @param fileId 文件ID
           * @param chunkIndex 分片索引
           */
          markChunkAsFailed(fileId, chunkIndex) {
            // 从活跃集合中移除分片
            this.activeChunksMap.get(fileId)?.delete(chunkIndex);
            this.logDebug(`已标记分片为失败 [文件:${fileId}, 分片:${chunkIndex}]`);
          }
          /**
           * 标记分片为已暂停
           * @param fileId 文件ID
           * @param chunkIndex 分片索引
           */
          markChunkAsPaused(fileId, chunkIndex) {
            // 从活跃集合中移除分片
            this.activeChunksMap.get(fileId)?.delete(chunkIndex);
            this.logDebug(`已标记分片为暂停 [文件:${fileId}, 分片:${chunkIndex}]`);
          }
          /**
           * 重置文件的活跃分片状态
           * @param fileId 文件ID
           */
          resetActiveChunks(fileId) {
            this.activeChunksMap.delete(fileId);
            this.logDebug(`已重置文件的活跃分片状态 [文件:${fileId}]`);
          }
          /**
           * 获取所有活跃分片的索引
           * @param fileId 文件ID
           * @returns 活跃分片索引数组
           */
          getActiveChunks(fileId) {
            const activeChunks = this.activeChunksMap.get(fileId);
            if (!activeChunks) {
              return [];
            }
            return Array.from(activeChunks);
          }
          /**
           * 检查分片是否处于活跃状态
           * @param fileId 文件ID
           * @param chunkIndex 分片索引
           * @returns 是否活跃
           */
          isChunkActive(fileId, chunkIndex) {
            return this.activeChunksMap.get(fileId)?.has(chunkIndex) || false;
          }
          /**
           * 更新分片信息
           * @param chunksDetails 当前分片详情
           * @param chunkIndex 要更新的分片索引
           * @param status 新的分片状态
           * @param error 错误信息（可选）
           * @returns 更新后的分片详情
           */
          updateChunkInfo(chunksDetails, chunkIndex, status, error) {
            // 复制一份分片详情数组
            const updatedChunks = [...chunksDetails];
            const now = Date.now();
            // 查找要更新的分片
            const chunkToUpdate = updatedChunks.find(chunk => chunk.index === chunkIndex);
            if (chunkToUpdate) {
              // 更新现有分片信息
              chunkToUpdate.status = status;
              chunkToUpdate.lastAttempt = now;
              // 如果是失败状态且提供了错误信息，则更新错误信息
              if (status === _types__WEBPACK_IMPORTED_MODULE_0__.ChunkStatus.FAILED && error) {
                chunkToUpdate.lastError = error;
                chunkToUpdate.retryCount += 1;
              }
              // 如果是成功状态，清除错误信息
              if (status === _types__WEBPACK_IMPORTED_MODULE_0__.ChunkStatus.SUCCESS) {
                chunkToUpdate.lastError = undefined;
              }
            } else {
              // 如果分片不存在于数组中，添加新的分片信息
              updatedChunks.push({
                index: chunkIndex,
                status,
                retryCount:
                  status === _types__WEBPACK_IMPORTED_MODULE_0__.ChunkStatus.FAILED ? 1 : 0,
                lastAttempt: now,
                lastError:
                  status === _types__WEBPACK_IMPORTED_MODULE_0__.ChunkStatus.FAILED
                    ? error
                    : undefined,
              });
            }
            return updatedChunks;
          }
          /**
           * 清理所有资源
           */
          destroy() {
            this.activeChunksMap.clear();
            this.logDebug('分片状态管理器已销毁');
          }
          /**
           * 记录调试日志
           * @param message 日志消息
           * @param data 额外数据
           */
          logDebug(message, data) {
            if (this.logger?.debug) {
              this.logger.debug(`[ChunkStateManager] ${message}`, data);
            }
          }
        }

        /***/
      },

    /***/ './src/resume-strategy/index.ts':
      /*!**************************************!*\
  !*** ./src/resume-strategy/index.ts ***!
  \**************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ ChunkStateManager: () =>
            /* reexport safe */ _chunk_state_manager__WEBPACK_IMPORTED_MODULE_1__.ChunkStateManager,
          /* harmony export */ ChunkStatus: () =>
            /* reexport safe */ _types__WEBPACK_IMPORTED_MODULE_4__.ChunkStatus,
          /* harmony export */ ProgressCalculator: () =>
            /* reexport safe */ _progress_calculator__WEBPACK_IMPORTED_MODULE_3__.ProgressCalculator,
          /* harmony export */ ResumeUploadStrategy: () =>
            /* reexport safe */ _resume_upload_strategy__WEBPACK_IMPORTED_MODULE_0__.ResumeUploadStrategy,
          /* harmony export */ UploadStateValidator: () =>
            /* reexport safe */ _upload_state_validator__WEBPACK_IMPORTED_MODULE_2__.UploadStateValidator,
          /* harmony export */ resumable: () => /* binding */ resumable,
          /* harmony export */
        });
        /* harmony import */ var _resume_upload_strategy__WEBPACK_IMPORTED_MODULE_0__ =
          __webpack_require__(
            /*! ./resume-upload-strategy */ './src/resume-strategy/resume-upload-strategy.ts',
          );
        /* harmony import */ var _chunk_state_manager__WEBPACK_IMPORTED_MODULE_1__ =
          __webpack_require__(
            /*! ./chunk-state-manager */ './src/resume-strategy/chunk-state-manager.ts',
          );
        /* harmony import */ var _upload_state_validator__WEBPACK_IMPORTED_MODULE_2__ =
          __webpack_require__(
            /*! ./upload-state-validator */ './src/resume-strategy/upload-state-validator.ts',
          );
        /* harmony import */ var _progress_calculator__WEBPACK_IMPORTED_MODULE_3__ =
          __webpack_require__(
            /*! ./progress-calculator */ './src/resume-strategy/progress-calculator.ts',
          );
        /* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(
          /*! ./types */ './src/resume-strategy/types.ts',
        );
        /**
         * 断点续传策略索引文件
         * 导出断点续传相关组件
         */
        // 导出组件

        // 导入实现

        /**
         * 创建并返回一个续传策略插件
         * @param options 续传策略选项
         * @returns 续传策略插件
         */
        const resumable = options => {
          return {
            name: 'resumable',
            version: '1.0.0',
            install: (uploader, opts) => {
              const finalOptions = {
                maxConcurrentChunks: 3, // 默认并发数
                cleanupInterval: 24 * 60 * 60 * 1000, // 默认每天清理一次
                ...options,
                ...opts,
              };
              const resumeStrategy =
                new _resume_upload_strategy__WEBPACK_IMPORTED_MODULE_0__.ResumeUploadStrategy(
                  finalOptions,
                );
              // 设置事件发射器
              resumeStrategy.setEventEmitter(uploader.eventEmitter);
              // 注册钩子
              uploader.hooks.beforeUpload.register(async file => {
                // 检查文件是否可以续传
                const resumeState = await resumeStrategy.checkResumable(file);
                if (resumeState) {
                  // 将续传状态附加到文件上下文
                  file._resumeState = resumeState;
                  // 获取分片详细状态统计
                  const stats = await resumeStrategy.getUploadStats(file.id);
                  // 触发续传状态事件
                  uploader.eventEmitter.emit('resume:detected', {
                    fileId: file.id,
                    fileName: file.name,
                    progress: resumeState.progress.percent,
                    uploadedChunks: resumeState.uploadedChunks.length,
                    totalChunks: resumeState.totalChunks,
                    uploaded: stats.uploaded,
                    failed: stats.failed,
                    pending: stats.pending,
                    uploading: stats.uploading,
                    estimatedTimeRemaining: stats.estimatedTimeRemaining,
                  });
                }
                return file;
              });
              // 注册分片处理钩子
              uploader.hooks.beforeChunkUpload.register(async params => {
                const { file, chunks } = params;
                if (file._resumeState) {
                  // 获取需要上传的分片
                  const pendingChunks = await resumeStrategy.getPendingChunks(
                    file.id,
                    chunks.length,
                  );
                  params._pendingChunks = pendingChunks;
                  // 添加并发控制
                  if (!resumeStrategy.canUploadMoreChunks(file.id)) {
                    // 如果当前活跃分片数已达到最大并发数，暂停此分片
                    params._shouldSkip = true;
                    // 发送并发限制事件
                    uploader.eventEmitter.emit('resume:concurrency_limit', {
                      fileId: file.id,
                      activeChunks: resumeStrategy.getActiveChunksCount(file.id),
                      maxConcurrentChunks: finalOptions.maxConcurrentChunks,
                    });
                  }
                }
                return params;
              });
              // 注册分片开始上传钩子
              uploader.hooks.beforeChunkRequest?.register(async params => {
                const { file, chunkIndex } = params;
                // 标记分片开始上传
                resumeStrategy.markChunkAsUploading(file.id, chunkIndex);
                // 发送分片开始上传事件
                uploader.eventEmitter.emit('resume:chunk_start', {
                  fileId: file.id,
                  chunkIndex,
                  activeChunks: resumeStrategy.getActiveChunksCount(file.id),
                });
                return params;
              });
              // 注册分片上传成功钩子
              uploader.hooks.afterChunkUpload.register(async result => {
                const { file, chunkIndex } = result;
                // 标记分片完成（这个方法内部会更新上传状态，不需要再调用updateUploadedChunk）
                await resumeStrategy.markChunkAsComplete(file.id, chunkIndex);
                // 获取最新状态
                const stats = await resumeStrategy.getUploadStats(file.id);
                // 发送分片完成事件
                uploader.eventEmitter.emit('resume:chunk_complete', {
                  fileId: file.id,
                  chunkIndex,
                  remainingChunks: stats.total - stats.uploaded,
                  uploaded: stats.uploaded,
                  total: stats.total,
                  progress: stats.progress,
                });
                return result;
              });
              // 注册分片上传失败钩子
              uploader.hooks.onChunkError?.register(async error => {
                const { file, chunkIndex, error: errorInfo } = error;
                // 标记分片失败
                resumeStrategy.markChunkAsFailed(file.id, chunkIndex, errorInfo?.message);
                // 发送分片失败事件
                uploader.eventEmitter.emit('resume:chunk_failed', {
                  fileId: file.id,
                  chunkIndex,
                  error: errorInfo?.message || '未知错误',
                });
                return error;
              });
              // 注册上传完成钩子
              uploader.hooks.afterUpload.register(async result => {
                const { file } = result;
                // 清理存储
                await resumeStrategy.completeUpload(file.id);
                // 发送存储清理事件
                uploader.eventEmitter.emit('resume:storage_cleared', {
                  fileId: file.id,
                  fileName: file.name,
                });
                return result;
              });
              // 注册上传暂停钩子
              uploader.hooks.onPause?.register(async file => {
                if (!file) return file;
                try {
                  // 获取当前分片状态并更新所有正在上传的分片为暂停状态
                  const chunksDetails = await resumeStrategy.getChunksDetails(file.id);
                  for (const chunk of chunksDetails) {
                    if (
                      chunk.status === _types__WEBPACK_IMPORTED_MODULE_4__.ChunkStatus.UPLOADING
                    ) {
                      await resumeStrategy.updateChunkStatus(
                        file.id,
                        chunk.index,
                        _types__WEBPACK_IMPORTED_MODULE_4__.ChunkStatus.PAUSED,
                      );
                    }
                  }
                  // 发送暂停事件
                  uploader.eventEmitter.emit('resume:paused', {
                    fileId: file.id,
                    fileName: file.name,
                  });
                } catch (error) {
                  console.error('暂停上传时出错', error);
                }
                return file;
              });
              // 添加获取上传状态方法
              uploader.getUploadStats = async fileId => {
                return resumeStrategy.getUploadStats(fileId);
              };
              // 添加获取分片详情方法
              uploader.getChunksDetails = async fileId => {
                return resumeStrategy.getChunksDetails(fileId);
              };
              // 向上传器添加resumeStrategy引用，以便在需要时直接访问
              uploader.resumeStrategy = resumeStrategy;
            },
            // 清理资源
            cleanup: uploader => {
              if (uploader.resumeStrategy) {
                uploader.resumeStrategy.destroy();
                delete uploader.resumeStrategy;
                delete uploader.getUploadStats;
                delete uploader.getChunksDetails;
              }
            },
          };
        };

        /***/
      },

    /***/ './src/resume-strategy/progress-calculator.ts':
      /*!****************************************************!*\
  !*** ./src/resume-strategy/progress-calculator.ts ***!
  \****************************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ ProgressCalculator: () => /* binding */ ProgressCalculator,
          /* harmony export */
        });
        /* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(
          /*! ./types */ './src/resume-strategy/types.ts',
        );

        /**
         * 上传进度计算器类
         * 提供各种进度计算和统计功能
         */
        class ProgressCalculator {
          /**
           * 创建进度计算器
           * @param logger 日志记录器
           */
          constructor(logger) {
            this.logger = logger;
          }
          /**
           * 计算上传进度
           * @param fileId 文件ID
           * @param fileSize 文件大小（字节）
           * @param chunkSize 分片大小（字节）
           * @param uploadedChunks 已上传分片索引数组
           * @returns 上传进度信息和分片统计
           */
          calculateProgress(fileId, fileSize, chunkSize, uploadedChunks) {
            // 计算总分片数
            const totalChunks = Math.ceil(fileSize / chunkSize);
            // 计算已上传字节数（处理最后一个分片可能不完整的情况）
            let uploadedBytes = 0;
            uploadedChunks.forEach(chunkIndex => {
              // 最后一个分片可能小于chunkSize
              if (chunkIndex === totalChunks - 1) {
                const lastChunkSize = fileSize % chunkSize || chunkSize;
                uploadedBytes += lastChunkSize;
              } else {
                uploadedBytes += chunkSize;
              }
            });
            // 计算进度百分比，确保不超过100%
            const percent = Math.min(100, Math.floor((uploadedBytes / fileSize) * 100));
            this.logDebug(
              `计算上传进度 [文件:${fileId}] ${percent}% (${uploadedBytes}/${fileSize}字节)`,
            );
            return {
              loaded: uploadedBytes,
              total: fileSize,
              percent,
              speed: 0,
              timeElapsed: 0,
              timeRemaining: 0,
              totalChunks,
              uploadedChunks: uploadedChunks.length,
            };
          }
          /**
           * 获取分片统计信息
           * @param chunksDetails 分片详情数组
           * @param totalChunks 总分片数
           * @returns 统计信息
           */
          getUploadStats(chunksDetails, totalChunks) {
            // 初始化统计数据
            const stats = {
              total: totalChunks,
              uploaded: 0,
              failed: 0,
              pending: 0,
              uploading: 0,
              progress: 0,
            };
            // 如果没有分片详情，假设所有分片都是待处理状态
            if (!chunksDetails || chunksDetails.length === 0) {
              stats.pending = totalChunks;
              return stats;
            }
            // 统计各状态分片数量
            chunksDetails.forEach(chunk => {
              switch (chunk.status) {
                case _types__WEBPACK_IMPORTED_MODULE_0__.ChunkStatus.SUCCESS:
                  stats.uploaded++;
                  break;
                case _types__WEBPACK_IMPORTED_MODULE_0__.ChunkStatus.FAILED:
                  stats.failed++;
                  break;
                case _types__WEBPACK_IMPORTED_MODULE_0__.ChunkStatus.UPLOADING:
                  stats.uploading++;
                  break;
                case _types__WEBPACK_IMPORTED_MODULE_0__.ChunkStatus.PENDING:
                case _types__WEBPACK_IMPORTED_MODULE_0__.ChunkStatus.PAUSED:
                default:
                  stats.pending++;
                  break;
              }
            });
            // 计算整体进度百分比
            stats.progress = totalChunks > 0 ? Math.floor((stats.uploaded / totalChunks) * 100) : 0;
            // 确保待处理分片数量正确（考虑可能有些分片还没有添加到详情中）
            const accountedChunks = stats.uploaded + stats.failed + stats.uploading + stats.pending;
            if (accountedChunks < totalChunks) {
              stats.pending += totalChunks - accountedChunks;
            }
            return stats;
          }
          /**
           * 估算剩余上传时间
           * @param uploadStats 上传统计信息
           * @param uploadSpeed 当前上传速度（字节/秒）
           * @param chunkSize 分片大小（字节）
           * @returns 估计剩余时间（秒）
           */
          estimateRemainingTime(uploadStats, uploadSpeed, chunkSize) {
            // 如果没有速度数据或已完成，返回undefined
            if (!uploadSpeed || uploadSpeed <= 0 || uploadStats.progress >= 100) {
              return undefined;
            }
            // 计算剩余分片数
            const remainingChunks = uploadStats.total - uploadStats.uploaded;
            if (remainingChunks <= 0) {
              return 0;
            }
            // 计算剩余字节数（简化计算，假设所有分片大小相同）
            const remainingBytes = remainingChunks * chunkSize;
            // 计算剩余时间（秒）
            const remainingTimeSeconds = Math.ceil(remainingBytes / uploadSpeed);
            this.logDebug(
              `估计剩余时间: ${remainingTimeSeconds}秒 (速度: ${this.formatSpeed(uploadSpeed)})`,
            );
            return remainingTimeSeconds;
          }
          /**
           * 格式化上传速度为人类可读格式
           * @param bytesPerSecond 每秒字节数
           * @returns 格式化后的速度字符串
           */
          formatSpeed(bytesPerSecond) {
            if (bytesPerSecond >= 1024 * 1024) {
              return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`;
            } else if (bytesPerSecond >= 1024) {
              return `${(bytesPerSecond / 1024).toFixed(2)} KB/s`;
            } else {
              return `${Math.round(bytesPerSecond)} B/s`;
            }
          }
          /**
           * 记录调试日志
           * @param message 日志消息
           * @param data 额外数据
           */
          logDebug(message, data) {
            if (this.logger?.debug) {
              this.logger.debug(`[ProgressCalculator] ${message}`, data);
            }
          }
        }

        /***/
      },

    /***/ './src/resume-strategy/resume-upload-strategy.ts':
      /*!*******************************************************!*\
  !*** ./src/resume-strategy/resume-upload-strategy.ts ***!
  \*******************************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ ResumeUploadStrategy: () => /* binding */ ResumeUploadStrategy,
          /* harmony export */
        });
        /* harmony import */ var _file_chunk_uploader_types__WEBPACK_IMPORTED_MODULE_0__ =
          __webpack_require__(/*! @file-chunk-uploader/types */ '../types/dist/index.esm.js');
        /* harmony import */ var _storage__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(
          /*! ../storage */ './src/storage/index.ts',
        );
        /* harmony import */ var _chunk_state_manager__WEBPACK_IMPORTED_MODULE_2__ =
          __webpack_require__(
            /*! ./chunk-state-manager */ './src/resume-strategy/chunk-state-manager.ts',
          );
        /* harmony import */ var _progress_calculator__WEBPACK_IMPORTED_MODULE_3__ =
          __webpack_require__(
            /*! ./progress-calculator */ './src/resume-strategy/progress-calculator.ts',
          );
        /* harmony import */ var _types__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(
          /*! ./types */ './src/resume-strategy/types.ts',
        );
        /* harmony import */ var _upload_state_validator__WEBPACK_IMPORTED_MODULE_5__ =
          __webpack_require__(
            /*! ./upload-state-validator */ './src/resume-strategy/upload-state-validator.ts',
          );
        /**
         * 断点续传策略实现
         * 负责实现上传状态保存、断点检测和恢复逻辑
         */

        /**
         * 续传上传策略类
         * 实现断点续传功能，包括状态保存、断点检测和恢复逻辑
         */
        class ResumeUploadStrategy {
          /**
           * 创建续传策略实例
           * @param options 续传策略配置选项
           */
          constructor(options = {}) {
            // 设置默认选项
            this.options = {
              storage: options.storage || {},
              enabled: options.enabled !== false,
              maxStorageTime: options.maxStorageTime || 7 * 24 * 60 * 60 * 1000, // 默认7天
              maxConcurrentChunks: options.maxConcurrentChunks || 3, // 默认并发3个分片
              visualizationCallback: options.visualizationCallback,
              cleanupInterval: options.cleanupInterval || 24 * 60 * 60 * 1000, // 默认每天清理一次
              logger: options.logger,
            };
            this.enabled = this.options.enabled;
            this.logger = this.options.logger;
            // 创建存储管理器
            this.storageManager = new _storage__WEBPACK_IMPORTED_MODULE_1__.StorageManager(
              this.options.storage,
            );
            // 创建分片状态管理器
            this.chunkStateManager =
              new _chunk_state_manager__WEBPACK_IMPORTED_MODULE_2__.ChunkStateManager(
                this.options.maxConcurrentChunks,
                this.logger,
              );
            // 创建上传状态验证器
            this.uploadStateValidator =
              new _upload_state_validator__WEBPACK_IMPORTED_MODULE_5__.UploadStateValidator();
            // 创建进度计算器
            this.progressCalculator =
              new _progress_calculator__WEBPACK_IMPORTED_MODULE_3__.ProgressCalculator(this.logger);
            // 定期清理过期数据
            this.scheduleCleanup();
          }
          /**
           * 销毁实例，清理资源
           * 在组件销毁或不再需要时必须调用此方法，防止内存泄漏
           */
          destroy() {
            // 清理定时器，防止内存泄漏
            if (this.cleanupTimer) {
              clearInterval(this.cleanupTimer);
              this.cleanupTimer = undefined;
            }
            // 清理分片状态管理器
            this.chunkStateManager.destroy();
            // 解除事件发射器引用
            this.eventEmitter = undefined;
            this.logInfo('续传策略实例已销毁，资源已释放');
          }
          /**
           * 设置事件发射器
           * @param emitter 事件发射器实例
           */
          setEventEmitter(emitter) {
            this.eventEmitter = emitter;
          }
          /**
           * 启用或禁用断点续传
           * @param enabled 是否启用
           */
          setEnabled(enabled) {
            this.enabled = enabled;
          }
          /**
           * 获取指定文件的当前活跃上传分片数
           * @param fileId 文件ID
           * @returns 活跃上传分片数
           */
          getActiveChunksCount(fileId) {
            return this.chunkStateManager.getActiveChunksCount(fileId);
          }
          /**
           * 检查是否可以上传新的分片（并发控制）
           * @param fileId 文件ID
           * @returns 是否可以上传新分片
           */
          canUploadMoreChunks(fileId) {
            return this.chunkStateManager.canUploadMoreChunks(fileId);
          }
          /**
           * 标记分片开始上传
           * @param fileId 文件ID
           * @param chunkIndex 分片索引
           */
          markChunkAsUploading(fileId, chunkIndex) {
            this.chunkStateManager.markChunkAsUploading(fileId, chunkIndex);
          }
          /**
           * 标记分片上传完成
           * @param fileId 文件ID
           * @param chunkIndex 分片索引
           */
          async markChunkAsComplete(fileId, chunkIndex) {
            // 更新分片状态管理器
            this.chunkStateManager.markChunkAsComplete(fileId, chunkIndex);
            // 更新上传状态
            await this.updateUploadedChunk(fileId, chunkIndex);
          }
          /**
           * 标记分片上传失败
           * @param fileId 文件ID
           * @param chunkIndex 分片索引
           * @param error 错误信息
           */
          markChunkAsFailed(fileId, chunkIndex, error) {
            // 更新分片状态管理器
            this.chunkStateManager.markChunkAsFailed(fileId, chunkIndex);
            // 更新分片状态
            this.updateChunkStatus(
              fileId,
              chunkIndex,
              _types__WEBPACK_IMPORTED_MODULE_4__.ChunkStatus.FAILED,
              error,
            );
          }
          /**
           * 更新分片状态
           * @param fileId 文件ID
           * @param chunkIndex 分片索引
           * @param status 分片状态
           * @param error 错误信息
           */
          async updateChunkStatus(fileId, chunkIndex, status, error) {
            try {
              // 获取存储的上传状态
              const state = await this.storageManager.getUploadState(fileId);
              if (!state) {
                this.logDebug(
                  `未找到上传状态，无法更新分片状态 [文件:${fileId}, 分片:${chunkIndex}]`,
                );
                return;
              }
              // 转换为扩展上传状态
              const extendedState = state;
              if (!extendedState.chunksDetails) {
                extendedState.chunksDetails = [];
              }
              // 更新分片状态
              extendedState.chunksDetails = this.chunkStateManager.updateChunkInfo(
                extendedState.chunksDetails,
                chunkIndex,
                status,
                error,
              );
              // 更新上传状态
              extendedState.lastUpdated = Date.now();
              // 保存更新后的状态
              await this.storageManager.saveUploadState(fileId, extendedState);
              // 更新UI可视化（如果提供了回调）
              this.updateVisualization(fileId, extendedState.chunksDetails);
              this.logDebug(`已更新分片状态 [文件:${fileId}, 分片:${chunkIndex}, 状态:${status}]`);
            } catch (error) {
              this.logError(`更新分片状态失败 [文件:${fileId}, 分片:${chunkIndex}]`, error);
            }
          }
          /**
           * 检查文件是否可以断点续传
           * @param fileInfo 文件信息
           * @returns 上传状态或null（如果不可续传）
           */
          async checkResumable(fileInfo) {
            if (!this.enabled) {
              this.logDebug(`断点续传已禁用，跳过检查 [文件:${fileInfo.id}]`);
              return null;
            }
            try {
              // 从存储中获取上传状态
              const state = await this.storageManager.getUploadState(fileInfo.id);
              if (!state) {
                this.logDebug(`未找到上传状态 [文件:${fileInfo.id}]`);
                return null;
              }
              // 验证上传状态
              const validationResult = this.uploadStateValidator.validateUploadState(
                state,
                fileInfo,
              );
              if (!validationResult.valid) {
                this.logDebug(
                  `上传状态验证失败 [文件:${fileInfo.id}]: ${validationResult.reason}`,
                  validationResult.details,
                );
                return null;
              }
              // 转换为扩展上传状态
              const extendedState = state;
              if (!extendedState.chunksDetails) {
                extendedState.chunksDetails = [];
              }
              // 更新并发配置
              extendedState.maxConcurrentChunks = this.options.maxConcurrentChunks;
              // 重置活跃分片状态
              this.chunkStateManager.resetActiveChunks(fileInfo.id);
              // 重置所有处于上传中状态的分片为暂停状态
              const updatedChunksDetails = extendedState.chunksDetails.map(chunk => {
                if (chunk.status === _types__WEBPACK_IMPORTED_MODULE_4__.ChunkStatus.UPLOADING) {
                  return {
                    ...chunk,
                    status: _types__WEBPACK_IMPORTED_MODULE_4__.ChunkStatus.PAUSED,
                  };
                }
                return chunk;
              });
              extendedState.chunksDetails = updatedChunksDetails;
              // 更新上传状态，标记为已恢复
              extendedState.status =
                _file_chunk_uploader_types__WEBPACK_IMPORTED_MODULE_0__.UploadStatus.UPLOADING;
              extendedState.lastUpdated = Date.now();
              // 保存更新后的状态
              await this.storageManager.saveUploadState(fileInfo.id, extendedState);
              // 更新UI可视化
              this.updateVisualization(fileInfo.id, updatedChunksDetails);
              this.logInfo(`找到可续传的上传状态 [文件:${fileInfo.id}]`, {
                uploadedChunks: extendedState.uploadedChunks.length,
                totalChunks: extendedState.totalChunks,
                progress: extendedState.progress.percent,
              });
              return extendedState;
            } catch (error) {
              this.logError(`检查续传状态失败 [文件:${fileInfo.id}]`, error);
              return null;
            }
          }
          /**
           * 保存上传状态
           * @param fileInfo 文件信息
           * @param chunkResult 分片结果
           * @param uploadedChunks 已上传分片索引数组
           * @param status 上传状态
           * @param progress 上传进度
           */
          async saveUploadState(
            fileInfo,
            chunkResult,
            uploadedChunks,
            status = _file_chunk_uploader_types__WEBPACK_IMPORTED_MODULE_0__.UploadStatus.UPLOADING,
            progress,
          ) {
            if (!this.enabled) {
              return;
            }
            try {
              // 获取现有状态或创建新状态
              const state = (await this.storageManager.getUploadState(fileInfo.id)) || {};
              // 获取分片详情
              const chunksDetails = state.chunksDetails || [];
              // 如果没有提供进度信息，计算进度
              if (!progress) {
                progress = this.progressCalculator.calculateProgress(
                  fileInfo.id,
                  fileInfo.size,
                  chunkResult.chunkSize,
                  uploadedChunks,
                );
              }
              // 更新上传状态
              const updatedState = {
                ...state,
                fileId: fileInfo.id,
                fileName: fileInfo.name,
                fileSize: fileInfo.size,
                lastModified: fileInfo.lastModified,
                uploadedChunks,
                totalChunks: Math.ceil(fileInfo.size / chunkResult.chunkSize),
                chunkSize: chunkResult.chunkSize,
                progress,
                status,
                lastUpdated: Date.now(),
                chunksDetails,
                maxConcurrentChunks: this.options.maxConcurrentChunks,
              };
              // 保存状态到存储
              await this.storageManager.saveUploadState(fileInfo.id, updatedState);
              // 更新UI可视化
              this.updateVisualization(fileInfo.id, chunksDetails);
              this.logDebug(`已保存上传状态 [文件:${fileInfo.id}]`, {
                progress: progress.percent,
                uploadedChunks: uploadedChunks.length,
                totalChunks: Math.ceil(fileInfo.size / chunkResult.chunkSize),
              });
            } catch (error) {
              this.logError(`保存上传状态失败 [文件:${fileInfo.id}]`, error);
            }
          }
          /**
           * 更新已上传的分片信息
           * @param fileId 文件ID
           * @param chunkIndex 分片索引
           */
          async updateUploadedChunk(fileId, chunkIndex) {
            if (!this.enabled) {
              return;
            }
            try {
              // 获取上传状态
              const state = await this.storageManager.getUploadState(fileId);
              if (!state) {
                this.logDebug(`未找到上传状态，无法更新分片 [文件:${fileId}, 分片:${chunkIndex}]`);
                return;
              }
              // 检查分片是否已经标记为已上传
              const uploadedChunks = state.uploadedChunks || [];
              if (uploadedChunks.includes(chunkIndex)) {
                return; // 分片已经标记为已上传，不需要再次更新
              }
              // 添加分片到已上传列表
              uploadedChunks.push(chunkIndex);
              // 更新分片状态
              const extendedState = state;
              if (!extendedState.chunksDetails) {
                extendedState.chunksDetails = [];
              }
              // 更新分片状态为成功
              extendedState.chunksDetails = this.chunkStateManager.updateChunkInfo(
                extendedState.chunksDetails,
                chunkIndex,
                _types__WEBPACK_IMPORTED_MODULE_4__.ChunkStatus.SUCCESS,
              );
              // 更新进度
              const progress = this.progressCalculator.calculateProgress(
                fileId,
                state.fileSize,
                state.chunkSize,
                uploadedChunks,
              );
              // 更新状态
              extendedState.uploadedChunks = uploadedChunks;
              extendedState.progress = progress;
              extendedState.lastUpdated = Date.now();
              // 保存更新后的状态
              await this.storageManager.saveUploadState(fileId, extendedState);
              // 更新UI可视化
              this.updateVisualization(fileId, extendedState.chunksDetails);
              this.logDebug(`已更新上传分片 [文件:${fileId}, 分片:${chunkIndex}]`, {
                progress: progress.percent,
                uploadedChunks: uploadedChunks.length,
                totalChunks: Math.ceil(state.fileSize / state.chunkSize),
              });
            } catch (error) {
              this.logError(`更新上传分片失败 [文件:${fileId}, 分片:${chunkIndex}]`, error);
            }
          }
          /**
           * 完成上传，清理状态
           * @param fileId 文件ID
           */
          async completeUpload(fileId) {
            try {
              // 清理分片状态管理器中的记录
              this.chunkStateManager.resetActiveChunks(fileId);
              // 清理存储中的上传状态
              await this.storageManager.deleteFile(fileId);
              this.logInfo(`已完成上传并清理状态 [文件:${fileId}]`);
            } catch (error) {
              this.logError(`完成上传清理状态失败 [文件:${fileId}]`, error);
            }
          }
          /**
           * 获取待上传的分片
           * @param fileId 文件ID
           * @param totalChunks 总分片数
           * @returns 待上传分片索引数组
           */
          async getPendingChunks(fileId, totalChunks) {
            if (!this.enabled) {
              // 如果断点续传禁用，返回所有分片
              return Array.from({ length: totalChunks }, (_, i) => i);
            }
            try {
              // 获取上传状态
              const state = await this.storageManager.getUploadState(fileId);
              if (!state || !state.uploadedChunks) {
                // 如果没有找到上传状态或没有已上传分片记录，返回所有分片
                return Array.from({ length: totalChunks }, (_, i) => i);
              }
              // 获取已上传的分片
              const uploadedChunks = state.uploadedChunks;
              // 计算待上传的分片（所有分片索引中排除已上传的）
              const pendingChunks = [];
              for (let i = 0; i < totalChunks; i++) {
                if (!uploadedChunks.includes(i)) {
                  pendingChunks.push(i);
                }
              }
              this.logDebug(`获取待上传分片 [文件:${fileId}]`, {
                pendingChunks: pendingChunks.length,
                uploadedChunks: uploadedChunks.length,
                totalChunks,
              });
              return pendingChunks;
            } catch (error) {
              this.logError(`获取待上传分片失败 [文件:${fileId}]`, error);
              // 出错时返回所有分片
              return Array.from({ length: totalChunks }, (_, i) => i);
            }
          }
          /**
           * 获取分片详情
           * @param fileId 文件ID
           * @returns 分片详情数组
           */
          async getChunksDetails(fileId) {
            try {
              // 获取上传状态
              const state = await this.storageManager.getUploadState(fileId);
              if (!state || !state.chunksDetails) {
                return [];
              }
              return state.chunksDetails;
            } catch (error) {
              this.logError(`获取分片详情失败 [文件:${fileId}]`, error);
              return [];
            }
          }
          /**
           * 配置上传器
           * @param config 上传配置
           * @returns 更新后的配置
           */
          configureUploader(config) {
            // 使用类型断言解决类型问题
            const updatedConfig = {
              ...config,
              storage: {
                ...(config.storage || {}),
              },
            };
            return updatedConfig;
          }
          /**
           * 转换存储类型
           * @param type 存储类型
           * @returns 转换后的存储类型
           */
          convertStorageType(type) {
            return type;
          }
          /**
           * 获取上传统计信息
           * @param fileId 文件ID
           * @returns 上传统计信息
           */
          async getUploadStats(fileId) {
            try {
              // 获取上传状态
              const state = await this.storageManager.getUploadState(fileId);
              if (!state) {
                return {
                  total: 0,
                  uploaded: 0,
                  failed: 0,
                  pending: 0,
                  uploading: 0,
                  progress: 0,
                };
              }
              // 获取分片详情
              const chunksDetails = state.chunksDetails || [];
              // 计算统计信息
              return this.progressCalculator.getUploadStats(chunksDetails, state.totalChunks);
            } catch (error) {
              this.logError(`获取上传统计信息失败 [文件:${fileId}]`, error);
              return {
                total: 0,
                uploaded: 0,
                failed: 0,
                pending: 0,
                uploading: 0,
                progress: 0,
              };
            }
          }
          /**
           * 更新UI可视化
           * @param fileId 文件ID
           * @param chunksDetails 分片详情数组
           */
          updateVisualization(fileId, chunksDetails) {
            if (this.options.visualizationCallback) {
              try {
                this.options.visualizationCallback(fileId, chunksDetails);
              } catch (error) {
                this.logError('执行可视化回调失败', error);
              }
            }
          }
          /**
           * 安排定期清理过期数据
           */
          scheduleCleanup() {
            // 清理已有的定时器
            if (this.cleanupTimer) {
              clearInterval(this.cleanupTimer);
            }
            // 设置新的定时器
            this.cleanupTimer = setInterval(() => {
              this.cleanupExpiredData();
            }, this.options.cleanupInterval);
          }
          /**
           * 清理过期数据
           */
          async cleanupExpiredData() {
            try {
              const cleanupTime = Date.now() - this.options.maxStorageTime;
              await this.storageManager.cleanupExpiredData(cleanupTime);
              this.logInfo('已清理过期数据');
            } catch (error) {
              this.logError('清理过期数据失败', error);
            }
          }
          /**
           * 记录调试日志
           * @param message 日志消息
           * @param data 额外数据
           */
          logDebug(message, data) {
            if (this.logger?.debug) {
              this.logger.debug(`[ResumeStrategy] ${message}`, data);
            }
          }
          /**
           * 记录信息日志
           * @param message 日志消息
           * @param data 额外数据
           */
          logInfo(message, data) {
            if (this.logger?.info) {
              this.logger.info(`[ResumeStrategy] ${message}`, data);
            }
          }
          /**
           * 记录错误日志
           * @param message 日志消息
           * @param error 错误对象
           */
          logError(message, error) {
            if (this.logger?.error) {
              this.logger.error(`[ResumeStrategy] ${message}`, error);
            }
          }
        }

        /***/
      },

    /***/ './src/resume-strategy/types.ts':
      /*!**************************************!*\
  !*** ./src/resume-strategy/types.ts ***!
  \**************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ ChunkStatus: () => /* binding */ ChunkStatus,
          /* harmony export */
        });
        /**
         * 分片状态枚举
         * 用于更细粒度地追踪每个分片的状态
         */
        var ChunkStatus;
        (function (ChunkStatus) {
          /** 等待上传 */
          ChunkStatus['PENDING'] = 'pending';
          /** 正在上传 */
          ChunkStatus['UPLOADING'] = 'uploading';
          /** 上传成功 */
          ChunkStatus['SUCCESS'] = 'success';
          /** 上传失败 */
          ChunkStatus['FAILED'] = 'failed';
          /** 已暂停 */
          ChunkStatus['PAUSED'] = 'paused';
        })(ChunkStatus || (ChunkStatus = {}));

        /***/
      },

    /***/ './src/resume-strategy/upload-state-validator.ts':
      /*!*******************************************************!*\
  !*** ./src/resume-strategy/upload-state-validator.ts ***!
  \*******************************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ UploadStateValidator: () => /* binding */ UploadStateValidator,
          /* harmony export */
        });
        /**
         * 上传状态验证器类
         * 验证上传状态的有效性，确保断点续传安全
         */
        class UploadStateValidator {
          /**
           * 验证上传状态是否有效
           * @param state 上传状态
           * @param fileInfo 文件信息
           * @returns 验证结果
           */
          validateUploadState(state, fileInfo) {
            // 如果状态不存在，则无效
            if (!state) {
              return {
                valid: false,
                reason: 'state_missing',
                recoverable: false,
              };
            }
            // 基本验证：文件ID和名称
            if (state.fileId !== fileInfo.id) {
              return {
                valid: false,
                reason: 'file_id_mismatch',
                recoverable: false,
                details: {
                  expectedId: state.fileId,
                  actualId: fileInfo.id,
                },
              };
            }
            // 文件名验证（允许文件名变化，但记录为警告）
            const fileNameChanged = state.fileName !== fileInfo.name;
            // 文件大小验证 - 这是必须匹配的
            if (state.fileSize !== fileInfo.size) {
              return {
                valid: false,
                reason: 'file_size_mismatch',
                recoverable: false,
                details: {
                  expectedSize: state.fileSize,
                  actualSize: fileInfo.size,
                },
              };
            }
            // 最后修改时间验证 - 如果不匹配，可能文件内容已变化
            if (state.lastModified !== fileInfo.lastModified) {
              return {
                valid: false,
                reason: 'last_modified_mismatch',
                recoverable: false,
                details: {
                  expectedLastModified: state.lastModified,
                  actualLastModified: fileInfo.lastModified,
                  timeDifference: Math.abs(state.lastModified - fileInfo.lastModified),
                },
              };
            }
            // 检查分片信息是否存在
            if (!state.uploadedChunks || !Array.isArray(state.uploadedChunks)) {
              return {
                valid: false,
                reason: 'chunks_info_missing',
                recoverable: true,
              };
            }
            // 验证上传配置是否兼容
            if (state.config && fileInfo.config) {
              // 验证分片大小 - 如果分片大小变化，可能导致分片索引错位
              if (state.config.chunkSize !== fileInfo.config.chunkSize) {
                return {
                  valid: false,
                  reason: 'chunk_size_mismatch',
                  recoverable: false,
                  details: {
                    expectedChunkSize: state.config.chunkSize,
                    actualChunkSize: fileInfo.config.chunkSize,
                  },
                };
              }
              // 验证上传目标URL - 如果变化，可能需要重新上传
              if (state.config.target !== fileInfo.config.target) {
                return {
                  valid: false,
                  reason: 'target_url_mismatch',
                  recoverable: false,
                  details: {
                    expectedTarget: state.config.target,
                    actualTarget: fileInfo.config.target,
                  },
                };
              }
            }
            // 检查上传时间是否过期
            const now = Date.now();
            const maxUploadAge = 7 * 24 * 60 * 60 * 1000; // 默认7天
            const uploadAge = now - (state.lastUpdated || 0);
            if (uploadAge > maxUploadAge) {
              return {
                valid: false,
                reason: 'upload_expired',
                recoverable: false,
                details: {
                  age: uploadAge,
                  maxAge: maxUploadAge,
                },
              };
            }
            // 所有验证通过，但文件名可能已变化
            if (fileNameChanged) {
              return {
                valid: true,
                reason: 'file_name_changed',
                details: {
                  expectedName: state.fileName,
                  actualName: fileInfo.name,
                },
              };
            }
            // 验证通过
            return { valid: true };
          }
        }

        /***/
      },

    /***/ './src/storage/compression-utils.ts':
      /*!******************************************!*\
  !*** ./src/storage/compression-utils.ts ***!
  \******************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ compressData: () => /* binding */ compressData,
          /* harmony export */ decompressData: () => /* binding */ decompressData,
          /* harmony export */ isCompressionSupported: () => /* binding */ isCompressionSupported,
          /* harmony export */
        });
        /**
         * 数据压缩工具类
         * 提供用于压缩和解压数据的工具方法
         */
        /**
         * 压缩Blob数据
         * @param data 要压缩的数据
         * @param method 压缩方法
         * @returns 压缩后的数据
         */
        async function compressData(data, method = 'gzip', customCompressor) {
          // 输入类型验证
          if (!(data instanceof Blob)) {
            throw new Error('压缩数据必须是Blob类型');
          }
          // 保存原始大小
          const originalSize = data.size;
          // 如果数据太小，不压缩
          if (originalSize < 1024) {
            return { compressedData: data, originalSize, method: 'none' };
          }
          // 使用自定义压缩器
          if (method === 'custom' && customCompressor) {
            try {
              const compressedData = await customCompressor(data);
              return {
                compressedData,
                originalSize,
                method: 'custom',
              };
            } catch (error) {
              console.warn('自定义压缩失败，使用原始数据', error);
              return { compressedData: data, originalSize, method: 'none' };
            }
          }
          // 使用 CompressionStream API (如果浏览器支持)
          if (typeof CompressionStream !== 'undefined') {
            try {
              const blob = new Blob([await data.arrayBuffer()]);
              const stream = blob.stream();
              // 仅使用有效的压缩格式
              const compressionMethod = method === 'custom' ? 'gzip' : method;
              const compressedStream = stream.pipeThrough(new CompressionStream(compressionMethod));
              const compressedData = await new Response(compressedStream).blob();
              // 如果压缩后更大，则使用原始数据
              if (compressedData.size >= originalSize) {
                return { compressedData: data, originalSize, method: 'none' };
              }
              return {
                compressedData,
                originalSize,
                method,
              };
            } catch (error) {
              console.warn(`${method}压缩失败，使用原始数据`, error);
              return { compressedData: data, originalSize, method: 'none' };
            }
          }
          // 不支持压缩
          return { compressedData: data, originalSize, method: 'none' };
        }
        /**
         * 解压缩Blob数据
         * @param compressedData 压缩的数据
         * @param method 使用的压缩方法
         * @returns 解压后的数据
         */
        async function decompressData(compressedData, method, customDecompressor) {
          // 输入类型验证
          if (!(compressedData instanceof Blob)) {
            throw new Error('解压数据必须是Blob类型');
          }
          // 如果未压缩，直接返回
          if (method === 'none') {
            return compressedData;
          }
          // 使用自定义解压缩器
          if (method === 'custom' && customDecompressor) {
            try {
              return await customDecompressor(compressedData);
            } catch (error) {
              console.error('自定义解压失败', error);
              throw new Error('解压失败: 自定义解压错误');
            }
          }
          // 使用 DecompressionStream API
          if (
            typeof DecompressionStream !== 'undefined' &&
            (method === 'gzip' || method === 'deflate')
          ) {
            try {
              const blob = new Blob([await compressedData.arrayBuffer()]);
              const stream = blob.stream();
              const decompressedStream = stream.pipeThrough(new DecompressionStream(method));
              return await new Response(decompressedStream).blob();
            } catch (error) {
              console.error(`${method}解压失败`, error);
              throw new Error(`解压失败: ${method}解压错误`);
            }
          }
          // 不支持的压缩方法
          throw new Error(`解压失败: 不支持的压缩方法 ${method}`);
        }
        /**
         * 检查浏览器是否支持压缩API
         * @returns 是否支持压缩
         */
        function isCompressionSupported() {
          return (
            typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined'
          );
        }

        /***/
      },

    /***/ './src/storage/index.ts':
      /*!******************************!*\
  !*** ./src/storage/index.ts ***!
  \******************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ IndexedDBAdapter: () =>
            /* reexport safe */ _indexed_db_adapter__WEBPACK_IMPORTED_MODULE_0__.IndexedDBAdapter,
          /* harmony export */ MigrationHelper: () =>
            /* reexport safe */ _migration_helper__WEBPACK_IMPORTED_MODULE_3__.MigrationHelper,
          /* harmony export */ MigrationStatus: () =>
            /* reexport safe */ _migration_helper__WEBPACK_IMPORTED_MODULE_3__.MigrationStatus,
          /* harmony export */ PriorityManager: () =>
            /* reexport safe */ _priority_manager__WEBPACK_IMPORTED_MODULE_4__.PriorityManager,
          /* harmony export */ SpaceCleanupEvent: () =>
            /* reexport safe */ _space_manager__WEBPACK_IMPORTED_MODULE_5__.SpaceCleanupEvent,
          /* harmony export */ SpaceManager: () =>
            /* reexport safe */ _space_manager__WEBPACK_IMPORTED_MODULE_5__.SpaceManager,
          /* harmony export */ StorageLogger: () =>
            /* reexport safe */ _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageLogger,
          /* harmony export */ StorageManager: () =>
            /* reexport safe */ _storage_manager__WEBPACK_IMPORTED_MODULE_1__.StorageManager,
          /* harmony export */ StorageOperation: () =>
            /* reexport safe */ _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation,
          /* harmony export */ compressData: () =>
            /* reexport safe */ _compression_utils__WEBPACK_IMPORTED_MODULE_6__.compressData,
          /* harmony export */ decompressData: () =>
            /* reexport safe */ _compression_utils__WEBPACK_IMPORTED_MODULE_6__.decompressData,
          /* harmony export */ isCompressionSupported: () =>
            /* reexport safe */ _compression_utils__WEBPACK_IMPORTED_MODULE_6__.isCompressionSupported,
          /* harmony export */
        });
        /* harmony import */ var _indexed_db_adapter__WEBPACK_IMPORTED_MODULE_0__ =
          __webpack_require__(/*! ./indexed-db-adapter */ './src/storage/indexed-db-adapter.ts');
        /* harmony import */ var _storage_manager__WEBPACK_IMPORTED_MODULE_1__ =
          __webpack_require__(/*! ./storage-manager */ './src/storage/storage-manager.ts');
        /* harmony import */ var _storage_logger__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(
          /*! ./storage-logger */ './src/storage/storage-logger.ts',
        );
        /* harmony import */ var _migration_helper__WEBPACK_IMPORTED_MODULE_3__ =
          __webpack_require__(/*! ./migration-helper */ './src/storage/migration-helper.ts');
        /* harmony import */ var _priority_manager__WEBPACK_IMPORTED_MODULE_4__ =
          __webpack_require__(/*! ./priority-manager */ './src/storage/priority-manager.ts');
        /* harmony import */ var _space_manager__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(
          /*! ./space-manager */ './src/storage/space-manager.ts',
        );
        /* harmony import */ var _compression_utils__WEBPACK_IMPORTED_MODULE_6__ =
          __webpack_require__(/*! ./compression-utils */ './src/storage/compression-utils.ts');
        /* harmony import */ var _storage_options__WEBPACK_IMPORTED_MODULE_7__ =
          __webpack_require__(/*! ./storage-options */ './src/storage/storage-options.ts');
        /**
         * 存储模块导出文件
         */

        /***/
      },

    /***/ './src/storage/indexed-db-adapter.ts':
      /*!*******************************************!*\
  !*** ./src/storage/indexed-db-adapter.ts ***!
  \*******************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ IndexedDBAdapter: () => /* binding */ IndexedDBAdapter,
          /* harmony export */
        });
        /**
         * IndexedDB存储适配器
         * 提供基于IndexedDB的数据存储实现
         */
        class IndexedDBAdapter {
          /**
           * 创建IndexedDB存储适配器
           * @param options 存储选项
           */
          constructor(options = {}) {
            this.db = null;
            this.dbName = options.dbName || 'file-chunk-uploader';
            this.storeName = options.storeName || 'uploads';
            this.version = options.version || 1;
            this.keyPrefix = options.keyPrefix || '';
            this.ready = this.initDB();
          }
          /**
           * 初始化IndexedDB数据库
           * @returns 初始化完成的Promise
           */
          async initDB() {
            return new Promise((resolve, reject) => {
              // 检查浏览器是否支持IndexedDB
              if (!this.isSupported()) {
                reject(new Error('IndexedDB不受支持'));
                return;
              }
              const request = indexedDB.open(this.dbName, this.version);
              request.onerror = () => {
                console.error('无法打开IndexedDB');
                reject(new Error('IndexedDB访问被拒绝'));
              };
              request.onsuccess = () => {
                this.db = request.result;
                resolve();
              };
              request.onupgradeneeded = () => {
                const db = request.result;
                // 创建对象存储
                if (!db.objectStoreNames.contains(this.storeName)) {
                  const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
                  // 创建索引便于查询
                  store.createIndex('fileId', 'fileId', { unique: false });
                  store.createIndex('createdAt', 'createdAt', { unique: false });
                  store.createIndex('type', 'type', { unique: false });
                }
              };
            });
          }
          /**
           * 保存数据到IndexedDB
           * @param key 键名
           * @param value 要保存的数据
           * @param expiration 过期时间(毫秒)
           */
          async save(key, value, expiration) {
            await this.ready;
            return new Promise((resolve, reject) => {
              if (!this.db) {
                reject(new Error('数据库未初始化'));
                return;
              }
              try {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                // 准备数据
                const prefixedKey = this.getKeyWithPrefix(key);
                const now = Date.now();
                const data = {
                  id: prefixedKey,
                  key: prefixedKey,
                  value,
                  createdAt: now,
                  updatedAt: now,
                  expireAt: expiration ? now + expiration : undefined,
                  fileId: prefixedKey.split('_')[1], // 如果key的格式是 "type_fileId_extra"
                  type: prefixedKey.split('_')[0], // 提取类型，如 "state"、"chunk" 等
                };
                // 保存
                const request = store.put(data);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error('保存数据失败'));
              } catch (err) {
                reject(err);
              }
            });
          }
          /**
           * 从IndexedDB获取数据
           * @param key 键名
           * @returns 数据或null(如果不存在或已过期)
           */
          async get(key) {
            await this.ready;
            return new Promise((resolve, reject) => {
              if (!this.db) {
                reject(new Error('数据库未初始化'));
                return;
              }
              try {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const prefixedKey = this.getKeyWithPrefix(key);
                const request = store.get(prefixedKey);
                request.onsuccess = () => {
                  const result = request.result;
                  // 检查是否存在
                  if (!result) {
                    resolve(null);
                    return;
                  }
                  // 检查是否过期
                  if (result.expireAt && result.expireAt < Date.now()) {
                    // 数据已过期，异步删除
                    this.remove(key).catch(() => {
                      // 忽略删除错误
                    });
                    resolve(null);
                    return;
                  }
                  resolve(result.value);
                };
                request.onerror = () => reject(new Error('获取数据失败'));
              } catch (err) {
                reject(err);
              }
            });
          }
          /**
           * 从IndexedDB删除数据
           * @param key 键名
           */
          async remove(key) {
            await this.ready;
            return new Promise((resolve, reject) => {
              if (!this.db) {
                reject(new Error('数据库未初始化'));
                return;
              }
              try {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const prefixedKey = this.getKeyWithPrefix(key);
                const request = store.delete(prefixedKey);
                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error('删除数据失败'));
              } catch (err) {
                reject(err);
              }
            });
          }
          /**
           * 检查键是否存在于IndexedDB
           * @param key 键名
           * @returns 是否存在
           */
          async has(key) {
            try {
              const value = await this.get(key);
              return value !== null;
            } catch (error) {
              return false;
            }
          }
          /**
           * 清空IndexedDB存储
           */
          async clear() {
            await this.ready;
            return new Promise((resolve, reject) => {
              if (!this.db) {
                reject(new Error('数据库未初始化'));
                return;
              }
              try {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.clear();
                request.onsuccess = () => resolve();
                request.onerror = () => reject(new Error('清空数据失败'));
              } catch (err) {
                reject(err);
              }
            });
          }
          /**
           * 获取所有键
           * @returns 键列表
           */
          async keys() {
            await this.ready;
            return new Promise((resolve, reject) => {
              if (!this.db) {
                reject(new Error('数据库未初始化'));
                return;
              }
              try {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAllKeys();
                request.onsuccess = () => {
                  const results = Array.from(request.result)
                    .map(key => key.toString())
                    .filter(key => key.startsWith(this.keyPrefix))
                    .map(key => this.removePrefix(key));
                  resolve(results);
                };
                request.onerror = () => reject(new Error('获取键列表失败'));
              } catch (err) {
                reject(err);
              }
            });
          }
          /**
           * 获取存储使用情况
           * @returns 存储使用情况
           */
          async getUsage() {
            await this.ready;
            return new Promise((resolve, reject) => {
              if (!this.db) {
                reject(new Error('数据库未初始化'));
                return;
              }
              try {
                const transaction = this.db.transaction([this.storeName], 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAll();
                request.onsuccess = () => {
                  const results = request.result;
                  let totalSize = 0;
                  let chunkCount = 0;
                  const fileIds = new Set();
                  results.forEach(item => {
                    // 计算总大小（粗略估计，实际大小需考虑序列化后的大小）
                    const itemSize = this.estimateSize(item);
                    totalSize += itemSize;
                    // 统计分片数量
                    if (item.type === 'chunk') {
                      chunkCount++;
                    }
                    // 收集文件ID
                    if (item.fileId) {
                      fileIds.add(item.fileId);
                    }
                  });
                  resolve({
                    totalSize,
                    chunkCount,
                    fileCount: fileIds.size,
                  });
                };
                request.onerror = () => reject(new Error('获取存储使用情况失败'));
              } catch (err) {
                reject(err);
              }
            });
          }
          /**
           * 清理过期数据
           */
          async clearExpired() {
            await this.ready;
            return new Promise((resolve, reject) => {
              if (!this.db) {
                reject(new Error('数据库未初始化'));
                return;
              }
              try {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.openCursor();
                const now = Date.now();
                request.onsuccess = event => {
                  const cursor = event.target.result;
                  if (cursor) {
                    const data = cursor.value;
                    // 检查是否过期
                    if (data.expireAt && data.expireAt < now) {
                      cursor.delete();
                    }
                    cursor.continue();
                  } else {
                    // 所有条目都已处理
                    resolve();
                  }
                };
                request.onerror = () => reject(new Error('清理过期数据失败'));
              } catch (err) {
                reject(err);
              }
            });
          }
          /**
           * 检查是否支持IndexedDB
           * @returns 是否支持
           */
          isSupported() {
            return typeof indexedDB !== 'undefined';
          }
          /**
           * 为键添加前缀
           * @param key 原始键
           * @returns 带前缀的键
           */
          getKeyWithPrefix(key) {
            if (this.keyPrefix && !key.startsWith(this.keyPrefix)) {
              return `${this.keyPrefix}${key}`;
            }
            return key;
          }
          /**
           * 移除键的前缀
           * @param key 带前缀的键
           * @returns 原始键
           */
          removePrefix(key) {
            if (this.keyPrefix && key.startsWith(this.keyPrefix)) {
              return key.substring(this.keyPrefix.length);
            }
            return key;
          }
          /**
           * 估算对象大小（字节）
           * @param obj 要估算大小的对象
           * @returns 估算的字节大小
           */
          estimateSize(obj) {
            if (obj === null || obj === undefined) return 0;
            // Blob或File对象直接获取大小
            if (obj instanceof Blob || obj instanceof File) {
              return obj.size;
            }
            // 特殊处理ArrayBuffer和类型化数组
            if (obj instanceof ArrayBuffer) {
              return obj.byteLength;
            }
            if (
              obj instanceof Int8Array ||
              obj instanceof Uint8Array ||
              obj instanceof Uint8ClampedArray ||
              obj instanceof Int16Array ||
              obj instanceof Uint16Array ||
              obj instanceof Int32Array ||
              obj instanceof Uint32Array ||
              obj instanceof Float32Array ||
              obj instanceof Float64Array
            ) {
              return obj.byteLength;
            }
            // 字符串计算字节大小（考虑UTF-8编码）
            if (typeof obj === 'string') {
              // 使用TextEncoder来精确计算UTF-8编码字节长度
              if (typeof TextEncoder !== 'undefined') {
                return new TextEncoder().encode(obj).length;
              }
              // 降级处理：估算UTF-8编码大小
              // ASCII字符占1字节，其他字符可能占2-4字节
              let size = 0;
              for (let i = 0; i < obj.length; i++) {
                const code = obj.charCodeAt(i);
                if (code <= 0x7f) {
                  size += 1; // ASCII字符
                } else if (code <= 0x7ff) {
                  size += 2; // 两字节字符
                } else if (code >= 0xd800 && code <= 0xdfff) {
                  // 处理UTF-16代理对
                  size += 4;
                  i++; // 跳过下一个代码单元
                } else {
                  size += 3; // 三字节字符
                }
              }
              return size;
            }
            // 数字和布尔值固定大小
            if (typeof obj === 'number') return 8;
            if (typeof obj === 'boolean') return 4;
            // 日期对象
            if (obj instanceof Date) return 8;
            // 递归计算对象和数组
            if (typeof obj === 'object') {
              let size = 0;
              for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                  // 键的大小
                  size += key.length * 2;
                  // 值的大小
                  size += this.estimateSize(obj[key]);
                }
              }
              return size;
            }
            return 0;
          }
        }

        /***/
      },

    /***/ './src/storage/migration-helper.ts':
      /*!*****************************************!*\
  !*** ./src/storage/migration-helper.ts ***!
  \*****************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ MigrationHelper: () => /* binding */ MigrationHelper,
          /* harmony export */ MigrationStatus: () => /* binding */ MigrationStatus,
          /* harmony export */
        });
        /* harmony import */ var _storage_logger__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(
          /*! ./storage-logger */ './src/storage/storage-logger.ts',
        );
        /**
         * 存储迁移助手
         * 提供数据库版本迁移和升级支持
         */

        /**
         * 迁移结果状态
         */
        var MigrationStatus;
        (function (MigrationStatus) {
          MigrationStatus['SUCCESS'] = 'success';
          MigrationStatus['FAILED'] = 'failed';
          MigrationStatus['SKIPPED'] = 'skipped';
        })(MigrationStatus || (MigrationStatus = {}));
        /**
         * 存储迁移助手
         */
        class MigrationHelper {
          /**
           * 创建迁移助手实例
           */
          constructor(logger) {
            this.migrators = new Map();
            this.logger =
              logger || new _storage_logger__WEBPACK_IMPORTED_MODULE_0__.StorageLogger();
          }
          /**
           * 注册版本迁移器
           * @param version 目标版本号
           * @param migrator 迁移函数
           */
          registerMigrator(version, migrator) {
            if (this.migrators.has(version)) {
              this.logger.warn(`已存在版本 ${version} 的迁移器，将被覆盖`);
            }
            this.migrators.set(version, migrator);
            this.logger.debug(`已注册版本 ${version} 的迁移器`);
          }
          /**
           * 批量注册迁移器
           * @param migrators 迁移器映射
           */
          registerMigrators(migrators) {
            Object.entries(migrators).forEach(([versionStr, migrator]) => {
              const version = Number(versionStr);
              if (!isNaN(version)) {
                this.registerMigrator(version, migrator);
              } else {
                this.logger.error(`无效的版本号：${versionStr}`);
              }
            });
          }
          /**
           * 获取所有已注册的迁移版本
           * 按版本号升序排序
           */
          getMigrationVersions() {
            return Array.from(this.migrators.keys()).sort((a, b) => a - b);
          }
          /**
           * 获取特定版本的迁移器
           */
          getMigrator(version) {
            return this.migrators.get(version);
          }
          /**
           * 执行迁移
           * 注意：此方法需要在数据库版本变更处理器内调用
           *
           * @param db 数据库对象
           * @param oldVersion 旧版本号
           * @param newVersion 新版本号
           */
          async migrate(db, oldVersion, newVersion) {
            this.logger.info(`开始数据库迁移 v${oldVersion} -> v${newVersion}`);
            if (oldVersion >= newVersion) {
              this.logger.info('无需迁移（当前版本已是最新）');
              return {
                status: MigrationStatus.SKIPPED,
                fromVersion: oldVersion,
                toVersion: newVersion,
                message: '当前版本已是最新',
              };
            }
            try {
              // 获取需要执行的迁移
              const migrationsToRun = this.getMigrationVersions().filter(
                version => version > oldVersion && version <= newVersion,
              );
              if (migrationsToRun.length === 0) {
                this.logger.info('未找到适用的迁移器');
                return {
                  status: MigrationStatus.SKIPPED,
                  fromVersion: oldVersion,
                  toVersion: newVersion,
                  message: '未找到适用的迁移器',
                };
              }
              // 按版本顺序执行迁移
              for (const version of migrationsToRun) {
                const migrator = this.migrators.get(version);
                if (migrator) {
                  this.logger.info(`执行版本 ${version} 的迁移`);
                  await migrator(db);
                }
              }
              this.logger.info(`迁移完成：v${oldVersion} -> v${newVersion}`);
              return {
                status: MigrationStatus.SUCCESS,
                fromVersion: oldVersion,
                toVersion: newVersion,
                message: '迁移成功',
              };
            } catch (error) {
              this.logger.error(`迁移失败：${error.message}`, error);
              return {
                status: MigrationStatus.FAILED,
                fromVersion: oldVersion,
                toVersion: newVersion,
                error: error,
                message: `迁移失败：${error.message}`,
              };
            }
          }
          /**
           * 创建对象存储
           * 辅助方法，方便在迁移脚本中创建对象存储
           */
          createObjectStore(db, storeName, options = { keyPath: 'id' }) {
            this.logger.debug(`创建对象存储：${storeName}`);
            return db.createObjectStore(storeName, options);
          }
          /**
           * 创建索引
           * 辅助方法，方便在迁移脚本中创建索引
           */
          createIndex(store, indexName, keyPath, options = { unique: false }) {
            this.logger.debug(`创建索引：${indexName}`);
            return store.createIndex(indexName, keyPath, options);
          }
        }

        /***/
      },

    /***/ './src/storage/priority-manager.ts':
      /*!*****************************************!*\
  !*** ./src/storage/priority-manager.ts ***!
  \*****************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ PriorityManager: () => /* binding */ PriorityManager,
          /* harmony export */
        });
        /* harmony import */ var _storage_logger__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(
          /*! ./storage-logger */ './src/storage/storage-logger.ts',
        );

        /**
         * 存储优先级管理器
         * 管理文件和存储项的优先级
         */
        class PriorityManager {
          /**
           * 创建优先级管理器实例
           * @param logger 日志记录器
           */
          constructor(logger) {
            this.priorityMap = new Map();
            this.logger =
              logger || new _storage_logger__WEBPACK_IMPORTED_MODULE_0__.StorageLogger();
          }
          /**
           * 设置文件优先级
           * @param fileId 文件ID
           * @param priority 优先级 (1-10, 10为最高)
           */
          setFilePriority(fileId, priority) {
            // 确保优先级在有效范围内
            const validPriority = Math.min(Math.max(Math.round(priority), 1), 10);
            this.priorityMap.set(fileId, {
              fileId,
              priority: validPriority,
              updatedAt: Date.now(),
            });
            // 使用info方法记录优先级设置
            this.logger.info(`设置文件优先级: ${fileId}`, { priority: validPriority });
          }
          /**
           * 获取文件优先级
           * @param fileId 文件ID
           * @returns 文件优先级
           */
          getFilePriority(fileId) {
            return this.priorityMap.get(fileId)?.priority || PriorityManager.DEFAULT_PRIORITY;
          }
          /**
           * 计算存储项优先级
           * 基于文件优先级、访问时间和访问频率
           * @param metadata 存储项元数据
           * @returns 计算后的优先级得分
           */
          calculateItemPriority(metadata) {
            // 基础优先级
            let score = metadata.priority;
            // 如果是分片数据，使用对应文件的优先级
            if (metadata.fileId) {
              const filePriority = this.getFilePriority(metadata.fileId);
              score = filePriority;
            }
            // 考虑访问因素增加权重
            const now = Date.now();
            const daysSinceLastAccess = (now - metadata.lastAccessed) / (1000 * 60 * 60 * 24);
            // 近期访问增加权重，久未访问减少权重
            if (daysSinceLastAccess < 1) {
              // 24小时内访问过，增加权重
              score += 1;
            } else if (daysSinceLastAccess > 7) {
              // 一周未访问，降低权重
              score -= Math.min(3, Math.floor(daysSinceLastAccess / 7));
            }
            // 频繁访问的项目增加权重
            if (metadata.accessCount > 10) {
              score += 1;
            }
            // 限制范围
            return Math.min(Math.max(score, 1), 10);
          }
          /**
           * 排序存储项根据优先级
           * @param items 存储项元数据列表
           * @returns 排序后的列表
           */
          sortItemsByPriority(items) {
            return [...items].sort((a, b) => {
              const priorityA = this.calculateItemPriority(a);
              const priorityB = this.calculateItemPriority(b);
              return priorityB - priorityA; // 降序，高优先级在前
            });
          }
          /**
           * 获取低优先级项目列表
           * @param items 存储项元数据列表
           * @param threshold 优先级阈值，低于此值视为低优先级
           * @returns 低优先级项目列表
           */
          getLowPriorityItems(items, threshold = 3) {
            return items.filter(item => this.calculateItemPriority(item) <= threshold);
          }
          /**
           * 更新存储项访问记录
           * @param metadata 存储项元数据
           * @returns 更新后的元数据
           */
          updateItemAccess(metadata) {
            return {
              ...metadata,
              accessCount: metadata.accessCount + 1,
              lastAccessed: Date.now(),
            };
          }
          /**
           * 自动降级长时间未访问的项目优先级
           * @param items 存储项元数据列表
           * @param threshold 未访问时间阈值（毫秒）
           * @returns 需要降级的项目列表
           */
          getItemsForDemotion(items, threshold = 14 * 24 * 60 * 60 * 1000) {
            const now = Date.now();
            return items.filter(item => {
              // 只处理高优先级项目
              const currentPriority = this.calculateItemPriority(item);
              return currentPriority > 5 && now - item.lastAccessed > threshold;
            });
          }
          /**
           * 导出优先级数据
           * 可用于持久化存储
           */
          exportPriorityData() {
            return Array.from(this.priorityMap.values());
          }
          /**
           * 导入优先级数据
           * @param data 之前导出的优先级数据
           */
          importPriorityData(data) {
            data.forEach(item => {
              this.priorityMap.set(item.fileId, item);
            });
          }
        }
        PriorityManager.DEFAULT_PRIORITY = 5;

        /***/
      },

    /***/ './src/storage/space-manager.ts':
      /*!**************************************!*\
  !*** ./src/storage/space-manager.ts ***!
  \**************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ SpaceCleanupEvent: () => /* binding */ SpaceCleanupEvent,
          /* harmony export */ SpaceManager: () => /* binding */ SpaceManager,
          /* harmony export */
        });
        /* harmony import */ var _priority_manager__WEBPACK_IMPORTED_MODULE_0__ =
          __webpack_require__(/*! ./priority-manager */ './src/storage/priority-manager.ts');
        /* harmony import */ var _storage_logger__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(
          /*! ./storage-logger */ './src/storage/storage-logger.ts',
        );

        /**
         * 存储空间清理事件
         */
        var SpaceCleanupEvent;
        (function (SpaceCleanupEvent) {
          SpaceCleanupEvent['WARNING'] = 'warning';
          SpaceCleanupEvent['CLEANUP_STARTED'] = 'cleanup_started';
          SpaceCleanupEvent['CLEANUP_COMPLETE'] = 'cleanup_complete';
          SpaceCleanupEvent['CLEANUP_FAILED'] = 'cleanup_failed';
        })(SpaceCleanupEvent || (SpaceCleanupEvent = {}));
        /**
         * 存储空间管理类
         * 负责监控存储空间使用情况和清理策略
         */
        class SpaceManager {
          /**
           * 创建空间管理器实例
           */
          constructor(options = {}, logger, priorityManager) {
            this.eventListeners = new Map();
            this.cleanupStrategies = new Map();
            this.options = options;
            this.logger =
              logger || new _storage_logger__WEBPACK_IMPORTED_MODULE_1__.StorageLogger();
            this.priorityManager =
              priorityManager ||
              new _priority_manager__WEBPACK_IMPORTED_MODULE_0__.PriorityManager(this.logger);
            // 注册默认清理策略
            this.registerCleanupStrategies();
          }
          /**
           * 检查存储空间状态
           * @param usage 当前存储使用情况
           * @returns 如果空间使用超过警告阈值，返回true
           */
          checkStorageWarning(usage) {
            if (!this.options.spaceManagement) {
              return false;
            }
            const { maxStorageSize, usageWarningThreshold = 0.8 } = this.options.spaceManagement;
            // 如果没有设置最大存储大小限制，则检查实际使用率（如果可用）
            if (!maxStorageSize && usage.usageRatio !== undefined) {
              if (usage.usageRatio >= usageWarningThreshold) {
                this.triggerEvent(SpaceCleanupEvent.WARNING, {
                  usageRatio: usage.usageRatio,
                  threshold: usageWarningThreshold,
                });
                this.logger.warn(`存储空间使用率警告：${Math.round(usage.usageRatio * 100)}%`);
                return true;
              }
              return false;
            }
            // 如果设置了最大存储大小限制，检查是否接近限制
            if (maxStorageSize && usage.totalSize >= maxStorageSize * usageWarningThreshold) {
              this.triggerEvent(SpaceCleanupEvent.WARNING, {
                totalSize: usage.totalSize,
                maxSize: maxStorageSize,
                threshold: usageWarningThreshold,
              });
              this.logger.warn(
                `存储空间使用警告：${this.formatSize(usage.totalSize)}/${this.formatSize(
                  maxStorageSize,
                )}`,
              );
              return true;
            }
            return false;
          }
          /**
           * 执行存储空间清理
           * @param items 所有存储项的元数据
           * @param percentageToFree 目标释放空间百分比 (0-1)
           * @returns 建议清理的项目列表
           */
          async cleanupStorage(items, percentageToFree = 0.3) {
            this.triggerEvent(SpaceCleanupEvent.CLEANUP_STARTED, {
              itemCount: items.length,
              percentageToFree,
            });
            try {
              const strategy = this.options.spaceManagement?.cleanupStrategy || 'lowest-priority';
              let strategyFn = this.cleanupStrategies.get(strategy);
              if (!strategyFn) {
                this.logger.warn(`未知清理策略: ${strategy}，使用默认策略`);
                strategyFn = this.cleanupStrategies.get('lowest-priority');
              }
              if (!strategyFn) {
                throw new Error('无法获取清理策略');
              }
              // 获取当前总大小
              const currentTotalSize = items.reduce((sum, item) => sum + item.size, 0);
              // 目标释放大小
              const targetReleaseSize = currentTotalSize * percentageToFree;
              // 选择要清理的项目
              const itemsToRemove = strategyFn(items);
              // 按顺序移除，直到达到目标释放大小
              let releasedSize = 0;
              const selectedItems = [];
              for (const item of itemsToRemove) {
                selectedItems.push(item);
                releasedSize += item.size;
                if (releasedSize >= targetReleaseSize) {
                  break;
                }
              }
              this.logger.info(
                `空间清理完成：选择了 ${selectedItems.length} 个项目，预计释放 ${this.formatSize(
                  releasedSize,
                )}`,
              );
              this.triggerEvent(SpaceCleanupEvent.CLEANUP_COMPLETE, {
                itemsRemoved: selectedItems.length,
                releasedSize,
                targetReleaseSize,
              });
              return selectedItems;
            } catch (error) {
              this.logger.error(`空间清理失败: ${error.message}`, error);
              this.triggerEvent(SpaceCleanupEvent.CLEANUP_FAILED, {
                error,
              });
              return [];
            }
          }
          /**
           * 注册事件监听器
           * @param event 事件类型
           * @param listener 监听器函数
           */
          on(event, listener) {
            if (!this.eventListeners.has(event)) {
              this.eventListeners.set(event, []);
            }
            this.eventListeners.get(event)?.push(listener);
          }
          /**
           * 移除事件监听器
           * @param event 事件类型
           * @param listener 监听器函数
           */
          off(event, listener) {
            const listeners = this.eventListeners.get(event);
            if (listeners) {
              const index = listeners.indexOf(listener);
              if (index !== -1) {
                listeners.splice(index, 1);
              }
            }
          }
          /**
           * 触发事件
           * @param event 事件类型
           * @param data 事件数据
           */
          triggerEvent(event, data) {
            const listeners = this.eventListeners.get(event);
            if (listeners) {
              listeners.forEach(listener => {
                try {
                  listener(data);
                } catch (error) {
                  this.logger.error(`事件监听器执行错误: ${error.message}`, error);
                }
              });
            }
          }
          /**
           * 注册默认清理策略
           */
          registerCleanupStrategies() {
            // 最低优先级优先清理
            this.cleanupStrategies.set('lowest-priority', items => {
              return [...items].sort((a, b) => {
                const priorityA = this.priorityManager.calculateItemPriority(a);
                const priorityB = this.priorityManager.calculateItemPriority(b);
                return priorityA - priorityB; // 升序，低优先级在前
              });
            });
            // 最旧优先清理
            this.cleanupStrategies.set('oldest', items => {
              return [...items].sort((a, b) => a.createdAt - b.createdAt);
            });
            // 最大优先清理
            this.cleanupStrategies.set('largest', items => {
              return [...items].sort((a, b) => b.size - a.size);
            });
          }
          /**
           * 注册自定义清理策略
           * @param name 策略名称
           * @param strategy 策略函数
           */
          registerCleanupStrategy(name, strategy) {
            this.cleanupStrategies.set(name, strategy);
          }
          /**
           * 格式化大小
           */
          formatSize(bytes) {
            if (bytes < 1024) return `${bytes}B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
            if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
            return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
          }
        }

        /***/
      },

    /***/ './src/storage/storage-logger.ts':
      /*!***************************************!*\
  !*** ./src/storage/storage-logger.ts ***!
  \***************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ StorageLogger: () => /* binding */ StorageLogger,
          /* harmony export */ StorageOperation: () => /* binding */ StorageOperation,
          /* harmony export */
        });
        /**
         * StorageLogger - 存储模块的日志记录功能
         *
         * 提供了与core包的Logger集成的日志记录功能，
         * 同时支持降级处理（当core包的Logger不可用时使用控制台）
         */
        /**
         * 存储操作类型
         */
        var StorageOperation;
        (function (StorageOperation) {
          StorageOperation['SAVE'] = 'save';
          StorageOperation['GET'] = 'get';
          StorageOperation['DELETE'] = 'delete';
          StorageOperation['LIST'] = 'list';
          StorageOperation['CLEAR'] = 'clear';
          StorageOperation['INIT'] = 'init';
          StorageOperation['CLEANUP'] = 'cleanup';
          StorageOperation['USE'] = 'use';
        })(StorageOperation || (StorageOperation = {}));
        /**
         * 存储日志记录器
         */
        class StorageLogger {
          /**
           * 创建存储日志记录器
           */
          constructor(logger, options = {}) {
            this.logger = null;
            this.enabled = false;
            this.debugEnabled = false;
            this.logger = logger || null;
            this.enabled = options.enabled !== undefined ? options.enabled : true;
            this.debugEnabled = options.debug || false;
          }
          /**
           * 记录调试信息
           */
          debug(message, data) {
            if (!this.enabled || !this.debugEnabled) return;
            if (this.logger) {
              this.logger.debug('storage', message, data);
            } else {
              console.debug(`[STORAGE] ${message}`, data || '');
            }
          }
          /**
           * 记录信息
           */
          info(message, data) {
            if (!this.enabled) return;
            if (this.logger) {
              this.logger.info('storage', message, data);
            } else {
              console.info(`[STORAGE] ${message}`, data || '');
            }
          }
          /**
           * 记录警告
           */
          warn(message, data) {
            if (!this.enabled) return;
            if (this.logger) {
              this.logger.warn('storage', message, data);
            } else {
              console.warn(`[STORAGE] ${message}`, data || '');
            }
          }
          /**
           * 记录错误
           */
          error(message, data) {
            if (!this.enabled) return;
            if (this.logger) {
              this.logger.error('storage', message, data);
            } else {
              console.error(`[STORAGE] ${message}`, data || '');
            }
          }
          /**
           * 记录存储操作
           */
          logOperation(operation, key, details) {
            if (!this.enabled) return;
            const baseMessage = `${this.getOperationName(operation)}: ${key}`;
            if (!details) {
              this.debug(baseMessage);
              return;
            }
            // 深度验证details参数
            if (typeof details !== 'object') {
              this.debug(`${baseMessage} - 参数错误: details不是对象`);
              return;
            }
            if (typeof details.success !== 'boolean') {
              this.debug(`${baseMessage} - 参数错误: details.success不是布尔值`);
              return;
            }
            const { success, duration, error, size } = details;
            if (success) {
              // 成功的操作
              const message = `${baseMessage} - 成功${
                duration ? ` (${duration.toFixed(2)}ms)` : ''
              }${size ? ` [${this.formatSize(size)}]` : ''}`;
              this.debug(message);
            } else {
              // 失败的操作
              const message = `${baseMessage} - 失败${
                duration ? ` (${duration.toFixed(2)}ms)` : ''
              }`;
              this.error(message, { error });
            }
          }
          /**
           * 获取操作名称
           */
          getOperationName(operation) {
            switch (operation) {
              case StorageOperation.SAVE:
                return '保存数据';
              case StorageOperation.GET:
                return '获取数据';
              case StorageOperation.DELETE:
                return '删除数据';
              case StorageOperation.LIST:
                return '列出键';
              case StorageOperation.CLEAR:
                return '清空存储';
              case StorageOperation.INIT:
                return '初始化存储';
              case StorageOperation.CLEANUP:
                return '清理过期数据';
              case StorageOperation.USE:
                return '使用存储';
              default:
                return '未知操作';
            }
          }
          /**
           * 格式化大小
           */
          formatSize(bytes) {
            if (bytes < 1024) return `${bytes}B`;
            if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
            return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
          }
          /**
           * 设置日志记录器
           */
          setLogger(logger) {
            this.logger = logger;
          }
          /**
           * 启用或禁用日志记录
           */
          setEnabled(enabled) {
            this.enabled = enabled;
          }
          /**
           * 启用或禁用调试日志
           */
          setDebug(debug) {
            this.debugEnabled = debug;
          }
        }

        /***/
      },

    /***/ './src/storage/storage-manager.ts':
      /*!****************************************!*\
  !*** ./src/storage/storage-manager.ts ***!
  \****************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);
        /* harmony export */ __webpack_require__.d(__webpack_exports__, {
          /* harmony export */ StorageManager: () => /* binding */ StorageManager,
          /* harmony export */
        });
        /* harmony import */ var _file_chunk_uploader_types__WEBPACK_IMPORTED_MODULE_0__ =
          __webpack_require__(/*! @file-chunk-uploader/types */ '../types/dist/index.esm.js');
        /* harmony import */ var _indexed_db_adapter__WEBPACK_IMPORTED_MODULE_1__ =
          __webpack_require__(/*! ./indexed-db-adapter */ './src/storage/indexed-db-adapter.ts');
        /* harmony import */ var _storage_logger__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(
          /*! ./storage-logger */ './src/storage/storage-logger.ts',
        );

        /**
         * StorageManager 实现
         * 提供对断点续传相关数据的管理功能
         */
        class StorageManager {
          /**
           * 创建StorageManager实例
           * @param options 存储选项
           */
          constructor(options = {}) {
            this.autoClearInterval = null;
            this.options = {
              type: _file_chunk_uploader_types__WEBPACK_IMPORTED_MODULE_0__.StorageType.INDEXED_DB,
              dbName: 'file-chunk-uploader',
              storeName: 'uploads',
              keyPrefix: '',
              expiration: 7 * 24 * 60 * 60 * 1000, // 默认保存7天
              enabled: true,
              autoClear: true,
              clearInterval: 30 * 60 * 1000, // 默认每30分钟清理一次过期数据
              ...options,
            };
            // 初始化日志记录器
            this.logger = new _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageLogger(
              undefined,
              {
                enabled: this.options.enabled,
                debug: false,
              },
            );
            this.adapter = this.createAdapter();
            this.setupAutoClear();
          }
          /**
           * 保存上传状态
           * @param fileId 文件ID
           * @param state 上传状态
           */
          async saveUploadState(fileId, state) {
            if (!this.options.enabled) {
              return;
            }
            const key = `state_${fileId}`;
            const startTime = performance.now();
            try {
              await this.adapter.save(key, state, this.options.expiration);
              // 记录操作日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.SAVE,
                key,
                {
                  success: true,
                  duration: performance.now() - startTime,
                  size: this.estimateObjectSize(state),
                },
              );
            } catch (error) {
              // 记录错误日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.SAVE,
                key,
                {
                  success: false,
                  duration: performance.now() - startTime,
                  error: error,
                },
              );
              console.error('保存上传状态失败:', error);
              throw new Error(`保存上传状态失败: ${error.message}`);
            }
          }
          /**
           * 保存文件分片
           * @param fileId 文件ID
           * @param chunkIndex 分片索引
           * @param chunk 分片数据
           */
          async saveChunk(fileId, chunkIndex, chunk) {
            if (!this.options.enabled) {
              return;
            }
            const key = `chunk_${fileId}_${chunkIndex}`;
            const startTime = performance.now();
            try {
              await this.adapter.save(key, chunk, this.options.expiration);
              // 记录操作日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.SAVE,
                key,
                {
                  success: true,
                  duration: performance.now() - startTime,
                  size: chunk.size,
                },
              );
            } catch (error) {
              // 记录错误日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.SAVE,
                key,
                {
                  success: false,
                  duration: performance.now() - startTime,
                  error: error,
                },
              );
              console.error(`保存分片${chunkIndex}失败:`, error);
              throw new Error(`保存分片失败: ${error.message}`);
            }
          }
          /**
           * 获取上传状态
           * @param fileId 文件ID
           * @returns 上传状态或null
           */
          async getUploadState(fileId) {
            if (!this.options.enabled) {
              return null;
            }
            const key = `state_${fileId}`;
            const startTime = performance.now();
            try {
              const result = await this.adapter.get(key);
              // 记录操作日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.GET,
                key,
                {
                  success: true,
                  duration: performance.now() - startTime,
                  size: result ? this.estimateObjectSize(result) : 0,
                },
              );
              return result;
            } catch (error) {
              // 记录错误日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.GET,
                key,
                {
                  success: false,
                  duration: performance.now() - startTime,
                  error: error,
                },
              );
              console.error('获取上传状态失败:', error);
              return null;
            }
          }
          /**
           * 获取文件分片
           * @param fileId 文件ID
           * @param chunkIndex 分片索引
           * @returns 分片数据或null
           */
          async getChunk(fileId, chunkIndex) {
            if (!this.options.enabled) {
              return null;
            }
            const key = `chunk_${fileId}_${chunkIndex}`;
            const startTime = performance.now();
            try {
              const result = await this.adapter.get(key);
              // 记录操作日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.GET,
                key,
                {
                  success: true,
                  duration: performance.now() - startTime,
                  size: result?.size || 0,
                },
              );
              return result;
            } catch (error) {
              // 记录错误日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.GET,
                key,
                {
                  success: false,
                  duration: performance.now() - startTime,
                  error: error,
                },
              );
              console.error(`获取分片${chunkIndex}失败:`, error);
              return null;
            }
          }
          /**
           * 获取文件的所有分片索引
           * @param fileId 文件ID
           * @returns 分片索引数组
           */
          async getChunkIndices(fileId) {
            if (!this.options.enabled) {
              return [];
            }
            const prefix = `chunk_${fileId}_`;
            const startTime = performance.now();
            try {
              const keys = await this.adapter.keys();
              const indices = keys
                .filter(key => key.startsWith(prefix))
                .map(key => {
                  const index = key.substring(prefix.length);
                  return parseInt(index, 10);
                })
                .filter(index => !isNaN(index))
                .sort((a, b) => a - b); // 确保按索引升序排列
              // 记录操作日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.LIST,
                prefix,
                {
                  success: true,
                  duration: performance.now() - startTime,
                },
              );
              return indices;
            } catch (error) {
              // 记录错误日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.LIST,
                prefix,
                {
                  success: false,
                  duration: performance.now() - startTime,
                  error: error,
                },
              );
              console.error('获取分片索引失败:', error);
              return [];
            }
          }
          /**
           * 删除文件相关数据
           * @param fileId 文件ID
           */
          async deleteFile(fileId) {
            if (!this.options.enabled) {
              return;
            }
            const startTime = performance.now();
            try {
              // 删除状态
              await this.adapter.remove(`state_${fileId}`);
              // 删除重试状态
              await this.adapter.remove(`retry_${fileId}`);
              // 获取并删除所有分片
              const chunkIndices = await this.getChunkIndices(fileId);
              const promises = chunkIndices.map(index =>
                this.adapter.remove(`chunk_${fileId}_${index}`),
              );
              await Promise.all(promises);
              // 记录操作日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.DELETE,
                `file_${fileId}`,
                {
                  success: true,
                  duration: performance.now() - startTime,
                },
              );
            } catch (error) {
              // 记录错误日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.DELETE,
                `file_${fileId}`,
                {
                  success: false,
                  duration: performance.now() - startTime,
                  error: error,
                },
              );
              console.error('删除文件数据失败:', error);
              throw new Error(`删除文件数据失败: ${error.message}`);
            }
          }
          /**
           * 清理过期数据
           * @param _maxAge 最大保存时间(毫秒)
           */
          async cleanupExpiredData(_maxAge) {
            if (!this.options.enabled) {
              return;
            }
            const startTime = performance.now();
            try {
              await this.adapter.clearExpired();
              // 记录操作日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.CLEANUP,
                'expired_data',
                {
                  success: true,
                  duration: performance.now() - startTime,
                },
              );
            } catch (error) {
              // 记录错误日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.CLEANUP,
                'expired_data',
                {
                  success: false,
                  duration: performance.now() - startTime,
                  error: error,
                },
              );
              console.error('清理过期数据失败:', error);
            }
          }
          /**
           * 获取存储使用情况
           * @returns 存储使用情况
           */
          async getStorageUsage() {
            if (!this.options.enabled) {
              return { totalSize: 0, chunkCount: 0, fileCount: 0 };
            }
            const startTime = performance.now();
            try {
              const usage = await this.adapter.getUsage();
              // 记录操作日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.GET,
                'storage_usage',
                {
                  success: true,
                  duration: performance.now() - startTime,
                },
              );
              return usage;
            } catch (error) {
              // 记录错误日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.GET,
                'storage_usage',
                {
                  success: false,
                  duration: performance.now() - startTime,
                  error: error,
                },
              );
              console.error('获取存储使用情况失败:', error);
              return { totalSize: 0, chunkCount: 0, fileCount: 0 };
            }
          }
          /**
           * 获取活跃上传列表
           * @returns 文件ID数组
           */
          async getActiveUploads() {
            if (!this.options.enabled) {
              return [];
            }
            const startTime = performance.now();
            const statePrefix = 'state_';
            try {
              const keys = await this.adapter.keys();
              const fileIds = keys
                .filter(key => key.startsWith(statePrefix))
                .map(key => key.substring(statePrefix.length));
              // 记录操作日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.LIST,
                'active_uploads',
                {
                  success: true,
                  duration: performance.now() - startTime,
                },
              );
              return fileIds;
            } catch (error) {
              // 记录错误日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.LIST,
                'active_uploads',
                {
                  success: false,
                  duration: performance.now() - startTime,
                  error: error,
                },
              );
              console.error('获取活跃上传列表失败:', error);
              return [];
            }
          }
          /**
           * 保存重试状态
           * @param fileId 文件ID
           * @param state 重试状态
           */
          async saveRetryState(fileId, state) {
            if (!this.options.enabled) {
              return;
            }
            const key = `retry_${fileId}`;
            const startTime = performance.now();
            try {
              await this.adapter.save(key, state, this.options.expiration);
              // 记录操作日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.SAVE,
                key,
                {
                  success: true,
                  duration: performance.now() - startTime,
                  size: this.estimateObjectSize(state),
                },
              );
            } catch (error) {
              // 记录错误日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.SAVE,
                key,
                {
                  success: false,
                  duration: performance.now() - startTime,
                  error: error,
                },
              );
              console.error('保存重试状态失败:', error);
              throw new Error(`保存重试状态失败: ${error.message}`);
            }
          }
          /**
           * 获取重试状态
           * @param fileId 文件ID
           * @returns 重试状态或null
           */
          async getRetryState(fileId) {
            if (!this.options.enabled) {
              return null;
            }
            const key = `retry_${fileId}`;
            const startTime = performance.now();
            try {
              const result = await this.adapter.get(key);
              // 记录操作日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.GET,
                key,
                {
                  success: true,
                  duration: performance.now() - startTime,
                  size: result ? this.estimateObjectSize(result) : 0,
                },
              );
              return result;
            } catch (error) {
              // 记录错误日志
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.GET,
                key,
                {
                  success: false,
                  duration: performance.now() - startTime,
                  error: error,
                },
              );
              console.error('获取重试状态失败:', error);
              return null;
            }
          }
          /**
           * 创建存储适配器
           * @returns 存储适配器实例
           */
          createAdapter() {
            const startTime = performance.now();
            try {
              // 如果提供了自定义适配器，则使用它
              if (this.options.adapter) {
                this.logger.logOperation(
                  _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.INIT,
                  'custom_adapter',
                  {
                    success: true,
                    duration: performance.now() - startTime,
                  },
                );
                return this.options.adapter;
              }
              // 根据存储类型创建适配器
              let adapter;
              switch (this.options.type) {
                case _file_chunk_uploader_types__WEBPACK_IMPORTED_MODULE_0__.StorageType.INDEXED_DB:
                  adapter = new _indexed_db_adapter__WEBPACK_IMPORTED_MODULE_1__.IndexedDBAdapter(
                    this.options,
                  );
                  break;
                // 其他适配器类型可以在这里添加
                default:
                  // 默认使用IndexedDB适配器
                  adapter = new _indexed_db_adapter__WEBPACK_IMPORTED_MODULE_1__.IndexedDBAdapter(
                    this.options,
                  );
              }
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.INIT,
                String(this.options.type),
                {
                  success: true,
                  duration: performance.now() - startTime,
                },
              );
              return adapter;
            } catch (error) {
              this.logger.logOperation(
                _storage_logger__WEBPACK_IMPORTED_MODULE_2__.StorageOperation.INIT,
                String(this.options.type),
                {
                  success: false,
                  duration: performance.now() - startTime,
                  error: error,
                },
              );
              throw error;
            }
          }
          /**
           * 设置自动清理过期数据
           */
          setupAutoClear() {
            // 清理之前的计时器
            if (this.autoClearInterval) {
              clearInterval(this.autoClearInterval);
              this.autoClearInterval = null;
            }
            // 如果启用了自动清理且在浏览器环境
            if (this.options.enabled && this.options.autoClear && typeof window !== 'undefined') {
              this.autoClearInterval = setInterval(
                () => {
                  this.cleanupExpiredData().catch(error => {
                    console.error('自动清理过期数据失败:', error);
                  });
                },
                this.options.clearInterval || 30 * 60 * 1000,
              ); // 默认每30分钟
            }
          }
          /**
           * 估算对象大小
           * @param obj 要估算大小的对象
           * @returns 估算的字节大小
           */
          estimateObjectSize(obj) {
            if (obj === null || obj === undefined) return 0;
            // 使用JSON序列化来估算大小
            try {
              return JSON.stringify(obj).length * 2; // UTF-16 编码每个字符2字节
            } catch (error) {
              return 0; // 无法序列化时返回0
            }
          }
          /**
           * 销毁存储管理器，清理资源
           */
          destroy() {
            if (this.autoClearInterval) {
              clearInterval(this.autoClearInterval);
              this.autoClearInterval = null;
            }
          }
          /**
           * 设置日志记录器
           * @param logger 核心包的Logger实例
           */
          setLogger(logger) {
            this.logger.setLogger(logger);
          }
          /**
           * 启用调试日志
           * @param debug 是否启用调试日志
           */
          setDebug(debug) {
            this.logger.setDebug(debug);
          }
        }

        /***/
      },

    /***/ './src/storage/storage-options.ts':
      /*!****************************************!*\
  !*** ./src/storage/storage-options.ts ***!
  \****************************************/
      /***/ (__unused_webpack_module, __webpack_exports__, __webpack_require__) => {
        __webpack_require__.r(__webpack_exports__);

        /***/
      },

    /******/
  };
  /************************************************************************/
  /******/ // The module cache
  /******/ var __webpack_module_cache__ = {};
  /******/
  /******/ // The require function
  /******/ function __webpack_require__(moduleId) {
    /******/ // Check if module is in cache
    /******/ var cachedModule = __webpack_module_cache__[moduleId];
    /******/ if (cachedModule !== undefined) {
      /******/ return cachedModule.exports;
      /******/
    }
    /******/ // Create a new module (and put it into the cache)
    /******/ var module = (__webpack_module_cache__[moduleId] = {
      /******/ // no module.id needed
      /******/ // no module.loaded needed
      /******/ exports: {},
      /******/
    });
    /******/
    /******/ // Execute the module function
    /******/ __webpack_modules__[moduleId](module, module.exports, __webpack_require__);
    /******/
    /******/ // Return the exports of the module
    /******/ return module.exports;
    /******/
  }
  /******/
  /************************************************************************/
  /******/ /* webpack/runtime/define property getters */
  /******/ (() => {
    /******/ // define getter functions for harmony exports
    /******/ __webpack_require__.d = (exports, definition) => {
      /******/ for (var key in definition) {
        /******/ if (
          __webpack_require__.o(definition, key) &&
          !__webpack_require__.o(exports, key)
        ) {
          /******/ Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
          /******/
        }
        /******/
      }
      /******/
    };
    /******/
  })();
  /******/
  /******/ /* webpack/runtime/hasOwnProperty shorthand */
  /******/ (() => {
    /******/ __webpack_require__.o = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
    /******/
  })();
  /******/
  /******/ /* webpack/runtime/make namespace object */
  /******/ (() => {
    /******/ // define __esModule on exports
    /******/ __webpack_require__.r = exports => {
      /******/ if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
        /******/ Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
        /******/
      }
      /******/ Object.defineProperty(exports, '__esModule', { value: true });
      /******/
    };
    /******/
  })();
  /******/
  /************************************************************************/
  var __webpack_exports__ = {};
  // This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
  (() => {
    /*!*****************************************!*\
  !*** ./examples/basic-resume-upload.ts ***!
  \*****************************************/
    __webpack_require__.r(__webpack_exports__);
    /* harmony import */ var _file_chunk_uploader_core_src_events__WEBPACK_IMPORTED_MODULE_1__ =
      __webpack_require__(
        /*! @file-chunk-uploader/core/src/events */ '../core/src/events/event-emitter.ts',
      );
    /* harmony import */ var _src__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(
      /*! ../src */ './src/index.ts',
    );
    /**
     * @file-chunk-uploader/resume 基本使用示例
     * 演示如何使用断点续传功能上传文件
     */

    // 模拟上传端点URL
    // const _UPLOAD_URL = 'https://api.example.com/upload';
    /**
     * 模拟HTTP请求上传分片
     * @param chunk 分片数据
     * @param index 分片索引
     * @param fileId 文件ID
     */
    async function uploadChunk(chunk, index, fileId) {
      // 创建FormData
      const formData = new FormData();
      formData.append('chunk', chunk);
      formData.append('index', String(index));
      formData.append('fileId', fileId);
      // 模拟上传，实际应用中使用fetch或其他HTTP客户端
      logToUI(`上传分片 ${index} (${chunk.size} bytes)...`);
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
      // 模拟偶发性失败（仅用于演示失败恢复）
      if (Math.random() < 0.1) {
        throw new Error(`分片 ${index} 上传失败（模拟错误）`);
      }
      logToUI(`分片 ${index} 上传成功`, 'success');
    }
    /**
     * 模拟API合并请求
     * @param fileId 文件ID
     * @param totalChunks 分片总数
     */
    async function mergeChunks(fileId, totalChunks) {
      logToUI(`请求服务器合并 ${totalChunks} 个分片...`);
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 1000));
      logToUI('文件合并成功，上传完成', 'success');
    }
    /**
     * 演示断点续传功能
     * @param file 要上传的文件
     */
    async function demonstrateResumeUpload(file) {
      // 使用全局事件总线或创建新的事件发射器
      const myEventEmitter =
        new _file_chunk_uploader_core_src_events__WEBPACK_IMPORTED_MODULE_1__.EventEmitter();
      // 禁用上传按钮
      const uploadButton = document.getElementById('uploadButton');
      uploadButton.disabled = true;
      // 设置事件监听器
      setupEventListeners(myEventEmitter);
      // 创建续传策略
      const resumeStrategy = new _src__WEBPACK_IMPORTED_MODULE_0__.ResumeUploadStrategy({
        storage: {
          dbName: 'resume-upload-demo',
          storeName: 'file-uploads',
          version: 1,
        },
        maxConcurrentChunks: 3,
        logger: console,
      });
      // 设置事件发射器
      resumeStrategy.setEventEmitter(myEventEmitter);
      try {
        // 生成文件ID - 这里使用简单的哈希函数生成ID
        const fileId = generateFileId(file);
        logToUI(`文件ID: ${fileId}`);
        // 检查是否有已保存的上传状态
        const hasState = await checkHasUploadState(resumeStrategy, fileId);
        if (hasState) {
          // 恢复上传
          logToUI('发现已保存的上传状态，准备恢复上传...', 'info');
          // 获取上传状态
          const uploadState = await getUploadState(resumeStrategy, fileId);
          logToUI(
            `恢复上传 "${file.name}"，` +
              `已完成: ${uploadState?.uploadedChunks?.length || 0}/${
                uploadState?.totalChunks || 0
              } 分片`,
          );
          // 处理文件
          const fileInfo = await processFile(file);
          // 更新进度条
          const initialProgress =
            ((uploadState?.uploadedChunks?.length || 0) / fileInfo.totalChunks) * 100;
          updateProgressBar(initialProgress);
          // 上传剩余分片
          await uploadRemainingChunks(
            resumeStrategy,
            fileId,
            fileInfo.chunks,
            uploadState?.uploadedChunks || [],
          );
        } else {
          // 开始新上传
          logToUI(`开始新上传: "${file.name}" (${formatSize(file.size)})`, 'info');
          // 处理文件
          const fileInfo = await processFile(file);
          logToUI(
            `文件已分为 ${fileInfo.totalChunks} 个分片，每个分片大小约为 ${formatSize(
              fileInfo.chunkSize,
            )}`,
          );
          // 上传所有分片
          await uploadRemainingChunks(resumeStrategy, fileId, fileInfo.chunks, []);
        }
        // 完成上传，清理存储
        await resumeStrategy.completeUpload(fileId);
        // 模拟调用API合并分片
        await mergeChunks(fileId, file.size);
        // 更新UI
        updateProgressBar(100);
        logToUI('上传完成！', 'success');
      } catch (error) {
        logToUI(`上传过程中发生错误: ${error.message}`, 'error');
        console.error('上传过程中发生错误:', error);
      } finally {
        // 销毁资源
        resumeStrategy.destroy();
        // 恢复上传按钮
        uploadButton.disabled = false;
      }
    }
    /**
     * 检查是否有上传状态
     * @param resumeStrategy 续传策略实例
     * @param fileId 文件ID
     */
    async function checkHasUploadState(resumeStrategy, fileId) {
      // 由于storageManager是私有的，我们可以通过公开的API检查是否存在上传状态
      // 这里使用resumeStrategy提供的公开方法或属性
      const state = await getUploadState(resumeStrategy, fileId);
      return !!state;
    }
    /**
     * 获取上传状态
     * @param resumeStrategy 续传策略实例
     * @param fileId 文件ID
     */
    async function getUploadState(resumeStrategy, fileId) {
      // 这里使用resumeStrategy提供的公开方法获取上传状态
      // 假设通过getChunksDetails可以获取到分片详情
      try {
        const chunksDetails = await resumeStrategy.getChunksDetails(fileId);
        if (chunksDetails && chunksDetails.length > 0) {
          // 提取已上传的分片索引
          const uploadedChunks = chunksDetails
            .filter(chunk => chunk.status === _src__WEBPACK_IMPORTED_MODULE_0__.ChunkStatus.SUCCESS)
            .map(chunk => chunk.index);
          return {
            uploadedChunks,
            totalChunks: chunksDetails.length,
          };
        }
      } catch (error) {
        console.log('获取上传状态失败:', error);
      }
      return null;
    }
    /**
     * 处理文件，将文件分为多个分片
     * @param file 文件对象
     * @returns 分片结果
     */
    async function processFile(file) {
      // 分片大小 1MB
      const chunkSize = 1024 * 1024;
      const chunks = [];
      // 分片处理
      for (let start = 0; start < file.size; start += chunkSize) {
        const end = Math.min(start + chunkSize, file.size);
        const chunk = file.slice(start, end);
        chunks.push(chunk);
      }
      return {
        chunks,
        totalChunks: chunks.length,
        chunkSize,
      };
    }
    /**
     * 生成文件ID
     * @param file 文件对象
     * @returns 文件ID
     */
    function generateFileId(file) {
      // 使用文件名、大小和最后修改时间组合生成ID
      const hashInput = `${file.name}-${file.size}-${file.lastModified}`;
      // 简单哈希函数
      let hash = 0;
      for (let i = 0; i < hashInput.length; i++) {
        const char = hashInput.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // 转换为32位整数
      }
      return Math.abs(hash).toString(16);
    }
    /**
     * 上传剩余的文件分片
     * @param resumeStrategy 续传策略实例
     * @param fileId 文件ID
     * @param chunks 所有分片
     * @param uploadedChunks 已上传的分片索引
     */
    async function uploadRemainingChunks(resumeStrategy, fileId, chunks, uploadedChunks) {
      // 创建已上传分片集合，便于快速查找
      const uploadedSet = new Set(uploadedChunks);
      // 使用Promise.all并行上传，但限制并发数
      const concurrency = 3;
      let pending = 0;
      const promises = [];
      // 更新进度条计算基础
      let completedChunks = uploadedChunks.length;
      const totalChunks = chunks.length;
      // 更新初始进度
      updateProgressBar((completedChunks / totalChunks) * 100);
      for (let i = 0; i < chunks.length; i++) {
        // 跳过已上传的分片
        if (uploadedSet.has(i)) {
          logToUI(`分片 ${i} 已上传，跳过`);
          continue;
        }
        // 等待并发控制
        if (pending >= concurrency) {
          await Promise.race(promises);
        }
        // 上传分片
        pending++;
        const promise = (async index => {
          try {
            await uploadChunk(chunks[index], index, fileId);
            // 保存上传进度
            await resumeStrategy.updateChunkStatus(
              fileId,
              index,
              _src__WEBPACK_IMPORTED_MODULE_0__.ChunkStatus.SUCCESS,
            );
            // 更新计数器和进度条
            pending--;
            completedChunks++;
            updateProgressBar((completedChunks / totalChunks) * 100);
          } catch (error) {
            pending--;
            // 记录失败，但不中断其他上传
            logToUI(`分片 ${index} 上传失败: ${error.message}`, 'error');
            await resumeStrategy.updateChunkStatus(
              fileId,
              index,
              _src__WEBPACK_IMPORTED_MODULE_0__.ChunkStatus.FAILED,
              error.message,
            );
            // 重新抛出错误
            throw error;
          }
        })(i);
        // 添加到Promise数组
        promises.push(promise);
      }
      // 等待所有上传完成
      await Promise.allSettled(promises);
      // 检查是否有失败的Promise
      const failedCount = promises.length - uploadedChunks.length;
      if (failedCount > 0) {
        throw new Error(`${failedCount} 个分片上传失败，使用断点续传功能可以继续上传`);
      }
    }
    /**
     * 设置事件监听器
     * @param eventEmitter 事件发射器
     */
    function setupEventListeners(eventEmitter) {
      eventEmitter.on('upload:progress', data => {
        logToUI(`上传进度: ${Math.round(data.progress)}%`);
        updateProgressBar(data.progress);
      });
      eventEmitter.on('upload:resume', data => {
        logToUI(
          `续传开始: "${data.fileName}", 已完成: ${data.uploadedChunks.length}/${data.totalChunks} 分片`,
          'info',
        );
      });
      eventEmitter.on('upload:complete', data => {
        logToUI(`上传完成: "${data.fileName}"`, 'success');
        updateProgressBar(100);
      });
      eventEmitter.on('upload:error', data => {
        logToUI(`上传错误: ${data.error.message}`, 'error');
      });
      eventEmitter.on('storage:cleanup', data => {
        logToUI(`清理存储: 删除了 ${data.count} 个过期状态`, 'info');
      });
    }
    /**
     * 更新进度条
     * @param progress 进度值(0-100)
     */
    function updateProgressBar(progress) {
      const progressBar = document.getElementById('progressBar');
      if (progressBar) {
        progressBar.style.width = `${Math.round(progress)}%`;
      }
    }
    /**
     * 向UI日志区域添加日志
     * @param message 日志信息
     * @param type 日志类型
     */
    function logToUI(message, type = 'info') {
      const logArea = document.getElementById('logArea');
      if (logArea) {
        const logEntry = document.createElement('div');
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logEntry.className = `log-entry ${type}`;
        logArea.appendChild(logEntry);
        logArea.scrollTop = logArea.scrollHeight; // 自动滚动到最新日志
        // 同时在控制台输出
        console.log(message);
      }
    }
    /**
     * 格式化文件大小
     * @param bytes 字节数
     */
    function formatSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    // 在DOM加载完成后设置事件处理
    document.addEventListener('DOMContentLoaded', () => {
      const fileInput = document.getElementById('fileInput');
      const uploadButton = document.getElementById('uploadButton');
      const pauseButton = document.getElementById('pauseButton');
      const resumeButton = document.getElementById('resumeButton');
      // 初始化UI
      logToUI('请选择一个文件进行上传', 'info');
      // 上传按钮事件
      uploadButton.addEventListener('click', async () => {
        if (fileInput.files && fileInput.files.length > 0) {
          const file = fileInput.files[0];
          // 启用暂停按钮
          pauseButton.disabled = false;
          try {
            await demonstrateResumeUpload(file);
          } catch (error) {
            logToUI(`上传失败: ${error.message}`, 'error');
          } finally {
            // 禁用暂停按钮
            pauseButton.disabled = true;
          }
        } else {
          logToUI('请先选择文件', 'warning');
        }
      });
      // 文件选择事件
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
          const file = fileInput.files[0];
          logToUI(`已选择文件: ${file.name} (${formatSize(file.size)})`, 'info');
          uploadButton.disabled = false;
        }
      });
      // 暂停按钮和恢复按钮事件 - 在实际应用中实现
      pauseButton.addEventListener('click', () => {
        logToUI('暂停功能在这个简化示例中未实现', 'warning');
      });
      resumeButton.addEventListener('click', () => {
        logToUI('恢复功能在这个简化示例中未实现', 'warning');
      });
    });
  })();

  /******/
})();
//# sourceMappingURL=bundle.js.map
