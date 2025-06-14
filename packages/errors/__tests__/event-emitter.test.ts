/**
 * 事件发射器测试
 */

import { EventEmitter } from '../src/utils/event-emitter';

describe('EventEmitter', () => {
  let emitter: EventEmitter;

  beforeEach(() => {
    emitter = new EventEmitter();
  });

  test('应该可以注册并触发事件', () => {
    const mockCallback = jest.fn();
    emitter.on('test-event', mockCallback);

    emitter.emit('test-event', 'arg1', 'arg2');
    expect(mockCallback).toHaveBeenCalledWith('arg1', 'arg2');
  });

  test('应该可以注册多个监听器', () => {
    const mockCallback1 = jest.fn();
    const mockCallback2 = jest.fn();

    emitter.on('test-event', mockCallback1);
    emitter.on('test-event', mockCallback2);

    emitter.emit('test-event', 'data');

    expect(mockCallback1).toHaveBeenCalledWith('data');
    expect(mockCallback2).toHaveBeenCalledWith('data');
  });

  test('once 应该只触发一次', () => {
    const mockCallback = jest.fn();

    emitter.once('test-event', mockCallback);

    emitter.emit('test-event', 'first');
    emitter.emit('test-event', 'second');

    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith('first');
  });

  test('off 应该能移除特定监听器', () => {
    const mockCallback1 = jest.fn();
    const mockCallback2 = jest.fn();

    emitter.on('test-event', mockCallback1);
    emitter.on('test-event', mockCallback2);

    emitter.off('test-event', mockCallback1);
    emitter.emit('test-event');

    expect(mockCallback1).not.toHaveBeenCalled();
    expect(mockCallback2).toHaveBeenCalled();
  });

  test('removeAllListeners 应该移除所有监听器', () => {
    const mockCallback1 = jest.fn();
    const mockCallback2 = jest.fn();

    emitter.on('event1', mockCallback1);
    emitter.on('event2', mockCallback2);

    emitter.removeAllListeners();

    emitter.emit('event1');
    emitter.emit('event2');

    expect(mockCallback1).not.toHaveBeenCalled();
    expect(mockCallback2).not.toHaveBeenCalled();
  });

  test('removeAllListeners 可以移除特定事件的所有监听器', () => {
    const mockCallback1 = jest.fn();
    const mockCallback2 = jest.fn();
    const mockCallback3 = jest.fn();

    emitter.on('event1', mockCallback1);
    emitter.on('event1', mockCallback2);
    emitter.on('event2', mockCallback3);

    emitter.removeAllListeners('event1');

    emitter.emit('event1');
    emitter.emit('event2');

    expect(mockCallback1).not.toHaveBeenCalled();
    expect(mockCallback2).not.toHaveBeenCalled();
    expect(mockCallback3).toHaveBeenCalled();
  });

  test('listenerCount 应该返回监听器数量', () => {
    emitter.on('event1', () => {});
    emitter.on('event1', () => {});
    emitter.on('event2', () => {});

    expect(emitter.listenerCount('event1')).toBe(2);
    expect(emitter.listenerCount('event2')).toBe(1);
    expect(emitter.listenerCount('event3')).toBe(0);
  });

  test('listeners 应该返回所有监听器', () => {
    const callback1 = () => {};
    const callback2 = () => {};

    emitter.on('event', callback1);
    emitter.on('event', callback2);

    const listeners = emitter.listeners('event');

    expect(listeners).toHaveLength(2);
    expect(listeners).toContain(callback1);
    expect(listeners).toContain(callback2);
  });

  test('emit 应该返回是否有监听器', () => {
    const hasListeners = emitter.emit('no-listeners');
    expect(hasListeners).toBe(false);

    emitter.on('has-listeners', () => {});
    const hasListenersNow = emitter.emit('has-listeners');
    expect(hasListenersNow).toBe(true);
  });

  test('on 应该返回取消订阅函数', () => {
    const mockCallback = jest.fn();

    const unsubscribe = emitter.on('test-event', mockCallback);
    emitter.emit('test-event', 'before');

    unsubscribe();

    emitter.emit('test-event', 'after');

    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback).toHaveBeenCalledWith('before');
  });
});
