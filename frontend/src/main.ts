import './styles/main.scss';
import '@fontsource/readex-pro/400.css';
import '@fontsource/readex-pro/500.css';
import '@fontsource/readex-pro/600.css';
import '@fontsource/readex-pro/700.css';
import { App } from './app/App';
import { setupDom } from './config/dom';

document.addEventListener('DOMContentLoaded', () => {
  setupDom();
  new App();
});
