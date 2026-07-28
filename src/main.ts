import { TangibleApp } from './app';
import './styles.css';
import './themes.css';

const root = document.querySelector<HTMLElement>('#app');

if (!root) throw new Error('Application root was not found.');

new TangibleApp(root).mount();
