import { render } from 'preact';
import './data/sprites';
import './styles.css';
import { App } from './ui/App';
import { artReady } from './render/art';

artReady.then(() => render(<App />, document.getElementById('app')!));
