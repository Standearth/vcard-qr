import { App } from '../app/App';

declare global {
  interface Window {
    appInstance: App;
  }
}
