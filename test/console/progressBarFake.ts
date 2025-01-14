/* eslint-disable class-methods-use-this */

import ProgressBar from '../../src/console/progressBar.js';

export default class ProgressBarFake extends ProgressBar {
  delete(): void {
  }

  async done(): Promise<void> {
    return Promise.resolve();
  }

  setWaitingMessage(): NodeJS.Timeout {
    return setTimeout(() => {});
  }

  async increment(): Promise<void> {
    return Promise.resolve();
  }

  withLoggerPrefix(): ProgressBar {
    return this;
  }

  async log(): Promise<void> {
    return Promise.resolve();
  }

  async reset(): Promise<void> {
    return Promise.resolve();
  }

  async setSymbol(): Promise<void> {
    return Promise.resolve();
  }

  async freeze(): Promise<void> {
    return Promise.resolve();
  }

  async update(): Promise<void> {
    return Promise.resolve();
  }
}
