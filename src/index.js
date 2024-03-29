import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom';
import 'bootstrap/dist/css/bootstrap.css';
import './index.css';
// import reportWebVitals from './reportWebVitals';
import smoothscroll from 'smoothscroll-polyfill';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
const App = lazy(() => import('./App'));

smoothscroll.polyfill();


ReactDOM.render(
  <React.StrictMode>
    <Suspense fallback={<div style={{height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', fontWeight: 'bold'}}>載入中...</div>}>
      <App />
    </Suspense>
  </React.StrictMode>,
  document.getElementById('root')
);

serviceWorkerRegistration.register();

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
