const { EventEmitter } = require('events');
const Logger = require('../utils/Logger');

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.logger = Logger.getInstance('EventBus');
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.on('error', (error) => {
      this.logger.error('EventBus error occurred', error);
    });
  }

  publish(eventName, data = {}) {
    try {
      this.logger.debug(`Publishing event: ${eventName}`, { data });
      this.emit(eventName, data);
    } catch (error) {
      this.logger.error(`Error publishing event: ${eventName}`, error, { data });
      throw error;
    }
  }

  subscribe(eventName, handler) {
    try {
      this.logger.debug(`Subscribing to event: ${eventName}`);
      this.on(eventName, handler);
    } catch (error) {
      this.logger.error(`Error subscribing to event: ${eventName}`, error);
      throw error;
    }
  }

  unsubscribe(eventName, handler) {
    try {
      this.logger.debug(`Unsubscribing from event: ${eventName}`);
      this.off(eventName, handler);
    } catch (error) {
      this.logger.error(`Error unsubscribing from event: ${eventName}`, error);
      throw error;
    }
  }

  once(eventName, handler) {
    try {
      this.logger.debug(`Subscribing once to event: ${eventName}`);
      super.once(eventName, handler);
    } catch (error) {
      this.logger.error(`Error subscribing once to event: ${eventName}`, error);
      throw error;
    }
  }

  removeAllListeners(eventName) {
    try {
      this.logger.debug(`Removing all listeners for event: ${eventName}`);
      super.removeAllListeners(eventName);
    } catch (error) {
      this.logger.error(`Error removing all listeners for event: ${eventName}`, error);
      throw error;
    }
  }

  getListenerCount(eventName) {
    return this.listenerCount(eventName);
  }

  static getInstance() {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
}

module.exports = EventBus;