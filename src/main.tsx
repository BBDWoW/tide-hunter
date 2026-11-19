import { render } from 'preact';
import './data/sprites';
import './styles.css';
import { App } from './ui/App';

render(<App />, document.getElementById('app')!);
